import { useState, useEffect } from 'react';
import { Download, FileText, Users, Shield, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useToast } from '@/hooks/use-toast';
import { DocumentStorageService } from '@/services/documentStorageService';
import { UnifiedDocument } from '@/types/document';
import jsPDF from 'jspdf';
interface DocumentsViewerProps {
  booking: Booking;
  onClose: () => void;
  documentType?: 'all' | 'id-documents' | 'contract' | 'police-form';
}
interface DocumentUrls {
  guestDocuments: UnifiedDocument[];
  contract: string | null;
  policeForms: {
    name: string;
    url: string;
  }[];
}
export const DocumentsViewer = ({
  booking,
  onClose,
  documentType = 'all'
}: DocumentsViewerProps) => {
  const [documents, setDocuments] = useState<DocumentUrls>({
    guestDocuments: [],
    contract: null,
    policeForms: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadDocuments();
  }, [booking.id]);
  const handleGenerateIDDocuments = async () => {
    try {
      console.log('🔍 Récupération documents d\'identité pour:', booking.id);
      
      // ✅ PRIORITÉ 1 : Récupérer d'abord depuis uploaded_documents (source principale)
      const { data: uploadedDocs, error: uploadedError } = await supabase
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

      if (uploadedError) {
        console.error('❌ Erreur récupération uploaded_documents:', uploadedError);
      }

      let idDocuments = [];
      
      // Traiter les documents de uploaded_documents
      if (uploadedDocs && uploadedDocs.length > 0) {
        console.log('✅ Documents trouvés dans uploaded_documents:', uploadedDocs.length);
        
        for (const doc of uploadedDocs) {
          let documentUrl = doc.document_url;
          
          // Si pas d'URL ou URL expirée, créer une nouvelle URL signée
          if (!documentUrl && doc.file_path) {
            console.log('🔄 Generating signed URL for file_path:', doc.file_path);
            
            const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke('storage-sign-url', {
              body: { bucket: 'guest-documents', path: doc.file_path, expiresIn: 7200 } // 2 heures
            });
            
            if (!signedUrlError && signedUrlData?.signedUrl) {
              documentUrl = signedUrlData.signedUrl;
              console.log('✅ Generated new signed URL');
            } else {
              console.error('❌ Failed to generate signed URL:', signedUrlError);
            }
          } else if (documentUrl && documentUrl.includes('token=')) {
            // Vérifier si l'URL signée existante est encore valide
            try {
              const response = await fetch(documentUrl, { method: 'HEAD' });
              if (!response.ok) {
                console.log('🔄 Existing URL expired, generating new one for:', doc.file_path);
                
                const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke('storage-sign-url', {
                  body: { bucket: 'guest-documents', path: doc.file_path, expiresIn: 7200 }
                });
                
                if (!signedUrlError && signedUrlData?.signedUrl) {
                  documentUrl = signedUrlData.signedUrl;
                  console.log('✅ Refreshed expired signed URL');
                }
              }
            } catch (error) {
              console.warn('⚠️ Could not verify URL validity:', error);
            }
          }
          
          if (documentUrl) {
            idDocuments.push({
              name: doc.file_name || `Document_${doc.id}`,
              url: documentUrl,
              guestName: doc.guests?.full_name || 'Invité inconnu',
              metadata: doc.extracted_data
            });
          }
        }
      }
      
      // ✅ PRIORITÉ 2 : Compléter avec guest_submissions si nécessaire
      if (idDocuments.length === 0) {
        console.log('🔄 Aucun document dans uploaded_documents, vérification guest_submissions...');
        
        const { data: submissions, error: submissionsError } = await supabase
          .from('v_guest_submissions')
          .select('*')
          .eq('resolved_booking_id', booking.id)
          .not('guest_data', 'is', null);
        
        if (submissionsError) {
          console.error('❌ Erreur récupération soumissions:', submissionsError);
          toast({
            title: "Erreur",
            description: "Impossible de récupérer les documents d'identité",
            variant: "destructive"
          });
          return;
        }
        
        if (!submissions || submissions.length === 0) {
          toast({
            title: "Aucun document",
            description: "Aucun document d'identité trouvé pour cette réservation",
            variant: "destructive"
          });
          return;
        }
        
        console.log('📝 Soumissions trouvées:', submissions.length);
        
        // Extraiter les documents des soumissions (fallback)
        for (const submission of submissions) {
          const guestData = submission.guest_data as { guests?: Array<{ fullName?: string; full_name?: string; documentNumber?: string; document_number?: string; documentType?: string; document_type?: string; nationality?: string; dateOfBirth?: string; date_of_birth?: string; placeOfBirth?: string; place_of_birth?: string }> };
          
          if (guestData?.guests && Array.isArray(guestData.guests)) {
            for (const guest of guestData.guests) {
              const guestName = guest.fullName || guest.full_name || 'Invité inconnu';
              const documentType = guest.documentType || guest.document_type || 'Document d\'identité';
              const documentNumber = guest.documentNumber || guest.document_number || 'Non spécifié';
              
              idDocuments.push({
                name: `ID_${guestName}`,
                url: '#', // Pas de fichier physique, juste les informations
                guestName: guestName,
                metadata: {
                  documentType,
                  documentNumber,
                  nationality: guest.nationality || 'Non spécifiée',
                  dateOfBirth: guest.dateOfBirth || guest.date_of_birth || 'Non spécifiée',
                  placeOfBirth: guest.placeOfBirth || guest.place_of_birth || 'Non spécifié'
                }
              });
            }
          }
        }
      }
      
      if (idDocuments.length === 0) {
        toast({
          title: "Aucun document",
          description: "Aucun document d'identité trouvé pour cette réservation",
          variant: "destructive"
        });
        return;
      }
      
      // ✅ Mettre à jour l'état des documents
      console.log('✅ Documents d\'identité trouvés:', idDocuments.length);
      setDocuments(prev => ({
        ...prev,
        guestDocuments: idDocuments
      }));
      
      toast({
        title: "Documents récupérés",
        description: `${idDocuments.length} document(s) d'identité trouvé(s)`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('❌ Erreur critique ID docs:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la récupération des documents d'identité",
        variant: "destructive"
      });
    }
  };

  const loadDocuments = async () => {
    try {
      setIsLoading(true);

      // ✅ CORRECTION : Utiliser UNIQUEMENT DocumentStorageService (plus de double chargement)
      const guestDocuments = await DocumentStorageService.getDocumentsForBooking(booking);
      
      // ✅ SUPPRIMÉ : Le chargement en double depuis v_guest_submissions
      // DocumentStorageService gère déjà tout via la vue unifiée

      // Clean up any potential duplications
      await DocumentStorageService.cleanupDuplicateSubmissions(booking);

      // Check for generated contract (attempt regardless of flag)
      let contractUrl: string | null = null;
      try {
        const {
          data
        } = await supabase.functions.invoke('storage-sign-url', {
          body: { bucket: 'contracts', path: `${booking.id}/contract.pdf`, expiresIn: 3600 }
        });
        if (data?.signedUrl) {
          contractUrl = data.signedUrl;
        }
      } catch {}

      // Fallback: if no stored contract but a signature exists, generate on-the-fly and persist
      if (!contractUrl) {
        try {
          const {
            data: sig
          } = await supabase.from('contract_signatures').select('signature_data,signed_at').eq('booking_id', booking.id).order('signed_at', {
            ascending: false
          }).limit(1);
          if (sig && sig.length > 0 && sig[0].signature_data) {
            const {
              data: gen,
              error: genErr
            } = await supabase.functions.invoke('generate-documents', {
              body: {
                bookingId: booking.id,
                documentType: 'contract',
                signatureData: sig[0].signature_data,
                signedAt: sig[0].signed_at
              }
            });
            if (!genErr && gen?.documentUrls?.[0]) {
              const dataUrl = gen.documentUrls[0] as string;
              contractUrl = dataUrl; // immediate display
              // Persist to storage in background
              try {
                const resp = await fetch(dataUrl);
                const blob = await resp.blob();
                await supabase.storage.from('contracts').upload(`${booking.id}/contract.pdf`, blob, {
                  upsert: true
                });
                const {
                  data: signed
                } = await supabase.functions.invoke('storage-sign-url', {
                  body: { bucket: 'contracts', path: `${booking.id}/contract.pdf`, expiresIn: 3600 }
                });
                if (signed?.signedUrl) contractUrl = signed.signedUrl;
              } catch (persistErr) {
                console.warn('Contract persistence failed, using data URL', persistErr);
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Contract fallback generation failed', fallbackErr);
        }
      }

      // Fetch all generated police forms for this booking (folder = booking.id)
      let policeForms: {
        name: string;
        url: string;
      }[] = [];
      try {
        const {
          data: files,
          error: listErr
        } = await supabase.storage.from('police-forms').list(booking.id, {
          limit: 100
        });
        if (!listErr && files && files.length > 0) {
          for (const f of files) {
            const path = `${booking.id}/${f.name}`;
            const {
              data: signed
            } = await supabase.functions.invoke('storage-sign-url', {
              body: { bucket: 'police-forms', path: path, expiresIn: 3600 }
            });
            if (signed?.signedUrl) {
              policeForms.push({
                name: f.name,
                url: signed.signedUrl
              });
            }
          }
        }
      } catch {}
      // ✅ SUPPRIMÉ : Logs de debug pour éviter le spam
      
      setDocuments({
        guestDocuments: guestDocuments, // ✅ Utiliser UNIQUEMENT les documents de DocumentStorageService
        contract: contractUrl,
        policeForms
      });
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const downloadDocument = async (url: string, baseFilename: string) => {
    try {
      // Extract the actual file extension from the URL
      const urlPath = new URL(url).pathname;
      const actualExtension = urlPath.split('.').pop() || 'pdf';

      // Remove any existing extension from baseFilename and add the correct one
      const cleanFilename = baseFilename.replace(/\.[^/.]+$/, "");
      const filename = `${cleanFilename}.${actualExtension}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast({
        title: "Success",
        description: `${filename} downloaded successfully`
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try viewing the document instead.",
        variant: "destructive"
      });
    }
  };
  const openDocument = (url: string) => {
    window.open(url, '_blank');
  };
  if (isLoading) {
    return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardHeader>
        </Card>
      </div>;
  }
  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Documents de la réservation
              </CardTitle>
              <CardDescription>
                {booking.checkInDate} to {booking.checkOutDate} • {booking.numberOfGuests} guests
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onClose}>Fermer</Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
                     {/* Guest Documents (IDs) */}
           {(documentType === 'all' || documentType === 'id-documents') && <div>
                             <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <Users className="h-5 w-5" />
                Documents d'identité clients ({documents.guestDocuments.length})
              </h3>
                             {/* ✅ INFO : Documents d'identité disponibles */}
               <div className="text-xs text-blue-600 bg-blue-50 p-2 mb-2 rounded">
                 <strong>ℹ️ INFO:</strong> {documents.guestDocuments.length} document(s) d'identité disponible(s)
               </div>
              {/* ✅ FORCER L'AFFICHAGE POUR DEBUG */}
              {(documents.guestDocuments && documents.guestDocuments.length > 0) || true ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.guestDocuments.map((doc, index) => <Card key={doc.id} className="p-6">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">
                              {doc.guestName || `Guest ${index + 1}`}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Document d'identité
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={async () => {
                              // ✅ DEBUG : Log de l'action
                              console.log('🔍 CLICK Voir - Document:', doc);
                              console.log('🔍 CLICK Voir - URL:', doc.url);
                              console.log('🔍 CLICK Voir - Guest:', doc.guestName);
                              
                              // ✅ CORRECTION : Générer et afficher le PDF d'identité
                              if (doc.url === '#') {
                                console.log('🔍 CLICK Voir - Génération et affichage PDF');
                                
                                try {
                                  // ✅ GÉNÉRER LE PDF DIRECTEMENT DANS LE FRONTEND
                                  const guestInfo = doc.metadata || {};
                                  
                                  // ✅ CRÉER LE CONTENU DU PDF
                                  const pdfContent = {
                                    title: `Document d'identité - ${doc.guestName}`,
                                    guestName: doc.guestName || 'Nom non spécifié',
                                    documentType: guestInfo.documentType || 'Non spécifié',
                                    documentNumber: guestInfo.documentNumber || 'Non spécifié',
                                    nationality: guestInfo.nationality || 'Non spécifiée',
                                    dateOfBirth: guestInfo.dateOfBirth || 'Non spécifiée',
                                    placeOfBirth: guestInfo.placeOfBirth || 'Non spécifié',
                                    generatedAt: new Date().toLocaleString('fr-FR'),
                                    bookingId: booking.id
                                  };
                                  
                                  // ✅ CRÉER LE PDF AVEC JSPDF
                                  const pdf = new jsPDF();
                                  
                                  // ✅ EN-TÊTE
                                  pdf.setFontSize(20);
                                  pdf.setTextColor(51, 102, 204); // Bleu professionnel
                                  pdf.text('DOCUMENT D\'IDENTITÉ', 105, 30, { align: 'center' });
                                  
                                  // ✅ LIGNE DE SÉPARATION
                                  pdf.setDrawColor(51, 102, 204);
                                  pdf.setLineWidth(0.5);
                                  pdf.line(20, 40, 190, 40);
                                  
                                  // ✅ INFORMATIONS PRINCIPALES
                                  pdf.setFontSize(12);
                                  pdf.setTextColor(0, 0, 0);
                                  
                                  let yPosition = 60;
                                  const lineHeight = 10;
                                  
                                  // ✅ NOM COMPLET
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Nom complet:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.guestName, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ TYPE DE DOCUMENT
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Type de document:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.documentType, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ NUMÉRO DE DOCUMENT
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Numéro de document:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.documentNumber, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ NATIONALITÉ
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Nationalité:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.nationality, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ DATE DE NAISSANCE
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Date de naissance:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.dateOfBirth, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ LIEU DE NAISSANCE
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Lieu de naissance:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.placeOfBirth, 80, yPosition);
                                  yPosition += lineHeight * 2;
                                  
                                  // ✅ INFORMATIONS DE RÉSERVATION
                                  pdf.setFontSize(14);
                                  pdf.setFont(undefined, 'bold');
                                  pdf.setTextColor(51, 102, 204);
                                  pdf.text('Informations de réservation:', 30, yPosition);
                                  yPosition += lineHeight;
                                  
                                  pdf.setFontSize(12);
                                  pdf.setTextColor(0, 0, 0);
                                  
                                  // ✅ ID RÉSERVATION
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('ID Réservation:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.bookingId, 80, yPosition);
                                  yPosition += lineHeight;
                                  
                                  // ✅ DATE DE GÉNÉRATION
                                  pdf.setFont(undefined, 'bold');
                                  pdf.text('Généré le:', 30, yPosition);
                                  pdf.setFont(undefined, 'normal');
                                  pdf.text(pdfContent.generatedAt, 80, yPosition);
                                  
                                  // ✅ BORDURE
                                  pdf.setDrawColor(200, 200, 200);
                                  pdf.setLineWidth(0.2);
                                  pdf.rect(15, 15, 180, 260);
                                  
                                  // ✅ PIED DE PAGE
                                  pdf.setFontSize(10);
                                  pdf.setTextColor(128, 128, 128);
                                  pdf.text('Document généré automatiquement par le système de réservation', 105, 270, { align: 'center' });
                                  
                                  // ✅ AFFICHER LE PDF DANS UN NOUVEL ONGLET
                                  const pdfBlob = pdf.output('blob');
                                  const pdfUrl = URL.createObjectURL(pdfBlob);
                                  window.open(pdfUrl, '_blank');
                                  
                                  // ✅ NETTOYER L'URL APRÈS UN DÉLAI
                                  setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
                                  
                                  console.log('✅ PDF généré et affiché avec succès');
                                  
                                  toast({
                                    title: "PDF généré",
                                    description: `Document d'identité de ${doc.guestName} affiché dans un nouvel onglet`,
                                  });
                                  
                                } catch (pdfError) {
                                  console.error('❌ Erreur génération PDF frontend:', pdfError);
                                  toast({
                                    title: "Erreur",
                                    description: "Erreur lors de la génération du PDF",
                                    variant: "destructive"
                                  });
                                }
                                
                              } else {
                                console.log('🔍 CLICK Voir - Ouverture document existant:', doc.url);
                                openDocument(doc.url);
                              }
                            }} 
                            className="flex-1 gap-1 min-w-0"
                          >
                            <Eye className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Voir</span>
                          </Button>
                                                     <Button 
                             size="sm" 
                             onClick={async () => {
                               // ✅ DEBUG : Log de l'action
                               console.log('🔍 CLICK Télécharger - Document:', doc);
                               console.log('🔍 CLICK Télécharger - URL:', doc.url);
                               console.log('🔍 CLICK Télécharger - Guest:', doc.guestName);
                               
                                                               if (doc.url === '#') {
                                  console.log('🔍 CLICK Télécharger - Génération PDF côté frontend');
                                  
                                  try {
                                    // ✅ GÉNÉRER LE PDF DIRECTEMENT DANS LE FRONTEND
                                    const guestInfo = doc.metadata || {};
                                    
                                    // ✅ CRÉER LE CONTENU DU PDF
                                    const pdfContent = {
                                      title: `Document d'identité - ${doc.guestName}`,
                                      guestName: doc.guestName || 'Nom non spécifié',
                                      documentType: guestInfo.documentType || 'Non spécifié',
                                      documentNumber: guestInfo.documentNumber || 'Non spécifié',
                                      nationality: guestInfo.nationality || 'Non spécifiée',
                                      dateOfBirth: guestInfo.dateOfBirth || 'Non spécifiée',
                                      placeOfBirth: guestInfo.placeOfBirth || 'Non spécifié',
                                      generatedAt: new Date().toLocaleString('fr-FR'),
                                      bookingId: booking.id
                                    };
                                    
                                    // ✅ CRÉER LE PDF AVEC JSPDF
                                    const pdf = new jsPDF();
                                    
                                    // ✅ EN-TÊTE
                                    pdf.setFontSize(20);
                                    pdf.setTextColor(51, 102, 204); // Bleu professionnel
                                    pdf.text('DOCUMENT D\'IDENTITÉ', 105, 30, { align: 'center' });
                                    
                                    // ✅ LIGNE DE SÉPARATION
                                    pdf.setDrawColor(51, 102, 204);
                                    pdf.setLineWidth(0.5);
                                    pdf.line(20, 40, 190, 40);
                                    
                                    // ✅ INFORMATIONS PRINCIPALES
                                    pdf.setFontSize(12);
                                    pdf.setTextColor(0, 0, 0);
                                    
                                    let yPosition = 60;
                                    const lineHeight = 10;
                                    
                                    // ✅ NOM COMPLET
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Nom complet:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.guestName, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ TYPE DE DOCUMENT
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Type de document:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.documentType, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ NUMÉRO DE DOCUMENT
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Numéro de document:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.documentNumber, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ NATIONALITÉ
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Nationalité:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.nationality, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ DATE DE NAISSANCE
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Date de naissance:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.dateOfBirth, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ LIEU DE NAISSANCE
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Lieu de naissance:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.placeOfBirth, 80, yPosition);
                                    yPosition += lineHeight * 2;
                                    
                                    // ✅ INFORMATIONS DE RÉSERVATION
                                    pdf.setFontSize(14);
                                    pdf.setFont(undefined, 'bold');
                                    pdf.setTextColor(51, 102, 204);
                                    pdf.text('Informations de réservation:', 30, yPosition);
                                    yPosition += lineHeight;
                                    
                                    pdf.setFontSize(12);
                                    pdf.setTextColor(0, 0, 0);
                                    
                                    // ✅ ID RÉSERVATION
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('ID Réservation:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.bookingId, 80, yPosition);
                                    yPosition += lineHeight;
                                    
                                    // ✅ DATE DE GÉNÉRATION
                                    pdf.setFont(undefined, 'bold');
                                    pdf.text('Généré le:', 30, yPosition);
                                    pdf.setFont(undefined, 'normal');
                                    pdf.text(pdfContent.generatedAt, 80, yPosition);
                                    
                                    // ✅ BORDURE
                                    pdf.setDrawColor(200, 200, 200);
                                    pdf.setLineWidth(0.2);
                                    pdf.rect(15, 15, 180, 260);
                                    
                                    // ✅ PIED DE PAGE
                                    pdf.setFontSize(10);
                                    pdf.setTextColor(128, 128, 128);
                                    pdf.text('Document généré automatiquement par le système de réservation', 105, 270, { align: 'center' });
                                    
                                    // ✅ TÉLÉCHARGER LE PDF
                                    const pdfBlob = pdf.output('blob');
                                    const downloadUrl = URL.createObjectURL(pdfBlob);
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = `ID_${doc.guestName || 'guest'}.pdf`;
                                    link.style.display = 'none';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(downloadUrl);
                                    
                                    console.log('✅ PDF généré et téléchargé avec succès');
                                    
                                    toast({
                                      title: "PDF généré",
                                      description: `Document d'identité de ${doc.guestName} téléchargé en PDF`,
                                    });
                                    
                                  } catch (pdfError) {
                                    console.error('❌ Erreur génération PDF frontend:', pdfError);
                                    toast({
                                      title: "Erreur",
                                      description: "Erreur lors de la génération du PDF",
                                      variant: "destructive"
                                    });
                                  }
                                  
                                } else {
                                console.log('🔍 CLICK Télécharger - Téléchargement:', doc.url);
                                downloadDocument(doc.url, `${doc.guestName || `guest-${index + 1}`}-id`);
                              }
                            }} 
                            className="flex-1 gap-1 min-w-0"
                          >
                            <Download className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Télécharger</span>
                          </Button>
                        </div>
                      </div>
                    </Card>)}
                </div> : <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Pas de pièce d'identité disponible</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Les documents d'identité apparaîtront ici une fois que les invités auront soumis leurs informations
                  </p>
                  {/* ✅ DEBUG : Afficher les informations de debug */}
                  <div className="mt-4 p-3 bg-gray-100 rounded text-left text-xs">
                    <p><strong>Debug:</strong></p>
                    <p>Documents chargés: {documents.guestDocuments?.length || 0}</p>
                    <p>Documents avec URL: {documents.guestDocuments?.filter(d => d.url !== '#').length || 0}</p>
                    <p>Documents sans URL: {documents.guestDocuments?.filter(d => d.url === '#').length || 0}</p>
                  </div>
                  {/* Bouton pour tester la génération de documents d'identité */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateIDDocuments}
                    className="mt-3 text-blue-600 hover:text-blue-700"
                  >
                    Récupérer documents d'identité
                  </Button>
                </div>}
            </div>}

          {documentType === 'all' && <Separator />}

          {/* Contract */}
          {(documentType === 'all' || documentType === 'contract') && <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5" />
                Contrat de location
                {documents.contract && <Badge variant="secondary">Généré</Badge>}
              </h3>
              {documents.contract ? <Card className="p-6 max-w-md">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">
                          Contrat de location
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          PDF - Contrat.pdf
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDocument(documents.contract!)} className="flex-1 gap-1 min-w-0">
                        <Eye className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Voir</span>
                      </Button>
                      <Button size="sm" onClick={() => downloadDocument(documents.contract!, `contract-${booking.bookingReference || booking.id.slice(0, 8)}.pdf`)} className="flex-1 gap-1 min-w-0">
                        <Download className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Télécharger</span>
                      </Button>
                    </div>
                  </div>
                </Card> : <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Contrat non généré</p>
                </div>}
            </div>}

          {documentType === 'all' && <Separator />}

          {/* Police Forms */}
          {(documentType === 'all' || documentType === 'police-form') && <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5" />
                Fiches de Police ({documents.policeForms.length > 0 ? documents.policeForms.length : (booking.documentsGenerated?.policeForm ? booking.guests?.length || 0 : 0)})
                {(documents.policeForms.length > 0 || booking.documentsGenerated?.policeForm) && <Badge variant="secondary">Généré</Badge>}
              </h3>
              {(documents.policeForms.length > 0 || booking.documentsGenerated?.policeForm) ? 
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {documents.policeForms.length > 0 ? 
                    documents.policeForms.map((pf, index) => <Card key={pf.name} className="p-4">
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-start gap-2">
                          <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm leading-tight">
                              {documents.guestDocuments[index] 
                                ? `Fiche de ${documents.guestDocuments[index].guestName?.split(' ')[0] || `Guest ${index + 1}`}`
                                : `Fiche de police ${index + 1}`}
                            </h4>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDocument(pf.url)} className="w-full gap-1 text-xs">
                            <Eye className="h-3 w-3" />
                            <span>Voir</span>
                          </Button>
                          <Button size="sm" onClick={() => downloadDocument(pf.url, pf.name)} className="w-full gap-1 text-xs">
                            <Download className="h-3 w-3" />
                            <span>Télécharger</span>
                          </Button>
                        </div>
                      </div>
                    </Card>)
                    : 
                    booking.guests?.map((guest, index) => <Card key={guest.id} className="p-4">
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-start gap-2">
                          <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm leading-tight">
                              Fiche de {guest.fullName.split(' ')[0]}
                            </h4>
                            <p className="text-xs text-muted-foreground">PDF généré dynamiquement</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={async () => {
                              try {
                                console.log('🔍 Génération PDF police pour:', booking.id);
                                
                                const { data, error } = await supabase.functions.invoke('generate-documents', {
                                  body: { bookingId: booking.id, documentType: 'police' }
                                });
                                
                                console.log('📄 Réponse generate-documents:', { data, error });
                                
                                if (error) {
                                  console.error('❌ Erreur generation:', error);
                                  toast({
                                    title: "Erreur",
                                    description: error.message || "Impossible de générer la fiche de police",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                
                                // ✅ CORRECTION: La fonction retourne un objet avec documentUrls
                                if (data && data.success && data.documentUrls && data.documentUrls.length > 0) {
                                  console.log('✅ Documents générés:', data.documentUrls.length);
                                  
                                  // ✅ CORRECTION: Convertir data URL en blob pour éviter les restrictions de sécurité
                                  data.documentUrls.forEach((dataUrl: string, index: number) => {
                                    if (dataUrl.startsWith('data:application/pdf;base64,')) {
                                      try {
                                        // Extraire le base64 et créer un blob
                                        const base64Data = dataUrl.split(',')[1];
                                        const byteCharacters = atob(base64Data);
                                        const byteArray = new Uint8Array(byteCharacters.length);
                                        
                                        for (let i = 0; i < byteCharacters.length; i++) {
                                          byteArray[i] = byteCharacters.charCodeAt(i);
                                        }
                                        
                                        const blob = new Blob([byteArray], { type: 'application/pdf' });
                                        const blobUrl = URL.createObjectURL(blob);
                                        
                                        window.open(blobUrl, '_blank');
                                        console.log(`✅ Fiche de police ${index + 1} ouverte via blob`);
                                        
                                        // Nettoyer l'URL après un délai
                                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                                      } catch (error) {
                                        console.error(`❌ Erreur création blob pour fiche ${index + 1}:`, error);
                                      }
                                    } else {
                                      console.error(`❌ Format invalide pour la fiche ${index + 1}:`, dataUrl.substring(0, 50));
                                    }
                                  });
                                  
                                  toast({
                                    title: "Fiches générées",
                                    description: `${data.documentUrls.length} fiche(s) de police ouverte(s)`,
                                  });
                                } else if (data && data.error) {
                                  console.error('❌ Erreur de la fonction:', data.error);
                                  toast({
                                    title: "Erreur",
                                    description: data.error,
                                    variant: "destructive"
                                  });
                                } else {
                                  console.error('❌ Format de réponse inattendu:', data);
                                  toast({
                                    title: "Erreur",
                                    description: "Format de réponse non reconnu",
                                    variant: "destructive"
                                  });
                                }
                              } catch (error) {
                                console.error('❌ Erreur critique:', error);
                                toast({
                                  title: "Erreur",
                                  description: "Erreur lors de la génération du document",
                                  variant: "destructive"
                                });
                              }
                            }}
                            className="w-full gap-1 text-xs"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Voir</span>
                          </Button>
                        </div>
                      </div>
                    </Card>)
                  }
                </div>
                : 
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Fiche de police non générée</p>
                </div>
              }
            </div>}
        </CardContent>
      </Card>
    </div>;
};