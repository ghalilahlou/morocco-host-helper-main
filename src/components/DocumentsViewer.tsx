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
import { DocumentSynchronizationService } from '@/services/documentSynchronizationService';
import { UnifiedDocument } from '@/types/document';
import jsPDF from 'jspdf';
interface DocumentsViewerProps {
  booking: Booking;
  onClose: () => void;
  documentType?: 'all' | 'id-documents' | 'contract' | 'police-form' | 'id-cards';
}
interface DocumentUrls {
  guestDocuments: DisplayDocument[];
  contract: string | null;
  policeForms: {
    name: string;
    url: string;
  }[];
}

// Transform UnifiedDocument to match expected structure for display
interface DisplayDocument {
  id: string;
  name: string;
  url: string;
  guestName?: string;
  metadata?: any;
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

  // Transform UnifiedDocument to DisplayDocument for consistent handling
  const transformToDisplayDocuments = (unifiedDocs: UnifiedDocument[]): DisplayDocument[] => {
    return unifiedDocs.map(doc => ({
      id: doc.id,
      name: doc.fileName || `Document_${doc.id}`,
      url: doc.url,
      guestName: doc.guestName,
      metadata: doc.metadata
    }));
  };
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
      
      // ✅ CORRECTION : Utiliser get-guest-documents-unified au lieu de requêtes directes
      const { data: documentsData, error: documentsError } = await supabase.functions.invoke('get-guest-documents-unified', {
        body: { bookingId: booking.id }
      });

      if (documentsError) {
        console.error('❌ Erreur récupération documents:', documentsError);
        toast({
          title: "Erreur",
          description: "Impossible de récupérer les documents d'identité",
          variant: "destructive"
        });
        return;
      }

      if (!documentsData?.success || !documentsData.bookings || documentsData.bookings.length === 0) {
        toast({
          title: "Aucun document",
          description: "Aucun document d'identité trouvé pour cette réservation",
          variant: "destructive"
        });
        return;
      }

      const bookingData = documentsData.bookings[0];
      const identityDocs = transformToDisplayDocuments(bookingData.documents.identity);
      
      if (identityDocs.length === 0) {
        toast({
          title: "Aucun document",
          description: "Aucun document d'identité trouvé pour cette réservation",
          variant: "destructive"
        });
        return;
      }
      
      // ✅ Mettre à jour l'état des documents
      console.log('✅ Documents d\'identité trouvés:', identityDocs.length);
      setDocuments(prev => ({
        ...prev,
        guestDocuments: identityDocs
      }));
      
      toast({
        title: "Documents récupérés",
        description: `${identityDocs.length} document(s) d'identité trouvé(s)`,
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
      console.log('📋 Loading documents for booking:', booking.id);

      // ✅ CORRECTION : Utiliser la fonction unifiée pour récupérer TOUS les documents
      const { data: documentsData, error: documentsError } = await supabase.functions.invoke('get-guest-documents-unified', {
        body: { bookingId: booking.id }
      });

      if (documentsError) {
        console.error('❌ Error fetching documents:', documentsError);
        toast({
          title: "Erreur",
          description: "Impossible de charger les documents",
          variant: "destructive"
        });
        return;
      }

      if (!documentsData?.success || !documentsData.bookings || documentsData.bookings.length === 0) {
        console.log('ℹ️ No documents found for booking');
        setDocuments({
          guestDocuments: [],
          contract: null,
          policeForms: []
        });
        return;
      }

      const bookingData = documentsData.bookings[0];
      console.log('📋 Documents loaded:', {
        identity: bookingData.documents.identity.length,
        contract: bookingData.documents.contract.length,
        police: bookingData.documents.police.length,
        totalDocuments: bookingData.summary.totalDocuments
      });

      // ✅ CORRECTION : Transformer les documents pour l'affichage
      const transformedDocs = {
        guestDocuments: transformToDisplayDocuments(bookingData.documents.identity),
        contract: bookingData.documents.contract.length > 0 ? bookingData.documents.contract[0].url : null,
        policeForms: transformToDisplayDocuments(bookingData.documents.police)
      };

      console.log('📋 Transformed documents:', {
        hasContract: !!transformedDocs.contract,
        contractUrl: transformedDocs.contract?.substring(0, 50) + '...',
        contractUrlFull: transformedDocs.contract,
        guestDocsCount: transformedDocs.guestDocuments.length,
        policeFormsCount: transformedDocs.policeForms.length
      });
      
      // ✅ DEBUG : Vérifier la validité des URLs
      if (transformedDocs.contract) {
        console.log('🔍 Contract URL validation:', {
          url: transformedDocs.contract,
          isValid: transformedDocs.contract !== '#' && transformedDocs.contract !== '',
          startsWithHttp: transformedDocs.contract.startsWith('http'),
          startsWithData: transformedDocs.contract.startsWith('data:'),
          length: transformedDocs.contract.length
        });
      }

      setDocuments(transformedDocs);
    } catch (error) {
      console.error('❌ Error loading documents:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des documents",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const downloadDocument = async (url: string, baseFilename: string) => {
    try {
      console.log('🔍 downloadDocument called with:', { url, baseFilename });
      
      // ✅ CORRECTION : Valider l'URL avant utilisation
      if (!url || url === '#' || url === '') {
        throw new Error('URL invalide ou vide');
      }
      
      // ✅ CORRECTION : Vérifier si l'URL est valide
      let urlPath: string;
      let actualExtension: string;
      
      try {
        const urlObj = new URL(url);
        urlPath = urlObj.pathname;
        actualExtension = urlPath.split('.').pop() || 'pdf';
        console.log('✅ URL valide:', { urlPath, actualExtension });
      } catch (urlError) {
        console.warn('⚠️ URL invalide, utilisation de l\'extension par défaut:', urlError);
        // Pour les URLs invalides, utiliser l'extension par défaut
        actualExtension = 'pdf';
      }

      // Remove any existing extension from baseFilename and add the correct one
      const cleanFilename = baseFilename.replace(/\.[^/.]+$/, "");
      const filename = `${cleanFilename}.${actualExtension}`;
      
      console.log('🔍 Downloading:', { url, filename });
      
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
      
      console.log('✅ Download completed successfully');
      toast({
        title: "Success",
        description: `${filename} downloaded successfully`
      });
    } catch (error) {
      console.error('❌ Download error:', error);
      toast({
        title: "Erreur de téléchargement",
        description: error instanceof Error ? error.message : "Impossible de télécharger le document",
        variant: "destructive"
      });
    }
  };
  const openDocument = (url: string) => {
    console.log('🔍 openDocument called with URL:', url);
    console.log('🔍 URL type:', typeof url);
    console.log('🔍 URL length:', url?.length);
    console.log('🔍 URL starts with http:', url?.startsWith('http'));
    console.log('🔍 URL starts with data:', url?.startsWith('data:'));
    
    if (!url || url === '#' || url === '') {
      console.error('❌ Invalid URL provided to openDocument:', url);
      toast({
        title: "Erreur",
        description: "URL du document invalide",
        variant: "destructive"
      });
      return;
    }
    
    // ✅ DEBUG : Test de l'URL avant ouverture
    if (url.startsWith('http')) {
      console.log('🔍 Testing URL accessibility...');
      fetch(url, { method: 'HEAD' })
        .then(response => {
          console.log('🔍 URL test response:', response.status, response.statusText);
          if (response.ok) {
            window.open(url, '_blank');
            console.log('✅ Document opened successfully');
          } else {
            console.error('❌ URL not accessible:', response.status);
            toast({
              title: "Erreur",
              description: `Document non accessible (${response.status})`,
              variant: "destructive"
            });
          }
        })
        .catch(error => {
          console.error('❌ URL test failed:', error);
          toast({
            title: "Erreur",
            description: "Impossible d'accéder au document",
            variant: "destructive"
          });
        });
    } else {
      try {
        window.open(url, '_blank');
        console.log('✅ Document opened successfully');
      } catch (error) {
        console.error('❌ Error opening document:', error);
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir le document",
          variant: "destructive"
        });
      }
    }
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
              {/* ✅ AFFICHAGE CONDITIONNEL DES DOCUMENTS */}
              {documents.guestDocuments && documents.guestDocuments.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <p>Premier document: {documents.guestDocuments?.[0] ? `${documents.guestDocuments[0].name} (${documents.guestDocuments[0].guestName})` : 'Aucun'}</p>
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
                  
                  {/* Bouton pour nettoyer les doublons de contrats */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        console.log('🧹 Nettoyage des doublons de contrats...');
                        const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
                          body: {
                            action: 'clean_duplicate_contracts',
                            bookingId: booking.id
                          }
                        });
                        
                        if (error) {
                          console.error('❌ Erreur nettoyage:', error);
                          toast({
                            title: "Erreur",
                            description: "Erreur lors du nettoyage des doublons",
                            variant: "destructive"
                          });
                        } else {
                          console.log('✅ Nettoyage réussi:', data);
                          toast({
                            title: "Nettoyage terminé",
                            description: data.message || "Doublons supprimés avec succès"
                          });
                          // Recharger les documents
                          loadDocuments();
                        }
                      } catch (error) {
                        console.error('❌ Erreur nettoyage:', error);
                        toast({
                          title: "Erreur",
                          description: "Erreur lors du nettoyage des doublons",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="mt-2 text-orange-600 hover:text-orange-700"
                  >
                    🧹 Nettoyer doublons contrats
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

          {/* ID Cards (Fiches ID) */}
          {(documentType === 'all' || documentType === 'id-cards') && <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <Users className="h-5 w-5" />
                Fiches ID ({booking.guests?.length || 0})
                <Badge variant="secondary">Générées</Badge>
              </h3>
              {booking.guests && booking.guests.length > 0 ? 
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {booking.guests.map((guest, index) => <Card key={guest.id} className="p-4">
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm leading-tight">
                            Fiche ID - {guest.fullName.split(' ')[0]}
                          </h4>
                          <p className="text-xs text-muted-foreground">Document d'identité formaté</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={async () => {
                            try {
                              console.log('🔍 Génération Fiche ID pour:', guest.fullName);
                              
                              const { data, error } = await supabase.functions.invoke('generate-id-documents', {
                                body: { 
                                  bookingId: booking.id,
                                  guestName: guest.fullName,
                                  guestInfo: {
                                    guestName: guest.fullName,
                                    documentType: guest.documentType || 'passport',
                                    documentNumber: guest.documentNumber || 'Non spécifié',
                                    nationality: guest.nationality || 'Non spécifiée',
                                    dateOfBirth: guest.dateOfBirth || 'Non spécifiée',
                                    placeOfBirth: guest.placeOfBirth || 'Non spécifié',
                                    generatedAt: new Date().toLocaleString('fr-FR'),
                                    bookingId: booking.id
                                  }
                                }
                              });
                              
                              console.log('📄 Réponse generate-id-documents:', { data, error });
                              
                              if (error) {
                                console.error('❌ Erreur generation Fiche ID:', error);
                                toast({
                                  title: "Erreur",
                                  description: error.message || "Impossible de générer la fiche ID",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              if (data && data.success && data.pdfBase64) {
                                console.log('✅ Fiche ID générée avec succès');
                                
                                // Convertir base64 en blob et ouvrir
                                try {
                                  const base64Data = data.pdfBase64;
                                  const byteCharacters = atob(base64Data);
                                  const byteArray = new Uint8Array(byteCharacters.length);
                                  
                                  for (let i = 0; i < byteCharacters.length; i++) {
                                    byteArray[i] = byteCharacters.charCodeAt(i);
                                  }
                                  
                                  const blob = new Blob([byteArray], { type: 'application/pdf' });
                                  const blobUrl = URL.createObjectURL(blob);
                                  
                                  window.open(blobUrl, '_blank');
                                  console.log('✅ Fiche ID ouverte via blob');
                                  
                                  // Nettoyer l'URL après un délai
                                  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                                  
                                  toast({
                                    title: "Fiche ID générée",
                                    description: `Fiche d'identité de ${guest.fullName} générée avec succès`,
                                  });
                                } catch (blobError) {
                                  console.error('❌ Erreur création blob:', blobError);
                                  toast({
                                    title: "Erreur",
                                    description: "Erreur lors de l'ouverture du document",
                                    variant: "destructive"
                                  });
                                }
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
                                description: "Erreur lors de la génération de la fiche ID",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="w-full gap-1 text-xs"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Générer</span>
                        </Button>
                      </div>
                    </div>
                  </Card>)
                }
                </div>
                : 
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucun invité pour générer les fiches ID</p>
                </div>
              }
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
                                
                                // ✅ CORRECTION : Utiliser submit-guest-info-unified au lieu de generate-police-forms
                                const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
                                  body: { 
                                    bookingId: booking.id,
                                    action: 'generate_police_only'
                                  }
                                });
                                
                                console.log('📄 Réponse submit-guest-info-unified:', { data, error });
                                
                                if (error) {
                                  console.error('❌ Erreur génération police:', error);
                                  toast({
                                    title: "Erreur",
                                    description: error.message || "Impossible de générer la fiche de police",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                
                                // ✅ CORRECTION: Support des deux formats de réponse
                                const documentUrls = data.documentUrls || (data.documentUrl ? [data.documentUrl] : []) || (data.policeUrl ? [data.policeUrl] : []);
                                if (data && data.success && documentUrls && documentUrls.length > 0) {
                                  console.log('✅ Documents générés:', documentUrls.length);
                                  
                                  // ✅ CORRECTION: Convertir data URL en blob pour éviter les restrictions de sécurité
                                  documentUrls.forEach((dataUrl: string, index: number) => {
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
                                    description: `${documentUrls.length} fiche(s) de police ouverte(s)`,
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