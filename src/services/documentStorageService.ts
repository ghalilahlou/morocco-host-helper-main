import { supabase } from '@/integrations/supabase/client';
import { DocumentStorageResult, DocumentMetadata, UnifiedDocument } from '@/types/document';
import { Booking } from '@/types/booking';

/**
 * Unified document storage service that handles both host and guest documents
 * Eliminates duplication between uploaded_documents and guest_submissions
 */
/**
 * Normalize guest names to handle different formats and encoding
 */
function normName(s?: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[^\p{L}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract guest name from various possible formats
 */
function extractGuestName(guest: any): string {
  // Try fullName first
  if (guest.fullName) return guest.fullName;
  if (guest.full_name) return guest.full_name;
  
  // Try firstName + lastName combination
  if (guest.firstName && guest.lastName) {
    return `${guest.firstName} ${guest.lastName}`;
  }
  
  // Try given_names + surname for submissions
  if (guest.given_names && guest.surname) {
    return `${guest.given_names} ${guest.surname}`;
  }
  
  return '';
}

export class DocumentStorageService {
  /**
   * Store a document file inside the `guest-documents` bucket,
   * register the document in `uploaded_documents`, and return its path/public URL.
   */
  static async storeDocument(
    file: File,
    metadata: DocumentMetadata
  ): Promise<DocumentStorageResult> {
    try {
      console.log('📄 DocumentStorageService - Uploading document to storage:', {
        fileName: file.name,
        bookingId: metadata.bookingId,
        size: file.size
      });

      // Generate deterministic storage path per booking to keep files grouped
      const timestamp = Date.now();
      // ✅ CORRECTION : Nettoyer le nom de fichier (enlever espaces et caractères spéciaux)
      const cleanFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/[^\w.-]/g, '_') // Remplacer caractères spéciaux par underscore
        .replace(/_{2,}/g, '_'); // Éviter les underscores multiples
      const filePath = `${metadata.bookingId}/${timestamp}_${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('guest-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        return { success: false, error: uploadError.message };
      }

      console.log('✅ File uploaded successfully:', { filePath });

      // Generate a public URL (bucket is public)
      const { data: publicData } = supabase.storage
        .from('guest-documents')
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        console.warn('⚠️ Unable to generate public URL, consumers must sign the path later.');
      }

      // Register the document in uploaded_documents for host visibility (persistance pièce d'identité / contrat / police)
      let insertError: string | undefined;
      try {
        const documentRecord = {
          booking_id: metadata.bookingId,
          guest_id: metadata.guestId || null,
          document_type: metadata.documentType || 'identity_upload',
          file_name: metadata.fileName,
          file_path: filePath,
          document_url: publicUrl || null,
          extracted_data: metadata.extractedData || null,
          processing_status: 'uploaded',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('uploaded_documents').insert(documentRecord);
        if (error) {
          insertError = error.message;
          console.warn('⚠️ Unable to insert uploaded_documents record:', error);
        } else {
          console.log('✅ Document metadata stored in uploaded_documents');
        }
      } catch (dbError) {
        insertError = dbError instanceof Error ? dbError.message : String(dbError);
        console.warn('⚠️ Unable to insert uploaded_documents record:', dbError);
      }

      if (insertError) {
        return { success: false, error: insertError };
      }

      return {
        success: true,
        filePath,
        documentUrl: publicUrl || undefined
      };
    } catch (error) {
      console.error('❌ Document storage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all documents for a booking (unified from all sources)
   */
  static async getDocumentsForBooking(booking: Booking): Promise<UnifiedDocument[]> {
    try {
      console.log('📋 DocumentStorageService - Getting documents for booking:', {
        id: booking.id,
        bookingReference: booking.bookingReference,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        propertyId: booking.property?.id,
        guestCount: booking.guests?.length || 0,
        createdAt: booking.createdAt
      });

      const documents: UnifiedDocument[] = [];

      // Get from uploaded_documents table (primary source)
      const { data: uploadedDocs, error: uploadError } = await supabase
        .from('uploaded_documents')
        .select(`
          id,
          file_name,
          document_url,
          file_path,
          created_at,
          guest_id,
          guests(full_name),
          extracted_data
        `)
        .eq('booking_id', booking.id);

      if (uploadError) {
        console.error('❌ Error loading uploaded documents:', uploadError);
      } else if (uploadedDocs && uploadedDocs.length > 0) {
        for (const doc of uploadedDocs) {
          let documentUrl = doc.document_url;

          // If no document_url but we have file_path, create signed URL
          if (!documentUrl && doc.file_path) {
            try {
              const { data: signedUrlData } = await supabase.functions.invoke('storage-sign-url', {
                body: { bucket: 'guest-documents', path: doc.file_path, expiresIn: 3600 }
              });
              
              if (signedUrlData?.signedUrl) {
                documentUrl = signedUrlData.signedUrl;
              }
            } catch (error) {
              console.error('❌ Error creating signed URL:', error);
            }
          }

          if (documentUrl) {
            // Try to get guest name from multiple sources
            let guestName = (doc as any).guests?.full_name;
            
            // If no guest associated, try to get from extracted data
            if (!guestName && doc.extracted_data && typeof doc.extracted_data === 'object') {
              const extractedData = doc.extracted_data as any;
              guestName = extractedData.fullName || 
                         extractedData.full_name ||
                         extractedData.name;
            }

            documents.push({
              id: String(doc.id),
              fileName: doc.file_name,
              url: documentUrl,
              guestName: guestName || undefined,
              bookingId: booking.id,
              createdAt: doc.created_at
            });
          }
        }
      }

      // ✅ PHASE 1 - DÉSACTIVÉ : Fallback storage.list (ANALYSE_PERFORMANCE_STORAGE_GUEST_DOCUMENTS.md)
      // Les appels .list() sur guest-documents saturaient la table objects. La DB est la source de vérité.
      // if (documents.length === 0) { ... storage.list(booking.id) ... }

      // Extract and normalize guest names from booking before calling edge function
      const bookingGuests = (booking as any).guests || [];
      const fromBookingGuests: string[] = [];
      
      console.log('📋 Raw booking guests data:', bookingGuests);
      
      // Extract names from booking guests using multiple formats
      bookingGuests.forEach((guest: any, index: number) => {
        console.log(`📋 Processing guest ${index}:`, guest);
        const extractedName = extractGuestName(guest);
        if (extractedName) {
          fromBookingGuests.push(extractedName);
          console.log(`📋 Extracted booking guest name: "${extractedName}"`);
        }
      });
      
      // Build normalized candidate names from booking guests
      const uniqueNames = Array.from(new Set(
        fromBookingGuests.map(normName).filter(Boolean)
      ));
      
      console.log('📋 Final booking guest names for filtering:', uniqueNames);

      // ✅ CORRECTION : Utiliser uniquement uploaded_documents comme source principale
      // Les documents d'identité sont maintenant correctement sauvegardés dans uploaded_documents
      // via l'Edge Function submit-guest-info corrigée
      
      console.log('📋 Documents d\'identité récupérés depuis uploaded_documents (source principale)');
      console.log(`✅ ${documents.length} documents trouvés pour cette réservation`);

      console.log(`✅ Found ${documents.length} documents for booking`);
      return documents;

    } catch (error) {
      console.error('❌ Error getting documents:', error);
      return [];
    }
  }
  
  /**
   * Delete all uploaded_documents records for a booking (keeps storage files for safety)
   */
  static async deleteDocumentsForBooking(bookingId: string): Promise<void> {
    try {
      console.log('🧹 Deleting uploaded_documents for booking:', bookingId);
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('booking_id', bookingId);
      if (error) {
        console.error('❌ Error deleting uploaded documents:', error);
      } else {
        console.log('✅ Uploaded documents removed for booking');
      }
    } catch (error) {
      console.error('❌ Exception while deleting uploaded documents:', error);
    }
  }

  /**
   * Remove guest_submissions duplication (cleanup method)
   */
  static async cleanupDuplicateSubmissions(booking: Booking): Promise<void> {
    try {
      // Skip cleanup for now since we're using edge function for secure guest document access
      console.log('🧹 Cleanup skipped - using edge function for secure guest document access');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}