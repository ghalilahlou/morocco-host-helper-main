import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { Upload, FileText, X, CheckCircle, Users, Calendar as CalendarLucide, ArrowRight, ArrowLeft, Sparkles, RefreshCw, RotateCcw, Check, PenTool, Home, CloudUpload } from 'lucide-react';
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
import { GuestHybridDateField } from '@/components/guest/GuestHybridDateField';
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
    email: ''
  };
}

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
  const location = useLocation();
  

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
            const guestsCount = Math.max(1, Math.min(10, parseInt(guestsParam || '1', 10) || 1));
            setNumberOfGuests(guestsCount);
            setNumberOfAdults(Math.max(1, guestsCount));
            setNumberOfChildren(0);
            
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
                documentIssueDate: undefined,
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
                const guestsCount = Math.max(1, Math.min(10, parseInt(guestsParam || '1', 10) || 1));
                setCheckInDate(startDate);
                setCheckOutDate(endDate);
                setNumberOfGuests(guestsCount);
                setNumberOfAdults(Math.max(1, guestsCount));
                setNumberOfChildren(0);
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
              {
                const ng = Math.max(1, Math.min(10, reservationData.numberOfGuests || 1));
                setNumberOfGuests(ng);
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
                  setNumberOfGuests(ng);
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
  }, [token, propertyId]);

  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [numberOfAdults, setNumberOfAdults] = useState(1);
  const [numberOfChildren, setNumberOfChildren] = useState(0);

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

  /** Pièce d'identité importée et OCR terminé pour ce voyageur (index aligné documents ↔ guests). */
  const identityUnlockedForGuest = useCallback(
    (guestIndex: number) => {
      const doc = uploadedDocuments[guestIndex];
      return Boolean(doc && !doc.processing);
    },
    [uploadedDocuments]
  );

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
          dateOfBirth: g.dateOfBirth ? new Date(g.dateOfBirth) : undefined,
          documentIssueDate: g.documentIssueDate ? new Date(g.documentIssueDate) : undefined
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
          setNumberOfGuests(parsedBooking.numberOfGuests);
        }
        console.log('✅ [Persistance] Booking restauré:', parsedBooking);
      }
      
      // Restaurer le nombre de guests
      const savedNumberOfGuests = sessionStorage.getItem(getSessionKey('form_numberOfGuests'));
      if (savedNumberOfGuests) {
        setNumberOfGuests(parseInt(savedNumberOfGuests, 10));
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
      documentIssueDate: undefined,
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
    const doc = uploadedDocuments[index];
    if (!doc || doc.processing) {
      return;
    }

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
    if (deduplicatedGuests.length <= 1) return;
    setGuests(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setNumberOfGuests(t => Math.max(1, t - 1));
    if (numberOfChildren > 0) {
      setNumberOfChildren(c => c - 1);
    } else {
      setNumberOfAdults(a => Math.max(1, a - 1));
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

        // ✅ AMÉLIORÉ : Accepter le document même si certains champs manquent
        if (extractedData && Object.keys(extractedData).length > 0) {
          const hasRequiredIdFields = extractedData.fullName && 
                                    extractedData.documentNumber && 
                                    extractedData.nationality && 
                                    extractedData.documentType;

          if (!hasRequiredIdFields) {
            // ✅ NOUVEAU : Au lieu de rejeter, accepter et demander complétion manuelle
            const missingFields = [];
            if (!extractedData.fullName) missingFields.push('nom complet');
            if (!extractedData.documentNumber) missingFields.push('numéro de document');
            if (!extractedData.nationality) missingFields.push('nationalité');
            if (!extractedData.documentType) missingFields.push('type de document');
            
            toast({
              title: "Document partiellement reconnu",
              description: `Certaines informations n'ont pas pu être extraites automatiquement (${missingFields.join(', ')}). Veuillez les compléter manuellement ci-dessous.`,
              variant: "default",
            });
            
            // ✅ ACCEPTER le document avec les données partielles
            // L'utilisateur pourra compléter manuellement
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
                documentIssueDate: extractedData.documentIssueDate ? new Date(extractedData.documentIssueDate) : undefined,
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
            
            // ✅ Parsing de la date d'expiration du document (extraite par l'analyse de la pièce d'identité)
            if (extractedData.documentIssueDate) {
              let parsedExpiryDate: Date | null = null;
              
              // Tentative 1: Direct parsing
              parsedExpiryDate = new Date(extractedData.documentIssueDate);
              if (isNaN(parsedExpiryDate.getTime())) {
                // Tentative 2: Format ISO (YYYY-MM-DD)
                const isoMatch = extractedData.documentIssueDate.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (isoMatch) {
                  parsedExpiryDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                } else {
                  // Tentative 3: Format DD/MM/YYYY ou DD-MM-YYYY
                  const ddmmyyyyMatch = extractedData.documentIssueDate.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
                  if (ddmmyyyyMatch) {
                    parsedExpiryDate = new Date(parseInt(ddmmyyyyMatch[3]), parseInt(ddmmyyyyMatch[2]) - 1, parseInt(ddmmyyyyMatch[1]));
                  }
                }
              }
              
              if (parsedExpiryDate && !isNaN(parsedExpiryDate.getTime())) {
                // Pour la date d'expiration : accepter une plage raisonnable (documents valides ou récemment expirés)
                const minDate = new Date(1990, 0, 1);
                const maxDate = new Date(2050, 11, 31);
                if (parsedExpiryDate >= minDate && parsedExpiryDate <= maxDate) {
                  targetGuest.documentIssueDate = parsedExpiryDate;
                  console.log('✅ Date d\'expiration extraite et mise à jour:', format(parsedExpiryDate, 'dd/MM/yyyy'));
                } else {
                  console.warn('⚠️ Date d\'expiration invalide (hors limites):', parsedExpiryDate);
                }
              } else {
                console.warn('⚠️ Impossible de parser la date d\'expiration:', extractedData.documentIssueDate);
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
          documentIssueDate: undefined,
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

    for (let gi = 0; gi < actualGuestCount; gi++) {
      if (!uploadedDocuments[gi]) {
        isSubmittingRef.current = false;
        isProcessingRef.current = false;
        toast({
          title: t('validation.error.title'),
          description: t(isMobile ? 'guestVerification.formLockedHintMobile' : 'guestVerification.formLockedHintDesktop', { n: gi + 1 }),
          variant: 'destructive'
        });
        return;
      }
    }
    
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

      // ✅ CRITIQUE : Lire les valeurs depuis les inputs pour chaque voyageur (email, profession, adresse, motif)
      const guestsPayload = deduplicatedGuests.map((guest, index) => {
        const emailInput = document.querySelector(`input[name="email-${index}"]`) as HTMLInputElement;
        const professionInput = document.querySelector(`input[name="profession-${index}"]`) as HTMLInputElement;
        const adresseInput = document.querySelector(`input[name="adresse-${index}"]`) as HTMLInputElement;
        const motifSelectEl = document.querySelector(`select[name="motifSejour-${index}"]`) as HTMLSelectElement;
        const motifSejour = motifSelectEl?.value || guest.motifSejour || '';
        return {
          firstName: guest.fullName?.split(' ')[0] || '',
          lastName: guest.fullName?.split(' ').slice(1).join(' ') || '',
          email: emailInput?.value || guest.email || '',
          nationality: guest.nationality || '',
          idType: guest.documentType || 'passport',
          idNumber: guest.documentNumber || '',
          dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : undefined,
          documentIssueDate: guest.documentIssueDate ? format(guest.documentIssueDate, 'yyyy-MM-dd') : undefined,
          profession: professionInput?.value || guest.profession || '',
          motifSejour,
          adressePersonnelle: adresseInput?.value || guest.adressePersonnelle || ''
        };
      });

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

      // ✅ CORRECTION : Sauvegarder les données enrichies du workflow unifié
      // ⚠️ IMPORTANT : Sauvegarder dans localStorage AVANT la navigation (fallback pour Vercel)
      try {
        localStorage.setItem('currentBookingId', bookingId);
        localStorage.setItem('currentBookingData', JSON.stringify(bookingData));
        localStorage.setItem('currentGuestData', JSON.stringify({ ...guestInfo, guests: guestsPayload }));
        localStorage.setItem('contractUrl', result.contractUrl);
        // ✅ NOUVEAU: Sauvegarder le nom de propriété pour la page de confirmation
        if (propertyName) {
          localStorage.setItem('currentPropertyName', propertyName);
        }
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

    goToStep('documents'); // ✅ CORRIGÉ : Utiliser goToStep pour marquer comme visitée
  };

  const handlePrevStep = () => {
    if (currentStep === 'signature') {
      goToStep('documents'); // ✅ CORRIGÉ : Utiliser goToStep
    } else if (currentStep === 'documents') {
      goToStep('booking'); // ✅ CORRIGÉ : Utiliser goToStep
    }
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
                    goToStep('booking'); // ✅ CORRIGÉ : Utiliser goToStep
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
      
      {/* ========================================
          MOBILE HEADER - Visible uniquement sur mobile
          ======================================== */}
      {isMobile && (
        <div className="mobile-header guest-verification-mobile-header safe-area-top">
          {/* Barre noire pleine largeur : logo à gauche, langue à droite uniquement */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <img 
                src="/lovable-uploads/Checky simple - fond transparent.png" 
                alt="CHECKY" 
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span style={{ 
                fontFamily: 'Fira Sans Condensed, sans-serif',
                fontWeight: 700,
                fontSize: '20px',
                color: '#FFFFFF'
              }}>CHECKY</span>
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
          <div className="flex items-center gap-3 mb-4">
            <img 
              src="/lovable-uploads/Checky simple - fond transparent.png" 
              alt="CHECKY Logo" 
              className="h-12 w-12 object-contain"
              onError={(e) => {
                console.log('Logo Checky not found');
                e.currentTarget.style.display = 'none';
              }}
            />
            <span style={{ 
              fontFamily: 'Fira Sans Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '32px',
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
        className={`flex-1 flex flex-col w-full ${isMobile ? 'safe-area-all min-h-screen' : ''}`}
        style={{ 
          backgroundColor: '#FDFDF9',
          marginLeft: isMobile ? 0 : '436px',
          minHeight: '100vh'
        }}
      >
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
        <div className={`flex-1 px-6 pb-6 overflow-y-auto ${isMobile ? 'guest-verification-main smooth-scroll' : ''}`}>
              {/* ✅ CORRIGÉ : Retirer ErrorBoundary car il causait des doubles rendus visuels */}
              {/* L'intercepteur global d'erreurs window.onerror gère déjà les erreurs Portal */}
                {/* ✅ CORRIGÉ : Retirer AnimatePresence pour éviter les conflits avec les Portals Radix UI */}
                {/* Utiliser simplement des div conditionnelles avec des clés stables */}
                {currentStep === 'booking' && (
                  <div className={`mx-auto space-y-6 relative ${isMobile ? 'max-w-full px-4' : 'max-w-4xl'}`}>
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
                    <div className="relative">
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
                            setShowCalendarPanel(!showCalendarPanel);
                            setShowGuestsPanel(false);
                          }}
                        >
                          <Label className={`block font-semibold lowercase ${isMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#222222' }}>{t('guestVerification.labelWhen')}</Label>
                          <div className={`font-normal ${isMobile ? 'text-base' : 'text-lg'}`} style={{ fontFamily: 'Inter, sans-serif', color: '#717171' }}>
                            {checkInDate && checkOutDate 
                              ? isMobile 
                                ? `${format(checkInDate, 'dd/MM')} → ${format(checkOutDate, 'dd/MM/yy')}`
                                : `${format(checkInDate, 'dd/MM/yyyy')} - ${format(checkOutDate, 'dd/MM/yyyy')}`
                              : t('guestVerification.selectDates')
                            }
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
                              ref={guestsPanelRef}
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
                                        const total = Math.max(1, numberOfAdults - 1) + numberOfChildren;
                                        setNumberOfGuests(total);
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
                                        const total = (numberOfAdults + 1) + numberOfChildren;
                                        setNumberOfGuests(total);
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
                                        const total = numberOfAdults + Math.max(0, numberOfChildren - 1);
                                        setNumberOfGuests(total);
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
                                        const total = numberOfAdults + (numberOfChildren + 1);
                                        setNumberOfGuests(total);
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
                                      const total = Math.max(1, numberOfAdults - 1) + numberOfChildren;
                                      setNumberOfGuests(total);
                                    }}
                                    disabled={numberOfAdults <= 1}
                                  >−</button>
                                  <span className="mobile-guests-count">{numberOfAdults}</span>
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfAdults(numberOfAdults + 1);
                                      const total = (numberOfAdults + 1) + numberOfChildren;
                                      setNumberOfGuests(total);
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
                                      const total = numberOfAdults + Math.max(0, numberOfChildren - 1);
                                      setNumberOfGuests(total);
                                    }}
                                    disabled={numberOfChildren <= 0}
                                  >−</button>
                                  <span className="mobile-guests-count">{numberOfChildren}</span>
                                  <button
                                    className="mobile-guests-btn"
                                    onClick={() => {
                                      setNumberOfChildren(numberOfChildren + 1);
                                      const total = numberOfAdults + (numberOfChildren + 1);
                                      setNumberOfGuests(total);
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
                            ref={calendarPanelRef}
                            initial={{ opacity: 0, y: isMobile ? 80 : -10, scale: isMobile ? 0.98 : 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: isMobile ? 80 : -10, scale: isMobile ? 0.98 : 0.95 }}
                            className={isMobile 
                              ? 'fixed inset-x-0 bottom-0 top-[env(safe-area-inset-top)] z-[61] bg-white rounded-t-2xl shadow-2xl overflow-y-auto safe-area-bottom' 
                              : 'absolute top-full left-0 right-0 mt-3 flex justify-center z-50'
                            }
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
                                </div>
                              )}
                              
                              <EnhancedCalendar
                                mode="range"
                                rangeStart={checkInDate}
                                rangeEnd={checkOutDate}
                                onRangeSelect={(checkIn, checkOut) => {
                                  const normalizedCheckIn = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                                  const normalizedCheckOut = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                                  setCheckInDate(normalizedCheckIn);
                                  setCheckOutDate(normalizedCheckOut);
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
                            Appuyez pour importer vos documents
                          </p>
                          <p className="text-xs text-gray-500">
                            Carte d'identité ou passeport • PDF, PNG, JPG (5 Mo max)
                          </p>
                        </div>
                        {uploadedDocuments.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              {t('guestVerification.docsUploadedCount', { count: uploadedDocuments.length })}
                            </p>
                            <div className="space-y-2">
                              {uploadedDocuments.map((doc, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white shadow-sm relative group">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
                                      setGuests(prev => prev.filter((_, i) => i !== index));
                                      setNumberOfGuests(prev => Math.max(1, prev - 1));
                                      toast({ title: 'Document supprimé', description: 'Le document a été retiré de la liste' });
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 touch-target"
                                    aria-label="Supprimer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
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
                                    <p className="text-xs text-gray-500">
                                      {deduplicatedGuests[index]?.fullName || (doc.extractedData?.fullName || '—')}
                                    </p>
                                  </div>
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
                          {deduplicatedGuests.map((guest, index) => {
                            const fieldsLocked = !identityUnlockedForGuest(index);
                            const docAt = uploadedDocuments[index];
                            const showProcessingBanner = Boolean(docAt?.processing);
                            return (
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

                                {(fieldsLocked || showProcessingBanner) && (
                                  <div
                                    role="status"
                                    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                                      showProcessingBanner
                                        ? 'border-blue-200 bg-blue-50 text-blue-900'
                                        : 'border-amber-200 bg-amber-50 text-amber-950'
                                    }`}
                                  >
                                    {showProcessingBanner
                                      ? t('guestVerification.formLockedProcessing')
                                      : t(
                                          isMobile
                                            ? 'guestVerification.formLockedHintMobile'
                                            : 'guestVerification.formLockedHintDesktop',
                                          { n: index + 1 }
                                        )}
                                  </div>
                                )}
                                
                                {/* Form Grid - 2 columns desktop, 1 column mobile */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.fullName')} <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      id={`fullName-${index}`}
                                      value={guest.fullName}
                                      onChange={(e) => updateGuest(index, 'fullName', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={fieldsLocked}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`guest-dob-${index}`} className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.dateOfBirth')} <span className="text-red-500">*</span>
                                    </Label>
                                    <GuestHybridDateField
                                      id={`guest-dob-${index}`}
                                      variant="birth"
                                      value={
                                        guest.dateOfBirth
                                          ? new Date(guest.dateOfBirth)
                                          : undefined
                                      }
                                      onChange={(date) => updateGuest(index, 'dateOfBirth', date)}
                                      ariaLabel={t('guest.clients.documentExpiryPlaceholder')}
                                      disabled={fieldsLocked}
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.nationality')} <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      id={`nationality-${index}`}
                                      value={guest.nationality}
                                      onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={fieldsLocked}
                                      list={`nationalities-list-${index}`}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    <datalist id={`nationalities-list-${index}`}>
                                      {NATIONALITIES.filter(n => n !== '---').map((nationality) => (
                                        <option key={nationality} value={nationality} />
                                      ))}
                                    </datalist>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.documentType')} <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                      <select
                                        id={`documentType-${index}`}
                                        value={guest.documentType} 
                                        onChange={(e) => updateGuest(index, 'documentType', e.target.value)}
                                        disabled={fieldsLocked}
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
                                      id={`documentNumber-${index}`}
                                      value={guest.documentNumber}
                                      onChange={(e) => updateGuest(index, 'documentNumber', e.target.value)}
                                      placeholder=""
                                      required
                                      disabled={fieldsLocked}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor={`guest-doc-expiry-${index}`} className="text-sm font-semibold text-gray-900">
                                      {t('guest.clients.documentExpiryDate')}
                                    </Label>
                                    <GuestHybridDateField
                                      id={`guest-doc-expiry-${index}`}
                                      variant="expiry"
                                      value={
                                        guest.documentIssueDate
                                          ? new Date(guest.documentIssueDate)
                                          : undefined
                                      }
                                      onChange={(date) => updateGuest(index, 'documentIssueDate', date)}
                                      ariaLabel={t('guest.clients.documentExpiryPlaceholder')}
                                      disabled={fieldsLocked}
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      Profession
                                    </Label>
                                    <input
                                      type="text"
                                      id={`profession-${index}`}
                                      name={`profession-${index}`}
                                      defaultValue={guest.profession || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'profession', target.value);
                                      }}
                                      placeholder=""
                                      disabled={fieldsLocked}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      Motif du séjour <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                      <select
                                        id={`motifSejour-${index}`}
                                        name={`motifSejour-${index}`}
                                        defaultValue={guest.motifSejour || ''} 
                                        onChange={(e) => {
                                          updateGuest(index, 'motifSejour', e.target.value);
                                        }}
                                        disabled={fieldsLocked}
                                        className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      Adresse personnelle
                                    </Label>
                                    <input
                                      type="text"
                                      id={`adresse-${index}`}
                                      name={`adresse-${index}`}
                                      defaultValue={guest.adressePersonnelle || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'adressePersonnelle', target.value);
                                      }}
                                      placeholder=""
                                      disabled={fieldsLocked}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900">
                                      Courriel <span className="text-gray-500 font-normal">(optionnel)</span>
                                    </Label>
                                    <input
                                      type="email"
                                      id={`email-${index}`}
                                      name={`email-${index}`}
                                      defaultValue={guest.email || ''}
                                      onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        updateGuest(index, 'email', target.value);
                                      }}
                                      placeholder=""
                                      disabled={fieldsLocked}
                                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                    </div>
                    
                    {/* Footer navigation - matching Figma */}
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
                        {t('guest.navigation.next')}
                        <ArrowRight className="w-4 h-4" />
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
    </div>
  );
};

