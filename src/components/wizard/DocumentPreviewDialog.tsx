import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2, AlertCircle } from 'lucide-react';
import { BookingFormData } from '../BookingWizard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'police' | 'contract';
  formData: BookingFormData;
  propertyId: string;
}

export const DocumentPreviewDialog = ({
  isOpen,
  onClose,
  documentType,
  formData,
  propertyId
}: DocumentPreviewDialogProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempBookingId, setTempBookingId] = useState<string | null>(null);
  
  // ✅ Générer l'aperçu en appelant l'Edge Function
  useEffect(() => {
    if (!isOpen) return;

    const generatePreview = async () => {
      setIsGenerating(true);
      setError(null);
      setDocumentUrl(null);

      try {
        console.log('🎨 [PREVIEW] Génération aperçu', { documentType, propertyId, formData });

        // ✅ VALIDATION DES DONNÉES
        if (!propertyId) {
          throw new Error('propertyId manquant - impossible de générer l\'aperçu');
        }

        if (!formData.checkInDate || !formData.checkOutDate) {
          throw new Error('Dates de réservation manquantes - impossible de générer l\'aperçu');
        }

        if (!formData.guests || formData.guests.length === 0) {
          throw new Error('Aucun client enregistré - impossible de générer l\'aperçu');
        }

        // ✅ NOUVEAU : Ne pas créer de booking temporaire, passer directement les données à l'Edge Function
        const action = documentType === 'police' ? 'generate_police_preview' : 'generate_contract_preview';
        
        // Préparer les données pour l'Edge Function
        const previewData = {
          action,
          is_preview: true,
          bookingData: {
            checkIn: formData.checkInDate,
            checkOut: formData.checkOutDate,
            numberOfGuests: formData.numberOfGuests,
            propertyId: propertyId
          },
          guests: formData.guests.map(guest => ({
            fullName: guest.fullName || '',
            nationality: guest.nationality || '',
            documentType: guest.documentType || 'passport',
            documentNumber: guest.documentNumber || '',
            dateOfBirth: guest.dateOfBirth || '',
            placeOfBirth: guest.placeOfBirth || ''
          }))
        };

        console.log('📤 [PREVIEW] Appel Edge Function avec données:', JSON.stringify(previewData, null, 2));

        const { data: docData, error: docError } = await supabase.functions.invoke('submit-guest-info-unified', {
          body: previewData
        });

        console.log('📥 [PREVIEW] Réponse Edge Function:', { data: docData, error: docError });

        if (docError) {
          console.error('❌ [PREVIEW] Erreur Edge Function:', docError);
          console.error('❌ [PREVIEW] Détails complets:', {
            message: docError.message,
            context: docError.context,
            status: docError.status,
            statusText: docError.statusText
          });
          
          // Message d'erreur plus informatif
          const errorMessage = docError.message || 'Erreur inconnue';
          throw new Error(`Erreur génération document: ${errorMessage}. Vérifiez les logs de l'Edge Function sur le Dashboard Supabase pour plus de détails.`);
        }

        const url = documentType === 'police' ? docData?.policeUrl : docData?.contractUrl;

        if (!url) {
          throw new Error('Aucune URL de document retournée');
        }

        console.log('✅ [PREVIEW] Document généré:', url);
        setDocumentUrl(url);

      } catch (err) {
        console.error('❌ [PREVIEW] Erreur:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
        toast({
          title: "Erreur",
          description: "Impossible de générer l'aperçu du document",
          variant: "destructive"
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generatePreview();
  }, [isOpen, documentType, formData, propertyId, toast]);

  // ✅ Plus besoin de nettoyage : on ne crée plus de booking temporaire


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {documentType === 'police' ? 'Aperçu - Fiche de Police' : 'Aperçu - Contrat de Location'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border rounded-lg bg-gray-50">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-brand-teal" />
              <p className="text-lg font-medium">Génération du document en cours...</p>
              <p className="text-sm text-muted-foreground">
                Appel à l'Edge Function - Cela peut prendre quelques secondes
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 p-8">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium text-destructive">Erreur de génération</p>
              <p className="text-sm text-muted-foreground text-center">{error}</p>
              <Button onClick={onClose} variant="outline">Fermer</Button>
            </div>
          ) : documentUrl ? (
            <iframe
              src={documentUrl}
              className="w-full h-full"
              title={documentType === 'police' ? 'Aperçu Fiche de Police' : 'Aperçu Contrat'}
            />
          ) : null}
        </div>

        {documentUrl && !isGenerating && (
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              ✅ Document généré avec le format officiel de l'Edge Function
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(documentUrl, '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              <Button onClick={onClose}>Fermer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

