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
import { urls } from '@/config/runtime';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePdfViewer } from '@/components/MobilePdfViewer';
import { cn } from '@/lib/utils';

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
  const [currentStep, setCurrentStep] = useState<'review' | 'celebration'>('review');
  
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
  
  // ✅ SIMPLIFIÉ : Plus besoin de réinitialiser le canvas car on reste sur la même page
  const [isAgreed, setIsAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const location = useLocation();
  const t = useT();
  const isMobile = useIsMobile();

  
  
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

  // ✅ AMÉLIORÉ : Configuration du canvas qui s'initialise dès le montage
  const canvasCallbackRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && !canvasInitialized) {
      canvasRef.current = canvas;
      
      // Configuration du canvas avec device pixel ratio pour meilleure qualité
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Dimensions logiques
      const logicalWidth = 600;
      const logicalHeight = 250;
      
      // Dimensions réelles avec DPR
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      
      // Style CSS pour l'affichage
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      
      // ✅ CORRIGÉ : Utiliser willReadFrequently dans getContext
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
      }

      // Mettre à l'échelle pour le DPR
      ctx.scale(dpr, dpr);
      
      // ✅ Utiliser la fonction centralisée pour configurer le contexte
      configureCanvasContext(ctx);
      
      // Remplir le canvas en blanc
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      
      setCanvasInitialized(true);
      console.log('✅ Canvas initialisé avec succès');
    }
  }, [canvasInitialized]);

  // Restaurer la signature si elle existe déjà
  useEffect(() => {
    if (signature && canvasRef.current && canvasInitialized) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          // Remplir en blanc d'abord
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 600, 250);
          // Dessiner la signature
          ctx.drawImage(img, 0, 0, 600, 250);
          configureCanvasContext(ctx); // Reconfigurer pour continuer à dessiner
        };
        img.src = signature;
      }
    }
  }, [signature, canvasInitialized]);

  // ✅ AMÉLIORÉ : Fonction pour configurer le contexte du canvas avec les bons styles
  const configureCanvasContext = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0891b2'; // brand-teal
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    // Utiliser les dimensions logiques (600x250) au lieu des dimensions réelles
    const scaleX = 600 / rect.width;
    const scaleY = 250 / rect.height;
    
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
    
    // ✅ AMÉLIORÉ : Sauvegarder la signature avec un petit délai pour s'assurer que le dernier trait est bien dessiné
    setTimeout(() => {
      const dataURL = canvas.toDataURL('image/png', 1.0);
      
      // Vérifier que la signature n'est pas vide
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        // Utiliser les dimensions logiques pour la vérification
        const imageData = ctx.getImageData(0, 0, 600, 250);
        let nonWhitePixels = 0;
        
        // Compter les pixels non-blancs
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          
          // Vérifier si le pixel n'est pas blanc et a de l'opacité
          if (a > 10 && !(r > 240 && g > 240 && b > 240)) {
            nonWhitePixels++;
          }
        }
        
        if (nonWhitePixels > 50) { // Au moins 50 pixels non-blancs
          setSignature(dataURL);
          console.log('✅ Signature sauvegardée avec', nonWhitePixels, 'pixels');
        } else {
          console.log('⚠️ Signature trop petite ou vide:', nonWhitePixels, 'pixels');
        }
      } else {
        // Fallback si on ne peut pas vérifier le contenu
        setSignature(dataURL);
      }
    }, 50);
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
        title: 'Contrat signé avec succès',
        description: 'Votre séjour est maintenant confirmé. Vous recevrez un email de confirmation sous peu.',
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-teal-50 relative overflow-hidden">
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

      <div className={cn(
        "relative z-10 mx-auto",
        isMobile ? "px-2 py-4 max-w-full" : "px-4 py-8 max-w-5xl"
      )}>
        <ErrorBoundary>
          {/* ✅ SIMPLIFIÉ : Une seule page avec contrat + signature */}
          {currentStep === 'review' && (
            <div
              key="review"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="text-center space-y-2 sm:space-y-3">
                <div className={cn(
                  "inline-flex items-center gap-2 sm:gap-3 rounded-full text-brand-teal font-semibold border-2 border-brand-teal/20 shadow-sm",
                  isMobile ? "px-3 py-2 text-sm" : "px-6 py-3",
                  "bg-gradient-to-r from-brand-teal/10 to-teal-100"
                )}>
                  <FileText className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
                  <span className={isMobile ? "text-xs" : ""}>Signature du contrat</span>
                </div>
                <h2 className={cn(
                  "font-bold text-gray-900",
                  isMobile ? "text-xl" : "text-2xl md:text-3xl"
                )}>
                  Votre contrat de location
                </h2>
                <p className={cn(
                  "text-gray-600 max-w-2xl mx-auto",
                  isMobile ? "text-sm px-2" : "text-lg"
                )}>
                  Lisez le contrat ci-dessous, acceptez les conditions et signez
                </p>
              </div>

              {/* Contrat en haut */}
              <Card className={cn(
                "shadow-xl border-2 border-gray-200 bg-white",
                isMobile ? "rounded-lg" : "rounded-xl"
              )}>
                <CardHeader className={cn(
                  "bg-gradient-to-r from-brand-teal/10 via-cyan-50 to-teal-50 border-b-2 border-brand-teal/20",
                  isMobile ? "p-3" : "p-6"
                )}>
                  <CardTitle className={cn(
                    "flex items-center gap-2 sm:gap-3 font-bold text-gray-900",
                    isMobile ? "text-base" : "text-xl"
                  )}>
                    <div className={cn(
                      "rounded-full bg-gradient-to-br from-brand-teal to-teal-600 flex items-center justify-center shadow-md flex-shrink-0",
                      isMobile ? "w-6 h-6" : "w-8 h-8"
                    )}>
                      <FileText className={cn(
                        "text-white",
                        isMobile ? "w-3 h-3" : "w-5 h-5"
                      )} />
                    </div>
                    <span className={isMobile ? "text-sm" : ""}>Contrat de location saisonnière</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingContract ? (
                    <div className={cn(
                      "w-full flex flex-col items-center justify-center space-y-4",
                      isMobile ? "h-[300px]" : "h-96"
                    )}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className={cn(
                          "border-4 border-brand-teal border-t-transparent rounded-full",
                          isMobile ? "w-8 h-8" : "w-12 h-12"
                        )}
                      />
                      <p className={cn(
                        "text-gray-600",
                        isMobile ? "text-sm" : "text-lg"
                      )}>Génération de votre contrat...</p>
                    </div>
                  ) : contractUrl ? (
                    isMobile ? (
                      <MobilePdfViewer
                        url={contractUrl}
                        title="Contrat de location"
                        className="rounded-b-lg"
                      />
                    ) : (
                      <iframe 
                        src={contractUrl} 
                        title="Contrat de location" 
                        className="w-full h-[400px] rounded-b-lg" 
                      />
                    )
                  ) : contractError ? (
                    <div className={cn(
                      "text-center",
                      isMobile ? "p-4" : "p-8"
                    )}>
                      <div className={cn(
                        "inline-flex items-center gap-2 rounded-full text-red-800 mb-4",
                        isMobile ? "px-3 py-1.5 text-xs" : "px-4 py-2"
                      )}>
                        <AlertDescription className={cn(
                          "font-medium",
                          isMobile ? "text-xs" : ""
                        )}>{contractError}</AlertDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={loadContract}
                        size={isMobile ? "sm" : "default"}
                        className="mt-4"
                      >
                        Réessayer
                      </Button>
                    </div>
                  ) : (
                    <div className={cn(
                      "w-full flex items-center justify-center text-gray-500",
                      isMobile ? "h-[300px] text-sm" : "h-96"
                    )}>
                      Préparation du contrat...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Zone de signature et acceptation */}
              <Card className={cn(
                "shadow-xl border-2 border-gray-200 bg-white",
                isMobile ? "rounded-lg" : "rounded-xl"
              )}>
                <CardContent className={cn(
                  "space-y-4 sm:space-y-6",
                  isMobile ? "p-4" : "p-6"
                )}>
                  {/* Accord préalable - toujours visible */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-start bg-gradient-to-r from-brand-teal/5 via-cyan-50 to-teal-50 rounded-lg border-2 border-brand-teal/30",
                      isMobile ? "space-x-2 p-3" : "space-x-3 p-4"
                    )}
                  >
                    <Checkbox 
                      id="agree" 
                      checked={isAgreed}
                      onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                      className={cn(
                        "mt-1 flex-shrink-0",
                        isMobile && "mt-0.5"
                      )}
                    />
                    <label 
                      htmlFor="agree" 
                      className={cn(
                        "leading-relaxed cursor-pointer text-gray-800 flex-1",
                        isMobile ? "text-sm" : "text-base"
                      )}
                    >
                      <span className="font-semibold text-gray-900">J'ai lu et j'accepte</span> toutes les conditions du contrat. 
                      Je confirme que toutes les informations sont exactes.
                    </label>
                  </motion.div>

                  {/* Zone de signature - visible dès que l'accord est accepté */}
                  {isAgreed && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3 sm:space-y-4"
                    >
                      <div className="text-center">
                        <h3 className={cn(
                          "font-bold text-gray-900 mb-1",
                          isMobile ? "text-lg" : "text-xl"
                        )}>Votre signature</h3>
                        <p className={cn(
                          "text-gray-600",
                          isMobile ? "text-xs" : "text-sm"
                        )}>Dessinez votre signature ci-dessous</p>
                      </div>

                          <div className="relative w-full max-w-full overflow-hidden">
                        <div className={cn(
                          "relative border-2 border-dashed border-brand-teal/40 rounded-lg bg-gradient-to-br from-white via-white to-cyan-50/30 shadow-md hover:shadow-lg transition-all duration-200",
                          isMobile ? "p-2" : "p-4"
                        )}>

                          {/* ✨ Canvas container ultra-moderne avec animations - Responsive */}
                          <div className="relative group w-full">
                            {/* Glow effect animé */}
                            <div className={`
                              absolute inset-0 rounded-3xl transition-all duration-500
                              ${signature ? 'bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-teal-400/20 animate-pulse' : 'bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-indigo-400/20 group-hover:from-cyan-500/30 group-hover:via-blue-500/30 group-hover:to-indigo-500/30'}
                              blur-xl
                            `} />
                            
                            <div className={cn(
                              "relative bg-gradient-to-br from-white via-white to-cyan-50/30 rounded-xl border-2 transition-all duration-500 shadow-xl overflow-hidden",
                              signature 
                                ? 'border-green-400 shadow-green-200/50 ring-4 ring-green-100' 
                                : 'border-brand-teal/40 group-hover:border-brand-teal/60 group-hover:shadow-brand-teal/20 group-hover:ring-4 group-hover:ring-brand-teal/20',
                              isMobile && "rounded-lg"
                            )}>
                              {/* Badge "Signature complétée" */}
                              {signature && !isDrawing && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={cn(
                                    "absolute z-10 bg-green-500 text-white rounded-full font-semibold shadow-md flex items-center gap-1",
                                    isMobile ? "-top-1 right-1 px-2 py-0.5 text-[10px]" : "-top-2 right-2 px-3 py-1 text-xs"
                                  )}
                                >
                                  <CheckCircle className={isMobile ? "w-2.5 h-2.5" : "w-3 h-3"} />
                                  Validée
                                </motion.div>
                              )}
                              
                              <canvas
                                ref={canvasCallbackRef}
                                width={600}
                                height={250}
                                className={cn(
                                  "w-full touch-none select-none rounded-lg transition-all duration-200",
                                  isDrawing ? 'cursor-grabbing' : 'cursor-crosshair',
                                  isMobile && "touch-pan-none rounded-md"
                                )}
                                style={{ 
                                  touchAction: 'none',
                                  WebkitTouchCallout: 'none',
                                  WebkitUserSelect: 'none',
                                  userSelect: 'none',
                                  display: 'block',
                                  height: isMobile ? '120px' : '200px',
                                  maxHeight: isMobile ? '120px' : '200px',
                                  width: '100%',
                                  maxWidth: '100%',
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb'
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
                              
                              {/* Guide line simple */}
                              {!signature && (
                                <div className="absolute bottom-1/3 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-teal/30 to-transparent pointer-events-none"></div>
                              )}
                            </div>
                          </div>

                          {/* Feedback simple */}
                          {signature ? (
                            <div className="mt-3 text-center">
                              <div className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
                                <CheckCircle className="w-4 h-4" />
                                Signature prête
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 text-center text-xs text-gray-500">
                              💡 Signez naturellement avec votre souris, doigt ou stylet
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ✅ SIMPLIFIÉ : Un seul bouton principal */}
                      <div className={cn(
                        "flex items-center",
                        isMobile ? "flex-col gap-2" : "gap-3"
                      )}>
                        {signature && (
                          <Button 
                            onClick={clearSignature}
                            variant="outline"
                            size={isMobile ? "default" : "lg"}
                            className={cn(
                              "border-2 border-gray-300 hover:border-red-400 text-gray-700 hover:text-red-700 transition-all",
                              isMobile ? "w-full px-3 py-2 text-sm" : "px-4 py-3"
                            )}
                          >
                            <X className={cn(
                              "mr-1",
                              isMobile ? "w-3 h-3" : "w-4 h-4"
                            )} />
                            Effacer
                          </Button>
                        )}
                        
                        <Button 
                          onClick={handleSubmitSignature}
                          disabled={!signature || !isAgreed || isSubmitting}
                          size={isMobile ? "default" : "lg"}
                          className={cn(
                            "flex-1 rounded-xl font-semibold transition-all duration-200",
                            isMobile ? "w-full py-3 text-sm" : "py-4 text-base",
                            signature && isAgreed && !isSubmitting
                              ? 'bg-brand-teal hover:bg-brand-teal/90 text-white shadow-lg hover:shadow-xl'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          )}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className={cn(
                                "mr-2 animate-spin",
                                isMobile ? "w-4 h-4" : "w-5 h-5"
                              )} />
                              <span className={isMobile ? "text-xs" : ""}>Signature en cours...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className={cn(
                                "mr-2",
                                isMobile ? "w-4 h-4" : "w-5 h-5"
                              )} />
                              Signer le contrat
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {!isAgreed && (
                    <Alert className="bg-amber-50 border-2 border-amber-200 rounded-lg">
                      <Shield className="w-5 h-5 text-amber-600" />
                      <AlertDescription className="text-amber-800 font-medium">
                        Veuillez lire et accepter les conditions du contrat pour pouvoir le signer.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Étape de confirmation professionnelle */}
          {currentStep === 'celebration' && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto"
            >
              <Card className="shadow-xl border-2 border-gray-200 bg-white rounded-xl overflow-hidden">
                <CardContent className="p-8 md:p-12">
                  {/* En-tête professionnel */}
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="mx-auto w-20 h-20 bg-brand-teal rounded-full flex items-center justify-center shadow-lg mb-6"
                    >
                      <CheckCircle className="w-10 h-10 text-white" />
                    </motion.div>
                    
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                      Contrat signé avec succès
                    </h1>
                    <p className="text-lg text-gray-600">
                      Félicitations ! Votre séjour est maintenant confirmé.
                    </p>
                  </div>

                  {/* Informations importantes */}
                  <div className="bg-gradient-to-r from-brand-teal/5 via-cyan-50/50 to-teal-50 rounded-lg p-6 border border-brand-teal/20 mb-8">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="w-4 h-4 text-brand-teal" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 mb-1">Confirmation par email</p>
                          <p className="text-sm text-gray-600">
                            Vous avez reçu toutes les informations par email, incluant votre contrat signé et les détails de votre réservation.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Home className="w-4 h-4 text-brand-teal" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 mb-1">Informations d'accès</p>
                          <p className="text-sm text-gray-600">
                            Les informations d'accès à la propriété vous seront envoyées avant votre arrivée.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-4 h-4 text-brand-teal" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 mb-1">Support client</p>
                          <p className="text-sm text-gray-600">
                            Notre équipe reste à votre disposition pour toute question ou assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contrat signé */}
                  {signedContractUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-brand-teal" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Votre contrat signé</h3>
                          <p className="text-sm text-gray-600">Document disponible en téléchargement</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => window.open(signedContractUrl, '_blank')}
                          className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-white"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Consulter le contrat
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
                          className="flex-1 border-2 border-gray-300 hover:border-brand-teal/50"
                        >
                          Télécharger PDF
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Message de bienvenue professionnel */}
                  <div className="text-center pt-6 border-t border-gray-200">
                    <p className="text-gray-700 mb-2">
                      Nous avons hâte de vous accueillir à
                    </p>
                    <p className="text-xl font-semibold text-brand-teal">
                      {propertyName}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};
