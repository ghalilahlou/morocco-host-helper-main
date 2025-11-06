import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  FileText, 
  Check, 
  Pen, 
  Heart, 
  Shield, 
  Coffee, 
  Home, 
  Sparkles,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Star,
  Gift,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getContractPdfUrl } from '@/services/contractService';
import { ApiService } from '@/services/apiService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface WelcomingContractSignatureProps {
  bookingData: any;
  propertyData: any;
  guestData?: any;
  documentUrls?: string[];
  onBack?: () => void;
  onSignatureComplete: (signatureData: string) => void;
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const floatingIcon = {
  animate: {
    y: [0, -10, 0],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }
};

export const WelcomingContractSignature: React.FC<WelcomingContractSignatureProps & { initialContractUrl?: string }> = ({
  bookingData,
  propertyData,
  guestData,
  documentUrls,
  onBack,
  onSignatureComplete,
  initialContractUrl
}) => {
  const isMountedRef = useRef(true);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'review' | 'signature' | 'celebration'>('review');
  
  // ✅ SUPPRIMÉ : Intercepteur d'erreurs redondant - l'intercepteur global dans main.tsx gère déjà les erreurs Portal
  
  // ✅ CORRIGÉ : Cleanup simple au montage et démontage
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // ✅ SUPPRIMÉ : Nettoyage manuel des Portals - l'intercepteur global gère les erreurs
      // Le nettoyage manuel causait des erreurs removeChild non interceptées
    };
  }, []);
  
    // Réinitialiser l'état du canvas quand on change d'étape
  useEffect(() => {
    if (currentStep !== 'signature') {
      setCanvasInitialized(false);
    }
  }, [currentStep]);
  const [isAgreed, setIsAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const location = useLocation();
  const t = useT();

  
  
  // ✅ CORRECTION : Fonction robuste pour récupérer l'ID de réservation
  const getBookingId = (): string | null => {
    // 1. Vérifier location.state (navigation depuis GuestVerification)
    const stateBookingId = (location as any)?.state?.bookingId;
    if (stateBookingId) {
      return stateBookingId;
    }

    // 2. Vérifier les props bookingData
    if (bookingData?.id) {
      return bookingData.id;
    }

    // 3. Vérifier les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlBookingId = urlParams.get('bookingId');
    if (urlBookingId) {
      return urlBookingId;
    }

    // 4. Vérifier localStorage
    const storedBookingId = localStorage.getItem('currentBookingId');
    if (storedBookingId) {
      return storedBookingId;
    }

    // 5. ✅ NOUVEAU : Essayer de créer un ID temporaire basé sur les données disponibles
    if (propertyData?.id && guestData?.guests?.[0]?.fullName) {
      const tempId = `temp-${propertyData.id}-${Date.now()}`;
      // Création d'un ID temporaire
      return tempId;
    }

    console.warn("⚠️ Aucun Booking ID trouvé dans toutes les sources");
    return null;
  };

  // ✅ CORRECTION : Persister l'ID de réservation dans localStorage
  useEffect(() => {
    const currentBookingId = getBookingId();
    if (currentBookingId) {
      localStorage.setItem('currentBookingId', currentBookingId);
    }
  }, [location.state, bookingData?.id]);

  const [contractUrl, setContractUrl] = useState<string | null>(initialContractUrl || null);
  
  // ✅ CORRIGÉ : Mettre à jour contractUrl si initialContractUrl change (important pour Vercel)
  useEffect(() => {
    if (initialContractUrl && initialContractUrl !== contractUrl) {
      setContractUrl(initialContractUrl);
    }
  }, [initialContractUrl]); // ✅ Seulement initialContractUrl dans les dépendances
  const [loadingContract, setLoadingContract] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string | null>(null);

  // Données d'accueil personnalisées
  const guestName = guestData?.guests?.[0]?.fullName || bookingData?.guests?.[0]?.fullName || 'Cher invité';
  const propertyName = propertyData?.name || 'Notre magnifique propriété';
  const checkInDate = bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : '';
  const checkOutDate = bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : '';
  const numberOfNights = bookingData?.checkInDate && bookingData?.checkOutDate 
    ? Math.ceil((new Date(bookingData.checkOutDate).getTime() - new Date(bookingData.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    : 1;

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

  // ✅ CORRIGÉ : Extraire les valeurs primitives pour éviter les boucles infinies dans useCallback
  const bookingIdForContract = bookingData?.id;
  const bookingCheckInForContract = bookingData?.checkInDate;
  const bookingCheckOutForContract = bookingData?.checkOutDate;
  const bookingNumberOfGuests = bookingData?.numberOfGuests;
  const bookingGuestsForContract = bookingData?.guests;
  const guestGuestsForContract = guestData?.guests;
  const propertyIdForContract = propertyData?.id;
  const propertyNameForContract = propertyData?.name;
  const propertyAddressForContract = propertyData?.address;
  const locationBookingId = (location as any)?.state?.bookingId;

  // Contract PDF fetching
  // ✅ CORRIGÉ : Mémoriser loadContract avec useCallback pour éviter les boucles infinies
  const loadContract = useCallback(async () => {
    try {
      setLoadingContract(true);
      setContractError(null);

      const bookingIdFromState = locationBookingId as string | undefined;
      const hasGuests = Array.isArray(guestGuestsForContract) && guestGuestsForContract.length > 0;
      const hasBookingGuests = Array.isArray(bookingGuestsForContract) && bookingGuestsForContract.length > 0;
      const shouldUsePreview = hasGuests || hasBookingGuests;
      let url: string;

      if (shouldUsePreview) {
        const allGuests: any[] = (guestGuestsForContract && Array.isArray(guestGuestsForContract) ? guestGuestsForContract : (bookingGuestsForContract || []));
        const guestsPayload = (allGuests || []).map((g: any) => ({
          fullName: g.fullName,
          dateOfBirth: g.dateOfBirth,
          documentNumber: g.documentNumber,
          nationality: g.nationality,
          documentType: g.documentType,
        }));
        const bookingLike = {
          id: bookingIdForContract || bookingIdFromState,
          property: {
            id: propertyIdForContract,
            name: propertyNameForContract,
            address: propertyAddressForContract,
            contract_template: propertyData?.contract_template,
            contact_info: propertyData?.contact_info,
            house_rules: propertyData?.house_rules,
          },
          checkInDate: bookingCheckInForContract ? new Date(bookingCheckInForContract).toISOString() : null,
          checkOutDate: bookingCheckOutForContract ? new Date(bookingCheckOutForContract).toISOString() : null,
          numberOfGuests: bookingNumberOfGuests ?? guestsPayload.length ?? 1,
          guests: guestsPayload,
        };
        url = await getContractPdfUrl({ supabase, bookingLike, isPreview: true });
      } else if (bookingIdFromState || bookingIdForContract) {
        const bookingId: string = bookingIdFromState ?? bookingIdForContract;
        url = await getContractPdfUrl({ supabase, bookingId, isPreview: false });
      } else {
        throw new Error('Données de réservation insuffisantes');
      }

      const bust = Date.now();
      const sep = typeof url === 'string' && url.includes('?') ? '&' : '?';

      if (typeof url === 'string' && url.startsWith('data:application/pdf')) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          setContractUrl(objectUrl);
          return;
        } catch (convErr) {
          console.warn('⚠️ Fallback blob URL failed, using data URL directly', convErr);
        }
      }

      if (typeof url === 'string' && url.startsWith('blob:')) {
        setContractUrl(url);
        return;
      }

      setContractUrl(`${url}${sep}t=${bust}`);
    } catch (e: any) {
      console.error('❌ [WelcomingContractSignature] Erreur génération du contrat:', e);
      setContractError(e?.message || 'Erreur lors de la génération du contrat');
      setContractUrl(null);
    } finally {
      setLoadingContract(false);
    }
    // ✅ CORRIGÉ : Utiliser seulement les valeurs primitives comme dépendances
    // Note: propertyData?.contract_template, contact_info, house_rules sont des objets complexes
    // mais ils sont utilisés directement dans la fonction, donc on les garde pour la cohérence
  }, [bookingIdForContract, bookingCheckInForContract, bookingCheckOutForContract, bookingNumberOfGuests, locationBookingId, propertyIdForContract, propertyNameForContract, propertyAddressForContract, propertyData, guestGuestsForContract, bookingGuestsForContract]);

  // ✅ CORRIGÉ : Mettre à jour contractUrl quand initialContractUrl change (problème Vercel)
  useEffect(() => {
    if (initialContractUrl && initialContractUrl !== contractUrl) {
      setContractUrl(initialContractUrl);
      setLoadingContract(false);
      setContractError(null);
    }
  }, [initialContractUrl]);

  // ✅ CORRIGÉ : Extraire les valeurs primitives pour éviter les boucles infinies
  const bookingId = bookingData?.id;
  const bookingCheckIn = bookingData?.checkInDate;
  const bookingCheckOut = bookingData?.checkOutDate;
  const bookingGuests = bookingData?.guests;
  const guestGuests = guestData?.guests;
  const propertyId = propertyData?.id;

  useEffect(() => {
    if (!propertyData) return;
    const hasBookingId = !!bookingId;
    const anyGuests = (Array.isArray(guestGuests) && guestGuests.length > 0) || (Array.isArray(bookingGuests) && bookingGuests.length > 0);
    const hasBookingLike = !!(propertyId && (bookingCheckIn || bookingCheckOut) && anyGuests);
    if (contractUrl) return; // si déjà fourni via navigation state
    if (hasBookingId || hasBookingLike) {
      loadContract();
    }
    // ✅ CORRIGÉ : Utiliser seulement les valeurs primitives comme dépendances + loadContract mémorisé
  }, [propertyId, bookingId, bookingCheckIn, bookingCheckOut, contractUrl, guestGuests?.length, bookingGuests?.length, loadContract]);

  // État pour la signature
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);

  // Configuration du canvas avec un callback ref (une seule fois)
  const canvasCallbackRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && currentStep === 'signature' && !canvasInitialized) {
      // Mettre à jour la ref pour les autres fonctions
      canvasRef.current = canvas;
      
      // Configuration simple du canvas
      canvas.width = 600;
      canvas.height = 250;
      
      // ✅ CORRIGÉ : Utiliser willReadFrequently dans getContext
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
      }

      // ✅ Utiliser la fonction centralisée pour configurer le contexte
      configureCanvasContext(ctx);
      
      setCanvasInitialized(true);
    }
  }, [currentStep, canvasInitialized]);

  // Restaurer la signature si elle existe déjà
  useEffect(() => {
    if (signature && canvasRef.current) {
      const canvas = canvasRef.current;
      // ✅ CORRIGÉ : Utiliser willReadFrequently pour les opérations de lecture
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = signature;
      }
    }
  }, [signature, currentStep]);

  // ✅ NOUVEAU : Fonction pour configurer le contexte du canvas avec les bons styles
  const configureCanvasContext = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0891b2'; // Cyan moderne
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    
    // ✅ CORRIGÉ : Configurer le contexte À CHAQUE FOIS
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // ✅ CRITIQUE : Toujours reconfigurer le contexte pour éviter que les styles se perdent
    configureCanvasContext(ctx);
    
    const pos = getMousePos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // ✅ CORRIGÉ : Configurer le contexte À CHAQUE FOIS pour éviter que la signature s'efface
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // ✅ CRITIQUE : Toujours reconfigurer le contexte
    configureCanvasContext(ctx);
    
    const pos = getMousePos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas not found during stop drawing');
      return;
    }
    
    // Sauvegarder la signature
    const dataURL = canvas.toDataURL('image/png');
    
    // Vérifier que la signature n'est pas vide
    // ✅ CORRIGÉ : Utiliser willReadFrequently pour les opérations de lecture
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasSignature = imageData.data.some((pixel, index) => 
        index % 4 === 3 && pixel > 0 // Vérifier les pixels alpha (transparence)
      );
      
      if (hasSignature) {
        setSignature(dataURL);
      }
    } else {
      // Fallback si on ne peut pas vérifier le contenu
      setSignature(dataURL);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // ✅ CORRIGÉ : Effacer proprement sans réinitialiser tout le canvas
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Effacer le contenu sans réinitialiser les dimensions
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reconfigurer le contexte avec les bons styles
    configureCanvasContext(ctx);
    
    setSignature(null);
  };

  const handleSubmitSignature = async () => {
    if (!signature || !isAgreed) {
      toast({
        title: 'Signature requise',
        description: 'Veuillez signer le contrat et accepter les conditions avant de continuer.',
        variant: 'destructive'
      });
      return;
    }

    
    // ✅ CORRECTION : Validation robuste de la signature
    const canvas = canvasRef.current;
    if (!canvas) {
      toast({
        title: 'Erreur technique',
        description: 'Impossible de capturer la signature. Veuillez recharger la page et réessayer.',
        variant: 'destructive'
      });
      return;
    }

    // ✅ CORRIGÉ : Validation robuste de la signature
    // Vérifier que la signature contient réellement des pixels non-blancs
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonWhitePixels = 0;
      let nonTransparentPixels = 0;
      
      // Parcourir tous les pixels pour détecter une signature réelle
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        
        // Vérifier si le pixel n'est pas transparent
        if (a > 10) { // Seuil de transparence (pas complètement transparent)
          nonTransparentPixels++;
          
          // Vérifier si le pixel n'est pas blanc (tolérance pour les pixels presque blancs)
          const isWhite = r > 240 && g > 240 && b > 240;
          if (!isWhite) {
            nonWhitePixels++;
          }
        }
      }
      
      // Une signature valide doit avoir au moins 100 pixels non-blancs
      const hasSignature = nonWhitePixels > 100 && nonTransparentPixels > 100;
      
      if (!hasSignature) {
        console.warn('⚠️ Signature invalide détectée:', {
          nonWhitePixels,
          nonTransparentPixels,
          totalPixels: imageData.data.length / 4
        });
        toast({
          title: 'Signature requise',
          description: 'Veuillez dessiner votre signature avant de continuer. La signature doit être visible.',
          variant: 'destructive'
        });
        return;
      }
      
      // Signature valide détectée
    }

    setIsSubmitting(true);
    
    // ✅ CORRIGÉ : Ajouter un timeout pour éviter les blocages
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: La sauvegarde de la signature a pris trop de temps')), 30000);
    });
    
    try {
      // ✅ CORRECTION : Utiliser l'ID existant ou échouer
      const bookingId = getBookingId();

      if (!bookingId) {
        // ✅ CORRECTION : Message d'erreur plus informatif et solution
        const errorMessage = 'ID de réservation manquant. ' +
          'Veuillez revenir à la page précédente et réessayer, ' +
          'ou contactez votre hôte pour obtenir un nouveau lien.';
        
        toast({ 
          title: 'Erreur de réservation', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        
        setIsSubmitting(false);
        
        // ✅ NOUVEAU : Essayer de rediriger vers la page de vérification
        setTimeout(() => {
          const currentPath = window.location.pathname;
          const pathParts = currentPath.split('/');
          if (pathParts.length >= 4) {
            const propertyId = pathParts[2];
            const token = pathParts[3];
            window.location.href = `/guest-verification/${propertyId}/${token}`;
          }
        }, 3000);
        
        return; // Sortir sans throw pour éviter les erreurs Portal
      }

      const allGuests = (bookingData?.guests && Array.isArray(bookingData.guests) ? bookingData.guests : (guestData?.guests || [])) as any[];
      const signerName = allGuests?.[0]?.fullName || 'Guest';
      const signerEmail = guestData?.email || null;
      const signerPhone = guestData?.phone || null;
      
      // ✅ CORRIGÉ : Utiliser Promise.race pour éviter les blocages
      const signatureResult = await Promise.race([
        ApiService.saveContractSignature({
          bookingId: bookingId,
          signerName: signerName,
          signerEmail: signerEmail,
          signerPhone: signerPhone,
          signatureDataUrl: signature
        }),
        timeoutPromise
      ]) as any;

      // ✅ CORRIGÉ : Générer le contrat signé via Edge Function (non-blocking)
      Promise.resolve().then(async () => {
        try {
          
          // Utiliser l'Edge Function directement pour générer le contrat signé
          const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
            body: {
              bookingId: bookingId,
              action: 'generate_contract_only',
              signature: {
                data: signature,
                timestamp: new Date().toISOString()
              }
            }
          });

          if (error) {
            console.warn('⚠️ Erreur lors de la génération du contrat signé:', error);
            return;
          }

          if (data?.success && data?.contractUrl && isMountedRef.current) {
            setSignedContractUrl(data.contractUrl);
          }
        } catch (generateError) {
          console.error('⚠️ Failed to generate signed contract for Storage:', generateError);
        }
      });
  
      // Notify property owner (non-blocking)
      Promise.resolve().then(async () => {
        try {
          const ownerEmail = propertyData?.contact_info?.email;
          if (ownerEmail) {
            const dashboardUrl = `${window.location.origin}/dashboard/property/${propertyData?.id}`;
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
      });

      // Envoi d'email au guest si il a fourni son email (non-blocking)
      Promise.resolve().then(async () => {
        try {
          const guestEmail = guestData?.guests?.[0]?.email;
          if (guestEmail && guestEmail.trim() !== '') {
            const { error: guestEmailError } = await supabase.functions.invoke('send-guest-contract', {
              body: {
                guestEmail: guestEmail,
                guestName: signerName,
                checkIn: bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR') : 'N/A',
                checkOut: bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR') : 'N/A',
                propertyName: propertyData?.name || 'Votre hébergement',
                propertyAddress: propertyData?.address || '',
                numberOfGuests: bookingData?.numberOfGuests || 1,
                contractUrl: null // TODO: Ajouter le lien du contrat signé si disponible
              }
            });
            
            if (guestEmailError) {
              // Erreur envoi email guest (non-bloquant)
            }
          }
        } catch (guestNotifyError) {
          console.error('⚠️ Notification guest échouée:', guestNotifyError);
        }
      });

      // ✅ CORRIGÉ : Marquer immédiatement comme terminé pour éviter les blocages
      if (isMountedRef.current) {
        setCurrentStep('celebration');
      }
      
      toast({
        title: 'Contrat signé avec succès ! 🎉',
        description: 'Votre séjour est maintenant confirmé. Nous avons hâte de vous accueillir !',
      });

      // ✅ CORRIGÉ : Appeler onSignatureComplete immédiatement sans setTimeout
      // et vérifier que le composant est toujours monté
      if (isMountedRef.current) {
        try {
          onSignatureComplete(signature);
        } catch (error) {
          console.error('❌ Erreur lors de l\'appel à onSignatureComplete:', error);
        }
      }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 relative overflow-hidden">
      {/* Éléments décoratifs flottants */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          className="absolute top-20 left-20 text-blue-400/20"
        >
          <Heart className="w-12 h-12" />
        </motion.div>
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          style={{ animationDelay: '1s' }}
          className="absolute top-32 right-32 text-teal-400/20"
        >
          <Home className="w-10 h-10" />
        </motion.div>
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          style={{ animationDelay: '2s' }}
          className="absolute bottom-32 left-40 text-purple-400/20"
        >
          <Sparkles className="w-8 h-8" />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <ErrorBoundary>
          {/* ✅ CORRIGÉ : Retirer AnimatePresence pour éviter les conflits avec Portals */}
          {/* Étape 1: Accueil chaleureux */}
          {currentStep === 'welcome' && (
            <div
              key="welcome"
              className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                className="mx-auto w-32 h-32 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center shadow-2xl"
              >
                <Heart className="w-16 h-16 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Bienvenue {guestName.split(' ')[0]} ! 🎉
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
                  Nous sommes ravis de vous accueillir à <span className="font-semibold text-blue-600">{propertyName}</span>
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50 max-w-2xl mx-auto"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-4 text-lg">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Calendar className="w-6 h-6" />
                      <span className="font-medium">Du {checkInDate}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2 text-teal-600">
                      <Calendar className="w-6 h-6" />
                      <span className="font-medium">Au {checkOutDate}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-8 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <span>{bookingData?.numberOfGuests || guestData?.guests?.length || 1} invité{(bookingData?.numberOfGuests || 1) > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      <span>{numberOfNights} nuit{numberOfNights > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-6"
              >
                <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                  Pour finaliser votre réservation, nous avons besoin de votre signature électronique sur le contrat de location. 
                  <span className="text-blue-600 font-medium"> C'est rapide, sécurisé et complètement dématérialisé !</span>
                </p>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => setCurrentStep('review')}
                    size="lg"
                    className="px-12 py-6 text-xl bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
                  >
                    <Sparkles className="w-6 h-6 mr-3" />
                    Commencer la signature
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          )}

          {/* Étape 2: Révision du contrat */}
          {currentStep === 'review' && (
            <div
              key="review"
              className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-100 rounded-full text-blue-800 font-medium">
                  <FileText className="w-5 h-5" />
                  Révision du contrat
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Votre contrat de location
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Prenez le temps de lire attentivement les conditions de votre séjour
                </p>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
                  <p className="text-blue-800 font-medium">
                    📋 Important : Veuillez lire entièrement le contrat ci-dessous avant de procéder à la signature. 
                    Votre signature électronique a la même valeur légale qu'une signature manuscrite.
                  </p>
                </div>
              </div>

              <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50 border-b">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <FileText className="w-7 h-7 text-blue-600" />
                    Contrat de location saisonnière
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingContract ? (
                    <div className="h-96 w-full flex flex-col items-center justify-center space-y-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                      />
                      <p className="text-lg text-gray-600">Génération de votre contrat personnalisé...</p>
                    </div>
                  ) : contractUrl ? (
                    <iframe 
                      src={contractUrl} 
                      title="Contrat de location" 
                      className="w-full h-[600px] rounded-b-lg" 
                    />
                  ) : contractError ? (
                    <div className="p-8 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full text-red-800 mb-4">
                        <AlertDescription className="font-medium">{contractError}</AlertDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={loadContract}
                        className="mt-4"
                      >
                        Réessayer
                      </Button>
                    </div>
                  ) : (
                    <div className="h-96 w-full flex items-center justify-center text-gray-500">
                      Préparation du contrat...
                    </div>
                  )}
                </CardContent>
              </Card>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-4 justify-center"
              >
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('welcome')}
                  size="lg"
                  className="px-8 py-4 rounded-xl"
                >
                  ← Retour
                </Button>
                <Button
                  onClick={() => setCurrentStep('signature')}
                  size="lg"
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-xl"
                >
                  Procéder à la signature
                  <Pen className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </div>
          )}

          {/* Étape 3: Signature */}
          {currentStep === 'signature' && (
            <div
              key="signature"
              className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-100 rounded-full text-green-800 font-medium">
                  <Pen className="w-5 h-5" />
                  Signature électronique
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Signez votre contrat
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Votre signature électronique a la même valeur légale qu'une signature manuscrite
                </p>
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('welcome')}
                    size="sm"
                    className="px-4 py-2"
                  >
                    ← Retour à l'accueil
                  </Button>
                </div>
              </div>

              {/* Affichage du contrat pendant la signature */}
              {contractUrl && (
                <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50 border-b">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <FileText className="w-6 h-6 text-blue-600" />
                      Votre contrat de location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <iframe 
                      src={contractUrl} 
                      title="Contrat de location" 
                      className="w-full h-[400px] rounded-b-lg" 
                    />
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm max-w-3xl mx-auto">
                <CardContent className="p-8 space-y-8">
                  {/* Accord préalable */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-4 p-6 bg-gradient-to-r from-blue-50 to-teal-50 rounded-2xl border border-blue-200"
                  >
                    <Checkbox 
                      id="agree" 
                      checked={isAgreed}
                      onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                      className="mt-1"
                    />
                    <label 
                      htmlFor="agree" 
                      className="text-lg leading-relaxed cursor-pointer"
                    >
                      <span className="font-semibold text-gray-900">J'ai lu et j'accepte</span> toutes les conditions du contrat de location. 
                      Je confirme que toutes les informations fournies sont exactes et complètes.
                    </label>
                  </motion.div>

                  {/* Zone de signature */}
                  {isAgreed && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">Votre signature</h3>
                        <p className="text-gray-600">Dessinez votre signature dans l'espace ci-dessous</p>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-teal-400/10 rounded-3xl blur-xl"></div>
                        <div className="relative border-3 border-dashed border-blue-300 rounded-3xl p-8 bg-white/90 backdrop-blur-sm shadow-xl">
                          {/* Titre de la zone de signature */}
                          <div className="text-center mb-6">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Pen className="w-6 h-6 text-blue-600" />
                              </motion.div>
                              <span className="text-lg font-semibold text-gray-800">Zone de signature</span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Dessinez votre signature comme vous le feriez sur papier
                            </p>
                          </div>

                          {/* ✨ Canvas container ultra-moderne avec animations */}
                          <div className="relative group">
                            {/* Glow effect animé */}
                            <div className={`
                              absolute inset-0 rounded-3xl transition-all duration-500
                              ${signature ? 'bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-teal-400/20 animate-pulse' : 'bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-indigo-400/20 group-hover:from-cyan-500/30 group-hover:via-blue-500/30 group-hover:to-indigo-500/30'}
                              blur-xl
                            `} />
                            
                            <div className={`
                              relative bg-gradient-to-br from-white via-white to-cyan-50/30 rounded-3xl 
                              border-3 transition-all duration-500 shadow-2xl
                              ${signature 
                                ? 'border-gradient-to-r border-green-400 shadow-green-200/50 ring-4 ring-green-100' 
                                : 'border-gradient-to-r border-cyan-300 group-hover:border-cyan-400 group-hover:shadow-cyan-200/50 group-hover:ring-4 group-hover:ring-cyan-100/50'
                              }
                            `}>
                              {/* Badge "En cours de signature" animé */}
                              {isDrawing && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="absolute -top-4 right-4 z-10 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2"
                                >
                                  <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className="w-2 h-2 bg-white rounded-full"
                                  />
                                  En cours de signature...
                                </motion.div>
                              )}
                              
                              {/* Badge "Signature complétée" */}
                              {signature && !isDrawing && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  className="absolute -top-4 left-4 z-10 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Signature validée !
                                </motion.div>
                              )}
                              
                              <canvas
                                ref={canvasCallbackRef}
                                width={600}
                                height={250}
                                className={`
                                  w-full h-full touch-none select-none rounded-3xl
                                  transition-all duration-300
                                  ${isDrawing ? 'cursor-grabbing' : 'cursor-crosshair'}
                                `}
                                style={{ 
                                  touchAction: 'none',
                                  WebkitTouchCallout: 'none',
                                  WebkitUserSelect: 'none',
                                  userSelect: 'none',
                                  display: 'block',
                                  minHeight: '200px',
                                  backgroundColor: 'white'
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                              />
                              
                              {/* Guide lines élégantes pour signature */}
                              <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
                                <div className="absolute bottom-1/3 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent"></div>
                                <div className="absolute top-3 right-4 text-xs font-semibold text-cyan-600/70 flex items-center gap-1">
                                  <Pen className="w-3 h-3" />
                                  Signez ici
                                </div>
                              </div>

                              {/* Indication interactive quand pas de signature */}
                              {!signature && !isDrawing && (
                                <motion.div 
                                  initial={{ opacity: 0.6 }}
                                  animate={{ opacity: [0.6, 1, 0.6] }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                  <div className="text-center">
                                    <motion.div
                                      animate={{ 
                                        y: [0, -8, 0],
                                        rotate: [0, -5, 5, 0]
                                      }}
                                      transition={{ duration: 2.5, repeat: Infinity }}
                                    >
                                      <Pen className="w-14 h-14 mx-auto mb-4 text-cyan-500/60" />
                                    </motion.div>
                                    <p className="text-xl font-semibold text-cyan-600/80 mb-2">✨ Signez ici</p>
                                    <p className="text-sm text-gray-500">Cliquez et dessinez votre signature</p>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </div>

                          {/* Instructions et feedback */}
                          <div className="text-center mt-6 space-y-2">
                            <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <span>🖱️</span>
                                <span>Souris</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>👆</span>
                                <span>Tactile</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>✏️</span>
                                <span>Stylet</span>
                              </div>
                            </div>
                            
                            {signature ? (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-green-50 border border-green-200 rounded-xl p-3"
                              >
                                <div className="flex items-center justify-center gap-2 text-green-700">
                                  <CheckCircle className="w-5 h-5" />
                                  <span className="font-medium">Signature capturée avec succès !</span>
                                </div>
                                <p className="text-sm text-green-600 mt-1">
                                  Vous pouvez maintenant procéder à la signature du contrat
                                </p>
                              </motion.div>
                            ) : (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-blue-700 font-medium text-sm">
                                  💡 Conseil : Signez naturellement comme sur papier
                                </p>
                                <p className="text-blue-600 text-xs mt-1">
                                  Votre signature doit être lisible et ressembler à votre signature habituelle
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Boutons d'action améliorés */}
                      <div className="space-y-4">
                        {/* Boutons secondaires */}
                        <div className="flex gap-3">
                          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              onClick={() => setCurrentStep('review')}
                              size="lg"
                              className="w-full py-4 rounded-xl border-2 border-gray-300 hover:border-blue-400 transition-all"
                            >
                              <ArrowLeft className="w-5 h-5 mr-2" />
                              Retour au contrat
                            </Button>
                          </motion.div>
                          
                          {signature && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8, x: -20 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.8, x: -20 }}
                              whileHover={{ scale: 1.05, rotate: -2 }} 
                              whileTap={{ scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                              <Button 
                                onClick={clearSignature}
                                variant="outline"
                                size="lg"
                                className="
                                  px-6 py-4 rounded-xl border-2 
                                  bg-gradient-to-r from-orange-50 to-red-50
                                  border-orange-400 text-orange-700 
                                  hover:border-red-500 hover:from-orange-100 hover:to-red-100
                                  hover:text-red-700 hover:shadow-lg hover:shadow-orange-200/50
                                  transition-all duration-300
                                  group relative overflow-hidden
                                "
                              >
                                {/* Effet de brillance au survol */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                                
                                <motion.div
                                  animate={{ rotate: [0, -10, 10, 0] }}
                                  transition={{ duration: 0.5, repeat: 0 }}
                                  className="inline-block"
                              >
                                <X className="w-5 h-5 mr-2" />
                                </motion.div>
                                Effacer
                              </Button>
                            </motion.div>
                          )}
                        </div>

                        {/* 🌟 Bouton principal ultra-moderne */}
                        <motion.div 
                          whileHover={signature && !isSubmitting ? { scale: 1.03, y: -2 } : {}} 
                          whileTap={signature && !isSubmitting ? { scale: 0.97 } : {}}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          className="w-full"
                        >
                          <Button 
                            onClick={handleSubmitSignature}
                            disabled={!signature || isSubmitting}
                            size="lg"
                            className={`
                              w-full py-6 rounded-2xl text-lg font-bold transition-all duration-300 
                              relative overflow-hidden group
                              ${signature && !isSubmitting
                                ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white shadow-2xl shadow-green-300/50 hover:shadow-green-400/60 ring-4 ring-green-100 hover:ring-green-200'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'
                              }
                            `}
                          >
                            {/* Effet de brillance animé */}
                            {signature && !isSubmitting && (
                              <motion.div 
                                animate={{ 
                                  x: ['-200%', '200%'],
                                }}
                                transition={{ 
                                  duration: 2, 
                                  repeat: Infinity,
                                  repeatDelay: 1
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              />
                            )}
                            
                            {/* Particules flottantes */}
                            {signature && !isSubmitting && (
                              <>
                                <motion.div
                                  animate={{ 
                                    y: [0, -100, 0],
                                    opacity: [0, 1, 0],
                                    scale: [0, 1, 0]
                                  }}
                                  transition={{ 
                                    duration: 3, 
                                    repeat: Infinity,
                                    delay: 0
                                  }}
                                  className="absolute left-1/4 top-1/2 w-2 h-2 bg-white/50 rounded-full"
                                />
                                <motion.div
                                  animate={{ 
                                    y: [0, -100, 0],
                                    opacity: [0, 1, 0],
                                    scale: [0, 1, 0]
                                  }}
                                  transition={{ 
                                    duration: 3, 
                                    repeat: Infinity,
                                    delay: 1
                                  }}
                                  className="absolute right-1/4 top-1/2 w-2 h-2 bg-white/50 rounded-full"
                                />
                              </>
                            )}
                            
                            <span className="relative z-10 flex items-center justify-center gap-3">
                            {isSubmitting ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  className="mr-3"
                                >
                                  <Loader2 className="w-6 h-6" />
                                </motion.div>
                                Finalisation en cours...
                              </>
                            ) : signature ? (
                              <>
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 0.5 }}
                                >
                                  <CheckCircle className="w-6 h-6" />
                                </motion.div>
                                ✨ Signer le contrat maintenant
                                <motion.div
                                  animate={{ x: [0, 5, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                  <ArrowRight className="w-6 h-6 ml-2" />
                                </motion.div>
                              </>
                            ) : (
                              <>
                                <Pen className="w-6 h-6 opacity-50" />
                                Dessinez votre signature d'abord
                              </>
                            )}
                            </span>
                          </Button>
                        </motion.div>

                        {/* Message d'aide contextuel */}
                        {!signature && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center text-sm text-gray-500 space-y-2"
                          >
                            <p>✍️ Dessinez votre signature dans la zone ci-dessus pour continuer</p>
                            
                            {/* Bouton de test simplifié */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const canvas = canvasRef.current;
                                if (!canvas) {
                                  console.error('❌ Canvas not found');
                                  return;
                                }
                                
                                // ✅ CORRIGÉ : Utiliser willReadFrequently pour les opérations de test
                                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                if (!ctx) {
                                  console.error('❌ Cannot get context');
                                  return;
                                }
                                
                                // Dessiner une signature de test simple
                                ctx.strokeStyle = '#ff0000';
                                ctx.lineWidth = 3;
                                ctx.lineCap = 'round';
                                ctx.beginPath();
                                ctx.moveTo(100, 100);
                                ctx.lineTo(200, 120);
                                ctx.lineTo(300, 100);
                                ctx.lineTo(400, 140);
                                ctx.stroke();
                                
                                // Dessiner quelques lettres
                                ctx.beginPath();
                                ctx.moveTo(150, 150);
                                ctx.lineTo(180, 180);
                                ctx.lineTo(210, 150);
                                ctx.stroke();
                                
                                setSignature(canvas.toDataURL());
                              }}
                              className="mx-auto bg-red-100 hover:bg-red-200 text-red-700"
                            >
                              🧪 TEST - Créer signature test
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {!isAgreed && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <Shield className="w-5 h-5 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Veuillez lire et accepter les conditions du contrat pour pouvoir le signer.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Étape 4: Célébration */}
          {currentStep === 'celebration' && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-8 max-w-2xl mx-auto"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto w-32 h-32 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
              >
                <CheckCircle className="w-16 h-16 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                  Félicitations ! 🎉
                </h1>
                <p className="text-2xl text-gray-600">
                  Votre contrat a été signé avec succès
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-200"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-2 text-green-800">
                    <Gift className="w-6 h-6" />
                    <span className="text-xl font-semibold">Votre séjour est confirmé !</span>
                  </div>
                  
                  <div className="space-y-3 text-lg text-gray-700">
                    <p>✨ Vous recevrez un email de confirmation sous peu</p>
                    <p>🏠 Les informations d'accès vous seront envoyées avant votre arrivée</p>
                    <p>📞 Notre équipe reste à votre disposition pour toute question</p>
                  </div>
                  
                  {/* Affichage du contrat signé */}
                  {signedContractUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                      className="mt-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-lg"
                    >
                      <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Votre contrat signé
                      </h3>
                      <div className="space-y-4">
                        <p className="text-gray-600">
                          Votre contrat a été généré et signé avec succès. Vous pouvez le télécharger ou le consulter.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => window.open(signedContractUrl, '_blank')}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Voir le contrat
                          </Button>
                          <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = signedContractUrl;
                              const bookingId = getBookingId();
                              link.download = `contrat-signe-${bookingId || 'contrat'}.pdf`;
                              link.click();
                            }}
                            variant="outline"
                          >
                            Télécharger PDF
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="pt-4">
                    <p className="text-2xl text-center">
                      <span className="text-gray-600">Nous avons hâte de vous accueillir à</span>
                      <br />
                      <span className="font-bold text-blue-600">{propertyName}</span> ! 
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="flex justify-center gap-4 text-3xl"
              >
                <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>🎉</motion.span>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>❤️</motion.span>
                <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>🏠</motion.span>
              </motion.div>
              </motion.div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};
