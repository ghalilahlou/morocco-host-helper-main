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
import { CalendarIcon, Upload, FileText, X, CheckCircle, Users, Calendar as CalendarLucide, ArrowRight, ArrowLeft, Sparkles, RefreshCw, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils';
import { OpenAIDocumentService } from '@/services/openaiDocumentService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { EnhancedInput } from '@/components/ui/enhanced-input';
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload';
import { AnimatedStepper } from '@/components/ui/animated-stepper';
import { IntuitiveBookingPicker } from '@/components/ui/intuitive-date-picker';
import { validateToken, isTestToken, logTestTokenUsage, TEST_TOKENS_CONFIG } from '@/utils/testTokens';
import { validateTokenDirect } from '@/utils/tokenValidation';
import { Guest } from '@/types/booking'; // ✅ Importer le type centralisé

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateStartOfDay = new Date(checkIn);
    checkInDateStartOfDay.setHours(0, 0, 0, 0);
    const checkOutDateStartOfDay = new Date(checkOut);
    checkOutDateStartOfDay.setHours(0, 0, 0, 0);
    
    if (checkInDateStartOfDay < today) {
      return { isValid: false, error: t('validation.dateFuture.desc') };
    }

    if (checkOutDateStartOfDay <= checkInDateStartOfDay) {
      return { isValid: false, error: t('validation.checkoutAfterCheckin.desc') };
    }

    const daysDifference = Math.ceil((checkOutDateStartOfDay.getTime() - checkInDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 30) {
      return { isValid: false, error: "La durée maximale du séjour est de 30 jours" };
    }

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
    
    // ✅ CORRIGÉ : Vérifier si déjà traité pour ce token/propertyId
    if (lastProcessedTokenRef.current === token && 
        lastProcessedPropertyIdRef.current === propertyId) {
      console.log('✅ ICS déjà vérifié pour ce token/propertyId, ignoré');
      return;
    }
    
    // ✅ PROTECTION : Éviter les exécutions parallèles de checkICSData
    if (isCheckingICSRef.current) {
      console.warn('⚠️ Vérification ICS déjà en cours, appel ignoré');
      return;
    }
    
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
          try {
            const startDate = parseLocalDate(startDateParam);
            const endDate = parseLocalDate(endDateParam);
            
            console.log('📅 Dates récupérées depuis l\'URL (sans décalage timezone):', {
              startDateParam,
              endDateParam,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              startDateLocal: startDate.toLocaleDateString('fr-FR'),
              endDateLocal: endDate.toLocaleDateString('fr-FR'),
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
        const { data, error } = await supabase.functions.invoke('issue-guest-link', {
          body: {
            action: 'resolve',
            propertyId,
            token
          }
        });

        if (error) {
          console.error('❌ Erreur lors de la vérification du token:', error);
          return;
        }

        if (data?.success && data?.metadata?.linkType === 'ics_direct') {
          const reservationData = data.metadata.reservationData;
          if (reservationData) {
            console.log('✅ Données ICS détectées via token, pré-remplissage des dates:', reservationData);
            
            // Pré-remplir les dates depuis les métadonnées du token
            // ✅ CORRIGÉ : Utiliser parseLocalDate pour éviter le décalage timezone
            // ✅ AJOUT : Gestion d'erreurs robuste
            try {
              setCheckInDate(parseLocalDate(reservationData.startDate));
              setCheckOutDate(parseLocalDate(reservationData.endDate));
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
      
      // ✅ PROTECTION : Éviter les vérifications parallèles de verifyToken
      if (isVerifyingTokenRef.current) {
        console.warn('⚠️ Vérification token déjà en cours, appel ignoré');
        return;
      }
      
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
          
          // ✅ CORRIGÉ : Utiliser parseLocalDate pour éviter le décalage timezone
          // ✅ AJOUT : Gestion d'erreurs robuste
          try {
            const foundCheckInDate = parseLocalDate(matchedReservation.start_date);
            const foundCheckOutDate = parseLocalDate(matchedReservation.end_date);
            
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
    // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour trouver le bon guest
    // car le rendu utilise deduplicatedGuests, donc l'index correspond à deduplicatedGuests
    const targetGuest = deduplicatedGuests[index];
    if (!targetGuest) return;
    
    // Trouver l'index dans guests en utilisant documentNumber ou fullName comme identifiant
    const guestId = targetGuest.documentNumber || targetGuest.fullName;
    const actualIndex = guests.findIndex(g => 
      (g.documentNumber && g.documentNumber === guestId) || 
      (g.fullName && g.fullName === guestId && !g.documentNumber)
    );
    
    if (actualIndex === -1) {
      // Si pas trouvé, utiliser l'index directement (fallback)
    const updatedGuests = [...guests];
      if (updatedGuests[index]) {
    updatedGuests[index] = { ...updatedGuests[index], [field]: value };
    setGuests(updatedGuests);
      }
    } else {
      const updatedGuests = [...guests];
      updatedGuests[actualIndex] = { ...updatedGuests[actualIndex], [field]: value };
      setGuests(updatedGuests);
    }
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
            
            // ✅ CORRIGÉ : Parsing simplifié de la date de naissance
            if (extractedData.dateOfBirth && !targetGuest.dateOfBirth) {
              let parsedDate: Date | null = null;
              
              // Tentative 1: Direct parsing
              parsedDate = new Date(extractedData.dateOfBirth);
              if (isNaN(parsedDate.getTime())) {
                // Tentative 2: Format ISO (YYYY-MM-DD)
                const isoMatch = extractedData.dateOfBirth.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (isoMatch) {
                  parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                }
              }
              
              if (parsedDate && !isNaN(parsedDate.getTime())) {
                targetGuest.dateOfBirth = parsedDate;
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
    // ✅ CORRIGÉ : Protection renforcée contre les soumissions multiples
    if (isSubmittingRef.current || isProcessingRef.current || isLoading || navigationInProgressRef.current) {
      console.warn('⚠️ Soumission déjà en cours, appel ignoré', {
        isSubmitting: isSubmittingRef.current,
        isProcessing: isProcessingRef.current,
        isLoading,
        navigationInProgress: navigationInProgressRef.current
      });
      toast({
        title: "Soumission en cours",
        description: "Veuillez patienter, la soumission est déjà en cours...",
        variant: "default"
      });
      return;
    }
    
    // ✅ Marquer immédiatement comme en cours
    isSubmittingRef.current = true;
    isProcessingRef.current = true;
    
    console.log('🔍 Validation - Upload check:', {
      uploadedDocuments: uploadedDocuments.length,
      numberOfGuests: numberOfGuests,
      guestsArray: guests.length,
      deduplicatedGuests: deduplicatedGuests.length
    });

    if (!checkInDate || !checkOutDate) {
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
    
    if (checkInDateStartOfDay < today) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.dateFuture.desc'),
        variant: "destructive"
      });
      return;
    }

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
      toast({
        title: t('validation.error.title'),
        description: t('validation.exactDocs.desc', { count: actualGuestCount, s: actualGuestCount > 1 ? 's' : '' }),
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Document validation passed');

    // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour la validation (évite les doubles formulaires)
    const incompleteGuests = deduplicatedGuests.filter(guest => 
      !guest.fullName || !guest.dateOfBirth || !guest.nationality || !guest.documentNumber
    );

    if (incompleteGuests.length > 0) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.completeGuests.desc'),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // ✅ CORRIGÉ : Utiliser deduplicatedGuests pour éviter les doublons dans la soumission
      const guestData = {
        guests: deduplicatedGuests.map(guest => ({
          ...guest,
          dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : null
        }))
      };

      const bookingData = {
        checkInDate: formatLocalDate(checkInDate),
        checkOutDate: formatLocalDate(checkOutDate),
        numberOfGuests: deduplicatedGuests.length // ✅ CORRIGÉ : Utiliser le nombre réel de guests dédupliqués
      };

      // ✅ CORRIGÉ : SUPPRESSION DE L'UPLOAD MANUEL DUPLIQUÉ
      // Le workflow unifié (submitDocumentsUnified) gère maintenant TOUS les uploads
      // Plus besoin d'uploader manuellement vers Supabase storage - évite la duplication
      
      console.log('🚀 Utilisation du workflow unifié (sans upload manuel préalable):', {
        token: token ? 'Présent' : 'Manquant',
        airbnbCode: airbnbBookingId,
        guestCount: deduplicatedGuests.length,
        guestsRaw: guests.length,
        documentsCount: uploadedDocuments.length
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

      const guestInfo = {
        firstName: firstGuest?.fullName?.split(' ')[0] || '',
        lastName: firstGuest?.fullName?.split(' ').slice(1).join(' ') || '',
        email: firstGuest?.email || '',
        // phone: firstGuest?.phone || '', // ✅ CORRIGÉ : Retiré car non présent dans le type Guest
        nationality: firstGuest?.nationality || '',
        idType: firstGuest?.documentType || 'passport',
        idNumber: firstGuest?.documentNumber || '',
        dateOfBirth: firstGuest?.dateOfBirth ? format(firstGuest.dateOfBirth, 'yyyy-MM-dd') : undefined
      };

      // ✅ DEBUG: Log des données finales
      console.log('🔍 DEBUG - guestInfo final:', guestInfo);

      // ✅ CORRECTION : Convertir les fichiers en base64 au lieu d'envoyer des blob URLs
      console.log('📄 Converting documents to base64...');
      const idDocuments = await Promise.all(
        uploadedDocuments.map(async (doc, index) => {
          // Convertir le fichier en base64
          const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(doc.file);
          });
          
          return {
            name: doc.file.name || `document_${index + 1}`,
            url: fileData, // data:image/...;base64,...
            type: doc.file.type || 'application/octet-stream',
            size: doc.file.size
          };
        })
      );
      
      console.log('✅ Documents converted to base64:', {
        count: idDocuments.length,
        sizes: idDocuments.map(d => d.size)
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

      console.log('✅ Workflow unifié réussi:', result);
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
      
      // Éviter les navigations multiples
      if (navigationInProgressRef.current) {
        console.warn('⚠️ Navigation déjà en cours, ignorée');
        return;
      }
      
      navigationInProgressRef.current = true;
      
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
          console.log('✅ Navigation lancée avec succès');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-turquoise/10 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-brand-cyan/5 to-brand-turquoise/5 border-b border-gray-100">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CardTitle className="text-3xl font-bold text-center text-gray-900">
                  {t('guest.verification.title')}
                </CardTitle>
                <CardDescription className="text-center text-lg mt-2 text-gray-600">
                  {t('guest.verification.subtitle', { propertyName })}
                </CardDescription>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <AnimatedStepper
                  steps={steps}
                  currentStep={currentStepIndex}
                  size="md"
                />
              </motion.div>
            </CardHeader>
            
            <CardContent className="p-8">
              {/* ✅ CORRIGÉ : Retirer ErrorBoundary car il causait des doubles rendus visuels */}
              {/* L'intercepteur global d'erreurs window.onerror gère déjà les erreurs Portal */}
                {/* ✅ CORRIGÉ : Retirer AnimatePresence pour éviter les conflits avec les Portals Radix UI */}
                {/* Utiliser simplement des div conditionnelles avec des clés stables */}
                {currentStep === 'booking' && (
                  <div key="booking-step">
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <CalendarLucide className="w-6 h-6 text-primary" />
                          {t('guest.booking.title')}
                        </h3>
                      </div>
                      
                      <div className="flex justify-center">
                        <IntuitiveBookingPicker
                          checkInDate={checkInDate}
                          checkOutDate={checkOutDate}
                          onDatesChange={(checkIn, checkOut) => {
                            setCheckInDate(checkIn);
                            setCheckOutDate(checkOut);
                          }}
                          numberOfGuests={numberOfGuests}
                          onGuestsChange={(newGuestCount) => {
                            console.log('📊 Calendrier - Changement nombre guests:', { 
                              ancien: numberOfGuests, 
                              nouveau: newGuestCount,
                              guestsActuels: guests.length 
                            });
                            
                            setNumberOfGuests(newGuestCount);
                            
                            // ✅ CORRIGÉ : Utiliser setGuests avec fonction pour éviter les race conditions
                            setGuests(prevGuests => {
                              console.log('📊 Avant modification:', prevGuests.length);
                              
                              // Si le nombre est le même, ne rien faire
                              if (newGuestCount === prevGuests.length) {
                                console.log('✅ Même nombre, pas de modification');
                                return prevGuests;
                              }
                              
                              const currentGuests = [...prevGuests];
                              
                              // Ajouter des guests si nécessaire
                              if (newGuestCount > currentGuests.length) {
                                const guestsToAdd = newGuestCount - currentGuests.length;
                                console.log(`➕ Ajout de ${guestsToAdd} guest(s)`);
                                
                                for (let i = 0; i < guestsToAdd; i++) {
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
                              } 
                              // Retirer des guests si nécessaire
                              else if (newGuestCount < currentGuests.length) {
                                console.log(`➖ Suppression de ${currentGuests.length - newGuestCount} guest(s)`);
                                currentGuests.splice(newGuestCount);
                              }
                              
                              console.log('📊 Après modification:', currentGuests.length);
                              return currentGuests;
                            });
                          }}
                          propertyName={propertyName}
                        />
                      </div>
                    </div>

                    <div 
                      className="flex justify-end pt-8"
                    >
                      {/* ✅ CORRIGÉ : Retirer motion.div pour éviter les conflits */}
                      <Button 
                        onClick={handleNextStep} 
                        size="lg" 
                        className="px-8 py-3 bg-brand-teal hover:bg-brand-teal/90 transition-transform hover:scale-105 active:scale-95"
                      >
                        {t('guest.navigation.next')}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {currentStep === 'documents' && (
                  <div key="documents-step">
                    <div className="space-y-8">
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-primary" />
                            {t('guest.documents.title')}
                          </h3>
                          {/* ✅ TEST: Bouton pour tester manuellement la date de naissance */}
                          <Button 
                            onClick={testDateOfBirth}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            🧪 Test Date
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <EnhancedFileUpload
                          onFilesUploaded={handleFileUpload}
                          uploadedFiles={uploadedDocuments}
                          onRemoveFile={removeDocument}
                          maxFiles={numberOfGuests}
                          acceptedTypes="image/*"
                          maxSizeMB={5}
                          showPreview={true}
                        />
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Users className="w-6 h-6 text-primary" />
                          <h4 className="text-xl font-bold text-gray-900">{t('guest.clients.title')}</h4>
                          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent"></div>
                        </div>

                        <div className="space-y-6">
                          {deduplicatedGuests.map((guest, index) => (
                            <div
                              key={`guest-form-${index}`}
                            >
                              <Card className="p-6 border-2 border-gray-100 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-white to-gray-50/50">
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center text-white font-bold text-sm">
                                      {index + 1}
                                    </div>
                                    {t('guest.clients.clientNumber', { number: index + 1 })}
                                  </h4>
                                  {deduplicatedGuests.length > 1 && (
                                    <Button 
                                      onClick={() => removeGuest(index)} 
                                      variant="destructive" 
                                      size="sm"
                                      className="rounded-full hover:scale-110 transition-transform"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <EnhancedInput
                                    label={t('guest.clients.fullName')}
                                    value={guest.fullName}
                                    onChange={(e) => updateGuest(index, 'fullName', e.target.value)}
                                    placeholder={t('guest.clients.fullNamePlaceholder')}
                                    validation={{
                                      required: true,
                                      minLength: 2,
                                      validator: (value) => {
                                        if (value.trim().split(' ').length < 2) {
                                          return "Veuillez saisir le nom et prénom";
                                        }
                                        return null;
                                      }
                                    }}
                                  />
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.dateOfBirth')} *
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left h-12 border-2 hover:border-primary/50 transition-transform hover:scale-[1.02]">
                                          <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                          {guest.dateOfBirth ? format(guest.dateOfBirth, 'dd/MM/yyyy') : t('guest.booking.selectDate')}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 border-2 shadow-xl">
                                        <Calendar
                                          mode="single"
                                          selected={guest.dateOfBirth}
                                          onSelect={(date) => updateGuest(index, 'dateOfBirth', date)}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.nationality')} *
                                    </Label>
                                      <EnhancedInput
                                        value={guest.nationality}
                                        onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                                      placeholder="Nationalité"
                                        validation={{ required: true }}
                                      list={`nationalities-list-${index}`}
                                    />
                                    <datalist id={`nationalities-list-${index}`}>
                                      {NATIONALITIES.filter(n => n !== '---').map((nationality) => (
                                        <option key={nationality} value={nationality} />
                                      ))}
                                    </datalist>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.documentType')} *
                                    </Label>
                                    <select
                                      value={guest.documentType} 
                                      onChange={(e) => updateGuest(index, 'documentType', e.target.value)}
                                      className="h-12 w-full border-2 rounded-md px-3 hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                      <option value="passport">{t('guest.clients.passport')}</option>
                                      <option value="national_id">{t('guest.clients.nationalId')}</option>
                                    </select>
                                  </div>
                                  
                                  <EnhancedInput
                                    label={t('guest.clients.documentNumber')}
                                    value={guest.documentNumber}
                                    onChange={(e) => updateGuest(index, 'documentNumber', e.target.value)}
                                    placeholder={t('guest.clients.documentNumberPlaceholder')}
                                    validation={{
                                      required: true,
                                      minLength: 5,
                                      validator: (value) => {
                                        if (!/^[A-Z0-9]+$/i.test(value.replace(/\s/g, ''))) {
                                          return "Format de document invalide";
                                        }
                                        return null;
                                      }
                                    }}
                                  />
                                  
                                  <EnhancedInput
                                    label="Profession"
                                    value={guest.profession || ''}
                                    onChange={(e) => updateGuest(index, 'profession', e.target.value)}
                                    placeholder="Ex: Étudiant, Employé, Retraité..."
                                    validation={{ required: false }}
                                  />
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      Motif du séjour *
                                    </Label>
                                    <select
                                      value={guest.motifSejour || 'TOURISME'} 
                                      onChange={(e) => updateGuest(index, 'motifSejour', e.target.value)}
                                      className="h-12 w-full border-2 rounded-md px-3 hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                      <option value="TOURISME">Tourisme</option>
                                      <option value="AFFAIRES">Affaires</option>
                                      <option value="FAMILLE">Famille</option>
                                      <option value="ÉTUDES">Études</option>
                                      <option value="MÉDICAL">Médical</option>
                                      <option value="AUTRE">Autre</option>
                                    </select>
                                  </div>
                                  
                                  <EnhancedInput
                                    label="Adresse personnelle"
                                    value={guest.adressePersonnelle || ''}
                                    onChange={(e) => updateGuest(index, 'adressePersonnelle', e.target.value)}
                                    placeholder="Votre adresse au Maroc ou à l'étranger"
                                    validation={{ required: false }}
                                  />
                                  
                                  <EnhancedInput
                                    label="Email (optionnel)"
                                    type="email"
                                    value={guest.email || ''}
                                    onChange={(e) => updateGuest(index, 'email', e.target.value)}
                                    placeholder="votre.email@exemple.com"
                                    validation={{ 
                                      required: false,
                                      validator: (value) => {
                                        if (!value || value.trim() === '') return null;
                                        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
                                        if (!emailRegex.test(value)) {
                                          return "Format d'email invalide";
                                        }
                                        return null;
                                      }
                                    }}
                                  />
                                </div>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div 
                      className="flex justify-between pt-8"
                    >
                      {/* ✅ CORRIGÉ : Retirer motion.div pour éviter les conflits */}
                      <Button 
                        variant="outline" 
                        onClick={handlePrevStep} 
                        size="lg" 
                        className="px-8 py-3 border-2 transition-transform hover:scale-105 active:scale-95"
                      >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        {t('guest.navigation.previous')}
                      </Button>
                      
                      {/* ✅ CORRIGÉ : Retirer motion.div pour éviter les conflits lors de la navigation */}
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isLoading}
                        size="lg"
                        className="px-8 py-3 bg-brand-teal hover:bg-brand-teal/90 transition-transform hover:scale-105 active:scale-95"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('guest.cta.processing')}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            {t('guest.cta.sendInfo')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

