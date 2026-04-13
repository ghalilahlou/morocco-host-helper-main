import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  X,
  PenTool,
  Menu
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getContractPdfUrl } from '@/services/contractService';
import { ApiService } from '@/services/apiService';
import { useT, useGuestLocale } from '@/i18n/GuestLocaleProvider';
import { urls } from '@/config/runtime';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePdfViewer } from '@/components/MobilePdfViewer';
import { cn } from '@/lib/utils';
import LanguageSwitcher from '@/components/guest/LanguageSwitcher';
import SignatureCanvas from 'react-signature-canvas';

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
  const navigate = useNavigate();
  const { propertyId: routePropertyId, token: routeToken } = useParams<{ propertyId: string; token: string }>();
  
  // ✅ NOUVEAU : Navigation vers les étapes précédentes (Réservation ou Documents)
  const navigateToStep = (targetStep: 'booking' | 'documents') => {
    // Naviguer vers GuestVerification avec l'étape cible dans le state
    navigate(`/guest-verification/${routePropertyId}/${routeToken}`, {
      state: {
        targetStep,
        // Préserver les données pour éviter de les perdre
        bookingData,
        guestData,
        propertyData,
        fromSignaturePage: true
      }
    });
  };
  
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
  
  const [isAgreed, setIsAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Menu caché par défaut
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();
  const location = useLocation();
  const { locale } = useGuestLocale();
  const t = useT();
  const isMobile = useIsMobile();

  // Breakpoint 1024px pour contract-signing : même layout « mobile » (barre noire + étapes en zone claire) dès que la largeur < 1024px, pour que les changements soient visibles en redimensionnant la fenêtre ou sur tablette
  const [isCompactLayout, setIsCompactLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsCompactLayout(window.innerWidth < 1024);
    mql.addEventListener('change', onChange);
    setIsCompactLayout(window.innerWidth < 1024);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Sur cette page on affiche le « chez moi » mobile dès que compact (mobile ou tablette / fenêtre réduite)
  const showMobileLayout = isMobile || isCompactLayout;

  
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

  // ✅ NOUVEAU: Récupérer les vraies données des guests depuis guest_submissions
  const [realGuestData, setRealGuestData] = useState<any>(null);
  const [totalGuestsCount, setTotalGuestsCount] = useState<number>(1);
  const [realPropertyName, setRealPropertyName] = useState<string>(''); // ✅ NOUVEAU: State pour le vrai nom de la propriété

  // ✅ NOUVEAU: Récupérer le nom de la propriété depuis la base de données
  useEffect(() => {
    const fetchPropertyName = async () => {
      const propertyId = propertyData?.id;
      if (!propertyId) return;

      try {
        const { data: property, error } = await supabase
          .from('properties')
          .select('name')
          .eq('id', propertyId)
          .single();

        if (error) {
          console.error('❌ Erreur récupération nom propriété:', error);
          return;
        }

        if (property?.name) {
          console.log('✅ [RÉCAPITULATIF] Nom de la propriété récupéré depuis DB:', property.name);
          setRealPropertyName(property.name);
        }
      } catch (error) {
        console.error('❌ Erreur fetch property name:', error);
      }
    };

    fetchPropertyName();
  }, [propertyData?.id]);

  useEffect(() => {
    const fetchRealGuestData = async () => {
      const bookingId = getBookingId();
      if (!bookingId) return;

      try {
        // Récupérer les données du premier guest
        const { data: submissions, error } = await supabase
          .from('guest_submissions')
          .select('guest_data')  // ✅ CORRIGÉ: Retirer extracted_data qui n'existe pas
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Erreur récupération guest data:', error);
          return;
        }

        if (submissions && submissions.length > 0) {
          // Compter le nombre total de guests
          setTotalGuestsCount(submissions.length);

          // Récupérer les données du premier guest
          const firstSubmission = submissions[0];
          const guestData = (firstSubmission.guest_data || {}) as any; // ✅ Cast pour éviter les erreurs TypeScript avec Json
          
          const mappedData = {
            fullName: guestData.full_name || guestData.fullName || guestData.name || '',
            email: guestData.email || '',
            nationality: guestData.nationality || guestData.nationalite || '',
            phone: guestData.phone || guestData.telephone || ''
          };

          console.log('✅ [RÉCAPITULATIF] Données guests récupérées:', {
            totalGuests: submissions.length,
            firstGuest: mappedData
          });

          setRealGuestData(mappedData);
        }
      } catch (error) {
        console.error('❌ Erreur fetch guest data:', error);
      }
    };

    fetchRealGuestData();
  }, [bookingData?.id]);

  // Données d'accueil personnalisées - même source que le récapitulatif (sidebar + page finale)
  const navState = (location as any)?.state || {};
  const guestName = realGuestData?.fullName || 
                    guestData?.guests?.[0]?.fullName || 
                    guestData?.fullName || 
                    bookingData?.guests?.[0]?.fullName || 
                    bookingData?.guestName || 
                    bookingData?.guest_name || 
                    navState?.guestData?.guests?.[0]?.fullName || 
                    navState?.bookingData?.guests?.[0]?.fullName || 
                    'Cher invité';
  
  // ✅ CORRIGÉ: Utiliser realPropertyName (récupéré depuis DB) en priorité
  const propertyName = realPropertyName || 
                       propertyData?.name || 
                       propertyData?.property_name || 
                       bookingData?.property?.name || 
                       bookingData?.propertyName || 
                       'Propriété';
  
  // ✅ LOG: Diagnostiquer le nom de la propriété
  console.log('🏠 [RÉCAPITULATIF] Nom de la propriété:', {
    realPropertyName,
    propertyDataName: propertyData?.name,
    propertyDataPropertyName: propertyData?.property_name,
    bookingPropertyName: bookingData?.property?.name,
    bookingPropertyNameDirect: bookingData?.propertyName,
    finalPropertyName: propertyName
  });
  
  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : 'fr-FR';

  const formatContractDate = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString(dateLocale) : t('contract.body.dateUnspecified');

  const checkInDate = bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';
  const checkOutDate = bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';
  const numberOfNights = bookingData?.checkInDate && bookingData?.checkOutDate
    ? Math.ceil((new Date(bookingData.checkOutDate).getTime() - new Date(bookingData.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    : 1;

  const getContractContent = (includeGuestSignature = false) => {
    const allGuests = (bookingData?.guests && Array.isArray(bookingData.guests) ? bookingData.guests : (guestData?.guests || [])) as any[];
    const count = allGuests?.length || bookingData?.numberOfGuests || 1;
    const occupantsText = (allGuests && allGuests.length > 0)
      ? allGuests.map((g, i) => t('contract.body.occupantLine', {
        index: String(i + 1),
        name: g.fullName || '____________',
        dob: g.dateOfBirth ? new Date(g.dateOfBirth).toLocaleDateString(dateLocale) : '__/__/____',
        doc: g.documentNumber || '____________',
      })).join('\n')
      : t('contract.body.noOccupants');

    const fromStr = formatContractDate(bookingData?.checkInDate ?? null);
    const toStr = formatContractDate(bookingData?.checkOutDate ?? null);
    const todayStr = new Date().toLocaleDateString(dateLocale);

    return `
${t('contract.body.title')}

${t('contract.body.landlord')}: ${propertyData?.name || t('contract.body.propertyNameFallback')}
${t('contract.body.address')}: ${propertyData?.address || ''}

${t('contract.body.tenant')}: ${allGuests?.[0]?.fullName || t('contract.body.tenantNameFallback')}

${t('contract.body.rentalPeriod')}:
${t('contract.body.fromTo', { from: fromStr, to: toStr })}

${t('contract.body.numberOfOccupants')}: ${count}

${t('contract.body.article3')}
${t('contract.body.occupantsIntro', { count: String(count) })}
${occupantsText}

${t('contract.body.houseRules')}:
${propertyData?.house_rules?.map((rule: string, index: number) => `${index + 1}. ${rule}`).join('\n') || t('contract.body.noRules')}

${t('contract.body.generalConditions')}:
1. ${t('contract.body.condition1')}
2. ${t('contract.body.condition2')}
3. ${t('contract.body.condition3')}
4. ${t('contract.body.condition4')}
5. ${t('contract.body.condition5')}

${t('contract.body.bySigning')}

${t('contract.body.date')}: ${todayStr}


${t('contract.body.signatures')}:

${t('contract.body.ownerLabel')}:                    ${t('contract.body.tenantLabel')}:

Nom: ${propertyData?.contact_info?.name || propertyData?.name || '________________________'}              Nom: ${allGuests?.[0]?.fullName || '________________________'}

${t('contract.body.signatureOwner')}        Signature: ${includeGuestSignature && signature ? t('contract.body.signatureTenantDone') : t('contract.body.signatureTenantPending')}

${t('contract.body.date')}: ${todayStr}                            ${t('contract.body.date')}: ${todayStr}
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
        url = await getContractPdfUrl({ supabase, bookingLike, isPreview: true, locale });
      } else if (bookingIdFromState || bookingIdForContract) {
        const bookingId: string = bookingIdFromState ?? bookingIdForContract;
        url = await getContractPdfUrl({ supabase, bookingId, isPreview: false, locale });
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
  }, [bookingIdForContract, bookingCheckInForContract, bookingCheckOutForContract, bookingNumberOfGuests, locationBookingId, propertyIdForContract, propertyNameForContract, propertyAddressForContract, propertyData, guestGuestsForContract, bookingGuestsForContract, locale]);

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
  
  // ✅ CORRIGÉ : Déclaration manquante de canvasRef
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ✅ AMÉLIORÉ : Configuration du canvas qui s'initialise dès le montage
  const canvasCallbackRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && !canvasInitialized) {
      canvasRef.current = canvas;
      
      // Configuration du canvas avec device pixel ratio pour meilleure qualité
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // ✅ Dimensions testées et fonctionnelles
      const isMobileDevice = window.innerWidth < 768;
      const logicalWidth = isMobileDevice ? 800 : 1100;
      const logicalHeight = isMobileDevice ? 300 : 300;
      
      // Dimensions réelles (pas de scaling DPR pour éviter les problèmes)
      canvas.width = logicalWidth;
      canvas.height = logicalHeight;
      
      // Style CSS pour l'affichage
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      // ✅ CORRIGÉ : Utiliser willReadFrequently dans getContext
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
      }

      // ✅ PAS de scaling DPR - utiliser les dimensions réelles
      
      // ✅ Utiliser la fonction centralisée pour configurer le contexte
      configureCanvasContext(ctx);
      
      // Remplir le canvas en blanc
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      
      setCanvasInitialized(true);
      console.log('✅ Canvas initialisé avec succès', { width: logicalWidth, height: logicalHeight });
    }
  }, [canvasInitialized]);

  // Redimensionner le canvas pour qu'il corresponde à sa taille CSS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      
      // Sauvegarder la signature actuelle si elle existe
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // Redimensionner le canvas
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Restaurer le contexte
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Restaurer la signature si elle existait
        if (tempCtx) {
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
        
        configureCanvasContext(ctx);
      }
    };

    // Redimensionner au montage
    resizeCanvas();

    // Redimensionner lors du resize de la fenêtre
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [canvasInitialized]);

  // Restaurer la signature si elle existe déjà
  useEffect(() => {
    if (signature && canvasRef.current && canvasInitialized) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          // ✅ CORRIGÉ: Utiliser les dimensions réelles du canvas
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Remplir en blanc d'abord
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          // Dessiner la signature avec les bonnes dimensions
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          configureCanvasContext(ctx); // Reconfigurer pour continuer à dessiner
        };
        img.src = signature;
      }
    }
  }, [signature, canvasInitialized]);

  // ✅ AMÉLIORÉ : Fonction pour configurer le contexte du canvas avec les bons styles (style Airbnb)
  const configureCanvasContext = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#111827'; // Noir profond
    ctx.lineWidth = 3.5; // Trait plus épais pour meilleure visibilité
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Anti-aliasing supplémentaire pour fluidité maximale
    ctx.globalCompositeOperation = 'source-over';
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    // Position relative au canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Convertir en coordonnées du canvas (600x250)
    const canvasX = (x / rect.width) * canvas.width;
    const canvasY = (y / rect.height) * canvas.height;
    
    // Si les dimensions sont invalides, utiliser les coordonnées brutes
    if (!isFinite(canvasX) || !isFinite(canvasY)) {
      return { x, y };
    }
    
    return { x: canvasX, y: canvasY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Reconfigurer le contexte
    configureCanvasContext(ctx);
    
    const pos = getMousePos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
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
        // ✅ Vérifier avec les dimensions testées
        const isMobileDevice = window.innerWidth < 768;
        const checkWidth = isMobileDevice ? 800 : 1100;
        const checkHeight = isMobileDevice ? 300 : 300;
        const imageData = ctx.getImageData(0, 0, checkWidth, checkHeight);
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

      // Génération du contrat / documents : attendre avant « confirmé » pour aligner UI et base
      const generateTimeoutMs = 45000;
      const generateTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('contract_generation_timeout')), generateTimeoutMs);
      });

      const contractLocale = locale === 'en' || locale === 'es' ? locale : 'fr';
      let generatePayload: { data: unknown; error: unknown };
      try {
        generatePayload = await Promise.race([
          supabase.functions.invoke('submit-guest-info-unified', {
            body: {
              bookingId,
              action: 'generate_contract_only',
              signature: {
                data: signature,
                timestamp: new Date().toISOString()
              },
              locale: contractLocale
            }
          }),
          generateTimeoutPromise
        ]) as { data: unknown; error: unknown };
      } catch (raceErr) {
        const isTimeout = raceErr instanceof Error && raceErr.message === 'contract_generation_timeout';
        toast({
          title: t('contractSigning.contractGenFailedTitle'),
          description: isTimeout
            ? t('contractSigning.contractGenTimeoutDescription')
            : t('contractSigning.contractGenFailedDescription'),
          variant: 'destructive'
        });
        return;
      }

      const { data: genData, error: genError } = generatePayload as {
        data: { success?: boolean; contractUrl?: string; error?: string } | null;
        error: { message?: string } | null;
      };

      if (genError) {
        toast({
          title: t('contractSigning.contractGenFailedTitle'),
          description: genError.message || t('contractSigning.contractGenFailedDescription'),
          variant: 'destructive'
        });
        return;
      }

      if (!genData?.success) {
        toast({
          title: t('contractSigning.contractGenFailedTitle'),
          description:
            (typeof genData?.error === 'string' && genData.error) ||
            t('contractSigning.contractGenFailedDescription'),
          variant: 'destructive'
        });
        return;
      }

      if (isMountedRef.current && genData.contractUrl) {
        setSignedContractUrl(genData.contractUrl);
      }

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
            const { data: guestEmailResult, error: guestEmailError } = await supabase.functions.invoke<{
              success?: boolean;
              skipped?: boolean;
              error?: string;
              hint?: string;
            }>('send-guest-contract', {
              body: {
                guestEmail: guestEmail,
                guestName: signerName,
                checkIn: bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR') : 'N/A',
                checkOut: bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR') : 'N/A',
                propertyName: propertyData?.name || t('contractSigning.propertyFallback'),
                propertyAddress: propertyData?.address || '',
                numberOfGuests: bookingData?.numberOfGuests || 1,
                contractUrl: null // TODO: Ajouter le lien du contrat signé si disponible
              }
            });
            
            if (guestEmailError) {
              console.warn('⚠️ Email invité (send-guest-contract) non envoyé — non bloquant:', guestEmailError);
            } else if (guestEmailResult && guestEmailResult.success === false) {
              console.warn('⚠️ Email invité (send-guest-contract) non envoyé — non bloquant:', guestEmailResult.error ?? guestEmailResult);
            }
          }
        } catch (guestNotifyError) {
          console.warn('⚠️ Notification guest échouée (non bloquant):', guestNotifyError);
        }
      });

      if (isMountedRef.current) {
        setCurrentStep('celebration');
      }

      toast({
        title: t('contractSigning.signedToastTitle'),
        description: t('contractSigning.signedToastDescription'),
      });

      // ✅ Sauvegarder le nom du voyageur pour la page de confirmation (ContractSigning)
      try {
        if (guestName && guestName !== 'Cher invité') {
          localStorage.setItem('currentGuestName', guestName);
        }
      } catch (e) { /* ignore */ }

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
    <div className={cn("min-h-screen flex flex-col lg:flex-row items-start", showMobileLayout && "bg-[#FDFDF9]")} style={!showMobileLayout ? { backgroundColor: 'rgba(137, 215, 210, 0.19)' } : undefined}>
      {/* Mobile Header - même « chez moi » que guest-verification : barre noire pleine largeur, logo + langue (visible dès que largeur < 1024px) */}
      {showMobileLayout && (
        <div className="mobile-header guest-verification-mobile-header safe-area-top">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <img
                src="/lovable-uploads/Checky simple - fond transparent.png"
                alt="CHECKY"
                className="h-8 w-8 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span style={{ fontFamily: 'Fira Sans Condensed, sans-serif', fontWeight: 700, fontSize: '20px', color: '#FFFFFF' }}>CHECKY</span>
            </div>
            <div className="language-switcher-in-header">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - masqué quand largeur < 1024px pour garder le même « chez moi » que guest-verification */}
      <div 
        className="hidden lg:flex text-white flex-col fixed left-0 top-0 z-10" 
        style={{ 
          backgroundColor: '#1E1E1E',
          width: '436px',
          height: '100vh',
          borderRadius: '0px 22px 22px 0px',
          boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
          padding: '64px 49px'
        }}
      >
        {/* Logo Section - centered with tagline */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/Checky simple - fond transparent.png" 
              alt="CHECKY Logo" 
              className="h-10 w-10 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span style={{ 
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 700,
              fontSize: '38px',
              lineHeight: '36px',
              color: '#FFFFFF'
            }}>CHECKY</span>
          </div>
          <p style={{ 
            fontFamily: 'Inter, sans-serif',
            fontWeight: 300,
            fontSize: '14px',
            lineHeight: '20px',
            letterSpacing: '-0.5px',
            color: '#0BD9D0',
            textAlign: 'center'
          }}>
            Le check-in digitalisé
          </p>
        </div>
        
        {/* Récapitulatif Section */}
        <div className="mt-8">
          <h2
            style={{
              fontFamily: 'Fira Sans Condensed, sans-serif',
              fontWeight: 400,
              fontSize: '30px',
              lineHeight: '36px',
              color: '#FFFFFF',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            {t('contractSigning.sidebarSummaryTitle')}
          </h2>
          
          {/* Navigation Pills */}
          <div className="space-y-4">
            {/* Property */}
            <div style={{
              border: '1px solid #D3D3D3',
              borderRadius: '500px',
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Home className="w-6 h-6" style={{ color: '#FFFFFF' }} />
              <div>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontWeight: 590,
                  fontSize: '12px',
                  lineHeight: '14px',
                  color: '#FFFFFF'
                }}>{t('contractSigning.chipPropertyLabel')}</p>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '17px',
                  color: '#717171'
                }}>{propertyName || t('contractSigning.propertyFallback')}</p>
              </div>
            </div>
            
            {/* Dates */}
            <div style={{
              border: '1px solid #D3D3D3',
              borderRadius: '500px',
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Calendar className="w-6 h-6" style={{ color: '#FFFFFF' }} />
              <div>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontWeight: 590,
                  fontSize: '12px',
                  lineHeight: '14px',
                  color: '#FFFFFF'
                }}>{t('contractSigning.chipDatesLabel')}</p>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '17px',
                  color: '#717171'
                }}>{checkInDate} - {checkOutDate}</p>
              </div>
            </div>
            
            {/* Voyageurs */}
            <div style={{
              border: '1px solid #D3D3D3',
              borderRadius: '500px',
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Users className="w-6 h-6" style={{ color: '#FFFFFF' }} />
              <div>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontWeight: 590,
                  fontSize: '12px',
                  lineHeight: '14px',
                  color: '#FFFFFF'
                }}>{t('contractSigning.chipTravelersLabel')}</p>
                <p style={{ 
                  fontFamily: 'SF Pro, sans-serif',
                  fontSize: '14px',
                  lineHeight: '17px',
                  color: '#717171'
                }}>{guestName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Main Content - full width en layout compact (< 1024px), même structure que guest-verification */}
      <div 
        className={cn("flex-1 flex flex-col w-full", showMobileLayout && "safe-area-all min-h-screen")}
        style={{ 
          backgroundColor: '#FDFDF9',
          marginLeft: showMobileLayout ? 0 : '436px',
          borderRadius: showMobileLayout ? 0 : '12px',
          minHeight: '100vh'
        }}
      >

        {/* Même bloc que guest-verification : header (logo masqué) pour garder le même espacement */}
        {showMobileLayout && (
          <div className="p-6 flex justify-between items-center">
            <div className="flex items-center" style={{ visibility: 'hidden' }} aria-hidden="true">
              <span style={{ fontFamily: 'Fira Sans Condensed, sans-serif', fontWeight: 700, fontSize: '20px' }}>CHECKY</span>
            </div>
          </div>
        )}

        {/* Étapes dans la partie claire (layout compact) - même style que guest-verification */}
        {showMobileLayout && (
          <div className="guest-verification-steps-in-light">
            <div className="guest-verification-steps-row">
              <div
                className="guest-verification-step-icon done guest-verification-step-clickable"
                role="button"
                tabIndex={0}
                onClick={() => navigateToStep('booking')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToStep('booking'); } }}
              >
                <Home className="guest-verification-step-icon-svg" />
              </div>
              <div className="guest-verification-step-connector done" />
              <div
                className="guest-verification-step-icon done guest-verification-step-clickable"
                role="button"
                tabIndex={0}
                onClick={() => navigateToStep('documents')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToStep('documents'); } }}
              >
                <FileText className="guest-verification-step-icon-svg" />
              </div>
              <div className="guest-verification-step-connector done" />
              <div className="guest-verification-step-icon active" aria-current="step">
                <PenTool className="guest-verification-step-icon-svg" />
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps - masqués en layout compact (< 1024px) */}
        <div className={cn("px-6 pb-8 flex items-start justify-center gap-16", showMobileLayout && "hidden")}>
          {/* Step 1: Réservation - completed - CLIQUABLE */}
          <div 
            className="flex flex-col items-center"
            onClick={() => navigateToStep('booking')}
            style={{
              cursor: 'pointer',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: 'rgba(85, 186, 159, 0.42)', // Complété
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Home className="w-8 h-8" style={{ color: '#FFFFFF' }} />
            </div>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#000000',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepBooking')}</span>
            </span>
          </div>
          
          {/* Step 2: Documents - completed - CLIQUABLE */}
          <div 
            className="flex flex-col items-center"
            onClick={() => navigateToStep('documents')}
            style={{
              cursor: 'pointer',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: 'rgba(85, 186, 159, 0.42)', // Même couleur claire que Réservation (complété)
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText className="w-8 h-8" style={{ color: '#FFFFFF' }} />
            </div>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#000000',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepDocuments')}</span>
            </span>
          </div>
          
          {/* Step 3: Signature - active - NON CLIQUABLE (étape actuelle) */}
          <div 
            className="flex flex-col items-center"
            style={{
              cursor: 'default',
              opacity: 1
            }}
          >
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: '#55BA9F', // Même couleur sélection foncée que Réservation
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PenTool className="w-8 h-8" style={{ color: '#FFFFFF' }} />
            </div>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#000000',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepSignature')}</span>
              {/* Ligne noire sous Signature active */}
              <div style={{
                width: '100%',
                height: '2px',
                backgroundColor: '#000000',
                marginTop: '4px'
              }} />
            </span>
          </div>
        </div>
        
        {/* Main Content - scroll fluide en layout compact ; sur mobile padding bas pour que checkbox + bouton ne soient pas coupés */}
        <div className={cn(
          "flex-1 px-6 overflow-y-auto",
          showMobileLayout ? "guest-verification-main smooth-scroll pb-[max(100px,calc(env(safe-area-inset-bottom)+80px))]" : "pb-6"
        )}>
          <ErrorBoundary>
            {currentStep === 'review' && (
              <div className={cn("mx-auto space-y-8", isMobile ? "max-w-full" : "max-w-4xl")}>
                {/* Header Section - même typo que guest-verification sur mobile */}
                <div className={cn("flex items-center justify-center gap-3", isMobile ? "mb-4 mt-2" : "mb-4")}>
                  <FileText className={cn("flex-shrink-0", isMobile ? "w-7 h-7" : "w-9 h-9")} style={{ color: '#000000' }} />
                  <h2 style={{
                    fontFamily: 'Fira Sans Condensed, sans-serif',
                    fontWeight: 400,
                    fontSize: isMobile ? '20px' : '30px',
                    lineHeight: isMobile ? '26px' : '36px',
                    color: '#040404'
                  }}>{t('contractSignature.title')}</h2>
                </div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: isMobile ? '12px' : '14px',
                  lineHeight: '15px',
                  color: '#4B5563',
                  marginBottom: isMobile ? '16px' : '24px'
                }}>
                  {t('guestVerification.signatureIntro')}
                </p>

              {/* Contract Card - with border matching Figma */}
              <div style={{
                background: '#FFFFFF',
                border: '2px solid #F3F3F3',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
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
                      )}>{t('contractSignature.generating')}</p>
                    </div>
                  ) : contractUrl ? (
                    isMobile ? (
                      <MobilePdfViewer
                        url={contractUrl}
                        title="Contrat de location"
                        className="rounded-b-lg"
                        compactOnMobile
                      />
                    ) : (
                      <iframe 
                        src={`${contractUrl}#zoom=60`}
                        title="Contrat de location" 
                        className="w-full h-[600px] rounded-b-lg" 
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
                        {t('contractSignature.retry')}
                      </Button>
                    </div>
                  ) : (
                    <div className={cn(
                      "w-full flex items-center justify-center text-gray-500",
                      isMobile ? "h-[300px] text-sm" : "h-96"
                    )}>
                      {t('contractSignature.preparing')}
                    </div>
                  )}
                </CardContent>
              </div>

              {/* Checkbox d'acceptation - sur mobile rendu dans la barre fixe en bas ; sur desktop ici */}
              {!showMobileLayout && (
                <div style={{
                  border: '1px dashed rgba(85, 186, 159, 0.76)',
                  borderRadius: '8px',
                  padding: '16px 24px',
                  marginTop: '24px'
                }}>
                  <div className="flex items-start gap-4">
                    <div style={{
                      width: '24px',
                      height: '24px',
                      background: '#FFFFFF',
                      border: '1px solid #C2C2C2',
                      borderRadius: '4px',
                      flexShrink: 0
                    }}>
                      <Checkbox 
                        id="agree" 
                        checked={isAgreed}
                        onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    </div>
                    <label 
                      htmlFor="agree" 
                      style={{
                        fontFamily: 'SF Pro, sans-serif',
                        fontWeight: 400,
                        fontSize: '16px',
                        lineHeight: '19px',
                        color: '#222222',
                        cursor: 'pointer'
                      }}
                    >
                      {t('contractSignature.agreeLabel')}
                    </label>
                  </div>
                </div>
              )}

              {/* Section Signature */}
              {isAgreed && (
                <div className="mt-8">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <Pen className="w-7 h-7" style={{ color: '#000000' }} />
                    <h2 style={{
                      fontFamily: 'Fira Sans Condensed, sans-serif',
                      fontWeight: 400,
                      fontSize: '30px',
                      lineHeight: '36px',
                      color: '#040404'
                    }}>{t('contractSignature.yourSignature')}</h2>
                  </div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '15px',
                    color: '#4B5563',
                    marginBottom: '24px'
                  }}>
                    {t('contractSignature.signatureInstruction')}
                  </p>

                  {/* Signature Container - Dimensions Testées Fonctionnelles */}
                  <div className="relative w-full" style={{
                    maxWidth: isMobile ? '100%' : '1100px',
                    margin: '0 auto'
                  }}>
                    <motion.div 
                      className={cn(
                        "relative rounded-2xl bg-white transition-all duration-300 overflow-hidden",
                        signature ? 'border-2 border-black shadow-xl' : 'border-2 border-gray-300 shadow-md hover:border-gray-400 hover:shadow-lg'
                      )}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      {/* Texte d'aide simplifié - Disparaît pendant le dessin */}
                      {!signature && !isDrawing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <p className={cn(
                            "font-medium text-gray-400",
                            isMobile ? "text-base" : "text-lg"
                          )}>
                            {t('contractSignature.signaturePlaceholder')}
                          </p>
                        </div>
                      )}
                      
                      <canvas
                        ref={canvasCallbackRef}
                        width={isMobile ? 800 : 1100}
                        height={isMobile ? 300 : 300}
                        className={cn(
                          "w-full rounded-2xl touch-none select-none transition-all duration-200 relative z-0",
                          isMobile ? "h-[300px]" : "h-[300px]",
                          isDrawing ? 'cursor-grabbing' : 'cursor-crosshair'
                        )}
                        style={{ 
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          display: 'block',
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
                    </motion.div>
                  </div>

                  {/* Feedback simple */}
                  {!signature && (
                    <div className="mt-3 text-center text-xs text-gray-500">
                      {t('contractSignature.signatureHint')}
                    </div>
                  )}

                  {/* Boutons Signature */}
                  <div className={cn(
                    "flex items-center mt-6",
                    isMobile ? "flex-col gap-2" : "gap-3"
                  )}>
                    {signature && (
                      <Button 
                        onClick={clearSignature}
                        variant="outline"
                        size={isMobile ? "default" : "lg"}
                        className={cn(
                          "border-2 border-black text-black hover:bg-black hover:text-white transition-all",
                          isMobile ? "w-full px-3 py-2 text-sm" : "px-4 py-3"
                        )}
                      >
                        <X className={cn(
                          "mr-1",
                          isMobile ? "w-3 h-3" : "w-4 h-4"
                        )} />
                        {t('common.clear')}
                      </Button>
                    )}
                    
                    <Button 
                      onClick={handleSubmitSignature}
                      disabled={!signature || !isAgreed || isSubmitting}
                      size={isMobile ? "default" : "lg"}
                      className={cn(
                        "flex-1 font-bold transition-all duration-300",
                        isMobile ? "w-full py-4 text-base" : "py-5 text-lg",
                        signature && isAgreed && !isSubmitting
                          ? 'text-white shadow-xl hover:shadow-2xl'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      )}
                      style={signature && isAgreed && !isSubmitting ? { backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px' } : undefined}
                      onMouseEnter={signature && isAgreed && !isSubmitting ? (e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; } : undefined}
                      onMouseLeave={signature && isAgreed && !isSubmitting ? (e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; } : undefined}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className={cn(
                            "mr-2 animate-spin",
                            isMobile ? "w-4 h-4" : "w-5 h-5"
                          )} />
                          <span className={isMobile ? "text-xs" : ""}>{t('contractSignature.signingInProgress')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className={cn(
                            "mr-2",
                            isMobile ? "w-4 h-4" : "w-5 h-5"
                          )} />
                          {t('guest.navigation.next')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!isAgreed && (
                <Alert className="bg-amber-50 border-2 border-amber-200 rounded-lg mt-6">
                  <div className="flex items-baseline gap-2">
                    <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 translate-y-[1px]" />
                    <AlertDescription className="text-amber-800 font-medium leading-relaxed">
                      {t('contractSignature.mustAgree')}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Bouton Précédent juste sous l'alerte / le titre */}
              {onBack && (
                <div className={cn("mt-4", isMobile ? "w-full" : "")}>
                  <Button 
                    onClick={onBack}
                    size={isMobile ? "default" : "lg"}
                    className={cn(
                      "font-semibold transition-all",
                      isMobile ? "w-full px-3 py-2 text-sm" : "px-4 py-3"
                    )}
                    style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px', border: 'none', color: '#040404' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                  >
                    <ArrowLeft className={cn(
                      "mr-1",
                      isMobile ? "w-3 h-3" : "w-4 h-4"
                    )} />
                    {t('guest.navigation.previous')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Étape de confirmation - Design Figma */}
          {currentStep === 'celebration' && (
            <div 
              className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1E1E1E]", isMobile && "safe-area-all pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]")}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Logo Checky centré proche du titre */}
              <div style={{ position: 'absolute', top: isMobile ? 'max(80px, calc(env(safe-area-inset-top) + 40px))' : '140px', left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center', width: '100%' }}>
                <img 
                  src="/lovable-uploads/Checky simple - fond transparent.png" 
                  alt="Checky Logo" 
                  style={{ 
                    width: '150px', 
                    height: 'auto', 
                    objectFit: 'contain'
                  }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>

              {/* Contenu principal centré */}
              <div style={{ textAlign: 'center', maxWidth: '648px', padding: '0 24px' }}>

                
                {/* Titre de confirmation */}
                <h1 style={{
                  fontFamily: 'Fira Sans Condensed, sans-serif',
                  fontWeight: 400,
                  fontSize: '30px',
                  lineHeight: '36px',
                  color: '#FFFFFF',
                  marginBottom: '24px'
                }}>
                  Votre check-in est confirmé
                </h1>

                {/* Message de description */}
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#FFFFFF',
                  marginBottom: '48px'
                }}>
                  C'est fini ! Le propriétaire de l'hébergement a bien reçu les documents nécessaires à votre check-in. 
                  Nous vous souhaitons un agréable séjour.
                </p>

                {/* Récapitulatif - Navigation Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  {/* Propriété */}
                  <div style={{
                    width: '273px',
                    border: '1px solid #D3D3D3',
                    borderRadius: '500px',
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <Home className="w-6 h-6" style={{ color: '#FFFFFF' }} />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 590,
                        fontSize: '12px',
                        lineHeight: '14px',
                        color: '#FFFFFF'
                      }}>Propriété</p>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '17px',
                        color: '#717171'
                      }}>{propertyName || t('contractSigning.propertyFallback')}</p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{
                    width: '273px',
                    border: '1px solid #D3D3D3',
                    borderRadius: '500px',
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <Calendar className="w-6 h-6" style={{ color: '#FFFFFF' }} />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 590,
                        fontSize: '12px',
                        lineHeight: '14px',
                        color: '#FFFFFF'
                      }}>Dates</p>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '17px',
                        color: '#717171'
                      }}>{checkInDate} - {checkOutDate}</p>
                    </div>
                  </div>

                  {/* Voyageurs */}
                  <div style={{
                    width: '273px',
                    border: '1px solid #D3D3D3',
                    borderRadius: '500px',
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <Users className="w-6 h-6" style={{ color: '#FFFFFF' }} />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 590,
                        fontSize: '12px',
                        lineHeight: '14px',
                        color: '#FFFFFF'
                      }}>Voyageurs</p>
                      <p style={{ 
                        fontFamily: 'SF Pro, Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '17px',
                        color: '#717171'
                      }}>
                        {guestName}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer - safe-area on mobile */}
              <footer style={{
                position: 'absolute',
                bottom: isMobile ? 'max(24px, env(safe-area-inset-bottom))' : '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#FFFFFF',
                textAlign: 'center'
              }}>
                © 2025 Checky — Tous droits réservés, Mentions légales • Politique de confidentialité • CGV
              </footer>
            </div>
          )}
        </ErrorBoundary>

        {/* Mobile : barre fixe en bas avec "J'accepte" pour rester visible (contract-signing) */}
        {showMobileLayout && currentStep === 'review' && (
          <div
            className="sticky bottom-0 left-0 right-0 z-20 px-4 py-3 bg-[#FDFDF9] border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div
              style={{
                border: '1px dashed rgba(85, 186, 159, 0.76)',
                borderRadius: '8px',
                padding: '12px 16px'
              }}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id="agree-mobile"
                  checked={isAgreed}
                  onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                  className="h-5 w-5 shrink-0 rounded border-2 border-[#C2C2C2] data-[state=checked]:bg-[#55BA9F] data-[state=checked]:border-[#55BA9F]"
                />
                <label
                  htmlFor="agree-mobile"
                  className="text-sm font-normal text-[#222222] cursor-pointer leading-tight"
                  style={{ fontFamily: 'SF Pro, sans-serif' }}
                >
                  {t('contractSignature.agreeLabel')}
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - même style que guest-verification (safe-area sur mobile uniquement) */}
      <footer className={cn(isMobile && "safe-area-bottom", showMobileLayout && "guest-verification-footer")} style={{ padding: '16px 24px', backgroundColor: '#FDFDF9' }}>
        <p className="text-sm text-gray-600 text-center" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '12px', lineHeight: '15px', color: '#000000' }}>
          © 2025 Checky — Tous droits réservés · Mentions légales · Politique de confidentialité · CGV
        </p>
      </footer>
    </div>
  </div>
  );
};
