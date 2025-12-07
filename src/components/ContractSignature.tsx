import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Check, Pen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getContractPdfUrl } from '@/services/contractService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePdfViewer } from '@/components/MobilePdfViewer';
import { cn } from '@/lib/utils';
import { urls } from '@/config/runtime';

interface ContractSignatureProps {
  bookingData: any;
  propertyData: any;
  guestData?: any;
  documentUrls?: string[];
  onBack?: () => void;
  onSignatureComplete: (signatureData: string) => void;
}

export const ContractSignature: React.FC<ContractSignatureProps> = ({
  bookingData,
  propertyData,
  guestData,
  documentUrls,
  onBack,
  onSignatureComplete
}) => {
  const isMobile = useIsMobile();
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSignatureModeActive, setIsSignatureModeActive] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const location = useLocation();
  const t = useT();

  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [loadingContract, setLoadingContract] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string | null>(null);

  // ✅ CORRECTION : Fonction robuste pour récupérer le bookingId
  const getBookingId = (): string | null => {
    console.log('🔍 DEBUG: getBookingId() appelé');
    console.log('🔍 DEBUG: location.state =', location.state);
    console.log('🔍 DEBUG: bookingData =', bookingData);
    console.log('🔍 DEBUG: window.location.search =', window.location.search);
    
    // 1. Essayer depuis l'état de navigation
    const bookingIdFromState = (location as any)?.state?.bookingId;
    console.log('🔍 DEBUG: bookingIdFromState =', bookingIdFromState);
    if (bookingIdFromState) {
      console.log('✅ Booking ID from navigation state:', bookingIdFromState);
      return bookingIdFromState;
    }

    // 2. Essayer depuis les props bookingData
    console.log('🔍 DEBUG: bookingData?.id =', bookingData?.id);
    if (bookingData?.id) {
      console.log('✅ Booking ID from props:', bookingData.id);
      return bookingData.id;
    }

    // 3. Essayer depuis l'URL (si disponible)
    const urlParams = new URLSearchParams(window.location.search);
    const bookingIdFromUrl = urlParams.get('bookingId');
    console.log('🔍 DEBUG: bookingIdFromUrl =', bookingIdFromUrl);
    if (bookingIdFromUrl) {
      console.log('✅ Booking ID from URL params:', bookingIdFromUrl);
      return bookingIdFromUrl;
    }

    // 4. Essayer depuis le localStorage (fallback)
    const bookingIdFromStorage = localStorage.getItem('currentBookingId');
    console.log('🔍 DEBUG: bookingIdFromStorage =', bookingIdFromStorage);
    if (bookingIdFromStorage) {
      console.log('✅ Booking ID from localStorage:', bookingIdFromStorage);
      return bookingIdFromStorage;
    }

    console.error('❌ No booking ID found from any source');
    console.error('❌ DEBUG: Toutes les sources vérifiées:');
    console.error('   - location.state:', location.state);
    console.error('   - bookingData:', bookingData);
    console.error('   - URL params:', window.location.search);
    console.error('   - localStorage:', localStorage.getItem('currentBookingId'));
    return null;
  };

  // ✅ CORRECTION : Récupérer le bookingId actuel
  const currentBookingId = getBookingId();

  // ✅ CORRECTION : Sauvegarder dans localStorage pour persistance
  useEffect(() => {
    if (currentBookingId) {
      localStorage.setItem('currentBookingId', currentBookingId);
      console.log('✅ Booking ID saved to localStorage:', currentBookingId);
    }
  }, [currentBookingId]);

  // Debug logs to trace the data flow
  console.log('🔍 ContractSignature - RAW bookingData received:', bookingData);
  console.log('🔍 ContractSignature - checkInDate:', bookingData?.checkInDate);
  console.log('🔍 ContractSignature - checkOutDate:', bookingData?.checkOutDate);
  console.log('🔍 ContractSignature - RAW propertyData:', propertyData);
  console.log('🔍 ContractSignature - RAW guestData:', guestData);
  console.log('🔍 ContractSignature - Current Booking ID:', currentBookingId);

  const getContractContent = (includeGuestSignature = false) => {
    const allGuests = (bookingData?.guests && Array.isArray(bookingData.guests) ? bookingData.guests : (guestData?.guests || [])) as any[];
    const occupantsText = (allGuests && allGuests.length > 0)
      ? allGuests.map((g, i) => `${i + 1}. ${g.fullName || '____________'} - Né(e) le ${g.dateOfBirth ? new Date(g.dateOfBirth).toLocaleDateString('fr-FR') : '__/__/____'} - Document n° ${g.documentNumber || '____________'}`).join('\n')
      : 'Aucun occupant';

    return `
CONTRAT DE LOCATION SAISONNIÈRE

BAILLEUR: ${propertyData?.name || 'Nom de la propriété'}
Adresse: ${propertyData?.address || 'Adresse de la propriété'}

LOCATAIRE: ${allGuests?.[0]?.fullName || 'Nom du locataire principal'}

PÉRIODE DE LOCATION:
Du ${bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR') : 'Date non spécifiée'} 
Au ${bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR') : 'Date non spécifiée'}

NOMBRE D'OCCUPANTS: ${allGuests?.length || bookingData?.numberOfGuests || 1}

ARTICLE 3 - OCCUPANTS AUTORISÉS
Le logement sera occupé par ${allGuests?.length || bookingData?.numberOfGuests || 1} personne(s) maximum. Liste des occupants autorisés :
${occupantsText}

RÈGLEMENT INTÉRIEUR:
${propertyData?.house_rules?.map((rule: string, index: number) => `${index + 1}. ${rule}`).join('\n') || 'Aucune règle spécifiée'}

CONDITIONS GÉNÉRALES:
1. Le locataire s'engage à respecter les règles de la propriété
2. Le locataire est responsable de tous dommages causés pendant son séjour
3. Le locataire accepte de laisser la propriété dans l'état où il l'a trouvée
4. Aucune fête ou événement bruyant n'est autorisé
5. Le nombre maximum d'occupants ne peut être dépassé

En signant ce contrat, je confirme avoir lu et accepté toutes les conditions ci-dessus.

Date: ${new Date().toLocaleDateString('fr-FR')}


SIGNATURES:

PROPRIÉTAIRE (Bailleur):                    LOCATAIRE:

Nom: ${propertyData?.contact_info?.name || propertyData?.name || '________________________'}              Nom: ${allGuests?.[0]?.fullName || '________________________'}

Signature: [Signature électronique - Propriétaire]        Signature: ${includeGuestSignature && signature ? '[Signature électronique - Locataire collectée]' : '[En attente de signature électronique]'}

Date: ${new Date().toLocaleDateString('fr-FR')}                            Date: ${new Date().toLocaleDateString('fr-FR')}
    `.trim();
  };

  // Contract PDF fetching
  const loadContract = async () => {
    try {
      setLoadingContract(true);
      setContractError(null);

      const bookingIdFromState = (location as any)?.state?.bookingId as string | undefined;
      const hasGuests = Array.isArray(guestData?.guests) && guestData.guests.length > 0;
      const hasBookingGuests = Array.isArray(bookingData?.guests) && bookingData.guests.length > 0;
      const shouldUsePreview = hasGuests || hasBookingGuests; // Prefer preview to avoid RLS issues
      let url: string;

      if (shouldUsePreview) {
        const allGuests: any[] = (guestData?.guests && Array.isArray(guestData.guests) ? guestData.guests : (bookingData?.guests || []));
        const guestsPayload = (allGuests || []).map((g: any) => ({
          fullName: g.fullName,
          dateOfBirth: g.dateOfBirth,
          documentNumber: g.documentNumber,
          nationality: g.nationality,
          documentType: g.documentType,
        }));
        const bookingLike = {
          property: {
            id: propertyData?.id,
            name: propertyData?.name,
            address: propertyData?.address,
            contract_template: propertyData?.contract_template,
            contact_info: propertyData?.contact_info,
            house_rules: propertyData?.house_rules,
          },
          checkInDate: bookingData?.checkInDate ? new Date(bookingData.checkInDate).toISOString() : null,
          checkOutDate: bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toISOString() : null,
          numberOfGuests: bookingData?.numberOfGuests ?? guestsPayload.length ?? 1,
          guests: guestsPayload,
        };
        url = await getContractPdfUrl({ supabase, bookingLike, isPreview: true });
      } else if (bookingIdFromState || bookingData?.id) {
        const bookingId: string = bookingIdFromState ?? bookingData?.id;
        url = await getContractPdfUrl({ supabase, bookingId, isPreview: false });
      } else {
        throw new Error('Données de réservation insuffisantes');
      }

      const bust = Date.now();
      const sep = typeof url === 'string' && url.includes('?') ? '&' : '?';

      // Fallback: convert data URL to blob URL for better iframe compatibility
      if (typeof url === 'string' && url.startsWith('data:application/pdf')) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          setContractUrl(objectUrl); // don't append query to blob URLs
          return;
        } catch (convErr) {
          console.warn('⚠️ Fallback blob URL failed, using data URL directly', convErr);
        }
      }

      // If we already got a blob URL, use as-is
      if (typeof url === 'string' && url.startsWith('blob:')) {
        setContractUrl(url);
        return;
      }

      setContractUrl(`${url}${sep}t=${bust}`);
    } catch (e: any) {
      console.error('Erreur génération du contrat:', e);
      setContractError(e?.message || 'Erreur lors de la génération du contrat');
      setContractUrl(null);
    } finally {
      setLoadingContract(false);
    }
  };

  useEffect(() => {
    if (!propertyData) return;
    const hasBookingId = !!bookingData?.id;
    const anyGuests = (Array.isArray(guestData?.guests) && guestData.guests.length > 0) || (Array.isArray(bookingData?.guests) && bookingData.guests.length > 0);
    const hasBookingLike = !!(propertyData?.id && (bookingData?.checkInDate || bookingData?.checkOutDate) && anyGuests);
    if (hasBookingId || hasBookingLike) {
      loadContract();
    }
  }, [propertyData, bookingData, guestData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isSignatureModeActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup canvas for better quality
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Anti-aliasing and smooth lines
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawing = false;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      let x, y;
      
      if (e instanceof MouseEvent) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      }

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      let x, y;
      
      if (e instanceof MouseEvent) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      }

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawing = false;
      setSignature(canvas.toDataURL());
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);


    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isSignatureModeActive]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const handleSubmitSignature = async () => {
    if (!signature || !isAgreed) return;

    setIsSubmitting(true);
    try {
      // ✅ CORRECTION : Utiliser l'ID existant ou échouer
      const bookingId = getBookingId();
      
      if (!bookingId) {
        // ✅ CORRECTION : Message d'erreur plus informatif
        const errorMessage = 'ID de réservation manquant. ' +
          'Veuillez revenir à la page précédente et réessayer, ' +
          'ou contactez votre hôte pour obtenir un nouveau lien.';
        
        toast({ 
          title: 'Erreur de réservation', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        
        throw new Error(errorMessage);
      }

      console.log('✅ Utilisation de la réservation existante:', bookingId);

      // Save contract signature via edge function (avoids RLS issues)
      const allGuests = (bookingData?.guests && Array.isArray(bookingData.guests) ? bookingData.guests : (guestData?.guests || [])) as any[];
      const signerName = allGuests?.[0]?.fullName || 'Guest';
      const signerEmail = guestData?.email || null;
      const signerPhone = guestData?.phone || null;
      
      const { data: signatureResult, error: signErr } = await supabase.functions.invoke('save-contract-signature', {
        body: {
          bookingId: bookingId,
          signerName: signerName,
          signerEmail: signerEmail,
          signerPhone: signerPhone,
          signatureDataUrl: signature
        }
      });
      
      if (signErr) {
        console.error('❌ Contract signature error:', signErr);
        throw signErr;
      }

      console.log('✅ Contract signature saved successfully:', signatureResult);

      // Generate signed PDF (non-blocking)
      try {
        const { UnifiedDocumentService } = await import('@/services/unifiedDocumentService');
        const signedAt = new Date().toISOString();
        await UnifiedDocumentService.generateSignedContract({ id: bookingId } as any, signature, signedAt);
      } catch (generateError) {
        console.error('⚠️ Failed to generate signed contract for Storage:', generateError);
      }
  
      // Notify property owner (non-blocking)
      try {
        const ownerEmail = propertyData?.contact_info?.email;
        if (ownerEmail) {
          const dashboardUrl = `${urls.app.base}/dashboard/property/${propertyData?.id}`;
          const guestName = guestData?.guests?.[0]?.fullName || bookingData?.guestName || 'Invité';
          const checkIn = bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR') : 'N/A';
          const checkOut = bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR') : 'N/A';

          const { error: fnError } = await supabase.functions.invoke('send-owner-notification', {
            body: { toEmail: ownerEmail, guestName, checkIn, checkOut, propertyId: propertyData?.id, propertyName: propertyData?.name, dashboardUrl },
          });
          if (fnError) console.error('⚠️ Erreur envoi email propriétaire:', fnError);
        } else {
          console.warn('⚠️ Aucune adresse email propriétaire trouvée (property.contact_info.email).');
        }
      } catch (notifyError) {
        console.error('⚠️ Notification propriétaire échouée:', notifyError);
      }

      toast({
        title: 'Contrat signé avec succès',
        description: 'Votre signature a été enregistrée et la réservation marquée comme complétée.',
      });

      onSignatureComplete(signature);
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({ 
        title: 'Erreur', 
        description: error instanceof Error ? error.message : "Impossible d'enregistrer la signature. Veuillez réessayer.", 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-start">
          <Button 
            variant="outline"
            onClick={() => (onBack ? onBack() : window.history.back())}
          >
            {t('common.previous')}
          </Button>
        </div>
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-medium">
            <FileText className="w-4 h-4" />
            {t('contractSignature.pill')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t('contractSignature.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('contractSignature.subtitle')}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('contractSignature.cardTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingContract ? (
              <div className="h-96 w-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                {t('contractSignature.generating')}
              </div>
            ) : contractUrl ? (
              isMobile ? (
                <MobilePdfViewer
                  url={contractUrl}
                  title="Contrat de location"
                  className="rounded-lg"
                />
              ) : (
                <iframe src={contractUrl} title="Contrat" className="w-full h-[600px] border rounded-lg" />
              )
            ) : contractError ? (
              <div className="border rounded-lg p-4 text-sm">
                <p className="mb-2">{contractError}</p>
                <Button variant="outline" onClick={loadContract}>{t('contractSignature.retry')}</Button>
              </div>
            ) : (
              <div className="h-96 w-full flex items-center justify-center text-sm text-muted-foreground">
                {t('contractSignature.preparing')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pen className="w-5 h-5" />
              {t('contractSignature.electronic')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agree" 
                checked={isAgreed}
                onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
              />
              <label 
                htmlFor="agree" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('contractSignature.agreeLabel')}
              </label>
            </div>

            {isAgreed && (
              <div className="space-y-4">
                {!isSignatureModeActive ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => (onBack ? onBack() : window.history.back())}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button 
                      onClick={() => setIsSignatureModeActive(true)}
                      className="flex-1"
                      size="lg"
                    >
                      <Pen className="w-4 h-4 mr-2" />
                      {t('contractSignature.startSigning')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/5">
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('contractSignature.signHere')}
                      </p>
                      <canvas
                        ref={canvasRef}
                        width={500}
                        height={200}
                        className={cn(
                          "w-full border rounded bg-background cursor-crosshair",
                          isMobile && "touch-none h-[150px]"
                        )}
                        style={{
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none'
                        }}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => (onBack ? onBack() : window.history.back())}
                        variant="outline"
                        className="flex-1"
                      >
                        {t('common.previous')}
                      </Button>
                      <Button 
                        onClick={clearSignature}
                        variant="outline"
                        className="flex-1"
                      >
                        {t('common.clear')}
                      </Button>
                      <Button 
                        onClick={handleSubmitSignature}
                        disabled={!signature || isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('contractSignature.saving')}
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            {t('contractSignature.signContract')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isAgreed && (
              <Alert>
                <AlertDescription>
                  {t('contractSignature.mustAgree')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};