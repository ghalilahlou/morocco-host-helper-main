import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { sanitizeGuestName } from '@/utils/guestNameUtils';
import { useGuestPrefillFromUrl } from '@/hooks/useGuestPrefillFromUrl';
import { useGuestPrefillFromIcsToken } from '@/hooks/useGuestPrefillFromIcsToken';
import { useGuestPrefillFromAirbnbBooking } from '@/hooks/useGuestPrefillFromAirbnbBooking';
import { motion } from 'framer-motion';
// ✅ CORRIGÉ : flushSync retiré car il cause des erreurs Portal
// import { flushSync } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// ✅ ErrorBoundary retiré - l'intercepteur global window.onerror gère les erreurs Portal
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, X, CheckCircle, Users, Calendar as CalendarLucide, ArrowRight, ArrowLeft, Sparkles, RefreshCw, RotateCcw, Check, PenTool, Home, CloudUpload, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MOTIF_STAY_OPTIONS } from '@/constants/guestMotif';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate, formatLocalDate, extractDateOnly, parseStayDateForCalendar, parseAndNormalizeStayDate } from '@/utils/dateUtils';
import { OpenAIDocumentService } from '@/services/openaiDocumentService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { EnhancedInput } from '@/components/ui/enhanced-input';
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload';
import { AnimatedStepper } from '@/components/ui/animated-stepper';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { validateToken, isTestToken, logTestTokenUsage, TEST_TOKENS_CONFIG } from '@/utils/testTokens';
import { validateTokenDirect } from '@/utils/tokenValidation';
import { Guest } from '@/types/booking'; // ✅ Importer le type centralisé
import { DEV_GUEST_VERIFICATION_URL, DEV_PRESET_GUEST } from '@/config/devGuestVerification';
import LanguageSwitcher from '@/components/guest/LanguageSwitcher';
import { GuestDateSelectField } from '@/components/guest/GuestDateSelectField';
import { NATIONALITIES } from '@/data/nationalities';
import { AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
function createEmptyGuestForm(): Guest {
  return {
    fullName: '',
    dateOfBirth: undefined,
    nationality: '',
    documentNumber: '',
    documentType: 'passport',
    documentIssueDate: undefined,
    profession: '',
    motifSejour: 'TOURISME',
    adressePersonnelle: '',
    email: '',
    placeOfBirth: undefined,
  };
}

// ✅ Interface Guest supprimée - utilisation du type centralisé de @/types/booking

interface UploadedDocument {
  file: File;
  url: string;
  processing: boolean;
  extractedData?: any;
  isInvalid?: boolean;
  ocrFailed?: boolean;
}

/** Parse une date extraite par l'IA en évitant `new Date('YYYY-MM-DD')` (décalage UTC / jour manquant). */
function parseGuestDateFromExtraction(value: string | undefined): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const isoStrict = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoStrict) {
    try {
      return parseLocalDate(trimmed);
    } catch {
      return null;
    }
  }
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) return direct;
  const ddmmyyyy = trimmed.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3], 10), parseInt(ddmmyyyy[2], 10) - 1, parseInt(ddmmyyyy[1], 10));
  }
  return null;
}

function formatDocExtractSummary(doc: UploadedDocument, guestAtIndex: Guest | undefined): string {
  const ext = doc.extractedData as Partial<Guest> | undefined;
  const parts: string[] = [];
  const name = ext?.fullName || guestAtIndex?.fullName;
  if (name) parts.push(String(name));
  if (ext?.documentNumber) parts.push(`N° ${ext.documentNumber}`);
  if (ext?.nationality) parts.push(String(ext.nationality));
  if (ext?.placeOfBirth) parts.push(`Né(e) à ${ext.placeOfBirth}`);
  return parts.join(' · ') || '—';
}

/**
 * Signature stable des paramètres « réservation » pour le flux ICS.
 * Exclut `lang` (ajouté par GuestLocaleProvider via replaceState) pour éviter
 * un second passage qui efface les dates / bloque sur isCheckingICSRef.
 */
const GUEST_VERIFICATION_ICS_QUERY_KEYS = ['startDate', 'endDate', 'guests', 'airbnbCode', 'guestName'] as const;
function bookingQuerySignatureFromSearch(search: string): string {
  try {
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return GUEST_VERIFICATION_ICS_QUERY_KEYS.map((k) => `${k}=${sp.get(k) ?? ''}`).join('&');
  } catch {
    return '';
  }
}

/** TTL du cache check-in invité dans le navigateur (4 h). */
const CHECKIN_BROWSER_CACHE_TTL_MS = 4 * 3600 * 1000;

type CompletedCheckInCache = {
  bookingId: string;
  contractUrl: string | null;
};

function readCompletedCheckInFromBrowser(
  propertyId: string | undefined,
  token: string | undefined
): CompletedCheckInCache | null {
  if (!propertyId || !token || typeof window === 'undefined') return null;

  const ns = `${propertyId}:${token}`;

  try {
    const flagRaw = localStorage.getItem(`checkInCompleted:${ns}`);
    if (flagRaw) {
      const parsed = JSON.parse(flagRaw) as {
        bookingId?: string;
        contractUrl?: string | null;
        at?: number;
      };
      if (
        parsed.bookingId &&
        parsed.at &&
        Date.now() - parsed.at < CHECKIN_BROWSER_CACHE_TTL_MS
      ) {
        return {
          bookingId: parsed.bookingId,
          contractUrl:
            parsed.contractUrl ??
            localStorage.getItem(`contractUrl:${ns}`) ??
            null,
        };
      }
    }

    const bookingId = localStorage.getItem(`currentBookingId:${ns}`);
    if (!bookingId) return null;

    const submittedAtRaw = localStorage.getItem(`submittedAt:${bookingId}`);
    if (submittedAtRaw) {
      const age = Date.now() - Number(submittedAtRaw);
      if (age >= CHECKIN_BROWSER_CACHE_TTL_MS) return null;
    }

    const contractUrl = localStorage.getItem(`contractUrl:${ns}`);
    const guestData = localStorage.getItem(`currentGuestData:${ns}`);
    const bookingData = localStorage.getItem(`currentBookingData:${ns}`);

    if (!contractUrl && !guestData && !bookingData) return null;

    return { bookingId, contractUrl: contractUrl ?? null };
  } catch {
    return null;
  }
}

function hasSessionFormCache(sessionKey: (key: string) => string): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(sessionKey('form_data_saved')) !== 'true') return false;

  try {
    const guestsRaw = sessionStorage.getItem(sessionKey('form_guests'));
    if (guestsRaw) {
      const guests = JSON.parse(guestsRaw) as Array<{ fullName?: string }>;
      if (guests.some((g) => (g.fullName ?? '').trim().length > 0)) return true;
    }
  } catch {
    /* ignore */
  }

  try {
    const bookingRaw = sessionStorage.getItem(sessionKey('form_booking'));
    if (bookingRaw) {
      const booking = JSON.parse(bookingRaw) as {
        checkInDate?: string;
        checkOutDate?: string;
      };
      if (booking.checkInDate && booking.checkOutDate) return true;
    }
  } catch {
    /* ignore */
  }

  try {
    const docsRaw = sessionStorage.getItem(sessionKey('form_documents'));
    if (docsRaw) {
      const docs = JSON.parse(docsRaw);
      if (Array.isArray(docs) && docs.length > 0) return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function clearCheckInBrowserCache(
  propertyId: string,
  token: string,
  sessionKey: (key: string) => string,
  bookingId?: string | null
): void {
  if (typeof window === 'undefined') return;
  const ns = `${propertyId}:${token}`;
  const localKeys = [
    'checkInCompleted',
    'currentBookingId',
    'currentBookingData',
    'currentGuestData',
    'contractUrl',
    'currentPropertyName',
    'policeUrl',
  ];
  for (const k of localKeys) {
    localStorage.removeItem(`${k}:${ns}`);
  }
  if (bookingId) {
    localStorage.removeItem(`submittedAt:${bookingId}`);
  }
  const sessionKeys = [
    'form_data_saved',
    'form_guests',
    'form_booking',
    'form_numberOfGuests',
    'form_documents',
  ];
  for (const k of sessionKeys) {
    sessionStorage.removeItem(sessionKey(k));
  }
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 }
};

const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const GuestVerification = () => {
  const { propertyId, token, airbnbBookingId } = useParams<{
    propertyId: string;
    token: string;
    airbnbBookingId?: string;
  }>();
  const location = useLocation();
  const icsBookingQuerySig = bookingQuerySignatureFromSearch(location.search ?? '');

  // P14 — Stratégie de priorité URL > ICS > Airbnb
  const urlPrefill = useGuestPrefillFromUrl(location.search ?? '');
  const { prefill: icsPrefill } = useGuestPrefillFromIcsToken(
    urlPrefill ? undefined : token,   // Court-circuit si URL a déjà fourni les données
    urlPrefill ? undefined : propertyId
  );
  const { prefill: airbnbPrefill } = useGuestPrefillFromAirbnbBooking(
    propertyId,
    airbnbBookingId,
    !urlPrefill && !icsPrefill         // Court-circuit si une priorité supérieure a répondu
  );

  // ✅ FONCTION UTILITAIRE: Validation des dates
  const validateDates = (checkIn: Date, checkOut: Date): { isValid: boolean; error?: string } => {
    const checkInDateStartOfDay = new Date(checkIn);
    checkInDateStartOfDay.setHours(0, 0, 0, 0);
    const checkOutDateStartOfDay = new Date(checkOut);
    checkOutDateStartOfDay.setHours(0, 0, 0, 0);
    
    // ✅ SUPPRESSION : Plus de restriction sur les dates passées
    // Les utilisateurs peuvent réserver n'importe quelle date (passée ou future)

    if (checkOutDateStartOfDay <= checkInDateStartOfDay) {
      return { isValid: false, error: t('validation.checkoutAfterCheckin.desc') };
    }

    // ✅ SUPPRESSION : Plus de limite de durée maximale
    // const daysDifference = Math.ceil((checkOutDateStartOfDay.getTime() - checkInDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));
    // if (daysDifference > 30) {
    //   return { isValid: false, error: "La durée maximale du séjour est de 30 jours" };
    // }

    return { isValid: true };
  };

  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();
  const isMobile = useIsMobile(); // ✅ NOUVEAU: Détection mobile pour UI responsive
  const [isLoading, setIsLoading] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string | null>(null);
  const submissionStepTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  // P29 — bookingId détecté en localStorage au montage (soumission précédente)
  const [previousBookingId, setPreviousBookingId] = useState<string | null>(null);
  const [showPreviousSubmissionBanner, setShowPreviousSubmissionBanner] = useState(false);
  const [cachedContractUrl, setCachedContractUrl] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [propertyName, setPropertyName] = useState('');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [manualUnlockGuests, setManualUnlockGuests] = useState<Set<number>>(() => new Set());
  const [pastDateDialogOpen, setPastDateDialogOpen] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([{
    fullName: '',
    dateOfBirth: undefined,
    nationality: '',
    documentNumber: '',
    documentType: 'passport',
    documentIssueDate: undefined, // ✅ Date d'expiration du document (alignée fiche de police)
    profession: '',
    motifSejour: 'TOURISME',
    adressePersonnelle: '',
    email: ''
  }]);
  
  // ✅ REF : Pour éviter les boucles infinies lors de la détection de doublons
  const guestsProcessedRef = useRef(false);
  const lastGuestsCountRef = useRef(1); // Track le dernier nombre de guests
  const lastGuestsHashRef = useRef<string>(''); // Track le hash des guests pour détecter changements réels
  
  // ✅ FONCTION : Calculer un hash unique pour chaque guest
  const getGuestHash = (guest: Guest): string => {
    return `${guest.fullName || ''}-${guest.documentNumber || ''}-${guest.nationality || ''}`;
  };
  
  // ✅ FONCTION : Calculer le hash de tout le tableau guests
  const getGuestsArrayHash = (guestsArray: Guest[]): string => {
    return guestsArray.map(g => getGuestHash(g)).join('|');
  };
  
  // ✅ CORRIGÉ : Utiliser useMemo pour la déduplication au lieu de useEffect pour éviter les boucles infinies
  // ✅ CRUCIAL : Sauvegarder la dernière référence pour éviter les re-renders inutiles
  const lastDeduplicatedGuestsRef = useRef<Guest[]>(guests);
  
  const deduplicatedGuests = useMemo(() => {
    const currentHash = getGuestsArrayHash(guests);
    
    // ✅ Si le hash n'a pas changé, retourner LA MÊME RÉFÉRENCE (pas guests, mais lastDeduplicatedGuestsRef)
    if (currentHash === lastGuestsHashRef.current) {
      return lastDeduplicatedGuestsRef.current;
    }
    
    // ✅ NOUVEAU : Éviter de traiter si on a plus de 10 guests (probablement un bug)
    if (guests.length > 10) {
      console.error('🚨 ALERTE: Plus de 10 guests détectés! Réinitialisation forcée.', {
        count: guests.length,
        guests: guests.map(g => ({ fullName: g.fullName, docNumber: g.documentNumber }))
      });
      return [{
        fullName: '',
        dateOfBirth: undefined,
        nationality: '',
        documentNumber: '',
        documentType: 'passport' as const,
        documentIssueDate: undefined,
        profession: '',
        motifSejour: 'TOURISME' as const,
        adressePersonnelle: '',
        email: ''
      }] as Guest[];
    }
    
    // ✅ ALGORITHME DE DÉDUPLICATION ROBUSTE
    const uniqueGuests = guests.reduce((acc: Guest[], guest, currentIndex) => {
      // Fiches vides : une par voyageur (étape Documents). Ne pas fusionner plusieurs slots vides.
      if (!guest.fullName && !guest.documentNumber && !guest.nationality) {
        acc.push(guest);
        return acc;
      }
      
      // Doublon uniquement si même numéro de document non vide (le nom seul ne suffit pas —
      // une famille peut avoir plusieurs voyageurs du même nom).
      const isDuplicate = acc.some(existingGuest => {
        const docA = guest.documentNumber?.trim();
        const docB = existingGuest.documentNumber?.trim();
        return !!docA && !!docB && docA === docB;
      });
      
      if (!isDuplicate) {
        acc.push(guest);
      } else {
        console.warn(`🚨 DOUBLON DÉTECTÉ ET IGNORÉ à l'index ${currentIndex}:`, {
          fullName: guest.fullName,
          docNumber: guest.documentNumber
        });
      }
      
      return acc;
    }, []);
    
    // ✅ Mettre à jour les références seulement si des doublons ont été trouvés
    if (uniqueGuests.length !== guests.length) {
      console.error('⚠️⚠️⚠️ DOUBLONS DÉTECTÉS ⚠️⚠️⚠️', { 
        avant: guests.length, 
        après: uniqueGuests.length,
        doublonsSupprimes: guests.length - uniqueGuests.length
      });
      lastGuestsHashRef.current = getGuestsArrayHash(uniqueGuests);
      lastGuestsCountRef.current = uniqueGuests.length;
    } else {
      lastGuestsHashRef.current = currentHash;
      lastGuestsCountRef.current = guests.length;
    }
    
    // ✅ CRUCIAL : Sauvegarder la référence pour les prochains appels
    lastDeduplicatedGuestsRef.current = uniqueGuests;
    
    return uniqueGuests;
  }, [guests]);
  
  // ✅ Refs pour la gestion de l'état et des flags
  const isMountedRef = useRef(true); // ✅ Réf pour suivre si le composant est monté
  const navigationInProgressRef = useRef(false); // ✅ Réf pour éviter les navigations multiples
  const processingFilesRef = useRef<Set<string>>(new Set()); // ✅ Réf pour éviter les traitements multiples du même fichier
  const isProcessingRef = useRef(false); // ✅ Réf pour éviter les appels multiples simultanés
  const isCheckingICSRef = useRef(false); // ✅ Réf pour éviter les vérifications ICS multiples parallèles
  const isVerifyingTokenRef = useRef(false); // ✅ Réf pour éviter les vérifications token multiples parallèles
  const isSubmittingRef = useRef(false); // ✅ NOUVEAU : Réf pour éviter les soumissions multiples
  
  // ✅ CRITIQUE : Gardes globaux pour éviter les doubles exécutions sur Vercel (Strict Mode / Hydratation SSR)
  const hasInitializedICSRef = useRef(false); // ✅ Garde pour l'initialisation ICS
  const hasInitializedTokenRef = useRef(false); // ✅ Garde pour la vérification token
  const hasInitializedBookingRef = useRef(false); // ✅ Garde pour le matching booking
  
  // ✅ CRITIQUE : Utiliser sessionStorage pour persister entre les navigations (Vercel)
  // Pour `ics`, n'utiliser que les paramètres réservation (sans `lang`).
  const getSessionKey = (key: string) => {
    const qs = key === 'ics' ? icsBookingQuerySig : '';
    return `guest_verification_${key}_${propertyId}_${token}${qs}`;
  };
  const hasInitializedInSession = (key: string) => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(getSessionKey(key)) === 'true';
  };
  const markInitializedInSession = (key: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(getSessionKey(key), 'true');
  };
  
  // ✅ NOUVEAU : Stocker et récupérer le résultat de validation du token
  const getTokenValidationResult = () => {
    if (typeof window === 'undefined') return null;
    const result = sessionStorage.getItem(getSessionKey('token_valid'));
    return result === 'true' ? true : result === 'false' ? false : null;
  };
  const setTokenValidationResult = (isValid: boolean, propName?: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(getSessionKey('token_valid'), isValid ? 'true' : 'false');
    if (propName) {
      sessionStorage.setItem(getSessionKey('property_name'), propName);
    }
  };
  const getStoredPropertyName = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(getSessionKey('property_name'));
  };

  // ✅ SUPPRIMÉ : Intercepteur d'erreurs redondant - l'intercepteur global dans main.tsx gère déjà les erreurs Portal

  // ✅ CORRIGÉ : Cleanup immédiat au montage ET au démontage
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      // Réinitialiser tous les refs de garde (M8) — évite les flags figés sur navigation SPA
      isMountedRef.current = false;
      navigationInProgressRef.current = false;
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      isCheckingICSRef.current = false;
      isVerifyingTokenRef.current = false;
      hasInitializedICSRef.current = false;
      hasInitializedTokenRef.current = false;
      hasInitializedBookingRef.current = false;
      processingFilesRef.current.clear();
      // Nettoyer les timers de progression (P21)
      submissionStepTimerRef.current.forEach(clearTimeout);
      submissionStepTimerRef.current = [];
      // Révoquer toutes les blob URLs restantes (P26)
      uploadedDocumentsRef.current.forEach((doc) => {
        if (doc.url?.startsWith('blob:')) URL.revokeObjectURL(doc.url);
      });
    };
  }, []);

  // P14 — Appliquer icsPrefill quand disponible (chemin ICS, priorité 2)
  useEffect(() => {
    if (!icsPrefill) return;
    setCheckInDate(icsPrefill.checkInDate);
    setCheckOutDate(icsPrefill.checkOutDate);
    setNumberOfAdults(Math.max(1, icsPrefill.guestCount));
    setNumberOfChildren(0);
    if (icsPrefill.guestName) {
      setGuests(prev => {
        const next = Array.from({ length: icsPrefill.guestCount }, (_, i) => ({
          ...createEmptyGuestForm(),
          fullName: i === 0 ? icsPrefill.guestName! : '',
        }));
        return next;
      });
    }
    toast({ title: 'Reservation loaded', description: `${icsPrefill.checkInDate.toLocaleDateString()} - ${icsPrefill.checkOutDate.toLocaleDateString()}` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icsPrefill]);

  // P14 — Appliquer airbnbPrefill quand disponible (chemin Airbnb, priorité 3)
  useEffect(() => {
    if (!airbnbPrefill) return;
    setCheckInDate(airbnbPrefill.checkInDate);
    setCheckOutDate(airbnbPrefill.checkOutDate);
    setNumberOfAdults(Math.max(1, airbnbPrefill.guestCount));
    setNumberOfChildren(0);
    if (airbnbPrefill.guestName) {
      setGuests(prev => {
        const updated = [...prev];
        if (updated[0]) updated[0] = { ...updated[0], fullName: airbnbPrefill.guestName! };
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airbnbPrefill]);

  // P29 — Bandeau si check-in déjà enregistré dans le cache navigateur (localStorage / session).
  useEffect(() => {
    if (!propertyId || !token) {
      setShowPreviousSubmissionBanner(false);
      setPreviousBookingId(null);
      setCachedContractUrl(null);
      return;
    }

    const completed = readCompletedCheckInFromBrowser(propertyId, token);
    const sessionHasForm = hasSessionFormCache(getSessionKey);

    if (completed) {
      setPreviousBookingId(completed.bookingId);
      setCachedContractUrl(completed.contractUrl);
      setShowPreviousSubmissionBanner(true);
      return;
    }

    if (sessionHasForm) {
      setPreviousBookingId(null);
      setCachedContractUrl(null);
      setShowPreviousSubmissionBanner(true);
      return;
    }

    setShowPreviousSubmissionBanner(false);
    setPreviousBookingId(null);
    setCachedContractUrl(null);
  }, [propertyId, token, getSessionKey]);

  // ✅ Log de debug supprimé pour éviter le spam dans la console

  // ✅ CORRIGÉ : Désactiver la mise à jour automatique de selectsKey pour éviter les conflits
  // Les clés basées sur documentNumber sont maintenant stables et ne nécessitent plus cette mise à jour
  // Cette mise à jour causait des re-renders multiples et des conflits avec les Portals
  // useEffect(() => {
  //   if (!isMountedRef.current) return;
  //   const timeoutId = setTimeout(() => {
  //     if (isMountedRef.current) {
  //       setSelectsKey(prev => prev + 1);
  //     }
  //   }, 150);
  //   return () => clearTimeout(timeoutId);
  // }, [guests.length]);

  // ✅ NOUVEAU : Refs pour tracker les derniers paramètres traités
  const lastProcessedTokenRef = useRef<string | null>(null);
  const lastProcessedPropertyIdRef = useRef<string | null>(null);
  /** Réinitialise les gardes « déjà initialisé » quand on change de lien (SPA) — sinon dates/token figés. */
  const lastIcsRouteKeyRef = useRef<string>('');
  const lastTokenRouteKeyRef = useRef<string>('');
  const lastBookingMatchKeyRef = useRef<string>('');

  /**
   * Réservation indépendante : ne pas garder startDate/endDate/guests/airbnbCode/guestName dans l'URL.
   * Sinon anciens liens / VerifyToken / session figent l'étape « Réservation » avant tout effet ICS.
   * On nettoie aussi sessionStorage (brouillon) pour ce propertyId+token.
   */
  useLayoutEffect(() => {
    if (!token || !propertyId || typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search || '');
    const ac = (sp.get('airbnbCode') || '').trim();
    const isIndependent =
      !ac || ac.toUpperCase() === 'INDEPENDENT_BOOKING';
    const hasLegacyBookingParams = GUEST_VERIFICATION_ICS_QUERY_KEYS.some((k) => {
      const v = sp.get(k);
      return v != null && String(v).length > 0;
    });
    if (!isIndependent || !hasLegacyBookingParams) return;

    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith('guest_verification_form_') && k.includes(`_${propertyId}_${token}`)) {
        sessionStorage.removeItem(k);
      }
      if (k.startsWith(`guest_verification_ics_${propertyId}_${token}`)) {
        sessionStorage.removeItem(k);
      }
    }

    const qs = new URLSearchParams();
    const lang = sp.get('lang');
    if (lang) qs.set('lang', lang);
    const qstr = qs.toString();
    const pathSuffix = airbnbBookingId ? `/${airbnbBookingId}` : '';
    navigate(
      `/guest-verification/${propertyId}/${token}${pathSuffix}${qstr ? `?${qstr}` : ''}`,
      { replace: true }
    );
  }, [token, propertyId, airbnbBookingId, navigate, location.search]);

  // ✅ NOUVEAU : Vérifier si c'est un lien ICS direct et pré-remplir les données
  useEffect(() => {
    if (!token || !propertyId) return;

    const icsRouteKey = `${propertyId}\0${token}\0${icsBookingQuerySig}`;
    if (lastIcsRouteKeyRef.current !== icsRouteKey) {
      lastIcsRouteKeyRef.current = icsRouteKey;
      hasInitializedICSRef.current = false;
      lastProcessedTokenRef.current = null;
      lastProcessedPropertyIdRef.current = null;
      setCheckInDate(undefined);
      setCheckOutDate(undefined);
    }
    
    // ✅ CRITIQUE : Garde global pour éviter les doubles exécutions (Strict Mode / Hydratation SSR)
    if (hasInitializedICSRef.current) {
      console.log('✅ [ICS] Déjà initialisé (useRef), ignoré');
      return;
    }
    
    // ✅ CRITIQUE : Vérifier aussi dans sessionStorage (persiste entre navigations)
    if (hasInitializedInSession('ics')) {
      console.log('✅ [ICS] Déjà initialisé (sessionStorage), ignoré');
      hasInitializedICSRef.current = true; // Synchroniser le ref
      return;
    }
    
    // ✅ CORRIGÉ : Vérifier si déjà traité pour ce token/propertyId
    if (lastProcessedTokenRef.current === token && 
        lastProcessedPropertyIdRef.current === propertyId) {
      console.log('✅ [ICS] Déjà vérifié pour ce token/propertyId, ignoré');
      hasInitializedICSRef.current = true;
      markInitializedInSession('ics');
      return;
    }
    
    // ✅ PROTECTION : Éviter les exécutions parallèles de checkICSData
    if (isCheckingICSRef.current) {
      console.warn('⚠️ [ICS] Vérification déjà en cours, appel ignoré');
      return;
    }
    
    // ✅ CRITIQUE : Marquer comme initialisé IMMÉDIATEMENT (avant toute opération async)
    hasInitializedICSRef.current = true;
    markInitializedInSession('ics');
    
    // ✅ Marquer comme traité
    lastProcessedTokenRef.current = token;
    lastProcessedPropertyIdRef.current = propertyId;
    isCheckingICSRef.current = true;

    const checkICSData = async () => {
      try {
        console.log('🔍 Vérification des données ICS pour lien direct...');
        
        // P14 — Pré-remplissage URL via useGuestPrefillFromUrl (hook dédié, propre, sans try/catch).
        // Le hook parse, valide et normalise les dates en amont.
        if (urlPrefill) {
          console.log('✅ [URL prefill] Dates et invités depuis URL:', {
            checkIn: urlPrefill.checkInDate.toLocaleDateString('fr-FR'),
            checkOut: urlPrefill.checkOutDate.toLocaleDateString('fr-FR'),
            guestCount: urlPrefill.guestCount,
            guestName: urlPrefill.guestName,
          });

          setCheckInDate(urlPrefill.checkInDate);
          setCheckOutDate(urlPrefill.checkOutDate);
          setNumberOfAdults(Math.max(1, urlPrefill.guestCount));
          setNumberOfChildren(0);

          setGuests(prevGuests => {
            const target = urlPrefill.guestCount;
            if (prevGuests.length === target) {
              if (urlPrefill.guestName && prevGuests[0] && !prevGuests[0].fullName) {
                const updated = [...prevGuests];
                updated[0] = { ...updated[0], fullName: urlPrefill.guestName };
                return updated;
              }
              return prevGuests;
            }
            return Array.from({ length: target }, (_, i) => ({
              ...createEmptyGuestForm(),
              fullName: i === 0 ? (urlPrefill.guestName || '') : '',
            }));
          });

          toast({
            title: 'Dates de réservation chargées',
            description: `Du ${urlPrefill.checkInDate.toLocaleDateString('fr-FR')} au ${urlPrefill.checkOutDate.toLocaleDateString('fr-FR')}`
          });
          return; // Pré-remplissage URL terminé
        }

        // Fallback : Vérifier le token si pas de paramètres d'URL
        // ✅ VALIDATION : Vérifier que propertyId et token sont valides avant l'appel
        if (!propertyId || !token) {
          console.error('❌ [ICS] propertyId ou token manquant, abandon:', { propertyId, token });
          return;
        }

        try {
          console.log('🔍 [ICS] Appel issue-guest-link resolve:', { 
            propertyId, 
            token: token.substring(0, 8) + '...',
            hasPropertyId: !!propertyId,
            hasToken: !!token
          });
          
          // ✅ NOUVEAU : Timeout de sécurité pour éviter le blocage (5 secondes)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          let data, error;
          try {
            const response = await supabase.functions.invoke('issue-guest-link', {
              body: {
                action: 'resolve',
                propertyId,
                token
              }
            });
            data = response.data;
            error = response.error;
            clearTimeout(timeoutId);
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              console.warn('⚠️ [ICS] Timeout issue-guest-link, continuer sans données ICS');
              return; // Continuer sans les données ICS
            }
            throw fetchError;
          }

          if (error) {
            console.error('❌ [ICS] Erreur issue-guest-link:', {
              message: error.message,
              status: error.status,
              statusText: error.statusText,
              details: error
            });
            
            // ✅ MODIFIÉ : Ne pas afficher de toast en cas d'erreur, continuer silencieusement
            console.warn('⚠️ [ICS] Continuer sans données ICS');
            return;
          }

          console.log('✅ [ICS] Réponse issue-guest-link:', data);

        if (data?.success && data?.metadata?.linkType === 'ics_direct') {
          const reservationData = data.metadata.reservationData;
          const rawAc = reservationData?.airbnbCode;
          const isIndependentIcs =
            rawAc == null ||
            String(rawAc).trim() === '' ||
            String(rawAc).toUpperCase() === 'INDEPENDENT_BOOKING';

          if (reservationData && isIndependentIcs) {
            console.log('⏭️ [ICS] Métadonnées indépendantes : pas de pré-remplissage depuis le token');
          }

          if (reservationData && !isIndependentIcs) {
            console.log('✅ Données ICS détectées via token, pré-remplissage des dates:', reservationData);
            
            // Pré-remplir les dates depuis les métadonnées du token
            // ✅ CORRIGÉ : Utiliser extractDateOnly puis parseLocalDate pour éviter le décalage timezone
            // ✅ AJOUT : Gestion d'erreurs robuste
            try {
              const startDateStr = extractDateOnly(reservationData.startDate);
              const endDateStr = extractDateOnly(reservationData.endDate);
              
              setCheckInDate(parseLocalDate(startDateStr));
              setCheckOutDate(parseLocalDate(endDateStr));
              {
                const ng = Math.max(1, Math.min(10, reservationData.numberOfGuests || 1));
                setNumberOfAdults(Math.max(1, ng));
                setNumberOfChildren(0);
              }
            } catch (dateError) {
              console.error('❌ Erreur lors du parsing des dates depuis les métadonnées:', dateError);
              // Fallback
              try {
                setCheckInDate(new Date(reservationData.startDate));
                setCheckOutDate(new Date(reservationData.endDate));
                {
                  const ng = Math.max(1, Math.min(10, reservationData.numberOfGuests || 1));
                  setNumberOfAdults(Math.max(1, ng));
                  setNumberOfChildren(0);
                }
              } catch (fallbackError) {
                console.error('❌ Erreur même avec fallback:', fallbackError);
              }
            }
            
            // Pré-remplir le 1er voyageur ; garder autant de fiches que numberOfGuests (pas un seul élément)
            if (reservationData.guestName) {
              const n = Math.max(1, Math.min(10, reservationData.numberOfGuests || 1));
              const next: Guest[] = [];
              for (let i = 0; i < n; i++) {
                next.push(
                  i === 0
                    ? {
                        fullName: reservationData.guestName,
                        dateOfBirth: undefined,
                        nationality: '',
                        documentNumber: '',
                        documentType: 'passport',
                        documentIssueDate: undefined,
                        profession: '',
                        motifSejour: 'TOURISME',
                        adressePersonnelle: '',
                        email: ''
                      }
                    : createEmptyGuestForm()
                );
              }
              setGuests(next);
            }

            toast({
              title: "Réservation chargée",
              description: `Réservation ${reservationData.airbnbCode} du ${new Date(reservationData.startDate).toLocaleDateString('fr-FR')} au ${new Date(reservationData.endDate).toLocaleDateString('fr-FR')}`
            });
          }
        }
        } catch (icsError) {
          console.error('❌ [ICS] Erreur lors de l\'appel issue-guest-link:', icsError);
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification des données ICS:', error);
      } finally {
        // ✅ PROTECTION : Réinitialiser le flag après l'exécution
        isCheckingICSRef.current = false;
      }
    };

    checkICSData();
    
    // ✅ Cleanup : Réinitialiser le flag si le composant est démonté
    return () => {
      isCheckingICSRef.current = false;
    };
  }, [token, propertyId, icsBookingQuerySig, navigate, airbnbBookingId]);

  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  const [numberOfAdults, setNumberOfAdults] = useState(1);
  const [numberOfChildren, setNumberOfChildren] = useState(0);
  // Source de vérité : adults + children. Plus de state séparé pour éviter les désynchronisations.
  const numberOfGuests = numberOfAdults + numberOfChildren;

  // Aligner guests sur numberOfGuests. Dépend aussi de guests.length pour corriger les setGuests async
  // (ex. ICS qui remplace par [un seul voyageur] alors que numberOfGuests vaut 3).
  useEffect(() => {
    const target = Math.max(1, Math.min(10, numberOfGuests));
    setGuests(prev => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        const next = [...prev];
        while (next.length < target) next.push(createEmptyGuestForm());
        return next;
      }
      return prev.slice(0, target);
    });
  }, [numberOfGuests, guests.length]);

  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [showGuestsPanel, setShowGuestsPanel] = useState(false);
  /** Arrivée choisie dans le calendrier, affichée avant validation du départ (n’écrit pas checkInDate). */
  const [rangeDraftStart, setRangeDraftStart] = useState<Date | undefined>();
  /** Barre réservation + panneaux calendrier / voyageurs (clic extérieur). */
  const bookingPanelsRef = useRef<HTMLDivElement>(null);
  
  // Fermer les panneaux au clic extérieur (barre + dropdowns inclus).
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (document.activeElement?.tagName === 'SELECT') return;
      if (bookingPanelsRef.current && !bookingPanelsRef.current.contains(event.target as Node)) {
        setShowCalendarPanel(false);
        setShowGuestsPanel(false);
        setRangeDraftStart(undefined);
      }
    };

    if (showCalendarPanel || showGuestsPanel) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCalendarPanel, showGuestsPanel]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  // Ref toujours à jour — utilisé uniquement dans le cleanup d'unmount pour révoquer les blob URLs.
  const uploadedDocumentsRef = useRef<UploadedDocument[]>([]);
  useEffect(() => { uploadedDocumentsRef.current = uploadedDocuments; }, [uploadedDocuments]);

  /** Pièce d'identité importée et OCR terminé pour ce voyageur (index aligné documents ↔ guests). */
  const identityUnlockedForGuest = useCallback(
    (guestIndex: number) => {
      // 1. Document à l'index exact — déverrouiller dès que le traitement est terminé
      //    (que l'OCR ait réussi ou échoué, l'invité doit pouvoir corriger manuellement).
      const doc = uploadedDocuments[guestIndex];
      if (doc && !doc.processing) return true;

      // 2. Avec le traitement parallèle (P8), un document peut être à un index différent
      //    (ordre d'arrivée vs ordre des guests). On cherche UN document traité qui
      //    correspond à ce voyageur par nom ou n° de document.
      const guest = guests[guestIndex];
      if (uploadedDocuments.some((d) => {
        if (!d || d.processing) return false;
        if (!d.extractedData) return true; // doc traité sans extractedData (OCR échoué) → déverrouiller
        const ext = d.extractedData as Partial<Guest>;
        const sameName =
          ext.fullName && guest?.fullName &&
          ext.fullName.trim().toLowerCase() === guest.fullName.trim().toLowerCase();
        const sameDoc =
          ext.documentNumber && guest?.documentNumber &&
          ext.documentNumber.trim() === guest.documentNumber.trim();
        return Boolean(sameName || sameDoc);
      })) return true;

      // 3. Fallback : si au moins UN document a fini de traiter et que ce voyageur
      //    a été rempli (fullName non vide), déverrouiller (l'OCR a travaillé sur lui).
      const hasAnyProcessedDoc = uploadedDocuments.some(d => d && !d.processing);
      if (hasAnyProcessedDoc && guest?.fullName?.trim()) return true;

      return false;
    },
    [uploadedDocuments, guests]
  );

  const isIdentityFieldsLocked = useCallback(
    (guestIndex: number) =>
      !identityUnlockedForGuest(guestIndex) && !manualUnlockGuests.has(guestIndex),
    [identityUnlockedForGuest, manualUnlockGuests]
  );

  const unlockGuestManual = useCallback((guestIndex: number) => {
    setManualUnlockGuests((prev) => {
      const next = new Set(prev);
      next.add(guestIndex);
      return next;
    });
  }, []);

  // P35 — Utilise parseAndNormalizeStayDate qui retourne null (pas Date(NaN)) pour le picker
  const guestDateForPicker = (raw: Date | string | undefined): Date | undefined =>
    parseAndNormalizeStayDate(raw) ?? undefined;

  const [currentStep, setCurrentStep] = useState<'booking' | 'documents' | 'signature'>('booking');
  
  // ✅ NOUVEAU : Suivi des étapes visitées pour permettre la navigation bidirectionnelle
  const [visitedSteps, setVisitedSteps] = useState<Set<'booking' | 'documents' | 'signature'>>(new Set(['booking']));
  
  // ✅ NOUVEAU : Fonction pour changer d'étape et marquer comme visitée
  const goToStep = (step: 'booking' | 'documents' | 'signature') => {
    setCurrentStep(step);
    setVisitedSteps(prev => new Set([...prev, step]));
  };
  
  // ✅ NOUVEAU : Vérifier si une étape peut être naviguée (a été visitée)
  const canNavigateToStep = (step: 'booking' | 'documents' | 'signature') => {
    // On peut toujours naviguer vers l'étape actuelle
    if (step === currentStep) return false; // Pas besoin de cliquer sur l'étape actuelle
    // On peut naviguer vers une étape si elle a été visitée
    return visitedSteps.has(step);
  };
  
  // ✅ NOUVEAU : Persistance des données du formulaire (guests, booking, documents) pour navigation depuis Signature
  const saveFormDataToSession = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      // Sauvegarder les guests avec conversion des dates
      const guestsToSave = guests.map(g => ({
        ...g,
        dateOfBirth: g.dateOfBirth instanceof Date ? g.dateOfBirth.toISOString() : g.dateOfBirth,
        documentIssueDate: g.documentIssueDate instanceof Date ? g.documentIssueDate.toISOString() : g.documentIssueDate
      }));
      sessionStorage.setItem(getSessionKey('form_guests'), JSON.stringify(guestsToSave));
      
      // Sauvegarder les données de réservation
      const bookingToSave = {
        checkInDate: checkInDate instanceof Date ? checkInDate.toISOString() : checkInDate,
        checkOutDate: checkOutDate instanceof Date ? checkOutDate.toISOString() : checkOutDate,
        numberOfGuests: numberOfGuests
      };
      sessionStorage.setItem(getSessionKey('form_booking'), JSON.stringify(bookingToSave));
      
      // Sauvegarder le nombre de guests
      sessionStorage.setItem(getSessionKey('form_numberOfGuests'), String(numberOfGuests));
      
      // ✅ NOUVEAU : Sauvegarder les documents uploadés (convertir en base64)
      if (uploadedDocuments.length > 0) {
        const docsToSave = await Promise.all(uploadedDocuments.map(async (doc) => {
          // Convertir le fichier en base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(doc.file);
          });
          
          return {
            fileName: doc.file.name,
            fileType: doc.file.type,
            fileSize: doc.file.size,
            base64Data: base64,
            processing: false, // Marquer comme déjà traité
            extractedData: doc.extractedData,
            isInvalid: doc.isInvalid
          };
        }));
        sessionStorage.setItem(getSessionKey('form_documents'), JSON.stringify(docsToSave));
        console.log('✅ [Persistance] Documents sauvegardés:', docsToSave.length);
      }
      
      // Marquer que les données sont sauvegardées
      sessionStorage.setItem(getSessionKey('form_data_saved'), 'true');
      
      console.log('✅ [Persistance] Données du formulaire sauvegardées:', {
        guestsCount: guestsToSave.length,
        booking: bookingToSave,
        documentsCount: uploadedDocuments.length
      });
    } catch (error) {
      console.error('❌ [Persistance] Erreur lors de la sauvegarde:', error);
    }
  }, [guests, checkInDate, checkOutDate, numberOfGuests, uploadedDocuments, getSessionKey]);
  
  const restoreFormDataFromSession = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const hasSavedData = sessionStorage.getItem(getSessionKey('form_data_saved')) === 'true';
      if (!hasSavedData) return false;
      
      // Restaurer les guests
      const savedGuests = sessionStorage.getItem(getSessionKey('form_guests'));
      if (savedGuests) {
        const parsedGuests = JSON.parse(savedGuests).map((g: any) => ({
          ...g,
          dateOfBirth: g.dateOfBirth ? guestDateForPicker(g.dateOfBirth) : undefined,
          documentIssueDate: g.documentIssueDate ? guestDateForPicker(g.documentIssueDate) : undefined
        }));
        setGuests(parsedGuests);
        console.log('✅ [Persistance] Guests restaurés:', parsedGuests.length);
      }
      
      // Restaurer les données de réservation
      const savedBooking = sessionStorage.getItem(getSessionKey('form_booking'));
      if (savedBooking) {
        const parsedBooking = JSON.parse(savedBooking);
        if (parsedBooking.checkInDate) {
          setCheckInDate(new Date(parsedBooking.checkInDate));
        }
        if (parsedBooking.checkOutDate) {
          setCheckOutDate(new Date(parsedBooking.checkOutDate));
        }
        if (parsedBooking.numberOfGuests) {
          setNumberOfAdults(Math.max(1, parsedBooking.numberOfGuests));
          setNumberOfChildren(0);
        }
        console.log('✅ [Persistance] Booking restauré:', parsedBooking);
      }
      
      // Restaurer le nombre de guests
      const savedNumberOfGuests = sessionStorage.getItem(getSessionKey('form_numberOfGuests'));
      if (savedNumberOfGuests) {
        const savedN = Math.max(1, parseInt(savedNumberOfGuests, 10));
        setNumberOfAdults(savedN);
        setNumberOfChildren(0);
      }
      
      // ✅ NOUVEAU : Restaurer les documents uploadés
      const savedDocuments = sessionStorage.getItem(getSessionKey('form_documents'));
      if (savedDocuments) {
        const parsedDocs = JSON.parse(savedDocuments);
        const restoredDocs: UploadedDocument[] = parsedDocs.map((doc: any) => {
          // Convertir le base64 en Blob puis en File
          const byteString = atob(doc.base64Data.split(',')[1]);
          const mimeType = doc.fileType;
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeType });
          const file = new File([blob], doc.fileName, { type: mimeType });
          const url = URL.createObjectURL(blob);
          
          return {
            file,
            url,
            processing: false,
            extractedData: doc.extractedData,
            isInvalid: doc.isInvalid
          };
        });
        setUploadedDocuments(restoredDocs);
        console.log('✅ [Persistance] Documents restaurés:', restoredDocs.length);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [Persistance] Erreur lors de la restauration:', error);
      return false;
    }
  }, [getSessionKey]);
  
  // ✅ NOUVEAU : Gérer la navigation depuis la page de signature
  useEffect(() => {
    const navState = (location as any)?.state;
    if (navState?.fromSignaturePage && navState?.targetStep) {
      const targetStep = navState.targetStep as 'booking' | 'documents' | 'signature';
      console.log('✅ [Navigation] Retour depuis la page de signature vers:', targetStep);
      
      // Marquer toutes les étapes comme visitées (car on vient de la page signature)
      setVisitedSteps(new Set(['booking', 'documents', 'signature']));
      
      // ✅ NOUVEAU : Restaurer les données du formulaire depuis sessionStorage
      const restored = restoreFormDataFromSession();
      console.log('✅ [Navigation] Données restaurées depuis sessionStorage:', restored);
      
      // Naviguer vers l'étape cible
      setCurrentStep(targetStep);
      
      // ✅ IMPORTANT : Nettoyer le state pour éviter les navigations répétées
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Étapes pour le stepper
  const steps = [
    {
      id: 'booking',
      title: t('guest.booking.title'),
      description: 'Dates et invités',
      icon: CalendarLucide,
      status: (currentStep === 'booking' ? 'current' : 
             ['documents', 'signature'].includes(currentStep) ? 'completed' : 'pending') as 'current' | 'completed' | 'pending'
    },
    {
      id: 'documents',
      title: t('guest.documents.title'),
      description: 'Pièces d\'identité',
      icon: FileText,
      status: (currentStep === 'documents' ? 'current' : 
             currentStep === 'signature' ? 'completed' : 'pending') as 'current' | 'completed' | 'pending'
    },
    {
      id: 'signature',
      title: t('contractSignature.pill'),
      description: 'Finalisation',
      icon: CheckCircle,
      status: (currentStep === 'signature' ? 'current' : 'pending') as 'current' | 'pending'
    }
  ];

  useEffect(() => {
    const verifyToken = async () => {
      if (!propertyId || !token) {
        setCheckingToken(false);
        return;
      }

      const tokenRouteKey = `${propertyId}\0${token}`;
      if (lastTokenRouteKeyRef.current !== tokenRouteKey) {
        lastTokenRouteKeyRef.current = tokenRouteKey;
        hasInitializedTokenRef.current = false;
      }
      
      // ✅ CRITIQUE : Garde global pour éviter les doubles exécutions (Strict Mode / Hydratation SSR)
      if (hasInitializedTokenRef.current) {
        console.log('✅ [Token] Déjà initialisé (useRef), ignoré');
        // ✅ CORRIGÉ : S'assurer que checkingToken est false pour afficher la page
        setCheckingToken(false);
        return;
      }
      
      // ✅ CRITIQUE : Vérifier aussi dans sessionStorage (persiste entre navigations)
      if (hasInitializedInSession('token')) {
        console.log('✅ [Token] Déjà initialisé (sessionStorage), ignoré');
        hasInitializedTokenRef.current = true; // Synchroniser le ref
        
        // ✅ CORRIGÉ : Récupérer le résultat de validation depuis sessionStorage
        const cachedValidation = getTokenValidationResult();
        const cachedPropertyName = getStoredPropertyName();
        
        console.log('✅ [Token] Résultat caché:', { cachedValidation, cachedPropertyName });
        
        if (cachedValidation !== null) {
          setIsValidToken(cachedValidation);
          if (cachedPropertyName) {
            setPropertyName(cachedPropertyName);
          }
        } else {
          // Si pas de résultat caché, supposer valide car déjà vérifié
          setIsValidToken(true);
        }
        setCheckingToken(false);
        return;
      }
      
      // ✅ PROTECTION : Éviter les vérifications parallèles de verifyToken
      if (isVerifyingTokenRef.current) {
        console.warn('⚠️ [Token] Vérification déjà en cours, appel ignoré');
        return;
      }
      
      // ✅ CRITIQUE : Marquer comme initialisé IMMÉDIATEMENT (avant toute opération async)
      hasInitializedTokenRef.current = true;
      markInitializedInSession('token');
      
      isVerifyingTokenRef.current = true;

      console.log('🔍 GuestVerification params:', { propertyId, token, airbnbBookingId });

      // ✅ NOUVEAU : Timeout de sécurité pour éviter le blocage infini
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
        setTimeout(() => resolve({ timeout: true }), 8000); // 8 secondes max
      });

      try {
        // ✅ NOUVEAU : Vérifier d'abord si c'est un token de test
        if (TEST_TOKENS_CONFIG.enabled && isTestToken(token)) {
          console.log('🧪 Token de test détecté:', token);
          logTestTokenUsage(token, 'GuestVerification - Token validation');
          
          const testValidation = await validateToken(token, propertyId);
          if (testValidation.isValid && testValidation.isTestToken) {
            console.log('✅ Token de test valide, utilisation des données de test');
            const propName = 'Propriété de Test - ' + propertyId;
            setIsValidToken(true);
            setPropertyName(propName);
            setTokenValidationResult(true, propName); // ✅ Sauvegarder le résultat
            setCheckingToken(false);
            return;
          }
        }

        // ✅ CORRECTION : Utilisation de la validation directe avec timeout
        console.log('🔍 Validation directe du token...');
        
        const validationPromise = validateTokenDirect(propertyId, token);
        const result = await Promise.race([validationPromise, timeoutPromise]);
        
        // ✅ Vérifier si c'est un timeout
        if ('timeout' in result && result.timeout) {
          console.warn('⚠️ [Token] Timeout de validation, tentative de continuer...');
          // En cas de timeout, on essaie quand même de valider en arrière-plan
          // mais on affiche la page pour ne pas bloquer l'utilisateur
          const defaultName = 'Votre hébergement';
          setIsValidToken(true); // Permettre l'accès en cas de timeout
          setPropertyName(defaultName);
          setTokenValidationResult(true, defaultName); // ✅ Sauvegarder le résultat
          setCheckingToken(false);
          
          // Continuer la validation en arrière-plan
          validationPromise.then((validationResult) => {
            if (validationResult.isValid && validationResult.propertyData) {
              setPropertyName(validationResult.propertyData.name || 'Property');
            }
          }).catch(console.error);
          return;
        }
        
        const validationResult = result as Awaited<ReturnType<typeof validateTokenDirect>>;
        
        if (validationResult.isValid && validationResult.propertyData) {
          console.log('✅ Token validé avec succès');
          const propName = validationResult.propertyData.name || 'Property';
          setIsValidToken(true);
          setPropertyName(propName);
          setTokenValidationResult(true, propName); // ✅ Sauvegarder le résultat
        } else {
          console.error('❌ Token invalide:', validationResult.error);
          setTokenValidationResult(false); // ✅ Sauvegarder l'échec aussi
          setIsValidToken(false);
        }
        
      } catch (error) {
        console.error('Error verifying token:', error);
        setTokenValidationResult(false); // ✅ Sauvegarder l'échec
        setIsValidToken(false);
      } finally {
        setCheckingToken(false);
        // ✅ PROTECTION : Réinitialiser le flag après l'exécution
        isVerifyingTokenRef.current = false;
      }
    };

    verifyToken();
    
    // ✅ Cleanup : Réinitialiser le flag si le composant est démonté
    return () => {
      isVerifyingTokenRef.current = false;
    };
  }, [propertyId, token, airbnbBookingId]);

  // Effect to handle Airbnb booking ID matching and date pre-filling
  useEffect(() => {
    const bookingRouteKey = `${propertyId ?? ''}\0${token ?? ''}\0${airbnbBookingId ?? ''}`;
    if (lastBookingMatchKeyRef.current !== bookingRouteKey) {
      lastBookingMatchKeyRef.current = bookingRouteKey;
      hasInitializedBookingRef.current = false;
    }

    const matchAirbnbBooking = async () => {
      if (!isValidToken || !propertyId || !airbnbBookingId) {
        return;
      }
      
      // ✅ CRITIQUE : Garde global pour éviter les doubles exécutions (Strict Mode / Hydratation SSR)
      if (hasInitializedBookingRef.current) {
        console.log('✅ [Booking] Déjà initialisé (useRef), ignoré');
        return;
      }
      
      // ✅ CRITIQUE : Vérifier aussi dans sessionStorage (persiste entre navigations)
      const bookingSessionKey = `booking_${airbnbBookingId}`;
      if (hasInitializedInSession(bookingSessionKey)) {
        console.log('✅ [Booking] Déjà initialisé (sessionStorage), ignoré');
        hasInitializedBookingRef.current = true; // Synchroniser le ref
        return;
      }
      
      // ✅ CRITIQUE : Marquer comme initialisé IMMÉDIATEMENT (avant toute opération async)
      hasInitializedBookingRef.current = true;
      markInitializedInSession(bookingSessionKey);
      
      try {
        const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-airbnb-reservation', {
          body: { propertyId, bookingId: airbnbBookingId }
        });

        if (searchError) {
          console.error('❌ Edge function error:', searchError);
          return;
        }
        
        if (searchResult?.reservation) {
          const matchedReservation = searchResult.reservation;
          
          // ✅ CORRIGÉ : Utiliser extractDateOnly puis parseLocalDate pour éviter le décalage timezone
          // ✅ AJOUT : Gestion d'erreurs robuste
          try {
            const startDateStr = extractDateOnly(matchedReservation.start_date);
            const endDateStr = extractDateOnly(matchedReservation.end_date);
            
            const foundCheckInDate = parseLocalDate(startDateStr);
            const foundCheckOutDate = parseLocalDate(endDateStr);
            
            setCheckInDate(foundCheckInDate);
            setCheckOutDate(foundCheckOutDate);
          } catch (dateError) {
            console.error('❌ Erreur lors du parsing des dates depuis la recherche:', dateError);
            // Fallback
            try {
              setCheckInDate(new Date(matchedReservation.start_date));
              setCheckOutDate(new Date(matchedReservation.end_date));
            } catch (fallbackError) {
              console.error('❌ Erreur même avec fallback:', fallbackError);
            }
          }
          
          if (matchedReservation.number_of_guests) {
            setNumberOfAdults(Math.max(1, matchedReservation.number_of_guests));
            setNumberOfChildren(0);
          }
          
          if (matchedReservation.guest_name) {
            setGuests(prevGuests => {
              const updatedGuests = [...prevGuests];
              updatedGuests[0] = { ...updatedGuests[0], fullName: matchedReservation.guest_name };
              return updatedGuests;
            });
          }
        }
      } catch (error) {
        console.error('❌ Error matching Airbnb booking:', error);
      }
    };

    matchAirbnbBooking();
  }, [airbnbBookingId, isValidToken, propertyId, token]);

  const addGuest = () => {
    setGuests([...guests, {
      fullName: '',
      dateOfBirth: undefined,
      nationality: '',
      documentNumber: '',
      documentType: 'passport',
      documentIssueDate: undefined,
      profession: '',
      motifSejour: 'TOURISME',
      adressePersonnelle: '',
      email: ''
    }]);
  };

  /** Index réel dans `guests` (le formulaire affiche `deduplicatedGuests`, indices différents si doublons filtrés). */
  const rowIndexForGuest = (guest: Guest) => {
    const i = guests.findIndex((g) => g === guest);
    return i >= 0 ? i : 0;
  };

  const updateGuest = (rowIndex: number, field: keyof Guest, value: any) => {
    console.log('🔄 updateGuest appelé:', { rowIndex, field, value });

    setGuests((prevGuests) => {
      const updatedGuests = [...prevGuests];
      if (updatedGuests[rowIndex]) {
        updatedGuests[rowIndex] = { ...updatedGuests[rowIndex], [field]: value };
        console.log('✅ Guest mis à jour:', updatedGuests[rowIndex]);
      }
      return updatedGuests;
    });
  };

  const removeGuest = (index: number) => {
    if (deduplicatedGuests.length <= 1) return;
    setGuests(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    if (numberOfChildren > 0) {
      setNumberOfChildren(c => c - 1);
    } else {
      setNumberOfAdults(a => Math.max(1, a - 1));
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (isProcessingRef.current) {
      console.warn('⚠️ handleFileUpload déjà en cours, appel ignoré');
      return;
    }
    if (!files || files.length === 0) return;

    isProcessingRef.current = true;

    const filesArray = Array.from(files);

    if (filesArray.length > 5) {
      toast({
        title: 'Traitement en cours',
        description: `Le traitement de ${filesArray.length} photos peut prendre jusqu'à 30 s.`,
      });
    }

    // Traite un seul fichier : URL → spinner → OCR → mise à jour state
    const processFile = async (file: File) => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;

      if (processingFilesRef.current.has(fileKey)) {
        console.warn('⚠️ Fichier déjà en cours de traitement:', file.name);
        return;
      }

      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast({
          title: t('upload.error.notImage.title'),
          description: t('upload.error.notImage.desc', { filename: file.name }),
          variant: 'destructive',
        });
        return;
      }

      processingFilesRef.current.add(fileKey);
      const url = URL.createObjectURL(file);

      try {
        setUploadedDocuments(prev => [...prev, { file, url, processing: true, extractedData: null }]);

        const extractedData = await OpenAIDocumentService.extractDocumentData(file);
        const ocrSucceeded = Boolean(extractedData && Object.keys(extractedData).length > 0);

        setUploadedDocuments(prev =>
          prev.map(doc =>
            doc.url === url ? { ...doc, processing: false, extractedData, ocrFailed: !ocrSucceeded } : doc
          )
        );

        if (ocrSucceeded) {
          const hasRequiredIdFields = extractedData.fullName && extractedData.documentNumber &&
                                      extractedData.nationality && extractedData.documentType;
          if (!hasRequiredIdFields) {
            const missingFields: string[] = [];
            if (!extractedData.fullName) missingFields.push('nom complet');
            if (!extractedData.documentNumber) missingFields.push('numéro de document');
            if (!extractedData.nationality) missingFields.push('nationalité');
            if (!extractedData.documentType) missingFields.push('type de document');
            toast({
              title: 'Document partiellement reconnu',
              description: `Certaines informations n'ont pas pu être extraites (${missingFields.join(', ')}). Veuillez les compléter manuellement.`,
            });
          }

          // Les mises à jour fonctionnelles sont toujours séquencées par React —
          // sans risque de race condition même en traitement parallèle.
          setGuests(prevGuests => {
            const updatedGuests = [...prevGuests];
            let targetIndex = -1;

            if (extractedData.fullName || extractedData.documentNumber) {
              targetIndex = updatedGuests.findIndex(guest => {
                const sameDocNumber = extractedData.documentNumber && guest.documentNumber &&
                                      extractedData.documentNumber.trim() === guest.documentNumber.trim();
                return sameDocNumber;
              });

              if (targetIndex !== -1) {
                const existingGuest = updatedGuests[targetIndex];
                const isAlreadyComplete =
                  existingGuest.fullName?.trim().toLowerCase() === extractedData.fullName?.trim().toLowerCase() &&
                  existingGuest.documentNumber?.trim() === extractedData.documentNumber?.trim() &&
                  existingGuest.nationality === extractedData.nationality;
                if (isAlreadyComplete) return prevGuests;
              }
            }

            if (targetIndex === -1) {
              targetIndex = updatedGuests.findIndex(guest => !guest.fullName && !guest.documentNumber);
            }
            if (targetIndex === -1 && updatedGuests.length > 0) targetIndex = 0;

            if (targetIndex === -1) {
              return [...updatedGuests, {
                fullName: extractedData.fullName || '',
                dateOfBirth: parseGuestDateFromExtraction(extractedData.dateOfBirth) ?? undefined,
                nationality: extractedData.nationality || '',
                documentNumber: extractedData.documentNumber || '',
                documentType: (extractedData.documentType as 'passport' | 'national_id') || 'passport',
                documentIssueDate: parseGuestDateFromExtraction(extractedData.documentIssueDate) ?? undefined,
                profession: '',
                motifSejour: 'TOURISME',
                adressePersonnelle: '',
                email: '',
                placeOfBirth: extractedData.placeOfBirth || undefined,
              }];
            }

            const tg = updatedGuests[targetIndex];
            if (extractedData.fullName && tg.fullName !== extractedData.fullName) tg.fullName = extractedData.fullName;
            if (extractedData.nationality && tg.nationality !== extractedData.nationality) tg.nationality = extractedData.nationality;
            if (extractedData.documentNumber && tg.documentNumber !== extractedData.documentNumber) tg.documentNumber = extractedData.documentNumber;
            if (extractedData.documentType && tg.documentType !== extractedData.documentType) tg.documentType = extractedData.documentType as 'passport' | 'national_id';
            if (extractedData.placeOfBirth && tg.placeOfBirth !== extractedData.placeOfBirth) tg.placeOfBirth = extractedData.placeOfBirth;

            if (extractedData.dateOfBirth) {
              const parsed = parseGuestDateFromExtraction(extractedData.dateOfBirth);
              if (parsed && !isNaN(parsed.getTime()) && parsed >= new Date(1900, 0, 1)) tg.dateOfBirth = parsed;
            }
            if (extractedData.documentIssueDate) {
              const parsed = parseGuestDateFromExtraction(extractedData.documentIssueDate);
              if (parsed && !isNaN(parsed.getTime()) && parsed >= new Date(1990, 0, 1) && parsed <= new Date(2050, 11, 31)) tg.documentIssueDate = parsed;
            }
            return updatedGuests;
          });

          toast({ title: 'Document traité', description: 'Informations extraites automatiquement.' });
        } else {
          setUploadedDocuments(prev =>
            prev.map(doc => doc.url === url ? { ...doc, processing: false, ocrFailed: true } : doc)
          );
          toast({ title: t('upload.docNotRecognized.title'), description: t('upload.docNotRecognized.desc'), variant: 'destructive' });
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_DOCUMENT') {
          // Déjà géré
        } else {
          console.error('Document processing failed:', error);
          setUploadedDocuments(prev =>
            prev.map(doc => doc.url === url ? { ...doc, processing: false, ocrFailed: true } : doc)
          );
          toast({ title: t('upload.warning.title'), description: t('upload.warning.desc'), variant: 'destructive' });
        }
      } finally {
        processingFilesRef.current.delete(fileKey);
      }
    };

    try {
      // Traitement parallèle par lots de 3 (P8) — gain : 3 photos → ~12 s au lieu de ~36 s
      const BATCH = 3;
      for (let i = 0; i < filesArray.length; i += BATCH) {
        await Promise.all(filesArray.slice(i, i + BATCH).map(processFile));
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [toast, t]);

  const removeDocument = useCallback((url: string) => {
    console.log('🗑️ Removing document:', url);
    
    const docToRemove = uploadedDocuments.find(doc => doc.url === url);
    
    if (docToRemove && docToRemove.extractedData) {
      console.log('📄 Document had extracted data, finding associated guest...');
      
      const guestToResetIndex = guests.findIndex(guest => 
        guest.fullName === docToRemove.extractedData?.fullName ||
        guest.documentNumber === docToRemove.extractedData?.documentNumber
      );
      
      if (guestToResetIndex !== -1) {
        console.log('✂️ Clearing guest data at index:', guestToResetIndex);
        
        const updatedGuests = [...guests];
        updatedGuests[guestToResetIndex] = {
          ...createEmptyGuestForm(),
        };
        setGuests(updatedGuests);
        
        toast({
          title: t('guestVerification.docRemovedTitle'),
          description: t('guestVerification.docRemovedDesc'),
        });
      }
    }
    
    setUploadedDocuments(prev => prev.filter(doc => doc.url !== url));
    URL.revokeObjectURL(url);
  }, [guests, toast, t, uploadedDocuments]);

  const retryDocumentOcr = useCallback(
    async (docUrl: string) => {
      const doc = uploadedDocuments.find((d) => d.url === docUrl);
      if (!doc || doc.processing) return;
      const file = doc.file;
      removeDocument(docUrl);
      const dt = new DataTransfer();
      dt.items.add(file);
      await handleFileUpload(dt.files);
    },
    [uploadedDocuments, removeDocument, handleFileUpload]
  );

  const handleSubmit = async () => {
    // ✅ CRITIQUE : Protection renforcée contre les soumissions multiples
    if (isSubmittingRef.current || isProcessingRef.current || isLoading || navigationInProgressRef.current) {
      console.warn('⚠️ [GuestVerification] Soumission déjà en cours, appel ignoré', {
        isSubmitting: isSubmittingRef.current,
        isProcessing: isProcessingRef.current,
        isLoading,
        navigationInProgress: navigationInProgressRef.current,
        timestamp: new Date().toISOString()
      });
      toast({
        title: "Soumission en cours",
        description: "Veuillez patienter, la soumission est déjà en cours...",
        variant: "default"
      });
      return;
    }
    
    // ✅ CRITIQUE : Marquer immédiatement comme en cours AVANT toute opération
    isSubmittingRef.current = true;
    isProcessingRef.current = true;
    
    console.log('🚀 [GuestVerification] Unified workflow triggered once only', {
      timestamp: new Date().toISOString(),
      token: token?.substring(0, 8) + '...',
      airbnbCode: airbnbBookingId
    });
    
    console.log('🔍 Validation - Upload check:', {
      uploadedDocuments: uploadedDocuments.length,
      numberOfGuests: numberOfGuests,
      guestsArray: guests.length,
      deduplicatedGuests: deduplicatedGuests.length
    });

    if (!checkInDate || !checkOutDate) {
      // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      toast({
        title: t('validation.error.title'),
        description: t('validation.selectDates.desc'),
        variant: "destructive"
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateStartOfDay = new Date(checkInDate);
    checkInDateStartOfDay.setHours(0, 0, 0, 0);
    
    // ✅ DÉSACTIVÉ : Permettre les dates passées (réservations antérieures)
    // Les utilisateurs peuvent créer des réservations pour des dates passées
    /*
    if (checkInDateStartOfDay < today) {
      // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      toast({
        title: t('validation.error.title'),
        description: t('validation.dateFuture.desc'),
        variant: "destructive"
      });
      return;
    }
    */

    // ✅ CORRIGÉ : Utiliser deduplicatedGuests.length au lieu de numberOfGuests pour la validation
    // car deduplicatedGuests est la source de vérité pour le rendu (évite les doubles formulaires)
    const actualGuestCount = deduplicatedGuests.length;

    if (uploadedDocuments.some(d => d.processing)) {
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      toast({
        title: t('validation.error.title'),
        description: t('guestVerification.formLockedProcessing'),
        variant: 'default'
      });
      return;
    }

    // Une pièce par ligne `guests` (tableau parallèle à `uploadedDocuments`, cf. suppression doc + guest au même index).
    for (let ri = 0; ri < guests.length; ri++) {
      if (!uploadedDocuments[ri]) {
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        toast({
          title: t('validation.error.title'),
          description: t(isMobile ? 'guestVerification.formLockedHintMobile' : 'guestVerification.formLockedHintDesktop', { n: ri + 1 }),
          variant: 'destructive'
        });
        return;
      }
    }

    // ✅ VALIDATION : une entrée de pièce par voyageur (même nombre que `guests`, pas seulement les lignes dédupliquées)
    if (uploadedDocuments.length !== guests.length) {
      console.log('❌ Document validation failed:', {
        uploadedCount: uploadedDocuments.length,
        expectedCount: guests.length,
        numberOfGuests,
        guestsRaw: guests.length
      });
      // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      toast({
        title: t('validation.error.title'),
        description: t('validation.exactDocs.desc', { count: guests.length, s: guests.length > 1 ? 's' : '' }),
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Document validation passed');

    // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour la validation (évite les doubles formulaires)
    // ✅ VALIDATION STRICTE : Vérifier que TOUS les champs requis sont remplis, y compris le motif de séjour
    // ✅ NOUVEAU : Validation adaptée pour citoyens marocains (CIN acceptée avec date d'entrée optionnelle)
    const incompleteGuests = deduplicatedGuests.filter((guest) => {
      const motifSejour = guest.motifSejour || '';

      // Vérifier les champs de base
      if (!guest.fullName || !guest.dateOfBirth || !guest.nationality || !motifSejour || motifSejour.trim() === '') {
        return true;
      }
      
      // ✅ NOUVEAU : Validation adaptée selon la nationalité
      const isMoroccan = guest.nationality?.toUpperCase().includes('MAROC') || 
                         guest.nationality?.toUpperCase().includes('MOROCCO') ||
                         guest.nationality?.toUpperCase() === 'MAROCAIN' ||
                         guest.nationality?.toUpperCase() === 'MAROCAINE';
      
      if (isMoroccan) {
        // Citoyen marocain : CIN acceptée (national_id), date d'entrée au Maroc optionnelle
        if (!guest.documentNumber || guest.documentNumber.trim() === '') {
          return true; // Document requis même pour marocain
        }
        // Pas de validation de date d'entrée pour marocain (optionnelle)
      } else {
        // Non-marocain : Passeport ou titre de séjour requis, date d'entrée au Maroc obligatoire
        if (!guest.documentNumber || guest.documentNumber.trim() === '') {
          return true;
        }
        // Vérifier que c'est un passeport ou titre de séjour (pas CIN)
        if (guest.documentType === 'national_id') {
          // Pour non-marocain, national_id n'est pas accepté (doit être passeport)
          return true;
        }
        // TODO: Ajouter validation de date d'entrée au Maroc obligatoire pour non-marocain
        // (nécessite ajout du champ dans le formulaire)
      }
      
      return false;
    });

      if (incompleteGuests.length > 0) {
      // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      
      // ✅ NOUVEAU : Message d'erreur adapté selon le type de problème
      const firstIncomplete = incompleteGuests[0];
      const isMoroccan = firstIncomplete.nationality?.toUpperCase().includes('MAROC') || 
                         firstIncomplete.nationality?.toUpperCase().includes('MOROCCO') ||
                         firstIncomplete.nationality?.toUpperCase() === 'MAROCAIN' ||
                         firstIncomplete.nationality?.toUpperCase() === 'MAROCAINE';
      
      let errorMessage = t('validation.completeGuests.desc');
      if (!firstIncomplete.documentNumber || firstIncomplete.documentNumber.trim() === '') {
        errorMessage = 'Veuillez renseigner le numéro de document d\'identité.';
      } else if (!isMoroccan && firstIncomplete.documentType === 'national_id') {
        errorMessage = 'Pour les non-marocains, un passeport ou titre de séjour est requis (la CIN n\'est pas acceptée).';
      }
      
      toast({
        title: t('validation.error.title'),
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour éviter les doublons dans la soumission
      // ✅ VALIDATION STRICTE : Inclure le motif de séjour pour TOUS les invités (même critères que réservation/documents/signatures)
      const guestData = {
        guests: deduplicatedGuests.map((guest) => ({
          ...guest,
          dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : null,
          motifSejour: guest.motifSejour || 'TOURISME',
        }))
      };

      const bookingData = {
        checkInDate: formatLocalDate(checkInDate),
        checkOutDate: formatLocalDate(checkOutDate),
        numberOfGuests: deduplicatedGuests.length, // ✅ CORRIGÉ : Utiliser le nombre réel de guests dédupliqués
        propertyName: propertyName || 'Votre hébergement' // ✅ AJOUTÉ : Nom de la propriété
      };

      // ✅ CORRIGÉ : SUPPRESSION DE L'UPLOAD MANUEL DUPLIQUÉ
      // Le workflow unifié (submitDocumentsUnified) gère maintenant TOUS les uploads
      // Plus besoin d'uploader manuellement vers Supabase storage - évite la duplication
      
      console.log('🚀 [GuestVerification] Utilisation du workflow unifié (sans upload manuel préalable):', {
        token: token ? 'Présent' : 'Manquant',
        airbnbCode: airbnbBookingId,
        guestCount: deduplicatedGuests.length,
        guestsRaw: guests.length,
        documentsCount: uploadedDocuments.length,
        timestamp: new Date().toISOString(),
        isSubmitting: isSubmittingRef.current,
        isProcessing: isProcessingRef.current
      });

      // Convertir les données vers le format unifié
      // ✅ DEBUG: Log des données avant envoi
      // ✅ CORRIGÉ : Utiliser deduplicatedGuests[0] au lieu de guests[0] pour éviter les doublons
      const firstGuest = deduplicatedGuests[0];
      console.log('🔍 DEBUG - Données guest avant envoi:', {
        guest: firstGuest,
        hasDateOfBirth: !!firstGuest?.dateOfBirth,
        dateOfBirth: firstGuest?.dateOfBirth,
        formattedDateOfBirth: firstGuest?.dateOfBirth ? format(firstGuest.dateOfBirth, 'yyyy-MM-dd') : undefined
      });

      // ✅ VALIDATION STRICTE : Vérifier que TOUS les invités ont un motif de séjour valide
      // (même critères que pour la réservation, les documents et les signatures)
      const guestsWithoutMotif = deduplicatedGuests.filter((guest) => {
        const motifSejour = guest.motifSejour || '';
        return !motifSejour || motifSejour.trim() === '';
      });

      if (guestsWithoutMotif.length > 0) {
        // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        toast({
          title: t('validation.error.title'),
          description: `Veuillez sélectionner un motif de séjour pour ${guestsWithoutMotif.length > 1 ? 'tous les invités' : 'l\'invité'}.`,
          variant: "destructive",
        });
        return;
      }

      const guestsPayload = deduplicatedGuests.map((guest) => ({
        firstName: guest.fullName?.split(' ')[0] || '',
        lastName: guest.fullName?.split(' ').slice(1).join(' ') || '',
        email: guest.email || '',
        nationality: guest.nationality || '',
        idType: guest.documentType || 'passport',
        idNumber: guest.documentNumber || '',
        dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : undefined,
        documentIssueDate: guest.documentIssueDate ? format(guest.documentIssueDate, 'yyyy-MM-dd') : undefined,
        profession: guest.profession || '',
        motifSejour: guest.motifSejour || '',
        adressePersonnelle: guest.adressePersonnelle || '',
        placeOfBirth: guest.placeOfBirth || '',
      }));

      const guestInfo = guestsPayload[0];
      console.log('🔍 DEBUG - guestsPayload final:', guestsPayload);

      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      for (let i = 0; i < guestsPayload.length; i++) {
        const raw = guestsPayload[i].email?.trim() ?? '';
        if (raw && !emailRegex.test(raw)) {
          console.error('❌ Format email invalide:', guestsPayload[i].email);
          toast({
            title: "Email invalide",
            description: `Si vous renseignez un courriel pour le voyageur ${i + 1}, utilisez un format valide.`,
            variant: "destructive",
          });
          isSubmittingRef.current = false;
          isProcessingRef.current = false;
          return;
        }
      }

      // Convertir les fichiers en base64 pour l'envoi à l'Edge function
      const idDocuments = await Promise.all(
        uploadedDocuments.map((doc, index) =>
          new Promise<{ name: string; url: string; type: string; size: number }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: doc.file.name || `document_${index + 1}`,
                  url: reader.result as string,
                  type: doc.file.type || 'application/octet-stream',
                  size: doc.file.size,
                });
              reader.onerror = reject;
              reader.readAsDataURL(doc.file);
            }
          )
        )
      );
      
      console.log('✅ Documents converted to base64:', {
        count: idDocuments.length,
        sizes: idDocuments.map(d => d.size),
        hasErrors: idDocuments.some(d => !d.url || d.url === '')
      });

      // Démarrer le feedback de progression textuelle (P21)
      const steps = [
        t('guestVerification.submissionStep1'),
        t('guestVerification.submissionStep2'),
        t('guestVerification.submissionStep3'),
      ];
      setSubmissionStep(steps[0]);
      submissionStepTimerRef.current = [
        setTimeout(() => setSubmissionStep(steps[1]), 4000),
        setTimeout(() => setSubmissionStep(steps[2]), 12000),
      ];

      // Utiliser le service unifié
      const { submitDocumentsUnified } = await import('@/services/documentServiceUnified');
      
      // ✅ CORRIGÉ : Utiliser le vrai airbnbCode pour les liens ICS directs afin de trouver la réservation existante
      let finalAirbnbCode = airbnbBookingId || 'INDEPENDENT_BOOKING';
      
      // Vérifier les paramètres d'URL pour détecter un lien ICS direct
      const urlParams = new URLSearchParams(window.location.search);
      const startDateParam = urlParams.get('startDate');
      const endDateParam = urlParams.get('endDate');
      const airbnbCodeParam = urlParams.get('airbnbCode');
      
      // ✅ CORRIGÉ : Pour les liens ICS directs avec code Airbnb, utiliser le VRAI code
      // pour que le serveur trouve la réservation ICS existante créée lors de la génération du lien
      if (startDateParam && endDateParam) {
        if (airbnbCodeParam) {
          // ✅ CORRIGÉ : Utiliser le vrai code Airbnb pour trouver la réservation ICS existante
          // La réservation a été créée avec booking_reference = airbnbCode lors de la génération du lien
          console.log('🔍 Lien ICS direct détecté via paramètres d\'URL, utilisation du code Airbnb réel:', airbnbCodeParam);
          finalAirbnbCode = airbnbCodeParam; // ✅ Utiliser le vrai code au lieu de INDEPENDENT_BOOKING
        } else {
          // Lien ICS direct sans code - réservation indépendante
          console.log('🔍 Lien ICS direct détecté (sans code), création de réservation indépendante');
          finalAirbnbCode = 'INDEPENDENT_BOOKING';
        }
      } else if (!airbnbBookingId && checkInDate && checkOutDate) {
        // Si pas d'airbnbBookingId mais que les dates sont déjà définies, c'est probablement un lien ICS direct
        // Mais sans code, on ne peut pas trouver la réservation existante
        console.log('🔍 Lien ICS direct détecté via dates pré-remplies (sans code), création de réservation indépendante');
        finalAirbnbCode = 'INDEPENDENT_BOOKING';
      }

      // ✅ CORRIGÉ : Passer le code Airbnb réel dans les métadonnées si disponible
      // pour que le serveur puisse l'utiliser même avec INDEPENDENT_BOOKING
      const urlParamsForBooking = new URLSearchParams(window.location.search);
      const airbnbCodeFromUrl = urlParamsForBooking.get('airbnbCode');
      
      console.log('📤 Envoi au serveur:', {
        finalAirbnbCode,
        airbnbCodeFromUrl,
        tokenPrefix: token?.substring(0, 8) + '...',
        hasBookingData: !!bookingData,
        checkIn: bookingData.checkInDate,
        checkOut: bookingData.checkOutDate
      });
      
      // ✅ CRITIQUE : Vérifier une dernière fois avant l'appel au workflow
      if (isSubmittingRef.current === false || isProcessingRef.current === false) {
        console.error('❌ [GuestVerification] Flags réinitialisés avant l\'appel workflow, annulation');
        throw new Error('Soumission annulée - flags réinitialisés');
      }
      
      console.log('📤 [GuestVerification] Appel au workflow unifié...', {
        timestamp: new Date().toISOString(),
        finalAirbnbCode,
        guestCount: deduplicatedGuests.length
      });
      
      const result = await submitDocumentsUnified({
        token: token!,
        airbnbCode: finalAirbnbCode,
        guestInfo,
        guests: guestsPayload,
        idDocuments,
        bookingData: {
          checkIn: bookingData.checkInDate,
          checkOut: bookingData.checkOutDate,
          numberOfGuests: bookingData.numberOfGuests,
          // ✅ NOUVEAU : Passer le code Airbnb réel si disponible pour qu'il soit stocké dans la réservation
          ...(airbnbCodeFromUrl && { airbnbCode: airbnbCodeFromUrl })
        }
      });

      console.log('✅ [GuestVerification] Workflow unifié réussi:', {
        bookingId: result.bookingId,
        hasContractUrl: !!result.contractUrl,
        hasPoliceUrl: !!result.policeUrl,
        timestamp: new Date().toISOString()
      });
      const bookingId = result.bookingId;
      
      // ✅ CORRECTION : Vérifier que l'ID est valide
      if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
        console.error('❌ Booking ID invalide:', bookingId);
        throw new Error('ID de réservation invalide reçu du serveur');
      }
      
      console.log('✅ Booking created with ID:', bookingId);

      // ✅ Le workflow unifié a déjà tout synchronisé automatiquement !
      console.log('✅ Documents déjà synchronisés par le workflow unifié');

      // Sauvegarder les données dans localStorage (fallback Vercel qui perd location.state).
      // M5 — Clés namespacées par propertyId:token pour éviter qu'une 2e réservation ouverte
      // dans le même navigateur écrase les données de la 1re.
      try {
        const ns = `${propertyId}:${token}`;
        const set = (k: string, v: string) => {
          localStorage.setItem(`${k}:${ns}`, v); // clé namespacée
          localStorage.setItem(k, v);             // clé legacy (compatibilité ContractSigning existant)
        };
        set('currentBookingId', bookingId);
        set('currentBookingData', JSON.stringify(bookingData));
        set('currentGuestData', JSON.stringify({ ...guestInfo, guests: guestsPayload }));
        set('contractUrl', result.contractUrl ?? '');
        if (propertyName) set('currentPropertyName', propertyName);
        if (result.policeUrl) set('policeUrl', result.policeUrl);
        const submittedAt = Date.now();
        localStorage.setItem(`submittedAt:${bookingId}`, String(submittedAt));
        localStorage.setItem(
          `checkInCompleted:${ns}`,
          JSON.stringify({
            bookingId,
            contractUrl: result.contractUrl ?? null,
            at: submittedAt,
          })
        );
        console.log('✅ Données sauvegardées dans localStorage (clés namespacées + legacy)');
      } catch (storageError) {
        console.warn('⚠️ Erreur localStorage:', storageError);
      }

      toast({
        title: t('guestVerification.submissionSaved'),
        description: t('guestVerification.submissionSavedDesc'),
      });

      // ✅ CORRIGÉ : Préparer la navigation avec cleanup pour éviter les erreurs DOM
      const baseUrl = `/contract-signing/${propertyId}/${token}`;
      const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
      
      const navigationState = { 
        bookingId, 
        bookingData: {
          ...bookingData,
          // ✅ AJOUT : Inclure les guests dans bookingData pour le récapitulatif
          guests: deduplicatedGuests.map(g => ({
            fullName: g.fullName,
            nationality: g.nationality,
            documentNumber: g.documentNumber
          }))
        }, 
        guestData: {
          ...guestInfo,
          guests: guestsPayload,
        },
        contractUrl: result.contractUrl,
        policeUrl: result.policeUrl,
        propertyId,
        propertyName: propertyName || 'Votre hébergement', // ✅ AJOUTÉ : Nom de la propriété
        token,
        // ✅ AJOUTER : Timestamp pour éviter les conflits
        timestamp: Date.now()
      };
      
      console.log('🔍 DEBUG: Navigation vers signature avec state:', navigationState);
      console.log('🔍 DEBUG: URL de navigation:', url);
      console.log('🔍 DEBUG: bookingId à passer:', bookingId);
      
      // ✅ CORRIGÉ : Cleanup et navigation sécurisée
      // 1. Vérifier que le composant est toujours monté
      // 2. Attendre que tous les animations Framer Motion soient terminées
      // 3. Forcer la réconciliation DOM avec flushSync
      // 4. Attendre un tick pour que les Portals Radix UI soient nettoyés
      // 5. Naviguer avec try-catch pour gérer les erreurs
      
      // ✅ CRITIQUE : Éviter les navigations multiples
      if (navigationInProgressRef.current) {
        console.warn('⚠️ [GuestVerification] Navigation déjà en cours, ignorée', {
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      navigationInProgressRef.current = true;
      console.log('🧭 [GuestVerification] Navigation vers signature déclenchée une seule fois', {
        bookingId,
        url,
        timestamp: new Date().toISOString()
      });
      
      try {
        // ✅ Navigation immédiate - Plus de Select Radix UI = plus besoin de fermeture de Portals
        setIsLoading(false);
        
        // ✅ NOUVEAU : Sauvegarder les données du formulaire AVANT la navigation
        // Cela permet de restaurer les données si l'utilisateur revient depuis la page de signature
        await saveFormDataToSession();
        console.log('✅ [Navigation] Données du formulaire sauvegardées avant navigation vers signature');
        
        // Navigation directe
        try {
          navigate(url, { 
            state: navigationState,
            replace: false // Permettre le retour en arrière
          });
          console.log('✅ [GuestVerification] Navigation lancée avec succès - UNE SEULE FOIS', {
            bookingId,
            url,
            timestamp: new Date().toISOString()
          });
        } catch (navError) {
          console.error('❌ Erreur lors de la navigation:', navError);
          // ✅ FALLBACK : Si navigation échoue, utiliser window.location (fonctionne toujours)
          console.log('⚠️ Tentative de navigation via window.location...');
          window.location.href = url;
        }
      } catch (error) {
        // Erreur générale lors de la préparation de la navigation
        console.error('❌ Erreur lors de la préparation de la navigation:', error);
        navigationInProgressRef.current = false;
        // Réinitialiser isLoading en cas d'erreur
        setIsLoading(false);
      }

    } catch (error) {
      console.error('Error submitting guest information:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      setSubmissionError(`Erreur lors de l'envoi des informations: ${errorMessage}`);
      goToStep('documents');
      
      toast({
        title: "Erreur",
        description: `Erreur lors de l'envoi des informations. Veuillez réessayer ou contacter votre hôte.`,
        variant: "destructive"
      });
      
      // Réinitialiser le flag de navigation en cas d'erreur
      navigationInProgressRef.current = false;
    } finally {
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      // Nettoyer les timers de progression et réinitialiser le step (P21)
      submissionStepTimerRef.current.forEach(clearTimeout);
      submissionStepTimerRef.current = [];
      setSubmissionStep(null);
      if (!navigationInProgressRef.current) {
        setIsLoading(false);
      }
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-teal-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground font-medium"
          >
            Vérification du lien...
          </motion.p>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 2 }}
            className="text-sm text-muted-foreground mt-2"
          >
            Chargement en cours...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <Card className="border-red-200 shadow-xl">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"
              >
                <X className="w-8 h-8 text-red-600" />
              </motion.div>
              <CardTitle className="text-red-800">{t('guest.invalidLink.title')}</CardTitle>
              <CardDescription className="text-red-600">
                {t('guest.invalidLink.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-red-600">
                Veuillez contacter votre hôte pour obtenir un nouveau lien.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const handleNextStep = () => {
    if (!checkInDate || !checkOutDate) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner les dates d'arrivée et de départ",
        variant: "destructive"
      });
      return;
    }

    const validation = validateDates(checkInDate, checkOutDate);
    if (!validation.isValid) {
      toast({
        title: t('validation.error.title'),
        description: validation.error!,
        variant: "destructive"
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInStart = new Date(checkInDate);
    checkInStart.setHours(0, 0, 0, 0);
    if (checkInStart < today) {
      setPastDateDialogOpen(true);
      return;
    }
    goToStep('documents');
  };

  const proceedToDocumentsAfterPastDateWarning = () => {
    setPastDateDialogOpen(false);
    goToStep('documents');
  };

  const handlePrevStep = () => {
    if (currentStep === 'signature') {
      goToStep('documents'); // ✅ CORRIGÉ : Utiliser goToStep
    } else if (currentStep === 'documents') {
      goToStep('booking'); // ✅ CORRIGÉ : Utiliser goToStep
    }
  };

  if (submissionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className="p-8 max-w-md border-green-200 shadow-2xl">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-green-800">Merci!</h2>
                <p className="text-green-600 mt-2">
                  Vos informations ont été soumises avec succès. Vous pouvez maintenant procéder à la signature du contrat.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button 
                  onClick={() => {
                    const baseUrl = `/contract-signing/${propertyId}/${token}`;
                    const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
                    navigate(url);
                  }}
                  className="w-full text-white font-semibold transition-all"
                  style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                  size="lg"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  {t('contractSignature.signContract')}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentStepIndex = ['booking', 'documents', 'signature'].indexOf(currentStep);

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-start" style={{ backgroundColor: '#FDFDF9' }}>
      {import.meta.env.DEV && DEV_GUEST_VERIFICATION_URL ? (
        <div
          className="w-full border-b border-dashed border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          role="region"
          aria-label="Raccourci développement vérification invité"
        >
          <p className="font-medium mb-1">Lien de réservation / vérification (prédéfini)</p>
          <p className="text-xs text-amber-900/90 mb-2">
            Défini via <code className="rounded bg-white/80 px-1">VITE_DEV_GUEST_VERIFICATION_URL</code> dans{' '}
            <code className="rounded bg-white/80 px-1">.env</code>. Ouvrez le lien pour tester le flux invité classique.
          </p>
          <a
            href={DEV_GUEST_VERIFICATION_URL}
            className="text-teal-700 underline break-all block mb-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {DEV_GUEST_VERIFICATION_URL}
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-400 bg-white/90"
            onClick={() => {
              setGuests([{ ...DEV_PRESET_GUEST }]);
              setNumberOfAdults(1);
              setNumberOfChildren(0);
              toast({ title: 'Invité démo', description: 'Champs préremplis — complétez ou remplacez avant envoi.' });
            }}
          >
            Préremplir l'invité démo
          </Button>
        </div>
      ) : null}

      {/* ========================================
          MOBILE HEADER - Visible uniquement sur mobile
          ======================================== */}
      {isMobile && (
        <div className="mobile-header guest-verification-mobile-header safe-area-top">
          {/* Barre noire pleine largeur : logo à gauche, langue à droite uniquement */}
          <div className="flex items-center justify-between w-full">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <img
                  src="/lovable-uploads/imagecheckcalendar.png"
                  alt=""
                  className="block max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex h-8 items-center">
                <span
                  style={{
                    fontFamily: 'Fira Sans Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '20px',
                    lineHeight: 1,
                    color: '#FFFFFF',
                  }}
                >
                  CHECKY
                </span>
              </div>
            </div>
            <div className="language-switcher-in-header">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
      
      {/* ========================================
          LEFT SIDEBAR - Visible uniquement sur desktop (md:)
          ======================================== */}
      <div 
        className="hidden md:flex text-white flex-col fixed left-0 top-0 h-screen z-10" 
        style={{ 
          backgroundColor: '#1E1E1E',
          width: '436px',
          borderRadius: '0px 22px 22px 0px',
          boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
          padding: '64px 49px'
        }}
      >
        {/* Logo Section - CENTRÉ */}
        <div className="flex flex-col items-center" style={{ marginBottom: '72px' }}>
          <div className="mb-4 flex w-full items-center justify-center gap-3 px-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
              <img
                src="/lovable-uploads/imagecheckcalendar.png"
                alt=""
                className="block max-h-full max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="flex h-12 items-center">
              <span
                style={{
                  fontFamily: 'Fira Sans Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: '32px',
                  lineHeight: 1,
                  color: '#FFFFFF',
                }}
              >
                CHECKY
              </span>
            </div>
          </div>
          <p style={{ 
            fontFamily: 'Inter, sans-serif',
            fontWeight: 300,
            fontSize: '14px',
            lineHeight: '36px',
            letterSpacing: '-0.5px',
            color: '#0BD9D0',
            textAlign: 'center'
          }}>{t('guestVerification.slogan')}</p>
        </div>
        
        {currentStep === 'booking' && (
          <>
            {/* Premier paragraphe - Réservation (commence par "Votre réservation") */}
            <div style={{ textAlign: 'left' }}>
              <p style={{ 
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '24px',
                letterSpacing: '-0.5px',
                color: '#FFFFFF',
                width: '309px',
                marginBottom: '0',
                textAlign: 'left'
              }}>
                {t('guestVerification.reservationIntro', { property: propertyName ? t('guestVerification.reservationIntroProperty', { propertyName }) : '' })}
              </p>
            </div>
            
            {/* Spacer pour pousser le dernier paragraphe en bas */}
            <div style={{ flex: 1 }}></div>
            
            {/* Dernier paragraphe - Notre engagement */}
            <div>
              <p style={{ 
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '18px',
                letterSpacing: '-0.5px',
                color: '#FFFFFF',
                width: '309px'
              }}>
                {t('guestVerification.commitment')}
              </p>
            </div>
          </>
        )}
        
        {currentStep === 'documents' && (
          <>
            {/* Upload icon header */}
            <div 
              className="flex items-center gap-3 mb-4"
              style={{ marginTop: '-40px' }}
            >
              <Upload className="w-7 h-7" style={{ color: '#F3F3F3' }} />
              <h2 style={{
                fontFamily: 'Fira Sans Condensed, sans-serif',
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: '36px',
                color: '#FFFFFF'
              }}>{t('guestVerification.identityDocuments')}</h2>
            </div>

            {/* Upload Zone - Dark Theme matching Figma */}
            <div 
              style={{
                background: '#2D2F39',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '24px'
              }}
            >
              <div 
                className="cursor-pointer transition-all"
                style={{ 
                  background: '#1E1E1E',
                  border: '1px dashed #5A5B62',
                  borderRadius: '6px',
                  padding: '16px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderColor = '#0BD9D0';
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderColor = '#5A5B62';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderColor = '#5A5B62';
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
                onClick={(e) => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,.pdf';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files.length > 0) {
                      handleFileUpload(target.files);
                    }
                  };
                  input.click();
                }}
              >
                {/* Upload Icon */}
                <CloudUpload className="w-6 h-6" style={{ color: '#B0B2BC' }} />
                
                {/* Text content */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '17px',
                    color: '#B0B2BC',
                    marginBottom: '4px'
                  }}>{t('guestVerification.uploadDropzoneTitle')}</p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '15px',
                    color: 'rgba(176, 178, 188, 0.5)'
                  }}>{t('guestVerification.uploadDropzoneHint')}</p>
                </div>
              </div>

              {/* Import button - aligned to right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '48px' }}>
                <button
                  style={{
                    background: 'rgba(85, 186, 159, 0.8)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '19px',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#55BA9F'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(85, 186, 159, 0.8)'; }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,.pdf';
                    input.multiple = true;
                    input.onchange = (ev) => {
                      const target = ev.target as HTMLInputElement;
                      if (target.files && target.files.length > 0) {
                        handleFileUpload(target.files);
                      }
                    };
                    input.click();
                  }}
                >
                  Importer
                </button>
              </div>
            </div>
              
              {uploadedDocuments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3 text-white">{t('guestVerification.docsUploadedCount', { count: uploadedDocuments.length })}</h3>
                  <div className="space-y-2">
                    {uploadedDocuments.map((doc, index) => (
                      <div
                        key={doc.url}
                        className={`flex flex-col gap-2 p-3 rounded-lg relative group ${doc.ocrFailed ? 'ring-2 ring-red-500/60' : ''}`}
                        style={{ backgroundColor: '#1E1E1E' }}
                      >
                        <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.url)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t('guestVerification.docRemovedTitle')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {doc.ocrFailed && !doc.processing && (
                          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden />
                        )}
                        {doc.processing ? (
                          <div className="w-12 h-12 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : doc.file.type.startsWith('image/') ? (
                          <img 
                            src={doc.url} 
                            alt={doc.file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {doc.file.name}
                            {doc.processing && <span className="ml-2 text-green-400 text-xs">(Traitement...)</span>}
                          </p>
                          <p className="text-gray-400 text-xs break-words">
                            {formatDocExtractSummary(doc, guests[index])}
                          </p>
                        </div>
                        </div>
                        {doc.ocrFailed && !doc.processing && (
                          <div className="flex flex-wrap gap-2 pl-1">
                            <button
                              type="button"
                              className="text-xs text-teal-300 underline"
                              onClick={() => void retryDocumentOcr(doc.url)}
                            >
                              {t('guestVerification.retryOcr')}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-amber-200 underline"
                              onClick={() => unlockGuestManual(index)}
                            >
                              {t('guestVerification.manualEntryCta')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            
            <div className="mt-auto">
              <p className="text-gray-300 text-sm">
                {t('guestVerification.commitment')}
              </p>
            </div>
          </>
        )}
        
        {currentStep === 'signature' && (
          <>
            
            
            <div className="mt-auto">
              <p className="text-gray-300 text-sm">
                {t('guestVerification.commitment')}
              </p>
            </div>
          </>
        )}
      </div>
      
      {/* Right Main Content - full width on mobile (no sidebar) */}
      <div 
        className={`flex-1 flex flex-col w-full ${
          isMobile ? 'safe-area-all min-h-screen' : ''
        } ${
          currentStep === 'booking' && (showCalendarPanel || showGuestsPanel) ? 'overflow-visible' : ''
        }`}
        style={{ 
          backgroundColor: '#FDFDF9',
          marginLeft: isMobile ? 0 : '436px',
          minHeight: '100vh'
        }}
      >
        {/* P29 — Banner soumission précédente (dans la zone principale, pas à côté de la sidebar) */}
        {showPreviousSubmissionBanner && (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 flex flex-col gap-2"
          >
            <p className="font-semibold">
              {previousBookingId
                ? t('guestVerification.previousSubmission.title')
                : t('guestVerification.previousSubmission.titleSession')}
            </p>
            <p className="text-teal-700">
              {previousBookingId
                ? t('guestVerification.previousSubmission.desc')
                : t('guestVerification.previousSubmission.descSession')}
            </p>
            <div className="flex gap-2 flex-wrap">
              {previousBookingId && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
                  onClick={() => {
                    const ns = `${propertyId}:${token}`;
                    const url =
                      cachedContractUrl ??
                      localStorage.getItem(`contractUrl:${ns}`) ??
                      '';
                    const base = `/contract-signing/${propertyId}/${token}`;
                    const dest = airbnbBookingId ? `${base}/${airbnbBookingId}` : base;
                    navigate(dest, {
                      state: { bookingId: previousBookingId, contractUrl: url },
                    });
                  }}
                >
                  {t('guestVerification.previousSubmission.goSign')}
                </button>
              )}
              {!previousBookingId && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
                  onClick={() => {
                    restoreFormDataFromSession();
                    setShowPreviousSubmissionBanner(false);
                  }}
                >
                  {t('guestVerification.previousSubmission.resume')}
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-teal-400 text-teal-800 text-xs font-medium hover:bg-teal-100 transition-colors"
                onClick={() => {
                  if (propertyId && token) {
                    clearCheckInBrowserCache(
                      propertyId,
                      token,
                      getSessionKey,
                      previousBookingId
                    );
                  }
                  setShowPreviousSubmissionBanner(false);
                  setPreviousBookingId(null);
                  setCachedContractUrl(null);
                }}
              >
                {t('guestVerification.previousSubmission.restart')}
              </button>
            </div>
          </div>
        )}

        {/* Header with Logo and Language Switcher (langue uniquement sur desktop ; sur mobile elle est dans le bandeau noir) */}
        <div className="p-6 flex justify-between items-center">
          <div className="flex items-center" style={{ visibility: 'hidden' }}>
            {/* Logo retiré à la demande de l'utilisateur */}
          </div>
          {!isMobile && <LanguageSwitcher />}
        </div>

        {/* Étapes du check-in dans la partie claire (mobile uniquement) - cliquables comme desktop */}
        {isMobile && (
          <div className="guest-verification-steps-in-light">
            <div className="guest-verification-steps-row">
              <div 
                className={`guest-verification-step-icon ${currentStep === 'booking' ? 'active' : currentStepIndex > 0 ? 'done' : ''} ${canNavigateToStep('booking') ? 'guest-verification-step-clickable' : ''}`}
                aria-current={currentStep === 'booking' ? 'step' : undefined}
                role={canNavigateToStep('booking') ? 'button' : undefined}
                tabIndex={canNavigateToStep('booking') ? 0 : undefined}
                onClick={() => canNavigateToStep('booking') && goToStep('booking')}
                onKeyDown={(e) => { if (canNavigateToStep('booking') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goToStep('booking'); } }}
              >
                <CalendarLucide className="guest-verification-step-icon-svg" />
              </div>
              <div className={`guest-verification-step-connector ${currentStepIndex >= 1 ? 'done' : ''}`} />
              <div 
                className={`guest-verification-step-icon ${currentStep === 'documents' ? 'active' : currentStepIndex > 1 ? 'done' : ''} ${canNavigateToStep('documents') ? 'guest-verification-step-clickable' : ''}`}
                aria-current={currentStep === 'documents' ? 'step' : undefined}
                role={canNavigateToStep('documents') ? 'button' : undefined}
                tabIndex={canNavigateToStep('documents') ? 0 : undefined}
                onClick={() => canNavigateToStep('documents') && goToStep('documents')}
                onKeyDown={(e) => { if (canNavigateToStep('documents') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goToStep('documents'); } }}
              >
                <FileText className="guest-verification-step-icon-svg" />
              </div>
              <div className={`guest-verification-step-connector ${currentStepIndex >= 2 ? 'done' : ''}`} />
              <div 
                className={`guest-verification-step-icon ${currentStep === 'signature' ? 'active' : ''} ${canNavigateToStep('signature') ? 'guest-verification-step-clickable' : ''}`}
                aria-current={currentStep === 'signature' ? 'step' : undefined}
                role={canNavigateToStep('signature') ? 'button' : undefined}
                tabIndex={canNavigateToStep('signature') ? 0 : undefined}
                onClick={() => canNavigateToStep('signature') && goToStep('signature')}
                onKeyDown={(e) => { if (canNavigateToStep('signature') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goToStep('signature'); } }}
              >
                <PenTool className="guest-verification-step-icon-svg" />
              </div>
            </div>
          </div>
        )}
        
        {/* Progress Steps - Matching Figma design (hidden on mobile, stepper dans partie claire) */}
        <div className={`px-6 pb-8 flex items-start justify-center gap-16 ${isMobile ? 'hidden' : ''}`}>
          {/* Step 1: Réservation - Cliquable si déjà visitée et pas l'étape actuelle */}
          <div 
            className="flex flex-col items-center"
            onClick={() => {
              if (canNavigateToStep('booking')) {
                goToStep('booking');
              }
            }}
            style={{
              cursor: canNavigateToStep('booking') ? 'pointer' : 'default',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('booking')) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: currentStep === 'booking'
                  ? '#55BA9F'  // Vert quand actif
                  : 'rgba(85, 186, 159, 0.42)', // #55BA9F à 42% quand complété
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
              color: currentStep === 'booking' ? '#000000' : '#6B7280',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepBooking')}</span>
              {currentStep === 'booking' && (
                <div style={{
                  width: '100%',
                  height: '2px',
                  backgroundColor: '#000000',
                  marginTop: '4px'
                }} />
              )}
            </span>
          </div>
          
          {/* Step 2: Documents d'identité - Cliquable si déjà visitée et pas l'étape actuelle */}
          <div 
            className="flex flex-col items-center"
            onClick={() => {
              if (canNavigateToStep('documents')) {
                goToStep('documents');
              }
            }}
            style={{
              cursor: canNavigateToStep('documents') ? 'pointer' : 'default',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('documents')) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: currentStep === 'documents'
                  ? '#55BA9F'  // Même couleur sélection foncée que Réservation
                  : 'rgba(85, 186, 159, 0.42)', // Même couleur claire que Réservation (complété/inactif)
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
              color: currentStep === 'documents' ? '#000000' : '#6B7280',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepDocuments')}</span>
              {currentStep === 'documents' && (
                <div style={{
                  width: '100%',
                  height: '2px',
                  backgroundColor: '#000000',
                  marginTop: '4px'
                }} />
              )}
            </span>
          </div>
          
          {/* Step 3: Signature - Jamais cliquable (dernière étape) */}
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
                background: currentStep === 'signature'
                  ? '#55BA9F'  // Même couleur sélection foncée que Réservation
                  : 'rgba(85, 186, 159, 0.42)', // Même couleur claire que Réservation (inactif)
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
              color: currentStep === 'signature' ? '#000000' : '#6B7280',
              marginTop: '8px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              textAlign: 'center',
              flexDirection: 'column'
            }}>
              <span>{t('guestVerification.stepSignature')}</span>
              {currentStep === 'signature' && (
                <div style={{
                  width: '100%',
                  height: '2px',
                  backgroundColor: '#000000',
                  marginTop: '4px'
                }} />
              )}
            </span>
          </div>
        </div>
        
        {/* Main Content - scrollable, touch-friendly on mobile */}
        <div
          className={`flex-1 px-6 pb-6 ${
            currentStep === 'booking' && (showCalendarPanel || showGuestsPanel)
              ? 'overflow-visible'
              : 'overflow-y-auto'
          } ${isMobile ? 'guest-verification-main smooth-scroll' : ''}`}
        >
              {/* ✅ CORRIGÉ : Retirer ErrorBoundary car il causait des doubles rendus visuels */}
              {/* L'intercepteur global d'erreurs window.onerror gère déjà les erreurs Portal */}
                {/* ✅ CORRIGÉ : Retirer AnimatePresence pour éviter les conflits avec les Portals Radix UI */}
                {/* Utiliser simplement des div conditionnelles avec des clés stables */}
                {currentStep === 'booking' && (
                  <div
                    className={`mx-auto space-y-6 relative ${
                      isMobile ? 'max-w-full px-4' : 'max-w-4xl'
                    } ${showCalendarPanel || showGuestsPanel ? 'z-30' : ''}`}
                  >
                    {/* Titre - adapté mobile */}
                    <motion.h2 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`font-normal text-gray-900 text-center ${
                        isMobile ? 'text-xl mb-4 mt-2' : 'text-3xl mb-8'
                      }`}
                    >
                      {isMobile ? t('guestVerification.checkinShort') : t('guestVerification.checkinStartsHere')}
                    </motion.h2>
                    
                    {/* Central Search Bar - Responsive */}
                    <div className="relative" ref={bookingPanelsRef}>
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className={`bg-white rounded-2xl border border-gray-200 shadow-lg transition-all duration-300 ${
                          isMobile 
                            ? 'p-4 flex flex-col gap-3' 
                            : 'p-5 grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-x-8 gap-y-0 hover:shadow-xl'
                        }`}
                      >
                        {/* Zone 1: Hébergement - colonne égale */}
                        <div className={`cursor-default text-left ${
                          isMobile 
                            ? 'p-3 bg-gray-50 rounded-xl border border-gray-100' 
                            : 'min-w-0'
                        }`}>
                          <Label className={`block font-semibold lowercase ${isMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#222222' }}>{t('guestVerification.labelAccommodation')}</Label>
                          <div className={`font-normal ${isMobile ? 'text-base' : 'text-lg'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#717171' }}>{propertyName || t('guestVerification.propertyFallback')}</div>
                        </div>
                        
                        {/* Zone 2: Quand ? - Cliquable, même alignement */}
                        <div 
                          className={`cursor-pointer transition-colors text-left ${
                            isMobile 
                              ? 'p-3 bg-gray-50 rounded-xl border border-gray-100 active:bg-gray-100' 
                              : 'min-w-0 hover:bg-gray-50 rounded-lg p-2 -m-2'
                          }`}
                          onClick={() => {
                            const opening = !showCalendarPanel;
                            setShowCalendarPanel(opening);
                            setShowGuestsPanel(false);
                            if (opening) setRangeDraftStart(undefined);
                          }}
                        >
                          <Label className={`block font-semibold lowercase ${isMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#222222' }}>{t('guestVerification.labelWhen')}</Label>
                          <div className={`font-normal ${isMobile ? 'text-base' : 'text-lg'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#717171' }}>
                            {(() => {
                              const pendingStart =
                                rangeDraftStart ??
                                (checkInDate && !checkOutDate ? checkInDate : undefined);
                              if (checkInDate && checkOutDate) {
                                return isMobile
                                  ? `${format(checkInDate, 'dd/MM')} → ${format(checkOutDate, 'dd/MM/yy')}`
                                  : `${format(checkInDate, 'dd/MM/yyyy')} - ${format(checkOutDate, 'dd/MM/yyyy')}`;
                              }
                              if (pendingStart) {
                                return `${format(pendingStart, isMobile ? 'dd/MM' : 'dd/MM/yyyy')} → …`;
                              }
                              return t('guestVerification.selectDates');
                            })()}
                          </div>
                        </div>
                        
                        {/* Zone 3: Qui ? - Cliquable, poussé vers la droite */}
                        <div 
                          className={`cursor-pointer transition-colors relative text-left ${
                            isMobile 
                              ? 'p-3 bg-gray-50 rounded-xl border border-gray-100 active:bg-gray-100' 
                              : 'min-w-0 hover:bg-gray-50 rounded-lg p-2 -m-2 ml-12'
                          }`}
                          onClick={() => {
                            setShowGuestsPanel(!showGuestsPanel);
                            setShowCalendarPanel(false);
                          }}
                        >
                          <Label className={`block font-semibold lowercase ${isMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#222222' }}>{t('guestVerification.labelWho')}</Label>
                          <div className={`font-normal ${isMobile ? 'text-base' : 'text-lg'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#717171' }}>
                            {numberOfAdults + numberOfChildren > 0 
                              ? (numberOfAdults + numberOfChildren > 1 
                                  ? t('guestVerification.travelersCountPlural', { count: numberOfAdults + numberOfChildren }) 
                                  : t('guestVerification.travelersCount', { count: numberOfAdults + numberOfChildren }))
                              : t('guestVerification.numberOfTravelers')
                            }
                          </div>
                          
                          {/* Panneau flottant Voyageurs - Desktop only ici, Mobile = bottom sheet */}
                          {showGuestsPanel && !isMobile && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              className="absolute top-full left-0 mt-3 z-50"
                            >
                              <div 
                                style={{
                                  width: '250px',
                                  height: '118px',
                                  background: '#FFFFFF',
                                  border: '1px solid #D3D3D3',
                                  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                                  borderRadius: '25px',
                                  padding: '20px 24px',
                                  fontFamily: 'Fira Sans Condensed, sans-serif',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between'
                                }}
                              >
                                {/* Adultes - Desktop */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div style={{
                                    fontFamily: 'Fira Sans Condensed, sans-serif',
                                    fontWeight: 400,
                                    fontSize: '16px',
                                    lineHeight: '20px',
                                    color: '#1E1E1E'
                                  }}>Adultes</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNumberOfAdults(Math.max(1, numberOfAdults - 1));
                                      }}
                                      disabled={numberOfAdults <= 1}
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        border: '1px solid #D3D3D3',
                                        background: '#FFFFFF',
                                        cursor: numberOfAdults <= 1 ? 'not-allowed' : 'pointer',
                                        opacity: numberOfAdults <= 1 ? 0.5 : 1,
                                        fontSize: '20px',
                                        fontWeight: 400,
                                        color: '#1E1E1E',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >−</button>
                                    <span style={{
                                      fontFamily: 'Fira Sans Condensed, sans-serif',
                                      fontSize: '18px',
                                      fontWeight: 400,
                                      color: '#1E1E1E',
                                      minWidth: '28px',
                                      textAlign: 'center'
                                    }}>{numberOfAdults}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNumberOfAdults(numberOfAdults + 1);
                                      }}
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        border: '1px solid #D3D3D3',
                                        background: '#FFFFFF',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                        fontWeight: 400,
                                        color: '#1E1E1E',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >+</button>
                                  </div>
                                </div>
                                
                                {/* Enfants - Desktop */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div style={{
                                    fontFamily: 'Fira Sans Condensed, sans-serif',
                                    fontWeight: 400,
                                    fontSize: '16px',
                                    lineHeight: '20px',
                                    color: '#1E1E1E'
                                  }}>Enfants</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNumberOfChildren(Math.max(0, numberOfChildren - 1));
                                      }}
                                      disabled={numberOfChildren <= 0}
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        border: '1px solid #D3D3D3',
                                        background: '#FFFFFF',
                                        cursor: numberOfChildren <= 0 ? 'not-allowed' : 'pointer',
                                        opacity: numberOfChildren <= 0 ? 0.5 : 1,
                                        fontSize: '20px',
                                        fontWeight: 400,
                                        color: '#1E1E1E',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >−</button>
                                    <span style={{
                                      fontFamily: 'Fira Sans Condensed, sans-serif',
                                      fontSize: '18px',
                                      fontWeight: 400,
                                      color: '#1E1E1E',
                                      minWidth: '28px',
                                      textAlign: 'center'
                                    }}>{numberOfChildren}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNumberOfChildren(numberOfChildren + 1);
                                      }}
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        border: '1px solid #D3D3D3',
                                        background: '#FFFFFF',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                        fontWeight: 400,
                                        color: '#1E1E1E',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >+</button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                        
                        {/* Zone 4: Bouton continuer - Desktop seulement */}
                        {!isMobile && (
                          <Button
                            className="w-14 h-14 rounded-lg text-white flex-shrink-0 shadow-lg hover:shadow-xl transition-all"
                            style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                            onClick={handleNextStep}
                          >
                            <ArrowRight className="w-6 h-6" />
                          </Button>
                        )}
                      </motion.div>
                      
                      {/* ========================================
                          MOBILE BOTTOM SHEET - Voyageurs
                          ======================================== */}
                      {isMobile && showGuestsPanel && (
                        <>
                          {/* Overlay */}
                          <div 
                            className="mobile-overlay"
                            onClick={() => setShowGuestsPanel(false)}
                          />
                          
                          {/* Bottom Sheet */}
                          <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="mobile-bottom-sheet"
                          >
                            <div className="mobile-bottom-sheet-handle" />
                            
                            <div className="mobile-bottom-sheet-content">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voyageurs</h3>
                              
                              {/* Adultes */}
                              <div className="mobile-guests-row">
                                <span className="mobile-guests-label">Adultes</span>
                                <div className="mobile-guests-controls">
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfAdults(Math.max(1, numberOfAdults - 1));
                                    }}
                                    disabled={numberOfAdults <= 1}
                                  >−</button>
                                  <span className="mobile-guests-count">{numberOfAdults}</span>
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfAdults(numberOfAdults + 1);
                                    }}
                                  >+</button>
                                </div>
                              </div>
                              
                              {/* Enfants */}
                              <div className="mobile-guests-row">
                                <span className="mobile-guests-label">Enfants</span>
                                <div className="mobile-guests-controls">
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfChildren(Math.max(0, numberOfChildren - 1));
                                    }}
                                    disabled={numberOfChildren <= 0}
                                  >−</button>
                                  <span className="mobile-guests-count">{numberOfChildren}</span>
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfChildren(numberOfChildren + 1);
                                    }}
                                  >+</button>
                                </div>
                              </div>
                              
                              {/* Bouton Confirmer */}
                              <Button
                                className="w-full mt-6 text-white font-semibold transition-all"
                                style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                                onClick={() => setShowGuestsPanel(false)}
                              >
                                Confirmer
                              </Button>
                            </div>
                          </motion.div>
                        </>
                      )}
                      
                      {/* Panneau Calendrier - fullscreen sur mobile, flottant sur desktop */}
                      {showCalendarPanel && (
                        <>
                          {isMobile && (
                            <div
                              className="fixed inset-0 bg-black/50 z-[60] safe-area-all"
                              onClick={() => setShowCalendarPanel(false)}
                              aria-hidden="true"
                            />
                            )}
                          <motion.div
                            initial={{ opacity: 0, y: isMobile ? 80 : -10, scale: isMobile ? 0.98 : 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: isMobile ? 80 : -10, scale: isMobile ? 0.98 : 0.95 }}
                            className={isMobile
                              ? 'fixed inset-x-0 bottom-0 top-[env(safe-area-inset-top)] z-[61] bg-white rounded-t-2xl shadow-2xl overflow-y-auto safe-area-bottom'
                              : 'absolute top-full left-0 right-0 mt-3 flex justify-center z-[100]'
                            }
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className={isMobile ? 'p-4 pb-8' : 'bg-white rounded-xl shadow-2xl p-6'}>
                              {isMobile && (
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-lg font-bold text-gray-900">
                                    {t('guest.calendar.selectTitle')}
                                  </h3>
                                  <button
                                    type="button"
                                    onClick={() => setShowCalendarPanel(false)}
                                    className="p-2 rounded-full hover:bg-gray-100 touch-target"
                                    aria-label="Fermer"
                                  >
                                    <X className="w-5 h-5 text-gray-600" />
                                  </button>
                                </div>
                              )}
                              {!isMobile && (
                                <div className="mb-4 text-center">
                                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {t('guest.calendar.selectTitle')}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {t('guest.calendar.selectSubtitle')}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
                                    {t('guest.calendar.rangeHowto')}
                                  </p>
                                </div>
                              )}
                              {isMobile && (
                                <p className="text-xs text-gray-500 mb-3">
                                  {t('guest.calendar.rangeHowto')}
                                </p>
                              )}
                              
                              <EnhancedCalendar
                                key={`cal-${token ?? 't'}-${showCalendarPanel ? 'open' : 'closed'}`}
                                mode="range"
                                rangeStart={rangeDraftStart ?? checkInDate}
                                rangeEnd={checkOutDate}
                                onRangeProgress={(start, end) => {
                                  if (start && !end) {
                                    setRangeDraftStart(
                                      new Date(start.getFullYear(), start.getMonth(), start.getDate())
                                    );
                                  } else {
                                    setRangeDraftStart(undefined);
                                  }
                                }}
                                onRangeSelect={(checkIn, checkOut) => {
                                  const normalizedCheckIn = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                                  const normalizedCheckOut = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                                  setCheckInDate(normalizedCheckIn);
                                  setCheckOutDate(normalizedCheckOut);
                                  setRangeDraftStart(undefined);
                                  setShowCalendarPanel(false);
                                }}
                                className="mx-auto"
                              />
                            </div>
                          </motion.div>
                        </>
                      )}
                      
                    </div>
                    
                    {/* Boutons Navigation - Bas */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className={`flex justify-between items-center gap-4 ${isMobile ? 'pt-6 pb-4' : 'pt-24'}`}
                    >
                      {/* Bouton Précédent - Masqué sur la première étape */}
                      {currentStep !== 'booking' && (
                        <Button
                          className="px-8 py-3 font-semibold text-black shadow-md hover:shadow-lg transition-all"
                          style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px', border: 'none', color: '#040404' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                          onClick={handlePrevStep}
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          {t('guest.navigation.previous')}
                        </Button>
                      )}
                      
                      {/* Spacer pour pousser le bouton Suivant à droite si pas de Précédent */}
                      {currentStep === 'booking' && <div />}
                      
                      {/* Bouton Suivant */}
                      <Button
                        className="text-white px-8 py-3 font-semibold shadow-md hover:shadow-lg transition-all ml-auto"
                        style={{ backgroundColor: 'rgba(85, 186, 159, 0.8)', borderRadius: '8px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#55BA9F'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(85, 186, 159, 0.8)'; }}
                        onClick={handleNextStep}
                      >
                        {t('guest.navigation.next')}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  </div>
                )}

                {currentStep === 'documents' && (
                  <motion.div
                    key="documents-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-4xl mx-auto"
                  >
                    {submissionError && (
                      <div
                        role="alert"
                        className="mb-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                      >
                        <p>{t('guestVerification.retryBanner', { message: submissionError })}</p>
                        <button
                          type="button"
                          className="self-start text-red-700 underline text-xs"
                          onClick={() => setSubmissionError(null)}
                        >
                          {t('guestVerification.dismissError')}
                        </button>
                      </div>
                    )}
                    {/* Zone d'upload des pièces d'identité - visible sur mobile (sur desktop elle est dans la sidebar) */}
                    {isMobile && (
                      <div className="guest-verification-upload-mobile mb-6">
                        <div className="flex items-center gap-3 mb-3">
                          <Upload className="w-6 h-6 flex-shrink-0" style={{ color: '#55BA9F' }} />
                          <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Fira Sans Condensed, sans-serif' }}>
                            {t('guestVerification.identityDocuments')}
                          </h3>
                        </div>
                        <div
                          className="guest-verification-upload-zone-mobile"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*,.pdf';
                            input.multiple = true;
                            input.onchange = (e) => {
                              const target = e.target as HTMLInputElement;
                              if (target.files && target.files.length > 0) {
                                handleFileUpload(target.files);
                              }
                            };
                            input.click();
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('guest-verification-upload-zone-dragover'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('guest-verification-upload-zone-dragover'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('guest-verification-upload-zone-dragover');
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleFileUpload(e.dataTransfer.files);
                            }
                          }}
                        >
                          <CloudUpload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {t('guestVerification.uploadTapTitle')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t('guestVerification.uploadTapHint')}
                          </p>
                        </div>
                        {uploadedDocuments.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              {t('guestVerification.docsUploadedCount', { count: uploadedDocuments.length })}
                            </p>
                            <div className="space-y-2">
                              {uploadedDocuments.map((doc, index) => (
                                <div
                                  key={doc.url}
                                  className={`flex flex-col gap-2 p-3 rounded-xl border bg-white shadow-sm relative group ${doc.ocrFailed ? 'border-red-400' : 'border-gray-200'}`}
                                >
                                  <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDocument(doc.url);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 touch-target"
                                    aria-label={t('guestVerification.docRemovedTitle')}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  {doc.ocrFailed && !doc.processing && (
                                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden />
                                  )}
                                  {doc.processing ? (
                                    <div className="w-10 h-10 flex items-center justify-center">
                                      <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                  ) : doc.file.type.startsWith('image/') ? (
                                    <img src={doc.url} alt={doc.file.name} className="w-10 h-10 object-cover rounded-lg" />
                                  ) : (
                                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0 pr-8">
                                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file.name}</p>
                                    <p className="text-xs text-gray-500 break-words">
                                      {formatDocExtractSummary(doc, guests[index])}
                                    </p>
                                  </div>
                                  </div>
                                  {doc.ocrFailed && !doc.processing && (
                                    <div className="flex flex-wrap gap-3 pl-1">
                                      <button
                                        type="button"
                                        className="text-xs text-teal-700 underline"
                                        onClick={() => void retryDocumentOcr(doc.url)}
                                      >
                                        {t('guestVerification.retryOcr')}
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs text-amber-800 underline"
                                        onClick={() => unlockGuestManual(index)}
                                      >
                                        {t('guestVerification.manualEntryCta')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Header Section */}
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-7 h-7" style={{ color: '#000000' }} />
                      <h2 style={{
                        fontFamily: 'Fira Sans Condensed, sans-serif',
                        fontWeight: 400,
                        fontSize: '30px',
                        lineHeight: '36px',
                        color: '#040404'
                      }}>{t('guestVerification.travelerInfo')}</h2>
                    </div>
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '12px',
                      lineHeight: '15px',
                      color: '#4B5563',
                      marginBottom: '24px'
                    }}>
                      {t('guestVerification.travelerInfoSubline')}
                    </p>
                    
                    <div className="space-y-6">

                        <div className="space-y-6">
                          {deduplicatedGuests.map((guest, displayIndex) => {
                            const rowIndex = rowIndexForGuest(guest);
                            const identityFieldsLocked = isIdentityFieldsLocked(rowIndex);
                            const docAt = uploadedDocuments[rowIndex];
                            const showProcessingBanner = Boolean(docAt?.processing);
                            const showOcrFailedBanner =
                              Boolean(docAt?.ocrFailed && !docAt?.processing) && identityFieldsLocked;
                            return (
                            <div
                              key={`guest-form-${rowIndex}-${displayIndex}`}
                            >
                              {/* Guest Card - Figma style */}
                              <div style={{
                                background: '#FFFFFF',
                                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                                borderRadius: '12px',
                                padding: '24px'
                              }}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                  <span style={{
                                    fontFamily: 'Fira Sans Condensed, sans-serif',
                                    fontWeight: 400,
                                    fontSize: '16px',
                                    lineHeight: '36px',
                                    color: '#040404'
                                  }}>{t('guestVerification.travelerLabel', { n: displayIndex + 1 })}</span>
                                  {deduplicatedGuests.length > 1 && (
                                    <button 
                                      onClick={() => removeGuest(rowIndex)} 
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px'
                                      }}
                                    >
                                      <X className="w-5 h-5" style={{ color: '#EF4444' }} />
                                    </button>
                                  )}
                                </div>

                                {(showProcessingBanner || identityFieldsLocked) && (
                                  <div
                                    role="status"
                                    aria-live="polite"
                                    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                                      showProcessingBanner
                                        ? 'border-blue-200 bg-blue-50 text-blue-900'
                                        : 'border-amber-200 bg-amber-50 text-amber-950'
                                    }`}
                                  >
                                    {showProcessingBanner
                                      ? t('guestVerification.ocrInProgressHint')
                                      : t(
                                          isMobile
                                            ? 'guestVerification.formLockedHintMobile'
                                            : 'guestVerification.formLockedHintDesktop',
                                          { n: displayIndex + 1 }
                                        )}
                                  </div>
                                )}
                                {showOcrFailedBanner && (
                                  <button
                                    type="button"
                                    className="mb-4 text-sm text-teal-700 underline"
                                    onClick={() => unlockGuestManual(rowIndex)}
                                  >
                                    {t('guestVerification.manualEntryCta')}
                                  </button>
                                )}
                                
                                {/* Form Grid - 2 columns desktop, 1 column mobile */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.fullName')} <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      id={`fullName-${rowIndex}`}
                                      value={guest.fullName}
                                      onChange={(e) => updateGuest(rowIndex, 'fullName', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={identityFieldsLocked}
                                      autoComplete="name"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`guest-dob-${rowIndex}`} className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.dateOfBirth')} <span className="text-red-500">*</span>
                                    </Label>
                                    <GuestDateSelectField
                                      id={`guest-dob-${rowIndex}`}
                                      variant="birth"
                                      value={guestDateForPicker(guest.dateOfBirth)}
                                      onChange={(date) => updateGuest(rowIndex, 'dateOfBirth', date)}
                                      disabled={identityFieldsLocked}
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.nationality')} <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      id={`nationality-${rowIndex}`}
                                      value={guest.nationality}
                                      onChange={(e) => updateGuest(rowIndex, 'nationality', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={identityFieldsLocked}
                                      list={`nationalities-list-${rowIndex}`}
                                      autoComplete="country-name"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    <datalist id={`nationalities-list-${rowIndex}`}>
                                      {NATIONALITIES.filter(n => n !== '---').map((nationality) => (
                                        <option key={nationality} value={nationality} />
                                      ))}
                                    </datalist>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.placeOfBirth')}
                                    </Label>
                                    <input
                                      type="text"
                                      id={`placeOfBirth-${rowIndex}`}
                                      value={guest.placeOfBirth || ''}
                                      onChange={(e) => updateGuest(rowIndex, 'placeOfBirth', e.target.value)}
                                      disabled={identityFieldsLocked}
                                      autoComplete="off"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.documentType')} <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                      <select
                                        id={`documentType-${rowIndex}`}
                                        value={guest.documentType} 
                                        onChange={(e) => updateGuest(rowIndex, 'documentType', e.target.value)}
                                        disabled={identityFieldsLocked}
                                        className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      >
                                        <option value="passport">{t('guest.clients.passport')}</option>
                                        <option value="national_id">{t('guest.clients.nationalId')}</option>
                                      </select>
                                      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.documentNumber')} <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      id={`documentNumber-${rowIndex}`}
                                      value={guest.documentNumber}
                                      onChange={(e) => updateGuest(rowIndex, 'documentNumber', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={identityFieldsLocked}
                                      autoComplete="off"
                                      inputMode="text"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`guest-doc-expiry-${rowIndex}`} className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.documentExpiryDate')}
                                    </Label>
                                    <GuestDateSelectField
                                      id={`guest-doc-expiry-${rowIndex}`}
                                      variant="expiry"
                                      value={guestDateForPicker(guest.documentIssueDate)}
                                      onChange={(date) => updateGuest(rowIndex, 'documentIssueDate', date)}
                                      disabled={identityFieldsLocked}
                                    />
                                    {(() => {
                                      const dob = guest.dateOfBirth instanceof Date ? guest.dateOfBirth : undefined;
                                      const expiry = guest.documentIssueDate instanceof Date ? guest.documentIssueDate : undefined;
                                      if (dob && expiry && dob >= expiry) {
                                        return (
                                          <p className="text-xs text-amber-600 flex items-center gap-1" role="alert">
                                            <span aria-hidden="true">⚠</span>
                                            {t('guestVerification.dobAfterExpiryWarning')}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.profession')}
                                    </Label>
                                    <input
                                      type="text"
                                      id={`profession-${rowIndex}`}
                                      value={guest.profession || ''}
                                      onChange={(e) => updateGuest(rowIndex, 'profession', e.target.value)}
                                      placeholder=""
                                      autoComplete="organization-title"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.motifSejour')} <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                      <select
                                        id={`motifSejour-${rowIndex}`}
                                        value={guest.motifSejour || ''}
                                        onChange={(e) => updateGuest(rowIndex, 'motifSejour', e.target.value)}
                                        className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white appearance-none"
                                        required
                                      >
                                        <option value="">{t('guest.clients.motifSelect')}</option>
                                        {MOTIF_STAY_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {t(opt.labelKey)}
                                          </option>
                                        ))}
                                      </select>
                                      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.personalAddress')}
                                    </Label>
                                    <input
                                      type="text"
                                      id={`adresse-${rowIndex}`}
                                      value={guest.adressePersonnelle || ''}
                                      onChange={(e) => updateGuest(rowIndex, 'adressePersonnelle', e.target.value)}
                                      placeholder=""
                                      autoComplete="street-address"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.email')}{' '}
                                      <span className="text-gray-500 font-normal">{t('guest.clients.emailOptional')}</span>
                                    </Label>
                                    <input
                                      type="email"
                                      id={`email-${rowIndex}`}
                                      value={guest.email || ''}
                                      onChange={(e) => updateGuest(rowIndex, 'email', e.target.value)}
                                      placeholder=""
                                      autoComplete="email"
                                      inputMode="email"
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                    </div>
                    
                    {/* Footer navigation — sticky sur mobile, inline sur desktop (P30) */}
                    <div style={isMobile ? {
                      position: 'sticky',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      background: '#FFFFFF',
                      borderTop: '1px solid #E5E7EB',
                      padding: '12px 16px',
                      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                      zIndex: 40,
                      marginTop: '24px',
                    } : {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '32px',
                      marginTop: '32px',
                      gap: '16px',
                    }}>
                      {/* Bouton Précédent */}
                      <button
                        onClick={handlePrevStep}
                        style={{
                          minWidth: '120px',
                          height: '44px',
                          background: 'rgba(85, 186, 159, 0.8)',
                          boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '16px',
                          lineHeight: '28px',
                          color: '#040404',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#55BA9F'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(85, 186, 159, 0.8)'; }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {t('guest.navigation.previous')}
                      </button>
                      
                      {/* Bouton Suivant */}
                      <button
                        onClick={(e) => {
                          if (isSubmittingRef.current || isProcessingRef.current || isLoading || navigationInProgressRef.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.warn('⚠️ [GuestVerification] Double clic détecté et bloqué', {
                              timestamp: new Date().toISOString()
                            });
                            return;
                          }
                          handleSubmit();
                        }}
                        disabled={isLoading || isSubmittingRef.current || isProcessingRef.current || navigationInProgressRef.current}
                        style={{
                          minWidth: '120px',
                          height: '44px',
                          background: 'rgba(85, 186, 159, 0.8)',
                          boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: isLoading || isSubmittingRef.current || isProcessingRef.current || navigationInProgressRef.current ? 'not-allowed' : 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '16px',
                          lineHeight: '28px',
                          color: '#040404',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          opacity: isLoading || isSubmittingRef.current || isProcessingRef.current || navigationInProgressRef.current ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isLoading && !isSubmittingRef.current && !isProcessingRef.current && !navigationInProgressRef.current) {
                            e.currentTarget.style.background = '#55BA9F';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(85, 186, 159, 0.8)';
                        }}
                      >
                        {isLoading && submissionStep ? submissionStep : t('guestVerification.submitAndContinue')}
                        {!isLoading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
                
                {currentStep === 'signature' && (
                  <motion.div
                    key="signature-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-4xl mx-auto"
                  >
                    <h2 className="text-3xl font-bold mb-6">{t('guestVerification.signatureTitle')}</h2>
                    <p className="text-gray-600 mb-6">{t('guestVerification.signatureIntro')}</p>
                    
                    {/* Contract content placeholder - keep existing signature logic */}
                    <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {t('guest.signature.contract') || 'Contrat de location...'}
                      </p>
                    </div>
                    
                    {/* Signature pad and checkbox - keep existing logic */}
                    <div className="space-y-6">
                      <div>
                        <Label className="flex items-center gap-2 mb-4">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            required
                          />
                          <span>{t('guestVerification.acceptTerms')}</span>
                        </Label>
                      </div>
                    </div>
                    
                    {/* Footer navigation */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      paddingTop: '32px', 
                      marginTop: '32px',
                      gap: '16px'
                    }}>
                      {/* Bouton Précédent */}
                      <button
                        onClick={handlePrevStep}
                        style={{
                          minWidth: '120px',
                          height: '44px',
                          background: 'rgba(85, 186, 159, 0.8)',
                          boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '16px',
                          lineHeight: '28px',
                          color: '#040404',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#55BA9F'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(85, 186, 159, 0.8)'; }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {t('guest.navigation.previous')}
                      </button>
                      
                      {/* Note: Le bouton de soumission finale sera géré par le composant ContractSigning */}
                    </div>
                  </motion.div>
                )}
        </div>
        
        {/* Footer - Matching Figma (safe-area on mobile for iOS/Android) */}
        <footer className={isMobile ? 'safe-area-bottom guest-verification-footer' : ''} style={{
          padding: '16px 24px',
          backgroundColor: '#FDFDF9',
          marginTop: 'auto'
        }}>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '15px',
            color: '#000000',
            textAlign: 'center'
          }}>
            © 2025 Checky — {t('guestVerification.footerRights')}, {t('guestVerification.footerLegal')} • {t('guestVerification.footerPrivacy')} • {t('guestVerification.footerTerms')}
          </p>
        </footer>
      </div>

      <AlertDialog open={pastDateDialogOpen} onOpenChange={setPastDateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('guestVerification.pastDateWarning.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('guestVerification.pastDateWarning.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('guestVerification.pastDateWarning.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={proceedToDocumentsAfterPastDateWarning}>
              {t('guestVerification.pastDateWarning.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

