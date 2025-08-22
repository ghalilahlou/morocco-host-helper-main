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
  const loadDocuments = async () => {
    try {
      setIsLoading(true);

      // Use unified document service to get all guest documents
      const guestDocuments = await DocumentStorageService.getDocumentsForBooking(booking);

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
      setDocuments({
        guestDocuments: guestDocuments,
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
              {documents.guestDocuments.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.guestDocuments.map((doc, index) => <Card key={doc.id} className="p-6">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">
                              {doc.guestName || `Guest ${index + 1}`}
                            </h4>
                            
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDocument(doc.url)} className="flex-1 gap-1 min-w-0">
                            <Eye className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Voir</span>
                          </Button>
                          <Button size="sm" onClick={() => downloadDocument(doc.url, `${doc.guestName || `guest-${index + 1}`}-id`)} className="flex-1 gap-1 min-w-0">
                            <Download className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Télécharger</span>
                          </Button>
                        </div>
                      </div>
                    </Card>)}
                </div> : <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Pas de pièce d'identité disponible</p>
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
                Fiches de Police ({documents.policeForms.length})
                {documents.policeForms.length > 0 && <Badge variant="secondary">Généré</Badge>}
              </h3>
              {documents.policeForms.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {documents.policeForms.map((pf, index) => <Card key={pf.name} className="p-4">
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
                    </Card>)}
                </div> : <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Fiche de police non générée</p>
                </div>}
            </div>}
        </CardContent>
      </Card>
    </div>;
};