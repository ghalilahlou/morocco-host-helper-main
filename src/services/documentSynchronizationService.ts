import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

/**
 * Service de synchronisation unifié pour les documents et réservations
 * Résout les problèmes de liaison entre documents et réservations
 */
export class DocumentSynchronizationService {
  
  /**
   * Synchroniser les documents d'identité avec une réservation
   * Assure que chaque document est correctement lié à la bonne réservation
   */
  static async synchronizeIdentityDocuments(bookingId: string): Promise<{
    success: boolean;
    message: string;
    documentsCount: number;
  }> {
    try {
      console.log('🔄 Synchronisation des documents d\'identité pour la réservation:', bookingId);
      
      // 1. Récupérer tous les documents d'identité pour cette réservation
      const { data: identityDocs, error: docsError } = await supabase
        .from('uploaded_documents')
        .select(`
          *,
          guests(full_name, document_number, nationality)
        `)
        .eq('booking_id', bookingId)
        .eq('document_type', 'identity');
      
      if (docsError) {
        console.error('❌ Erreur récupération documents d\'identité:', docsError);
        return { success: false, message: 'Erreur lors de la récupération des documents', documentsCount: 0 };
      }
      
      // 2. Récupérer les invités de la réservation
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (guestsError) {
        console.error('❌ Erreur récupération invités:', guestsError);
        return { success: false, message: 'Erreur lors de la récupération des invités', documentsCount: 0 };
      }
      
      // 3. Vérifier la cohérence des documents avec les invités
      let synchronizedCount = 0;
      const inconsistencies: string[] = [];
      
      for (const guest of guests || []) {
        const guestDocs = identityDocs?.filter(doc => 
          doc.guest_id === guest.id || 
          (doc.extracted_data as any)?.guest_name === guest.full_name
        );
        
        if (!guestDocs || guestDocs.length === 0) {
          inconsistencies.push(`Aucun document d'identité trouvé pour ${guest.full_name}`);
        } else {
          synchronizedCount += guestDocs.length;
          console.log(`✅ ${guestDocs.length} document(s) trouvé(s) pour ${guest.full_name}`);
        }
      }
      
      // 4. Vérifier les documents orphelins (non liés à un invité)
      const orphanDocs = identityDocs?.filter(doc => 
        !doc.guest_id && !guests?.some(guest => 
          (doc.extracted_data as any)?.guest_name === guest.full_name
        )
      );
      
      if (orphanDocs && orphanDocs.length > 0) {
        console.warn(`⚠️ ${orphanDocs.length} document(s) orphelin(s) détecté(s)`);
        inconsistencies.push(`${orphanDocs.length} document(s) orphelin(s) non lié(s) à un invité`);
      }
      
      const message = inconsistencies.length > 0 
        ? `Synchronisation partielle: ${synchronizedCount} documents synchronisés, ${inconsistencies.length} problème(s) détecté(s)`
        : `Synchronisation réussie: ${synchronizedCount} documents correctement liés`;
      
      console.log('✅ Synchronisation terminée:', message);
      
      return {
        success: inconsistencies.length === 0,
        message,
        documentsCount: synchronizedCount
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      return { 
        success: false, 
        message: 'Erreur lors de la synchronisation des documents', 
        documentsCount: 0 
      };
    }
  }
  
  /**
   * Nettoyer les documents orphelins ou dupliqués
   */
  static async cleanupOrphanDocuments(bookingId: string): Promise<{
    success: boolean;
    message: string;
    cleanedCount: number;
  }> {
    try {
      console.log('🧹 Nettoyage des documents orphelins pour la réservation:', bookingId);
      
      // 1. Identifier les documents orphelins
      const { data: allDocs, error: docsError } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (docsError) {
        console.error('❌ Erreur récupération documents:', docsError);
        return { success: false, message: 'Erreur lors de la récupération des documents', cleanedCount: 0 };
      }
      
      // 2. Identifier les documents dupliqués (même nom de fichier, même type)
      const duplicates = new Map<string, any[]>();
      const toDelete: string[] = [];
      
      for (const doc of allDocs || []) {
        const key = `${doc.document_type}_${doc.file_name}`;
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(doc);
      }
      
      // 3. Marquer les doublons pour suppression (garder le plus récent)
      for (const [key, docs] of duplicates) {
        if (docs.length > 1) {
          // Trier par date de création (plus récent en premier)
          docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          // Marquer tous sauf le premier (le plus récent) pour suppression
          for (let i = 1; i < docs.length; i++) {
            toDelete.push(docs[i].id);
          }
        }
      }
      
      // 4. Supprimer les doublons
      let cleanedCount = 0;
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('uploaded_documents')
          .delete()
          .in('id', toDelete);
        
        if (deleteError) {
          console.error('❌ Erreur suppression doublons:', deleteError);
          return { success: false, message: 'Erreur lors de la suppression des doublons', cleanedCount: 0 };
        }
        
        cleanedCount = toDelete.length;
        console.log(`✅ ${cleanedCount} document(s) dupliqué(s) supprimé(s)`);
      }
      
      const message = cleanedCount > 0 
        ? `Nettoyage réussi: ${cleanedCount} document(s) dupliqué(s) supprimé(s)`
        : 'Aucun document dupliqué trouvé';
      
      return {
        success: true,
        message,
        cleanedCount
      };
      
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error);
      return { 
        success: false, 
        message: 'Erreur lors du nettoyage des documents', 
        cleanedCount: 0 
      };
    }
  }
  
  /**
   * Vérifier l'intégrité des documents pour une réservation
   */
  static async verifyDocumentIntegrity(bookingId: string): Promise<{
    success: boolean;
    message: string;
    issues: string[];
    summary: {
      totalDocuments: number;
      identityDocuments: number;
      contractDocuments: number;
      policeDocuments: number;
      orphanDocuments: number;
    };
  }> {
    try {
      console.log('🔍 Vérification de l\'intégrité des documents pour la réservation:', bookingId);
      
      // 1. Récupérer tous les documents
      const { data: allDocs, error: docsError } = await supabase
        .from('uploaded_documents')
        .select(`
          *,
          guests(full_name, document_number)
        `)
        .eq('booking_id', bookingId);
      
      if (docsError) {
        console.error('❌ Erreur récupération documents:', docsError);
        return { 
          success: false, 
          message: 'Erreur lors de la récupération des documents', 
          issues: ['Erreur de base de données'],
          summary: { totalDocuments: 0, identityDocuments: 0, contractDocuments: 0, policeDocuments: 0, orphanDocuments: 0 }
        };
      }
      
      // 2. Récupérer les invités
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (guestsError) {
        console.error('❌ Erreur récupération invités:', guestsError);
        return { 
          success: false, 
          message: 'Erreur lors de la récupération des invités', 
          issues: ['Erreur de base de données'],
          summary: { totalDocuments: 0, identityDocuments: 0, contractDocuments: 0, policeDocuments: 0, orphanDocuments: 0 }
        };
      }
      
      // 3. Analyser les documents
      const issues: string[] = [];
      const summary = {
        totalDocuments: allDocs?.length || 0,
        identityDocuments: 0,
        contractDocuments: 0,
        policeDocuments: 0,
        orphanDocuments: 0
      };
      
      for (const doc of allDocs || []) {
        // Compter par type
        switch (doc.document_type) {
          case 'identity':
            summary.identityDocuments++;
            break;
          case 'contract':
            summary.contractDocuments++;
            break;
          case 'police':
            summary.policeDocuments++;
            break;
        }
        
        // Vérifier les documents orphelins
        if (doc.document_type === 'identity' && !doc.guest_id) {
          summary.orphanDocuments++;
          issues.push(`Document d'identité orphelin: ${doc.file_name}`);
        }
        
        // Vérifier les documents sans URL
        if (!doc.document_url) {
          issues.push(`Document sans URL: ${doc.file_name}`);
        }
        
        // Vérifier les documents avec statut d'erreur
        if (doc.processing_status === 'error') {
          issues.push(`Document en erreur: ${doc.file_name}`);
        }
      }
      
      // 4. Vérifier la cohérence avec les invités
      for (const guest of guests || []) {
        const guestDocs = allDocs?.filter(doc => 
          doc.guest_id === guest.id || 
          (doc.extracted_data as any)?.guest_name === guest.full_name
        );
        
        if (!guestDocs || guestDocs.length === 0) {
          issues.push(`Aucun document d'identité pour l'invité: ${guest.full_name}`);
        }
      }
      
      const success = issues.length === 0;
      const message = success 
        ? `Intégrité vérifiée: ${summary.totalDocuments} documents correctement liés`
        : `${issues.length} problème(s) détecté(s) dans les documents`;
      
      console.log('✅ Vérification terminée:', message);
      
      return {
        success,
        message,
        issues,
        summary
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la vérification:', error);
      return { 
        success: false, 
        message: 'Erreur lors de la vérification de l\'intégrité', 
        issues: ['Erreur système'],
        summary: { totalDocuments: 0, identityDocuments: 0, contractDocuments: 0, policeDocuments: 0, orphanDocuments: 0 }
      };
    }
  }
  
  /**
   * Réparer automatiquement les problèmes détectés
   */
  static async repairDocumentIssues(bookingId: string): Promise<{
    success: boolean;
    message: string;
    repairs: string[];
  }> {
    try {
      console.log('🔧 Réparation automatique des problèmes de documents pour la réservation:', bookingId);
      
      const repairs: string[] = [];
      
      // 1. Nettoyer les doublons
      const cleanupResult = await this.cleanupOrphanDocuments(bookingId);
      if (cleanupResult.success && cleanupResult.cleanedCount > 0) {
        repairs.push(`Nettoyage: ${cleanupResult.cleanedCount} document(s) dupliqué(s) supprimé(s)`);
      }
      
      // 2. Synchroniser les documents d'identité
      const syncResult = await this.synchronizeIdentityDocuments(bookingId);
      if (syncResult.success) {
        repairs.push(`Synchronisation: ${syncResult.documentsCount} document(s) synchronisé(s)`);
      }
      
      // 3. Vérifier l'intégrité après réparation
      const integrityResult = await this.verifyDocumentIntegrity(bookingId);
      
      const success = integrityResult.success;
      const message = success 
        ? `Réparation réussie: ${repairs.length} opération(s) effectuée(s)`
        : `Réparation partielle: ${repairs.length} opération(s) effectuée(s), ${integrityResult.issues.length} problème(s) restant(s)`;
      
      console.log('✅ Réparation terminée:', message);
      
      return {
        success,
        message,
        repairs
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la réparation:', error);
      return { 
        success: false, 
        message: 'Erreur lors de la réparation automatique', 
        repairs: [] 
      };
    }
  }
}
