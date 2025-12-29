import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ✅ NOUVEAU : Fonction pour nettoyer le nom du guest récupéré depuis l'URL
function cleanGuestNameFromUrl(guestName: string): string {
  if (!guestName || guestName.trim() === '') return '';
  
  // Nettoyer le nom des éléments indésirables
  let cleanedName = guestName.trim();
  
  // Supprimer les patterns communs qui ne sont pas des noms
  const unwantedPatterns = [
    /phone\s*number/i,
    /phone/i,
    /address/i,
    /adresse/i,
    /email/i,
    /tel/i,
    /mobile/i,
    /fax/i,
    /^[A-Z0-9]{6,}$/, // Codes alphanumériques longs
    /^\d+$/, // Que des chiffres
    /^[A-Z]{2,}\d+$/, // Combinaisons lettres+chiffres comme "JBFDPhone"
    /\n/, // Retours à la ligne
    /\r/, // Retours chariot
  ];
  
  for (const pattern of unwantedPatterns) {
    if (pattern.test(cleanedName)) {
      console.log('🧹 Nom nettoyé depuis URL - pattern indésirable détecté:', cleanedName);
      return ''; // Retourner vide si le nom contient des éléments indésirables
    }
  }
  
  // Vérifier que le nom contient au moins des lettres
  if (!/[a-zA-Z]/.test(cleanedName)) {
    console.log('🧹 Nom nettoyé depuis URL - pas de lettres détectées:', cleanedName);
    return '';
  }
  
  // Nettoyer les espaces multiples et les retours à la ligne
  cleanedName = cleanedName.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log('✅ Nom nettoyé depuis URL avec succès:', cleanedName);
  return cleanedName;
}
import { motion } from 'framer-motion';
// ✅ CORRIGÉ : flushSync retiré car il cause des erreurs Portal
// import { flushSync } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// ✅ ErrorBoundary retiré - l'intercepteur global window.onerror gère les erreurs Portal
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileText, X, CheckCircle, Users, Calendar as CalendarLucide, ArrowRight, ArrowLeft, Sparkles, RefreshCw, RotateCcw, Check, PenTool, Home, CloudUpload } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate, formatLocalDate, extractDateOnly } from '@/utils/dateUtils';
import { OpenAIDocumentService } from '@/services/openaiDocumentService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { EnhancedInput } from '@/components/ui/enhanced-input';
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload';
import { AnimatedStepper } from '@/components/ui/animated-stepper';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { validateToken, isTestToken, logTestTokenUsage, TEST_TOKENS_CONFIG } from '@/utils/testTokens';
import { validateTokenDirect } from '@/utils/tokenValidation';
import { Guest } from '@/types/booking'; // ✅ Importer le type centralisé
import LanguageSwitcher from '@/components/guest/LanguageSwitcher';
import { AnimatePresence } from 'framer-motion';

// Liste complète des nationalités
const NATIONALITIES = [
  'Morocco', '---', 'France', 'Spain', 'Italy', 'Germany', 'United Kingdom', 'Belgium', 'Netherlands', 'Portugal',
  'Algeria', 'Tunisia', 'Turkey', 'United States', 'Canada', 'Brazil', 'Argentina', 'Russia', 'China', 
  'Japan', 'South Korea', 'India', 'Australia', 'New Zealand', 'South Africa', 'Egypt', 'Nigeria',
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Lebanon', 'Jordan', 'Syria', 'Iraq', 'Iran',
  'Pakistan', 'Bangladesh', 'Afghanistan', 'Thailand', 'Vietnam', 'Malaysia', 'Singapore',
  'Indonesia', 'Philippines', 'Mexico', 'Colombia', 'Venezuela', 'Peru', 'Chile', 'Ukraine',
  'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Serbia', 'Bosnia and Herzegovina', 'Albania',
  'Greece', 'Cyprus', 'Malta', 'Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland', 'Ireland',
  'Switzerland', 'Austria', 'Luxembourg', 'Monaco', 'Andorra', 'San Marino', 'Vatican City',
  'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Belarus', 'Moldova', 'Georgia',
  'Armenia', 'Azerbaijan', 'Kazakhstan', 'Kyrgyzstan', 'Uzbekistan', 'Tajikistan', 'Turkmenistan', 'Mongolia', 'North Korea',
  'Taiwan', 'Hong Kong', 'Macao', 'Myanmar', 'Laos', 'Cambodia', 'Brunei', 'Timor-Leste', 'Other'
];

// ✅ Interface Guest supprimée - utilisation du type centralisé de @/types/booking

interface UploadedDocument {
  file: File;
  url: string;
  processing: boolean;
  extractedData?: any;
  isInvalid?: boolean;
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
  const [isLoading, setIsLoading] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [propertyName, setPropertyName] = useState('');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [guests, setGuests] = useState<Guest[]>([{
    fullName: '',
    dateOfBirth: undefined,
    nationality: '',
    documentNumber: '',
    documentType: 'passport',
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
        profession: '',
        motifSejour: 'TOURISME' as const,
        adressePersonnelle: '',
        email: ''
      }] as Guest[];
    }
    
    // ✅ ALGORITHME DE DÉDUPLICATION ROBUSTE
    const uniqueGuests = guests.reduce((acc: Guest[], guest, currentIndex) => {
      // Si le guest est complètement vide, le garder tel quel
      if (!guest.fullName && !guest.documentNumber && !guest.nationality) {
        // Seulement si on n'a pas déjà un guest vide
        const hasEmptyGuest = acc.some(g => !g.fullName && !g.documentNumber && !g.nationality);
        if (!hasEmptyGuest) {
          acc.push(guest);
        }
        return acc;
      }
      
      // Chercher si un guest avec les mêmes données existe déjà
      const isDuplicate = acc.some(existingGuest => {
        const sameFullName = guest.fullName && existingGuest.fullName && 
                             guest.fullName.trim().toLowerCase() === existingGuest.fullName.trim().toLowerCase();
        const sameDocNumber = guest.documentNumber && existingGuest.documentNumber && 
                             guest.documentNumber.trim() === existingGuest.documentNumber.trim();
        
        // C'est un doublon si au moins un identifiant correspond
        return sameFullName || sameDocNumber;
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
  const getSessionKey = (key: string) => `guest_verification_${key}_${propertyId}_${token}`;
  const hasInitializedInSession = (key: string) => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(getSessionKey(key)) === 'true';
  };
  const markInitializedInSession = (key: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(getSessionKey(key), 'true');
  };

  // ✅ SUPPRIMÉ : Intercepteur d'erreurs redondant - l'intercepteur global dans main.tsx gère déjà les erreurs Portal

  // ✅ CORRIGÉ : Cleanup immédiat au montage ET au démontage
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      // Cleanup lors du démontage
      isMountedRef.current = false;
      navigationInProgressRef.current = false;
    };
  }, []);

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

  // ✅ NOUVEAU : Vérifier si c'est un lien ICS direct et pré-remplir les données
  useEffect(() => {
    if (!token || !propertyId) return;
    
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
        
        // ✅ NOUVEAU : Vérifier d'abord les paramètres d'URL pour les dates
        const urlParams = new URLSearchParams(window.location.search);
        const startDateParam = urlParams.get('startDate');
        const endDateParam = urlParams.get('endDate');
        const guestNameParam = urlParams.get('guestName');
        const guestsParam = urlParams.get('guests');
        const airbnbCodeParam = urlParams.get('airbnbCode');

        if (startDateParam && endDateParam) {
          console.log('✅ Dates trouvées dans l\'URL, pré-remplissage direct:', {
            startDate: startDateParam,
            endDate: endDateParam,
            guestName: guestNameParam,
            guests: guestsParam,
            airbnbCode: airbnbCodeParam
          });

          // ✅ CORRIGÉ : Pré-remplir directement depuis l'URL en utilisant parseLocalDate
          // pour éviter le décalage d'un jour causé par l'interprétation UTC de new Date()
          // ✅ AJOUT : Gestion d'erreurs robuste pour éviter page blanche
          // ✅ CORRIGÉ : Utiliser extractDateOnly pour éviter les décalages de timezone
          try {
            // Extraire la partie date (YYYY-MM-DD) depuis n'importe quel format
            const startDateStr = extractDateOnly(startDateParam);
            const endDateStr = extractDateOnly(endDateParam);
            
            // ✅ CORRIGÉ : Parser les dates et normaliser à minuit local pour éviter les problèmes de comparaison
            const startDateParsed = parseLocalDate(startDateStr);
            const endDateParsed = parseLocalDate(endDateStr);
            
            // ✅ CRITIQUE : Normaliser les dates à minuit local (sans heures/minutes/secondes)
            // Cela évite les problèmes de comparaison dans le calendrier
            const startDate = new Date(startDateParsed.getFullYear(), startDateParsed.getMonth(), startDateParsed.getDate());
            const endDate = new Date(endDateParsed.getFullYear(), endDateParsed.getMonth(), endDateParsed.getDate());
            
            console.log('📅 Dates récupérées depuis l\'URL (normalisées à minuit local):', {
              startDateParam,
              endDateParam,
              startDateStr,
              endDateStr,
              // ✅ CORRIGÉ : Afficher les valeurs réelles utilisées (format local) au lieu de toISOString()
              startDateLocal: startDate.toLocaleDateString('fr-FR'),
              endDateLocal: endDate.toLocaleDateString('fr-FR'),
              startDateFormatted: formatLocalDate(startDate),
              endDateFormatted: formatLocalDate(endDate),
              // ✅ DEBUG : Afficher aussi les composants de date pour vérification
              startDateComponents: {
                year: startDate.getFullYear(),
                month: startDate.getMonth() + 1,
                day: startDate.getDate()
              },
              endDateComponents: {
                year: endDate.getFullYear(),
                month: endDate.getMonth() + 1,
                day: endDate.getDate()
              },
              isValidStart: startDate.getTime() > 0,
              isValidEnd: endDate.getTime() > 0
            });
            
            setCheckInDate(startDate);
            setCheckOutDate(endDate);
            const guestsCount = parseInt(guestsParam || '1');
            setNumberOfGuests(guestsCount);
            
            // ✅ CORRIGÉ CRITIQUE : NE PAS recréer le tableau guests si déjà initialisé
            // Cela évite de créer des doublons lors des re-renders
            setGuests(prevGuests => {
              console.log('📊 Synchronisation guests depuis URL:', {
                guestsCount,
                prevGuestsCount: prevGuests.length,
                guestNameParam: guestNameParam || '(vide)'
              });
              
              // Si le nombre est déjà bon ET qu'on n'a pas de nom à ajouter, ne rien faire
              if (prevGuests.length === guestsCount) {
              // ✅ RÉACTIVÉ : Le pré-remplissage fonctionne maintenant avec des select natifs (pas de Portals)
              // Vérifier si on a un nom à ajouter
              if (guestNameParam && guestNameParam.trim()) {
                const cleanGuestName = cleanGuestNameFromUrl(decodeURIComponent(guestNameParam));
                if (cleanGuestName && prevGuests[0] && !prevGuests[0].fullName) {
                  const updated = [...prevGuests];
                  updated[0] = { ...updated[0], fullName: cleanGuestName };
                  console.log('✅ Nom du guest ajouté depuis URL:', cleanGuestName);
                  return updated;
                }
              }
              console.log('✅ Nombre de guests déjà correct, pas de modification');
              return prevGuests;
            }
            
            // Sinon, créer le bon nombre de guests
            const newGuests: Guest[] = [];
            for (let i = 0; i < guestsCount; i++) {
              newGuests.push({
                fullName: '',
                dateOfBirth: undefined,
                nationality: '',
                documentNumber: '',
                documentType: 'passport',
                profession: '',
                motifSejour: 'TOURISME',
                adressePersonnelle: '',
                email: ''
              });
            }

            // Pré-remplir le nom du guest si disponible (nettoyé) - seulement pour le premier guest
            if (guestNameParam && guestNameParam.trim() && newGuests.length > 0) {
              const cleanGuestName = cleanGuestNameFromUrl(decodeURIComponent(guestNameParam));
              if (cleanGuestName) {
                newGuests[0].fullName = cleanGuestName;
                console.log('✅ Nouveau tableau guests créé avec nom:', cleanGuestName);
              }
            }
            
            console.log('✅ Nouveau tableau guests créé:', newGuests.length);
            return newGuests;
          });
          } catch (dateError) {
            console.error('❌ Erreur lors du parsing des dates depuis l\'URL:', dateError);
            // ✅ FALLBACK : Utiliser new Date() si parseLocalDate échoue
            try {
              const startDate = new Date(startDateParam);
              const endDate = new Date(endDateParam);
              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                const guestsCount = parseInt(guestsParam || '1');
                setCheckInDate(startDate);
                setCheckOutDate(endDate);
                setNumberOfGuests(guestsCount);
                console.warn('⚠️ Utilisation fallback new Date() pour les dates');
              }
            } catch (fallbackError) {
              console.error('❌ Erreur même avec fallback new Date():', fallbackError);
            }
          }

          toast({
            title: "Dates de réservation chargées",
            description: `Réservation ${airbnbCodeParam || 'Airbnb'} du ${new Date(startDateParam).toLocaleDateString('fr-FR')} au ${new Date(endDateParam).toLocaleDateString('fr-FR')}`
          });

          return; // Sortir si les dates sont dans l'URL
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
          
          const { data, error } = await supabase.functions.invoke('issue-guest-link', {
            body: {
              action: 'resolve',
              propertyId,
              token
            }
          });

          if (error) {
            console.error('❌ [ICS] Erreur issue-guest-link:', {
              message: error.message,
              status: error.status,
              statusText: error.statusText,
              details: error
            });
            
            // Afficher un toast pour informer l'utilisateur
            toast({
              title: "Erreur de vérification",
              description: "Impossible de vérifier le lien. Veuillez réessayer.",
              variant: "destructive"
            });
            return;
          }

          console.log('✅ [ICS] Réponse issue-guest-link:', data);

        if (data?.success && data?.metadata?.linkType === 'ics_direct') {
          const reservationData = data.metadata.reservationData;
          if (reservationData) {
            console.log('✅ Données ICS détectées via token, pré-remplissage des dates:', reservationData);
            
            // Pré-remplir les dates depuis les métadonnées du token
            // ✅ CORRIGÉ : Utiliser extractDateOnly puis parseLocalDate pour éviter le décalage timezone
            // ✅ AJOUT : Gestion d'erreurs robuste
            try {
              const startDateStr = extractDateOnly(reservationData.startDate);
              const endDateStr = extractDateOnly(reservationData.endDate);
              
              setCheckInDate(parseLocalDate(startDateStr));
              setCheckOutDate(parseLocalDate(endDateStr));
              setNumberOfGuests(reservationData.numberOfGuests || 1);
            } catch (dateError) {
              console.error('❌ Erreur lors du parsing des dates depuis les métadonnées:', dateError);
              // Fallback
              try {
                setCheckInDate(new Date(reservationData.startDate));
                setCheckOutDate(new Date(reservationData.endDate));
                setNumberOfGuests(reservationData.numberOfGuests || 1);
              } catch (fallbackError) {
                console.error('❌ Erreur même avec fallback:', fallbackError);
              }
            }
            
            // Pré-remplir le nom du guest si disponible
            if (reservationData.guestName) {
              setGuests([{
                fullName: reservationData.guestName,
                dateOfBirth: undefined,
                nationality: '',
                documentNumber: '',
                documentType: 'passport',
                profession: '',
                motifSejour: 'TOURISME',
                adressePersonnelle: '',
                email: ''
              }]);
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
  }, [token, propertyId]);

  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [numberOfAdults, setNumberOfAdults] = useState(1);
  const [numberOfChildren, setNumberOfChildren] = useState(0);
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [showGuestsPanel, setShowGuestsPanel] = useState(false);
  const calendarPanelRef = useRef<HTMLDivElement>(null);
  const guestsPanelRef = useRef<HTMLDivElement>(null);
  
  // Fermer les panneaux au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarPanelRef.current && !calendarPanelRef.current.contains(event.target as Node)) {
        setShowCalendarPanel(false);
      }
      if (guestsPanelRef.current && !guestsPanelRef.current.contains(event.target as Node)) {
        setShowGuestsPanel(false);
      }
    };
    
    if (showCalendarPanel || showGuestsPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendarPanel, showGuestsPanel]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [currentStep, setCurrentStep] = useState<'booking' | 'documents' | 'signature'>('booking');

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
      
      // ✅ CRITIQUE : Garde global pour éviter les doubles exécutions (Strict Mode / Hydratation SSR)
      if (hasInitializedTokenRef.current) {
        console.log('✅ [Token] Déjà initialisé (useRef), ignoré');
        return;
      }
      
      // ✅ CRITIQUE : Vérifier aussi dans sessionStorage (persiste entre navigations)
      if (hasInitializedInSession('token')) {
        console.log('✅ [Token] Déjà initialisé (sessionStorage), ignoré');
        hasInitializedTokenRef.current = true; // Synchroniser le ref
        // ✅ CRITIQUE : Si déjà validé, ne pas re-vérifier mais mettre à jour l'état
        if (isValidToken) {
          setCheckingToken(false);
        }
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

      try {
        // ✅ NOUVEAU : Vérifier d'abord si c'est un token de test
        if (TEST_TOKENS_CONFIG.enabled && isTestToken(token)) {
          console.log('🧪 Token de test détecté:', token);
          logTestTokenUsage(token, 'GuestVerification - Token validation');
          
          const testValidation = await validateToken(token, propertyId);
          if (testValidation.isValid && testValidation.isTestToken) {
            console.log('✅ Token de test valide, utilisation des données de test');
            setIsValidToken(true);
            setPropertyName('Propriété de Test - ' + propertyId);
            setCheckingToken(false);
            return;
          }
        }

        // ✅ CORRECTION : Utilisation de la validation directe
        console.log('🔍 Validation directe du token...');
        
        const validationResult = await validateTokenDirect(propertyId, token);
        
        if (validationResult.isValid && validationResult.propertyData) {
          console.log('✅ Token validé avec succès');
          setIsValidToken(true);
          setPropertyName(validationResult.propertyData.name || 'Property');
        } else {
          console.error('❌ Token invalide:', validationResult.error);
          setIsValidToken(false);
        }
        
      } catch (error) {
        console.error('Error verifying token:', error);
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
            setNumberOfGuests(matchedReservation.number_of_guests);
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
  }, [airbnbBookingId, isValidToken, propertyId]);

  const addGuest = () => {
    setGuests([...guests, {
      fullName: '',
      dateOfBirth: undefined,
      nationality: '',
      documentNumber: '',
      documentType: 'passport',
      profession: '',
      motifSejour: 'TOURISME',
      adressePersonnelle: '',
      email: ''
    }]);
  };

  // ✅ TEST: Fonction pour tester manuellement la date de naissance
  const testDateOfBirth = () => {
    console.log('🧪 TEST - Ajout manuel de date de naissance');
    const updatedGuests = [...guests];
    if (updatedGuests[0]) {
      updatedGuests[0].dateOfBirth = new Date('1990-07-13');
      updatedGuests[0].fullName = 'Test User';
      updatedGuests[0].nationality = 'FRANÇAIS';
      updatedGuests[0].documentNumber = 'TEST123456';
      setGuests(updatedGuests);
      console.log('🧪 TEST - Date de naissance ajoutée manuellement:', {
        dateOfBirth: updatedGuests[0].dateOfBirth,
        typeOfDateOfBirth: typeof updatedGuests[0].dateOfBirth,
        isDateObject: updatedGuests[0].dateOfBirth instanceof Date
      });
    }
  };

  const updateGuest = (index: number, field: keyof Guest, value: any) => {
    console.log('🔄 updateGuest appelé:', { index, field, value });
    
    // ✅ SIMPLIFIÉ : Utiliser directement l'index dans guests
    // Pas besoin de chercher dans deduplicatedGuests car l'index correspond à guests
    setGuests(prevGuests => {
      const updatedGuests = [...prevGuests];
      if (updatedGuests[index]) {
    updatedGuests[index] = { ...updatedGuests[index], [field]: value };
        console.log('✅ Guest mis à jour:', updatedGuests[index]);
      }
      return updatedGuests;
    });
  };

  const removeGuest = (index: number) => {
    // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour trouver le bon guest
    const targetGuest = deduplicatedGuests[index];
    if (!targetGuest) return;
    
    if (deduplicatedGuests.length > 1) {
      // Trouver l'index dans guests en utilisant documentNumber ou fullName comme identifiant
      const guestId = targetGuest.documentNumber || targetGuest.fullName;
      const actualIndex = guests.findIndex(g => 
        (g.documentNumber && g.documentNumber === guestId) || 
        (g.fullName && g.fullName === guestId && !g.documentNumber)
      );
      
      if (actualIndex !== -1) {
        setGuests(guests.filter((_, i) => i !== actualIndex));
      } else {
        // Fallback : utiliser l'index directement
      setGuests(guests.filter((_, i) => i !== index));
      }
    }
  };

  // ✅ SOLUTION FINALE : handleFileUpload simplifié sans manipulation manuelle des Portals
  const handleFileUpload = useCallback(async (files: FileList) => {
    console.log('🚨 ALERTE - handleFileUpload appelé avec', files.length, 'fichier(s)');
    
    // ✅ PROTECTION : Empêcher les appels multiples simultanés
    if (isProcessingRef.current) {
      console.warn('⚠️ handleFileUpload déjà en cours, appel ignoré');
      return;
    }
    
    if (!files || files.length === 0) return;

    isProcessingRef.current = true;
    
    // ✅ CORRIGÉ : Logger pour debug
    console.log('🔍 DEBUG: handleFileUpload - Début traitement', {
      filesCount: files.length,
      fileNames: Array.from(files).map(f => f.name),
      isProcessingBefore: isProcessingRef.current
    });

    try {
      // ✅ CORRIGÉ : Traiter tous les fichiers de manière séquentielle pour éviter les conflits
      for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // ✅ PROTECTION : Vérifier si ce fichier est déjà en cours de traitement
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      if (processingFilesRef.current.has(fileKey)) {
        console.warn('⚠️ Fichier déjà en cours de traitement:', file.name);
        continue;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('upload.error.notImage.title'),
          description: t('upload.error.notImage.desc', { filename: file.name }),
          variant: "destructive"
        });
        continue;
      }

      // ✅ PROTECTION : Marquer le fichier comme en cours de traitement
      processingFilesRef.current.add(fileKey);
      const url = URL.createObjectURL(file);
      
      try {
        // ✅ SIMPLIFIÉ : Ajouter le document en processing (SANS manipulation de Portals)
        const newDoc: UploadedDocument = {
          file,
          url,
          processing: true,
          extractedData: null
        };

        setUploadedDocuments(prev => [...prev, newDoc]);
        
        // ✅ CORRIGÉ : Extraire les données une seule fois
        const extractedData = await OpenAIDocumentService.extractDocumentData(file);
        console.log('🚨 ALERTE - Données extraites:', {
          hasDateOfBirth: !!extractedData.dateOfBirth,
          dateOfBirth: extractedData.dateOfBirth,
          fullName: extractedData.fullName
        });

        // ✅ SIMPLIFIÉ : Mettre à jour les documents (SANS manipulation de Portals)
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.url === url 
              ? { ...doc, processing: false, extractedData }
              : doc
          )
        );

        // ✅ CORRIGÉ : Vérifier si les données sont valides AVANT de mettre à jour les guests
        if (extractedData && Object.keys(extractedData).length > 0) {
          const hasRequiredIdFields = extractedData.fullName && 
                                    extractedData.documentNumber && 
                                    extractedData.nationality && 
                                    extractedData.documentType;

          if (!hasRequiredIdFields) {
            toast({
              title: t('upload.docInvalid.title'),
              description: t('upload.docInvalid.desc'),
              variant: "destructive",
            });
            
            // ✅ SIMPLIFIÉ : Marquer comme invalide (SANS startTransition)
            setUploadedDocuments(prev => 
              prev.map(doc => 
                doc.url === url 
                  ? { ...doc, processing: false, extractedData: null, isInvalid: true }
                  : doc
              )
            );
            // ✅ CORRIGÉ : Utiliser un flag pour sortir du try et continuer la boucle
            throw new Error('INVALID_DOCUMENT'); // Utiliser throw pour sortir du try
          }

          // ✅ RÉACTIVÉ : La mise à jour automatique fonctionne maintenant avec des select natifs (pas de Portals)
          setGuests(prevGuests => {
            const updatedGuests = [...prevGuests];
            
            // ✅ PROTECTION RENFORCÉE : Chercher d'abord un invité existant avec le même nom ou document
            // Cela évite de créer des doublons
            let targetIndex = -1;
            
            if (extractedData.fullName || extractedData.documentNumber) {
              targetIndex = updatedGuests.findIndex(guest => {
                const sameFullName = extractedData.fullName && guest.fullName && 
                                    extractedData.fullName.trim().toLowerCase() === guest.fullName.trim().toLowerCase();
                const sameDocNumber = extractedData.documentNumber && guest.documentNumber && 
                                     extractedData.documentNumber.trim() === guest.documentNumber.trim();
                
                return sameFullName || sameDocNumber;
              });
              
              // ✅ Si trouvé, vérifier que les données ne sont pas déjà complètes (éviter les mises à jour inutiles)
              if (targetIndex !== -1) {
                const existingGuest = updatedGuests[targetIndex];
                const isAlreadyComplete = 
                  existingGuest.fullName?.trim().toLowerCase() === extractedData.fullName?.trim().toLowerCase() &&
                  existingGuest.documentNumber?.trim() === extractedData.documentNumber?.trim() &&
                  existingGuest.nationality === extractedData.nationality;
                
                if (isAlreadyComplete) {
                  console.log('⚠️ Données déjà présentes et complètes, mise à jour ignorée pour éviter doublon');
                  return prevGuests; // Ne pas mettre à jour si les données sont déjà complètes
                }
                
                console.log(`✅ Guest existant trouvé à l'index ${targetIndex}, mise à jour en cours`);
              }
            }
            
            // 2. Si pas trouvé, chercher un invité vide
            if (targetIndex === -1) {
              targetIndex = updatedGuests.findIndex(guest => 
                !guest.fullName && !guest.documentNumber
              );
            }
            
            // 3. Si toujours pas trouvé, utiliser le premier invité disponible
            if (targetIndex === -1 && updatedGuests.length > 0) {
              targetIndex = 0; // Utiliser le premier invité
            }
            
            // 4. Si aucun invité, créer un nouveau
            if (targetIndex === -1) {
              const newGuest: Guest = {
                fullName: extractedData.fullName || '',
                dateOfBirth: extractedData.dateOfBirth ? new Date(extractedData.dateOfBirth) : undefined,
                nationality: extractedData.nationality || '',
                documentNumber: extractedData.documentNumber || '',
                documentType: (extractedData.documentType as 'passport' | 'national_id') || 'passport',
                profession: '',
                motifSejour: 'TOURISME',
                adressePersonnelle: '',
                email: ''
              };
              return [...updatedGuests, newGuest];
            }
            
            // ✅ CORRIGÉ : Mise à jour directe de l'invité trouvé
            const targetGuest = updatedGuests[targetIndex];
            
            // ✅ PROTECTION : Ne mettre à jour que si les champs sont vides ou différents
            if (extractedData.fullName && (!targetGuest.fullName || targetGuest.fullName !== extractedData.fullName)) {
              targetGuest.fullName = extractedData.fullName;
            }
            if (extractedData.nationality && (!targetGuest.nationality || targetGuest.nationality !== extractedData.nationality)) {
              targetGuest.nationality = extractedData.nationality;
            }
            if (extractedData.documentNumber && (!targetGuest.documentNumber || targetGuest.documentNumber !== extractedData.documentNumber)) {
              targetGuest.documentNumber = extractedData.documentNumber;
            }
            if (extractedData.documentType && (!targetGuest.documentType || targetGuest.documentType !== extractedData.documentType)) {
              targetGuest.documentType = extractedData.documentType as 'passport' | 'national_id';
            }
            
            // ✅ AMÉLIORÉ : Parsing robuste de la date de naissance - toujours mettre à jour si extraite
            if (extractedData.dateOfBirth) {
              let parsedDate: Date | null = null;
              
              // Tentative 1: Direct parsing
              parsedDate = new Date(extractedData.dateOfBirth);
              if (isNaN(parsedDate.getTime())) {
                // Tentative 2: Format ISO (YYYY-MM-DD)
                const isoMatch = extractedData.dateOfBirth.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (isoMatch) {
                  parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                } else {
                  // Tentative 3: Format DD/MM/YYYY ou DD-MM-YYYY
                  const ddmmyyyyMatch = extractedData.dateOfBirth.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
                  if (ddmmyyyyMatch) {
                    parsedDate = new Date(parseInt(ddmmyyyyMatch[3]), parseInt(ddmmyyyyMatch[2]) - 1, parseInt(ddmmyyyyMatch[1]));
                  }
                }
              }
              
              if (parsedDate && !isNaN(parsedDate.getTime())) {
                // Vérifier que la date est raisonnable (pas dans le futur, pas trop ancienne)
                const now = new Date();
                const minDate = new Date(1900, 0, 1);
                if (parsedDate <= now && parsedDate >= minDate) {
                  targetGuest.dateOfBirth = parsedDate;
                  console.log('✅ Date de naissance extraite et mise à jour:', format(parsedDate, 'dd/MM/yyyy'));
                } else {
                  console.warn('⚠️ Date de naissance invalide (hors limites):', parsedDate);
                }
              } else {
                console.warn('⚠️ Impossible de parser la date de naissance:', extractedData.dateOfBirth);
              }
            }
            
            return updatedGuests;
          });

          toast({
            title: "Document traité",
            description: "Document d'identité valide. Informations extraites automatiquement.",
          });
        } else {
          toast({
            title: t('upload.docNotRecognized.title'),
            description: t('upload.docNotRecognized.desc'),
            variant: "destructive"
          });
        }
      } catch (error) {
        // ✅ CORRIGÉ : Ignorer les erreurs de document invalide (déjà gérées)
        if (error instanceof Error && error.message === 'INVALID_DOCUMENT') {
          // Document invalide déjà géré, juste continuer
          console.log('⚠️ Document invalide ignoré');
        } else {
          console.error('Document processing failed:', error);
          // ✅ SIMPLIFIÉ : Marquer comme échec (SANS startTransition)
          setUploadedDocuments(prev => 
            prev.map(doc => 
              doc.url === url 
                ? { ...doc, processing: false }
                : doc
            )
          );
          
          toast({
            title: t('upload.warning.title'),
            description: t('upload.warning.desc'),
            variant: "destructive"
          });
        }
      } finally {
        // ✅ PROTECTION : Retirer le fichier de la liste des fichiers en cours
        processingFilesRef.current.delete(fileKey);
      }
      } // Fin de la boucle for
    } finally {
      // ✅ PROTECTION : Réinitialiser le flag de traitement
      isProcessingRef.current = false;
    }
  }, [toast, t]); // ✅ Dépendances simplifiées (plus de manipulation de Portals)

  const removeDocument = (url: string) => {
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
          fullName: '',
          dateOfBirth: undefined,
          nationality: '',
          documentNumber: '',
          documentType: 'passport',
          profession: '',
          motifSejour: 'TOURISME',
          adressePersonnelle: '',
          email: ''
        };
        setGuests(updatedGuests);
        
        toast({
          title: t('removeDoc.deleted.title'),
          description: t('removeDoc.deleted.desc'),
        });
      }
    }
    
    setUploadedDocuments(prev => prev.filter(doc => doc.url !== url));
    URL.revokeObjectURL(url);
  };

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
    
    // ✅ VALIDATION : Vérifier que le nombre de documents correspond au nombre de guests dédupliqués
    if (uploadedDocuments.length !== actualGuestCount) {
      console.log('❌ Document validation failed:', {
        uploadedCount: uploadedDocuments.length,
        expectedCount: actualGuestCount,
        numberOfGuests,
        guestsRaw: guests.length
      });
      // ✅ CRITIQUE : Réinitialiser les flags si validation échoue
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      toast({
        title: t('validation.error.title'),
        description: t('validation.exactDocs.desc', { count: actualGuestCount, s: actualGuestCount > 1 ? 's' : '' }),
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Document validation passed');

    // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour la validation (évite les doubles formulaires)
    // ✅ VALIDATION STRICTE : Vérifier que TOUS les champs requis sont remplis, y compris le motif de séjour
    // ✅ NOUVEAU : Validation adaptée pour citoyens marocains (CIN acceptée avec date d'entrée optionnelle)
    const incompleteGuests = deduplicatedGuests.filter((guest, index) => {
      // Lire le motif de séjour depuis le select pour cet invité
      const motifSelect = document.querySelector(`select[name="motifSejour-${index}"]`) as HTMLSelectElement;
      const motifSejour = motifSelect?.value || guest.motifSejour || '';
      
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
        guests: deduplicatedGuests.map((guest, index) => {
          // Lire le motif de séjour depuis le select pour cet invité
          const motifSelect = document.querySelector(`select[name="motifSejour-${index}"]`) as HTMLSelectElement;
          const motifSejour = motifSelect?.value || guest.motifSejour || 'TOURISME';
          
          return {
            ...guest,
            dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : null,
            motifSejour: motifSejour // ✅ VALIDATION STRICTE : Inclure le motif validé
          };
        })
      };

      const bookingData = {
        checkInDate: formatLocalDate(checkInDate),
        checkOutDate: formatLocalDate(checkOutDate),
        numberOfGuests: deduplicatedGuests.length // ✅ CORRIGÉ : Utiliser le nombre réel de guests dédupliqués
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
      const guestsWithoutMotif = deduplicatedGuests.filter((guest, index) => {
        const motifSelect = document.querySelector(`select[name="motifSejour-${index}"]`) as HTMLSelectElement;
        const motifSejour = motifSelect?.value || guest.motifSejour || '';
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

      // ✅ CRITIQUE : Lire les valeurs directement depuis les inputs pour les champs non-contrôlés
      const emailInput = document.querySelector('input[name="email-0"]') as HTMLInputElement;
      const professionInput = document.querySelector('input[name="profession-0"]') as HTMLInputElement;
      const adresseInput = document.querySelector('input[name="adresse-0"]') as HTMLInputElement;
      const motifSelect = document.querySelector('select[name="motifSejour-0"]') as HTMLSelectElement;

      // ✅ VALIDATION STRICTE : Vérifier que le motif de séjour du premier invité est valide
      const firstGuestMotif = motifSelect?.value || firstGuest?.motifSejour || '';
      if (!firstGuestMotif || firstGuestMotif.trim() === '') {
        console.error('❌ Motif de séjour manquant pour le premier invité');
        toast({
          title: "Motif de séjour requis",
          description: "Veuillez sélectionner un motif de séjour pour le premier invité.",
          variant: "destructive",
        });
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        return;
      }

      const guestInfo = {
        firstName: firstGuest?.fullName?.split(' ')[0] || '',
        lastName: firstGuest?.fullName?.split(' ').slice(1).join(' ') || '',
        email: emailInput?.value || firstGuest?.email || '',
        // phone: firstGuest?.phone || '', // ✅ CORRIGÉ : Retiré car non présent dans le type Guest
        nationality: firstGuest?.nationality || '',
        idType: firstGuest?.documentType || 'passport',
        idNumber: firstGuest?.documentNumber || '',
        dateOfBirth: firstGuest?.dateOfBirth ? format(firstGuest.dateOfBirth, 'yyyy-MM-dd') : undefined,
        profession: professionInput?.value || firstGuest?.profession || '',
        motifSejour: firstGuestMotif, // ✅ VALIDATION STRICTE : Utiliser la valeur validée
        adressePersonnelle: adresseInput?.value || firstGuest?.adressePersonnelle || ''
      };

      // ✅ DEBUG: Log des données finales
      console.log('🔍 DEBUG - guestInfo final:', guestInfo);

      // ✅ VALIDATION CRITIQUE : Vérifier que l'email est renseigné AVANT d'envoyer
      if (!guestInfo.email || !guestInfo.email.trim()) {
        console.error('❌ Email manquant');
        toast({
          title: "Email requis",
          description: "Veuillez renseigner votre adresse email avant de continuer.",
          variant: "destructive",
        });
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        return;
      }

      // ✅ VALIDATION : Vérifier le format de l'email
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(guestInfo.email)) {
        console.error('❌ Format email invalide:', guestInfo.email);
        toast({
          title: "Email invalide",
          description: "Veuillez saisir une adresse email valide (ex: nom@exemple.com).",
          variant: "destructive",
        });
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        return;
      }

      // ✅ CORRECTION : Convertir les fichiers en base64 au lieu d'envoyer des blob URLs
      // ✅ CRITIQUE : Wrapper dans try-catch pour éviter que les erreurs Portal bloquent le flux
      console.log('📄 Converting documents to base64...');
      let idDocuments;
      try {
        idDocuments = await Promise.all(
          uploadedDocuments.map(async (doc, index) => {
            // ✅ CRITIQUE : Wrapper chaque conversion dans un try-catch individuel
            try {
              // Convertir le fichier en base64
              const fileData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    resolve(reader.result as string);
                  } catch (error) {
                    // Ignorer les erreurs Portal pendant la conversion
                    if (error instanceof Error && error.message.includes('insertBefore')) {
                      console.warn('⚠️ [GuestVerification] Erreur Portal ignorée pendant conversion base64');
                      resolve(reader.result as string); // Continuer quand même
                    } else {
                      reject(error);
                    }
                  }
                };
                reader.onerror = (error) => {
                  // Ignorer les erreurs Portal
                  if (error && typeof error === 'object' && 'message' in error && 
                      String(error.message).includes('insertBefore')) {
                    console.warn('⚠️ [GuestVerification] Erreur Portal ignorée dans FileReader');
                    resolve(''); // Retourner une chaîne vide si erreur Portal
                  } else {
                    reject(error);
                  }
                };
                reader.readAsDataURL(doc.file);
              });
              
              return {
                name: doc.file.name || `document_${index + 1}`,
                url: fileData, // data:image/...;base64,...
                type: doc.file.type || 'application/octet-stream',
                size: doc.file.size
              };
            } catch (error) {
              // ✅ CRITIQUE : Si erreur Portal, continuer avec une chaîne vide
              if (error instanceof Error && (
                error.message.includes('insertBefore') || 
                error.message.includes('NotFoundError') ||
                error.name === 'NotFoundError'
              )) {
                console.warn('⚠️ [GuestVerification] Erreur Portal ignorée, utilisation de fallback pour document', index);
                return {
                  name: doc.file.name || `document_${index + 1}`,
                  url: '', // Fallback vide si erreur Portal
                  type: doc.file.type || 'application/octet-stream',
                  size: doc.file.size
                };
              }
              throw error; // Re-lancer les autres erreurs
            }
          })
        );
      } catch (error) {
        // ✅ CRITIQUE : Si erreur globale Portal, utiliser les fichiers directement
        if (error instanceof Error && (
          error.message.includes('insertBefore') || 
          error.message.includes('NotFoundError') ||
          error.name === 'NotFoundError'
        )) {
          console.warn('⚠️ [GuestVerification] Erreur Portal globale ignorée, utilisation de fallback');
          // Fallback : utiliser les URLs blob directement
          idDocuments = uploadedDocuments.map((doc, index) => ({
            name: doc.file.name || `document_${index + 1}`,
            url: doc.url, // Utiliser l'URL blob comme fallback
            type: doc.file.type || 'application/octet-stream',
            size: doc.file.size
          }));
        } else {
          throw error; // Re-lancer les autres erreurs
        }
      }
      
      console.log('✅ Documents converted to base64:', {
        count: idDocuments.length,
        sizes: idDocuments.map(d => d.size),
        hasErrors: idDocuments.some(d => !d.url || d.url === '')
      });

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

      // ✅ CORRECTION : Sauvegarder les données enrichies du workflow unifié
      // ⚠️ IMPORTANT : Sauvegarder dans localStorage AVANT la navigation (fallback pour Vercel)
      try {
        localStorage.setItem('currentBookingId', bookingId);
        localStorage.setItem('currentBookingData', JSON.stringify(bookingData));
        localStorage.setItem('currentGuestData', JSON.stringify(guestInfo));
        localStorage.setItem('contractUrl', result.contractUrl);
        if (result.policeUrl) {
          localStorage.setItem('policeUrl', result.policeUrl);
        }
        console.log('✅ Données sauvegardées dans localStorage pour fallback Vercel');
      } catch (storageError) {
        console.warn('⚠️ Erreur lors de la sauvegarde dans localStorage:', storageError);
        // Ne pas bloquer la navigation si localStorage échoue
      }

      toast({
        title: "Documents générés avec succès !",
        description: "Contrat et fiche de police créés. Vous pouvez maintenant les consulter et signer.",
      });

      // ✅ CORRIGÉ : Préparer la navigation avec cleanup pour éviter les erreurs DOM
      const baseUrl = `/contract-signing/${propertyId}/${token}`;
      const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
      
      const navigationState = { 
        bookingId, 
        bookingData, 
        guestData: guestInfo, // ✅ Utiliser les données unifiées
        contractUrl: result.contractUrl,
        policeUrl: result.policeUrl,
        propertyId,
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
        
        // ✅ CORRIGÉ : Petit délai pour s'assurer que localStorage est bien écrit (important pour Vercel)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // ✅ CRITIQUE : Délai supplémentaire pour laisser les Portals Radix UI se nettoyer
        // Les Popover et Calendar utilisent des Portals qui peuvent causer des erreurs insertBefore
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
      
      // ✅ NOUVEAU : Afficher l'erreur sur la page au lieu de rediriger
      setSubmissionError(`Erreur lors de l'envoi des informations: ${errorMessage}`);
      
      toast({
        title: "Erreur",
        description: `Erreur lors de l'envoi des informations. Veuillez réessayer ou contacter votre hôte.`,
        variant: "destructive"
      });
      
      // Réinitialiser le flag de navigation en cas d'erreur
      navigationInProgressRef.current = false;
    } finally {
      // ✅ CORRIGÉ : Réinitialiser tous les flags de soumission
      isSubmittingRef.current = false;
      isProcessingRef.current = false;
      
      // ✅ CORRIGÉ : setIsLoading(false) seulement si la navigation n'a pas réussi
      // (si navigation réussie, on ne sera plus dans ce composant)
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

    setCurrentStep('documents');
  };

  const handlePrevStep = () => {
    setCurrentStep('booking');
  };

  // ✅ NOUVEAU : Afficher l'erreur de soumission au lieu de rediriger
  if (submissionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className="p-8 max-w-md border-red-200 shadow-2xl">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              >
                <X className="w-20 h-20 text-red-500 mx-auto" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-red-800">Interruption de la procédure</h2>
                <p className="text-red-600 mt-2">
                  {submissionError}
                </p>
                <p className="text-gray-600 mt-4 text-sm">
                  Veuillez réessayer ou contacter votre hôte pour obtenir de l'aide.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button 
                  onClick={() => {
                    setSubmissionError(null);
                    setCurrentStep('booking');
                  }}
                  className="w-full bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Réessayer
                </Button>
                <Button 
                  onClick={() => {
                    window.location.reload();
                  }}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Recharger la page
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

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
                  className="w-full bg-green-600 hover:bg-green-700"
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
    <div className="min-h-screen flex" style={{ backgroundColor: '#89D7D2' }}>
      {/* Left Sidebar - Fixed 436px width matching Figma */}
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
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-4">
          <img 
            src="/lovable-uploads/Checky simple - fond transparent.png" 
            alt="CHECKY Logo" 
            className="h-10 w-10 object-contain"
            onError={(e) => {
              // Fallback if image doesn't exist
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
          lineHeight: '36px',
          letterSpacing: '-0.5px',
          color: '#0BD9D0',
          textAlign: 'center'
        }}>Le check-in digitalisé</p>
        
        {currentStep === 'booking' && (
          <>
            <div className="mt-8">
              <p style={{ 
                fontFamily: 'Inter, sans-serif',
                fontWeight: 800,
                fontSize: '24px',
                lineHeight: '36px',
                letterSpacing: '-0.5px',
                color: '#FFFFFF'
              }}>
                Votre réservation{propertyName ? ` à ${propertyName}` : ''} approche à grand pas. 
                Réalisez votre check-in en quelques minutes.
              </p>
            </div>
            
            <div className="mt-auto">
              <p style={{ 
                fontFamily: 'Inter, sans-serif',
                fontWeight: 800,
                fontSize: '24px',
                lineHeight: '36px',
                letterSpacing: '-0.5px',
                color: '#FFFFFF'
              }}>
                Notre engagement : vos documents sont conservés conforméments aux exigences légales, 
                transmis de manière sécurisée et accessibles uniquement par les parties concernées.
              </p>
            </div>
          </>
        )}
        
        {currentStep === 'documents' && (
          <>
            {/* Upload icon header */}
            <div className="flex items-center gap-3 mt-8 mb-4">
              <Upload className="w-7 h-7" style={{ color: '#F3F3F3' }} />
              <h2 style={{
                fontFamily: 'Fira Sans Condensed, sans-serif',
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: '36px',
                color: '#FFFFFF'
              }}>Documents d'identité</h2>
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
                  }}>Glissez-déposez vos documents</p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '15px',
                    color: 'rgba(176, 178, 188, 0.5)'
                  }}>Carte d'identité ou passeport en format PDF, PNG, JPG (5MB max par fichier)</p>
                </div>
              </div>

              {/* Import button - aligned to right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '48px' }}>
                <button
                  style={{
                    background: '#7DCAB5',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '19px',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer'
                  }}
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
                  <h3 className="text-sm font-medium mb-3 text-white">Documents téléchargés ({uploadedDocuments.length})</h3>
                  <div className="space-y-2">
                    {uploadedDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg relative group" style={{ backgroundColor: '#1E1E1E' }}>
                        {/* ✅ NOUVEAU : Bouton de suppression */}
                        <button
                          onClick={() => {
                            // Supprimer le document de la liste
                            setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
                            // Supprimer le guest correspondant
                            setGuests(prev => prev.filter((_, i) => i !== index));
                            // Décrémenter le nombre de guests
                            setNumberOfGuests(prev => Math.max(1, prev - 1));
                            toast({
                              title: "Document supprimé",
                              description: "Le document a été retiré de la liste",
                            });
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer ce document"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        
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
                          <p className="text-gray-400 text-xs">
                            Nom: {deduplicatedGuests[index]?.fullName || (doc.extractedData?.fullName || 'Non assigné')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            
            <div className="mt-auto">
              <p className="text-gray-300 text-sm">
                Notre engagement : vos documents sont conservés conformément aux exigences légales, 
                transmis de manière sécurisée et accessibles uniquement par les parties concernées.
              </p>
            </div>
          </>
        )}
        
        {currentStep === 'signature' && (
          <>
            
            
            <div className="mt-auto">
              <p className="text-gray-300 text-sm">
                Notre engagement : vos documents sont conservés conformément aux exigences légales, 
                transmis de manière sécurisée et accessibles uniquement par les parties concernées.
              </p>
            </div>
          </>
        )}
      </div>
      
      {/* Right Main Content */}
      <div 
        className="flex-1 flex flex-col" 
        style={{ 
          backgroundColor: '#FDFDF9',
          marginLeft: '436px',
          borderRadius: '12px',
          minHeight: '100vh'
        }}
      >
        {/* Header with Language Switcher */}
        <div className="p-6 flex justify-end">
          <LanguageSwitcher />
        </div>
        
        {/* Progress Steps - Matching Figma design */}
        <div className="px-6 pb-8 flex items-center justify-center gap-4">
          {/* Step 1: Réservation */}
          <div className="flex flex-col items-center">
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: currentStep === 'booking' ? 'rgba(85, 186, 159, 0.42)' : 'rgba(71, 155, 162, 0.4)',
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
              marginTop: '8px'
            }}>Réservation</span>
          </div>
          
          {/* Connector Line */}
          <div style={{
            width: '80px',
            height: '3px',
            background: '#040404',
            marginTop: '-20px'
          }} />
          
          {/* Step 2: Documents d'identité */}
          <div className="flex flex-col items-center">
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: currentStep === 'documents' ? '#8EE7E4' : 'rgba(71, 155, 162, 0.4)',
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
              lineHeight: '14px',
              color: currentStep === 'documents' ? '#000000' : '#6B7280',
              marginTop: '8px',
              textAlign: 'center'
            }}>Documents<br/>d'identité</span>
          </div>
          
          {/* Connector Line */}
          <div style={{
            width: '80px',
            height: '3px',
            background: currentStep === 'signature' ? '#040404' : '#D1D5DB',
            marginTop: '-20px'
          }} />
          
          {/* Step 3: Signature */}
          <div className="flex flex-col items-center">
            <div 
              style={{
                width: '54px',
                height: '51px',
                borderRadius: '16px',
                background: currentStep === 'signature' ? '#8EE7E4' : 'rgba(71, 155, 162, 0.4)',
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
              lineHeight: '28px',
              letterSpacing: '-0.5px',
              color: currentStep === 'signature' ? '#000000' : '#6B7280',
              marginTop: '8px'
            }}>Signature</span>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 px-6 pb-6 overflow-y-auto">
              {/* ✅ CORRIGÉ : Retirer ErrorBoundary car il causait des doubles rendus visuels */}
              {/* L'intercepteur global d'erreurs window.onerror gère déjà les erreurs Portal */}
                {/* ✅ CORRIGÉ : Retirer AnimatePresence pour éviter les conflits avec les Portals Radix UI */}
                {/* Utiliser simplement des div conditionnelles avec des clés stables */}
                {currentStep === 'booking' && (
                  <div className="max-w-4xl mx-auto space-y-8 relative">
                    <motion.h2 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-3xl font-bold text-gray-900 mb-8"
                    >
                      Votre check-in commence ici
                    </motion.h2>
                    
                    {/* Central Search Bar - 4 zones cliquables */}
                    <div className="relative">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#FDFDF9] rounded-2xl border border-gray-200 p-5 flex items-end gap-4 shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        {/* Zone 1: Hébergement */}
                        <div className="flex-1 cursor-default">
                          <Label className="text-xs text-gray-500 mb-1.5 block font-normal uppercase tracking-wide">Hébergement</Label>
                          <div className="text-lg font-semibold text-gray-900">{propertyName || 'studio casa'}</div>
                        </div>
                        
                        {/* Zone 2: Quand ? - Cliquable */}
                        <div 
                          className="flex-1 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => {
                            setShowCalendarPanel(!showCalendarPanel);
                            setShowGuestsPanel(false);
                          }}
                        >
                          <Label className="text-xs text-gray-500 mb-1.5 block font-normal uppercase tracking-wide">Quand ?</Label>
                          <div className="text-lg font-semibold text-gray-900">
                            {checkInDate && checkOutDate 
                              ? `${format(checkInDate, 'dd/MM/yyyy')} - ${format(checkOutDate, 'dd/MM/yyyy')}`
                              : 'Dates'
                            }
                          </div>
                        </div>
                        
                        {/* Zone 3: Qui ? - Cliquable */}
                        <div 
                          className="flex-1 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => {
                            setShowGuestsPanel(!showGuestsPanel);
                            setShowCalendarPanel(false);
                          }}
                        >
                          <Label className="text-xs text-gray-500 mb-1.5 block font-normal uppercase tracking-wide">Qui ?</Label>
                          <div className="text-lg font-semibold text-gray-900">
                            {numberOfAdults + numberOfChildren > 0 
                              ? `${numberOfAdults + numberOfChildren} voyageur${numberOfAdults + numberOfChildren > 1 ? 's' : ''}`
                              : 'Nombre de voyageurs'
                            }
                          </div>
                        </div>
                        
                        {/* Zone 4: Bouton flèche verte */}
                        <Button
                          className="w-14 h-14 rounded-full text-white flex-shrink-0 shadow-lg hover:shadow-xl transition-all"
                          style={{ backgroundColor: '#7DCAB5' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6BB9A5'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7DCAB5'}
                          onClick={handleNextStep}
                        >
                          <ArrowRight className="w-6 h-6" />
                        </Button>
                      </motion.div>
                      
                      {/* Panneau flottant - Calendrier */}
                      {showCalendarPanel && (
                        <motion.div 
                          ref={calendarPanelRef}
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute top-full left-0 mt-3 w-full bg-white rounded-xl shadow-2xl z-50 p-6"
                        >
                          <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Sélectionnez vos dates</h3>
                            <p className="text-sm text-gray-600">Choisissez vos dates d'arrivée et de départ</p>
                          </div>
                          
                          <EnhancedCalendar
                            mode="range"
                            rangeStart={checkInDate}
                            rangeEnd={checkOutDate}
                            onRangeSelect={(checkIn, checkOut) => {
                              // ✅ CORRIGÉ : Normaliser les dates à minuit local pour éviter les problèmes de comparaison
                              const normalizedCheckIn = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                              const normalizedCheckOut = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                              setCheckInDate(normalizedCheckIn);
                              setCheckOutDate(normalizedCheckOut);
                              setShowCalendarPanel(false);
                            }}
                            className="w-full"
                          />
                        </motion.div>
                      )}
                      
                      {/* Panneau flottant - Voyageurs */}
                      {showGuestsPanel && (
                        <motion.div 
                          ref={guestsPanelRef}
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute top-full left-0 mt-3 w-full bg-[#FDFDF9] rounded-xl border border-gray-200 shadow-2xl z-50 p-6"
                        >
                          <h3 className="text-xl font-bold text-gray-900 mb-6">Nombre de voyageurs</h3>
                          
                          {/* Adultes */}
                          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
                            <div>
                              <Label className="text-base font-semibold text-gray-900 block mb-1">Adultes</Label>
                              <p className="text-sm text-gray-500">13 ans et plus</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-full"
                                onClick={() => setNumberOfAdults(Math.max(1, numberOfAdults - 1))}
                                disabled={numberOfAdults <= 1}
                              >
                                -
                              </Button>
                              <span className="w-12 text-center text-xl font-semibold">{numberOfAdults}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-full"
                                onClick={() => setNumberOfAdults(numberOfAdults + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          
                          {/* Enfants */}
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-base font-semibold text-gray-900 block mb-1">Enfants</Label>
                              <p className="text-sm text-gray-500">De 2 à 12 ans</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-full"
                                onClick={() => setNumberOfChildren(Math.max(0, numberOfChildren - 1))}
                                disabled={numberOfChildren <= 0}
                              >
                                -
                              </Button>
                              <span className="w-12 text-center text-xl font-semibold">{numberOfChildren}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-full"
                                onClick={() => setNumberOfChildren(numberOfChildren + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          
                          <Button
                            className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              const total = numberOfAdults + numberOfChildren;
                              setNumberOfGuests(total);
                              setGuests(prevGuests => {
                                const currentGuests = [...prevGuests];
                                if (total > currentGuests.length) {
                                  const toAdd = total - currentGuests.length;
                                  for (let i = 0; i < toAdd; i++) {
                                    currentGuests.push({
                                      fullName: '',
                                      dateOfBirth: undefined,
                                      nationality: '',
                                      documentNumber: '',
                                      documentType: 'passport',
                                      profession: '',
                                      motifSejour: 'TOURISME',
                                      adressePersonnelle: '',
                                      email: ''
                                    });
                                  }
                                } else if (total < currentGuests.length) {
                                  currentGuests.splice(total);
                                }
                                return currentGuests;
                              });
                              setShowGuestsPanel(false);
                            }}
                          >
                            Confirmer
                          </Button>
                        </motion.div>
                      )}
                    </div>
                    
                    {/* Bouton Suivant - Bas à droite */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex justify-end pt-6"
                    >
                      <Button
                        className="text-white px-8 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                        style={{ backgroundColor: '#7DCAB5' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6BB9A5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7DCAB5'}
                        onClick={handleNextStep}
                      >
                        Suivant
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
                    {/* Header Section */}
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-7 h-7" style={{ color: '#000000' }} />
                      <h2 style={{
                        fontFamily: 'Fira Sans Condensed, sans-serif',
                        fontWeight: 400,
                        fontSize: '30px',
                        lineHeight: '36px',
                        color: '#040404'
                      }}>Informations des voyageurs</h2>
                    </div>
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '12px',
                      lineHeight: '15px',
                      color: '#4B5563',
                      marginBottom: '24px'
                    }}>
                      Certains champs seront pré-remplis automatiquement lorsque vous aurez importé vos documents.
                    </p>
                    
                    <div className="space-y-6">

                        <div className="space-y-6">
                          {deduplicatedGuests.map((guest, index) => (
                            <div
                              key={`guest-form-${index}`}
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
                                  }}>Voyageur {index + 1}</span>
                                  {deduplicatedGuests.length > 1 && (
                                    <button 
                                      onClick={() => removeGuest(index)} 
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
                                
                                {/* Form Grid - 2 columns matching Figma */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      id={`fullName-${index}`}
                                      value={guest.fullName}
                                      onChange={(e) => updateGuest(index, 'fullName', e.target.value)}
                                      placeholder=" "
                                      required
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`fullName-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      {t('guest.clients.fullName')} <span className="text-red-500">*</span>
                                    </label>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.dateOfBirth')} <span className="text-red-500">*</span>
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          className={`w-full justify-start text-left h-12 border-2 transition-all duration-200 ${
                                            guest.dateOfBirth 
                                              ? 'border-brand-teal/50 bg-brand-teal/5 hover:bg-brand-teal/10 hover:border-brand-teal shadow-sm' 
                                              : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
                                          } focus-visible:ring-2 focus-visible:ring-brand-teal/20 focus-visible:ring-offset-2`}
                                        >
                                          <CalendarIcon className={`mr-3 h-5 w-5 ${guest.dateOfBirth ? 'text-brand-teal' : 'text-gray-400'}`} />
                                          <span className={guest.dateOfBirth ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                                            {guest.dateOfBirth 
                                              ? format(guest.dateOfBirth, 'dd/MM/yyyy') 
                                              : 'Sélectionner une date'}
                                          </span>
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 border-2 border-brand-teal/20 shadow-xl bg-[#FDFDF9]">
                                        <Calendar
                                          mode="single"
                                          selected={guest.dateOfBirth}
                                          onSelect={(date) => updateGuest(index, 'dateOfBirth', date)}
                                          initialFocus
                                          className="rounded-md"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  
                                  <div className="relative">
                                    <input
                                      type="text"
                                      id={`nationality-${index}`}
                                      value={guest.nationality}
                                      onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                                      placeholder=" "
                                      required
                                      list={`nationalities-list-${index}`}
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`nationality-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      {t('guest.clients.nationality')} <span className="text-red-500">*</span>
                                    </label>
                                    <datalist id={`nationalities-list-${index}`}>
                                      {NATIONALITIES.filter(n => n !== '---').map((nationality) => (
                                        <option key={nationality} value={nationality} />
                                      ))}
                                    </datalist>
                                  </div>
                                  
                                  <div className="relative">
                                    <select
                                      id={`documentType-${index}`}
                                      value={guest.documentType} 
                                      onChange={(e) => updateGuest(index, 'documentType', e.target.value)}
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white appearance-none"
                                    >
                                      <option value="passport">{t('guest.clients.passport')}</option>
                                      <option value="national_id">{t('guest.clients.nationalId')}</option>
                                    </select>
                                    <label
                                      htmlFor={`documentType-${index}`}
                                      className="absolute left-4 top-2 text-gray-500 text-xs pointer-events-none"
                                    >
                                      {t('guest.clients.documentType')} <span className="text-red-500">*</span>
                                    </label>
                                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                  
                                  <div className="relative">
                                    <input
                                      type="text"
                                      id={`documentNumber-${index}`}
                                      value={guest.documentNumber}
                                      onChange={(e) => updateGuest(index, 'documentNumber', e.target.value)}
                                      placeholder=" "
                                      required
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`documentNumber-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      {t('guest.clients.documentNumber')} <span className="text-red-500">*</span>
                                    </label>
                                  </div>
                                  
                                  <div className="relative">
                                    <input
                                      type="text"
                                      id={`profession-${index}`}
                                      name={`profession-${index}`}
                                      defaultValue={guest.profession || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'profession', target.value);
                                      }}
                                      placeholder=" "
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`profession-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      Profession
                                    </label>
                                  </div>
                                  
                                  <div className="relative">
                                    <select
                                      id={`motifSejour-${index}`}
                                      name={`motifSejour-${index}`}
                                      defaultValue={guest.motifSejour || ''} 
                                      onChange={(e) => {
                                        updateGuest(index, 'motifSejour', e.target.value);
                                      }}
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white appearance-none"
                                      required
                                    >
                                      <option value="">Sélectionnez un motif</option>
                                      <option value="TOURISME">Tourisme</option>
                                      <option value="AFFAIRES">Affaires</option>
                                      <option value="FAMILLE">Famille</option>
                                      <option value="ÉTUDES">Études</option>
                                      <option value="MÉDICAL">Médical</option>
                                      <option value="AUTRE">Autre</option>
                                    </select>
                                    <label
                                      htmlFor={`motifSejour-${index}`}
                                      className="absolute left-4 top-2 text-gray-500 text-xs pointer-events-none"
                                    >
                                      Motif du séjour <span className="text-red-500">*</span>
                                    </label>
                                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                  
                                  <div className="relative">
                                    <input
                                      type="text"
                                      id={`adresse-${index}`}
                                      name={`adresse-${index}`}
                                      defaultValue={guest.adressePersonnelle || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'adressePersonnelle', target.value);
                                      }}
                                      placeholder=" "
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`adresse-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      Adresse personnelle
                                    </label>
                                  </div>
                                  
                                  <div className="relative">
                                    <input
                                      type="email"
                                      id={`email-${index}`}
                                      name={`email-${index}`}
                                      defaultValue={guest.email || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'email', target.value);
                                      }}
                                      placeholder=" "
                                      required
                                      className="peer w-full px-4 pt-6 pb-2 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white"
                                    />
                                    <label
                                      htmlFor={`email-${index}`}
                                      className="absolute left-4 top-4 text-gray-500 text-base transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs pointer-events-none"
                                    >
                                      Courriel <span className="text-red-500">*</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>
                    
                    {/* Footer navigation - matching Figma */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      paddingTop: '32px', 
                      marginTop: '32px' 
                    }}>
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
                          width: '104px',
                          height: '44px',
                          background: 'rgba(85, 186, 159, 0.76)',
                          boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          borderRadius: '6px',
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
                          gap: '10px'
                        }}
                      >
                        Suivant
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
                    <h2 className="text-3xl font-bold mb-6">Signature du contrat</h2>
                    <p className="text-gray-600 mb-6">Veuillez lire et signer le contrat ci-dessous.</p>
                    
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
                          <span>J'accepte les termes et conditions du contrat</span>
                        </Label>
                      </div>
                    </div>
                  </motion.div>
                )}
        </div>
        
        {/* Footer - Matching Figma */}
        <footer style={{
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
            © 2025 Checky — Tous droits réservés, Mentions légales • Politique de confidentialité • CGV
          </p>
        </footer>
      </div>
    </div>
  );
};

