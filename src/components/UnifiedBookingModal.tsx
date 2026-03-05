/**
 * ✅ UNIFIÉ : Modal unifié pour toutes les réservations (Booking et Airbnb)
 * Basé sur AirbnbReservationModal (structure bleue) - le plus fonctionnel
 * Route: Utilisé par CalendarView pour afficher les détails de réservation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, X, Copy, FileText, Shield, CreditCard, Trash2, Share2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { supabase } from '@/integrations/supabase/client';
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
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { ContractService, getContractPdfUrl } from '@/services/contractService';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ShareModal } from '@/components/ShareModal';
import { copyToClipboardSimple } from '@/lib/clipboardSimple';
import { parseLocalDate } from '@/utils/dateUtils';
import { useT } from '@/i18n/GuestLocaleProvider';

interface UnifiedBookingModalProps {
  booking: Booking | EnrichedBooking | AirbnbReservation | null;
  isOpen: boolean;
  onClose: () => void;
  propertyId?: string;
}

export const UnifiedBookingModal = ({
  booking,
  isOpen,
  onClose,
  propertyId: propPropertyId
}: UnifiedBookingModalProps) => {
  // ✅ TOUS LES HOOKS DOIVENT ÊTRE APPELÉS AVANT TOUT RETURN CONDITIONNEL
  const {
    generatePropertyVerificationUrl,
    isLoading: isGeneratingLink
  } = useGuestVerification();
  const { deleteBooking, refreshBookings } = useBookings();
  const { toast } = useToast();
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documents, setDocuments] = useState<{
    contractUrl: string | null;
    contractId: string | null;
    policeUrl: string | null;
    policeId: string | null;
    identityDocuments: Array<{ url: string; id: string; guestName?: string; documentNumber?: string }>;
    loading: boolean;
  }>({
    contractUrl: null,
    contractId: null,
    policeUrl: null,
    policeId: null,
    identityDocuments: [],
    loading: false
  });
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [isGeneratingPolice, setIsGeneratingPolice] = useState(false);
  const [contractLocale, setContractLocale] = useState<'fr' | 'en' | 'es'>('fr');
  const [isOpeningContractView, setIsOpeningContractView] = useState(false);
  const [hasGuestData, setHasGuestData] = useState(false);
  const t = useT();
  const [showManualCheck, setShowManualCheck] = useState(false); // ✅ NOUVEAU : Afficher bouton vérification manuelle
  const [docsGeneratedState, setDocsGeneratedState] = useState<any>(null); // ✅ NOUVEAU : Stocker documents_generated pour l'affichage
  const [bookingDocsGeneratedState, setBookingDocsGeneratedState] = useState<any>(null); // ✅ NOUVEAU : Stocker documents_generated depuis DB
  const [isGeneratingMissingDocs, setIsGeneratingMissingDocs] = useState(false); // ✅ NOUVEAU : État pour génération documents manquants
  const isMobile = useIsMobile();
  
  // ✅ NOUVEAU : État pour le modal de partage mobile
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalUrl, setShareModalUrl] = useState<string>('');
  // ✅ PRESSE-PAPIERS : Lien préchargé à l'ouverture du modal pour copie synchrone au clic (iOS/Android)
  const [cachedGuestLinkUrl, setCachedGuestLinkUrl] = useState<string | null>(null);
  const [cachedGuestLinkLoading, setCachedGuestLinkLoading] = useState(false);

  // ✅ DÉTECTION : Identifier le type de réservation (avant le useEffect)
  const isAirbnb = booking ? ('source' in booking && booking.source === 'airbnb') : false;
  const isEnriched = booking ? ('hasRealSubmissions' in booking) : false;
  
  // ✅ EXTRACTION : Données unifiées pour tous les types (avec vérification null)
  const bookingCode = booking 
    ? (isAirbnb 
        ? (booking as AirbnbReservation).airbnbBookingId 
        : (booking as Booking).bookingReference || (booking as Booking).id.slice(-12).toUpperCase())
    : '';
  
  // ✅ CORRIGÉ : Utiliser parseLocalDate pour les réservations manuelles pour éviter le décalage timezone
  const checkIn = booking
    ? (isAirbnb
        ? (booking as AirbnbReservation).startDate
        : parseLocalDate((booking as Booking).checkInDate))
    : new Date();
  
  const checkOut = booking
    ? (isAirbnb
        ? (booking as AirbnbReservation).endDate
        : parseLocalDate((booking as Booking).checkOutDate))
    : new Date();

  const rawStatus = booking
    ? (isAirbnb 
        ? 'pending' 
        : (booking as Booking).status || 'pending')
    : 'pending';
  
  // ✅ NOUVEAU : Détecter si c'est une réservation issue d'un fichier ICS (non supprimable)
  // Une réservation ICS est identifiée par :
  // - Status 'pending'
  // - booking_reference existe et n'est pas 'INDEPENDENT_BOOKING' (code Airbnb)
  // - Pas de guests complets (pas de full_name, document_number, nationality pour tous les guests)
  // ✅ CORRIGÉ : Utiliser useMemo pour éviter les problèmes d'ordre d'initialisation et références circulaires
  const bookingTyped = booking as Booking;
  const isICSReservation = useMemo(() => {
    if (isAirbnb || !bookingTyped || rawStatus !== 'pending') return false;
    if (!bookingTyped.bookingReference || bookingTyped.bookingReference === 'INDEPENDENT_BOOKING') return false;
    
    const hasCompleteGuests = bookingTyped.guests && bookingTyped.guests.length > 0 && 
      bookingTyped.guests.every(guest => 
        guest.fullName && 
        guest.documentNumber && 
        guest.nationality
      );
    
    return !hasCompleteGuests;
  }, [isAirbnb, booking, rawStatus]);

  // ✅ PROPERTY ID : Priorité propertyId > booking.propertyId > booking.property?.id
  const propertyId = propPropertyId || 
    (booking ? ((booking as Booking).propertyId || 
    (booking as EnrichedBooking).property?.id) : undefined);
  
  // ✅ PROPERTY NAME : Extraire le nom de la propriété si disponible
  const propertyName = booking 
    ? ((booking as EnrichedBooking).property?.name || 
       (booking as Booking).property?.name || 
       '')
    : '';
  
  // ✅ DISPLAY NAME : Nom d'affichage pour la réservation (guest name ou code)
  const displayName = booking 
    ? getUnifiedBookingDisplayText(booking as Booking | AirbnbReservation, true)
    : '';

  // ✅ STATUS BADGE : Couleur selon le statut
  const getStatusBadge = () => {
    const statusColors = {
      completed: { bg: '#10b981', text: 'Terminé' },
      pending: { bg: BOOKING_COLORS.pending.hex, text: 'En attente' },
      confirmed: { bg: '#f59e0b', text: 'Confirmé' },
      default: { bg: '#64748b', text: 'En attente' }
    };
    
    const statusInfo = statusColors[status as keyof typeof statusColors] || statusColors.default;
    
    return (
      <Badge 
        variant="secondary" 
        style={{ backgroundColor: statusInfo.bg, color: 'white' }}
      >
        {statusInfo.text}
      </Badge>
    );
  };

  // ✅ CALCUL : Nombre de nuits
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  };

  // ✅ FORMATAGE : Date au format français
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // ✅ PRÉCHARGEMENT : À l'ouverture du modal, récupérer le lien pour copie synchrone au clic (presse-papiers fiable sur mobile)
  useEffect(() => {
    if (!isOpen || !booking || !propertyId) {
      setCachedGuestLinkUrl(null);
      return;
    }
    let cancelled = false;
    setCachedGuestLinkLoading(true);
    const doPrefetch = async () => {
      try {
        if (isAirbnb) {
          const airbnbRes = booking as AirbnbReservation;
          const url = await generatePropertyVerificationUrl(propertyId, airbnbRes.airbnbBookingId, {
            linkType: 'ics_direct',
            reservationData: {
              airbnbCode: airbnbRes.airbnbBookingId,
              startDate: airbnbRes.startDate,
              endDate: airbnbRes.endDate,
              guestName: airbnbRes.guestName,
              numberOfGuests: airbnbRes.numberOfGuests
            },
            skipCopy: true
          });
          if (!cancelled && url) setCachedGuestLinkUrl(url);
        } else {
          const manualBooking = booking as Booking;
          const startDate = parseLocalDate(manualBooking.checkInDate);
          const endDate = parseLocalDate(manualBooking.checkOutDate);
          const url = await generatePropertyVerificationUrl(propertyId, manualBooking.id, {
            linkType: 'ics_direct',
            reservationData: {
              airbnbCode: manualBooking.bookingReference || 'INDEPENDENT_BOOKING',
              startDate,
              endDate,
              numberOfGuests: manualBooking.numberOfGuests
            },
            skipCopy: true
          });
          if (!cancelled && url) setCachedGuestLinkUrl(url);
        }
      } catch {
        if (!cancelled) setCachedGuestLinkUrl(null);
      } finally {
        if (!cancelled) setCachedGuestLinkLoading(false);
      }
    };
    doPrefetch();
    return () => { cancelled = true; setCachedGuestLinkUrl(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generatePropertyVerificationUrl stable; avoid re-prefetch and new token on every render
  }, [isOpen, booking?.id, propertyId, isAirbnb]);

  // ✅ GÉNÉRATION DE LIEN : Desktop = copie directe vers session guest (pas de panneau). Mobile = panneau partage + copie.
  const handleGenerateGuestLink = async (event?: React.MouseEvent) => {
    // Utiliser le viewport (useIsMobile) pour desktop = copie seule, mobile = ShareModal (pas userAgent)
    // Lien déjà préchargé
    if (cachedGuestLinkUrl) {
      if (isMobile) {
        // ✅ MOBILE : Ouvrir le panneau partage (Copier, WhatsApp, SMS, Email…)
        setShareModalUrl(cachedGuestLinkUrl);
        setShareModalOpen(true);
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(cachedGuestLinkUrl)
            .then(() => {
              toast({
                title: t('toast.linkCopied'),
                description: t('toast.linkCopiedDesc'),
              });
            })
            .catch(() => {
              toast({
                title: t('toast.linkGenerated'),
                description: t('toast.linkGeneratedDesc'),
                duration: 8000,
              });
            });
        } else {
          toast({
            title: t('toast.linkGenerated'),
            description: t('toast.linkGeneratedDesc'),
          });
        }
      } else {
        // ✅ DESKTOP : Copie fiable (clipboardSimple + événement) pour que le presse-papiers fonctionne
        const result = await copyToClipboardSimple(cachedGuestLinkUrl, event?.nativeEvent);
        if (result.success) {
          toast({
            title: t('toast.linkCopied'),
            description: t('toast.linkCopiedDesc'),
          });
        } else {
          toast({
            title: t('toast.linkGenerated'),
            description: result.error || t('toast.linkGeneratedDesc'),
            duration: 8000,
          });
        }
      }
      return;
    }

    console.log('🔵 [UNIFIED MODAL] Génération de lien pour:', {
      bookingId: booking.id,
      bookingCode,
      propertyId,
      isAirbnb,
      hasEvent: !!event
    });
    
    if (isGeneratingLocal || isGeneratingLink) {
      console.warn('⚠️ Génération déjà en cours, clic ignoré');
      return;
    }

    if (!propertyId) {
      console.error('❌ Aucune propriété associée:', {
        bookingId: booking.id,
        propPropertyId,
        bookingPropertyId: (booking as Booking).propertyId,
        propertyFromBooking: (booking as EnrichedBooking).property?.id
      });
      toast({
        title: "Erreur",
        description: "Aucune propriété associée à cette réservation. Veuillez modifier la réservation pour associer une propriété.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingLocal(true);
    const userEvent = event || undefined;

    try {
      let generatedUrl: string | undefined;
      
      // ✅ ENRICHIE : Pour les réservations Airbnb, inclure les dates pré-remplies
      if (isAirbnb) {
        const airbnbRes = booking as AirbnbReservation;
        generatedUrl = await generatePropertyVerificationUrl(propertyId, airbnbRes.airbnbBookingId, {
          linkType: 'ics_direct',
          reservationData: {
            airbnbCode: airbnbRes.airbnbBookingId,
            startDate: airbnbRes.startDate,
            endDate: airbnbRes.endDate,
            guestName: airbnbRes.guestName,
            numberOfGuests: airbnbRes.numberOfGuests
          },
          userEvent: userEvent,
          skipCopy: true
        });
      } else {
        // ✅ ENRICHIE : Pour les réservations manuelles, inclure les dates avec linkType ics_direct
        const manualBooking = booking as Booking;
        
        // ✅ CORRIGÉ : Utiliser parseLocalDate pour éviter le décalage timezone
        // checkInDate et checkOutDate sont des chaînes YYYY-MM-DD, pas des objets Date
        // ⚠️ IMPORTANT : parseLocalDate crée une date à minuit local, évitant le décalage UTC
        const startDate = parseLocalDate(manualBooking.checkInDate);
        const endDate = parseLocalDate(manualBooking.checkOutDate);
        
        console.log('📅 [UNIFIED MODAL] Dates parsées pour réservation manuelle:', {
          checkInDate: manualBooking.checkInDate,
          checkOutDate: manualBooking.checkOutDate,
          startDate: startDate.toLocaleDateString('fr-FR'),
          endDate: endDate.toLocaleDateString('fr-FR'),
          startDateISO: startDate.toISOString(),
          endDateISO: endDate.toISOString()
        });
        
        // ICS/manual : passer le code résa (bookingReference) pour que le backend associe le lien à la bonne résa
        generatedUrl = await generatePropertyVerificationUrl(propertyId, manualBooking.bookingReference || manualBooking.id, {
          linkType: 'ics_direct', // ✅ FORCÉ : Toujours utiliser ics_direct
          reservationData: {
            airbnbCode: manualBooking.bookingReference || 'INDEPENDENT_BOOKING',
            startDate: startDate,
            endDate: endDate,
            numberOfGuests: manualBooking.numberOfGuests
          },
          userEvent: userEvent,
          skipCopy: true
        });
      }
      
      console.log('✅ Lien généré avec succès:', generatedUrl);
      
      // ✅ DESKTOP : Copie seule, lien direct vers session guest (pas de panneau). MOBILE : panneau partage + partage natif.
      if (generatedUrl) {
        if (isMobile) {
          setShareModalUrl(generatedUrl);
          setShareModalOpen(true);
          // Sur mobile, proposer en plus le partage natif (menu système)
          if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
              const shareTitle = `Lien de réservation${propertyName ? ` - ${propertyName}` : ''}`;
              let shareData: ShareData = {
                title: shareTitle,
                text: 'Cliquez ici pour compléter votre réservation',
                url: generatedUrl
              };
              if (navigator.canShare) {
                if (!navigator.canShare(shareData)) {
                  shareData = { title: shareTitle, url: generatedUrl };
                  if (!navigator.canShare(shareData)) shareData = { url: generatedUrl };
                }
              }
              await navigator.share(shareData);
              setShareModalOpen(false);
              toast({ title: "✅ Lien partagé !", description: "Le lien a été partagé avec succès" });
            } catch (shareError: any) {
              if (shareError.name === 'AbortError') {
                console.log('📱 Partage annulé par l\'utilisateur');
              } else if (shareError.name === 'NotAllowedError') {
                setShareModalUrl(generatedUrl);
                setShareModalOpen(true);
              } else {
                setShareModalUrl(generatedUrl);
                setShareModalOpen(true);
              }
            }
          } else {
            setShareModalUrl(generatedUrl);
            setShareModalOpen(true);
          }
        } else {
          // ✅ DESKTOP : Copie directe, lien envoie vers la session guest réservation (pas d’ouverture du panneau)
          const copyResult = await copyToClipboardSimple(generatedUrl, event?.nativeEvent);
          if (copyResult.success) {
              toast({
                title: "Lien copié !",
                description: "Le lien a été copié. Collez-le pour l’envoyer à votre client ; il ouvrira directement la session de réservation.",
              });
          } else {
            toast({
              title: "Lien généré",
              description: copyResult.error || "Le lien ouvre directement la session guest. Copiez-le manuellement.",
              duration: 8000,
            });
          }
          setCachedGuestLinkUrl(generatedUrl);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la génération du lien:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: "Erreur",
        description: `Impossible de générer le lien: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingLocal(false);
    }
  };

  // ✅ TITRE : Code de réservation ou nom du client
  const getTitle = () => {
    if (isAirbnb) {
      const airbnbRes = booking as AirbnbReservation;
      const rawEvent = airbnbRes.rawEvent || '';
      const patterns = [/details\/([A-Z0-9]{8,12})/i, /tails\/([A-Z0-9]{8,12})/i, /\/([A-Z0-9]{8,12})\\/i, /\b([A-Z0-9]{8,12})\b/g];
      
      for (const pattern of patterns) {
        const matches = rawEvent.match(pattern);
        if (matches) {
          const code = matches[1].toUpperCase();
          if (code !== 'RESERVED' && code !== 'AVAILABLE' && /^[A-Z0-9]{8,12}$/.test(code)) {
            return code;
          }
        }
      }
      return airbnbRes.airbnbBookingId || 'Réservation Airbnb';
    } else {
      const manualBooking = booking as Booking | EnrichedBooking;
      return bookingCode || 
        (isEnriched && (manualBooking as EnrichedBooking).realGuestNames[0]) ||
        (manualBooking as Booking).guests?.[0]?.fullName ||
        `Réservation #${booking.id.slice(-6)}`;
    }
  };

  // ✅ CODE RÉSERVATION : Extraction intelligente
  const getReservationCode = () => {
    if (isAirbnb) {
      const airbnbRes = booking as AirbnbReservation;
      const rawEvent = airbnbRes.rawEvent || '';
      const patterns = [/details\/([A-Z0-9]{8,12})/i, /tails\/([A-Z0-9]{8,12})/i, /\/([A-Z0-9]{8,12})\\/i, /\b([A-Z0-9]{8,12})\b/g];
      
      for (const pattern of patterns) {
        const matches = rawEvent.match(pattern);
        if (matches) {
          const code = matches[1].toUpperCase();
          if (code !== 'RESERVED' && code !== 'AVAILABLE' && /^[A-Z0-9]{8,12}$/.test(code)) {
            return code;
          }
        }
      }
      return airbnbRes.airbnbBookingId || "Code non trouvé";
    } else {
      return bookingCode;
    }
  };

  // ✅ CHARGEMENT DES DOCUMENTS : Lecture directe depuis props + fallback + timeout
  // ⚠️ CRITIQUE : Ce useEffect doit TOUJOURS être appelé (même si booking est null)
  useEffect(() => {
    const loadDocuments = async () => {
      if (!booking || (rawStatus !== 'completed' && rawStatus !== 'pending' && rawStatus !== 'confirmed') || isAirbnb || !booking.id) {
        setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: false });
        setShowManualCheck(false);
        return;
      }

      console.log('📄 [UNIFIED MODAL] Chargement des documents pour booking:', booking.id);
      console.log('📄 [UNIFIED MODAL] Booking complet:', {
        id: booking.id,
        status: (booking as any).status,
        hasContractUrl: !!(booking as any).contractUrl || !!(booking as any).contract_url,
        hasPoliceUrl: !!(booking as any).policeUrl || !!(booking as any).police_url,
        hasDocumentsGenerated: !!(booking as any).documents_generated
      });
      setShowManualCheck(false);
      
      // ✅ ÉTAPE 1 : LECTURE DIRECTE depuis les props du booking (INSTANTANÉ)
      const bookingAny = booking as any;
      const directContractUrl = bookingAny?.contractUrl || bookingAny?.contract_url || null;
      const directPoliceUrl = bookingAny?.policeUrl || bookingAny?.police_url || null;
      const directIdentityUrl = bookingAny?.identityUrl || bookingAny?.identity_url || null;
      
      // ✅ ÉTAPE 2 : Fallback avec documents_generated depuis le booking (INSTANTANÉ)
      const docsGenerated = bookingAny?.documents_generated;
      const fallbackContractUrl = docsGenerated?.contractUrl || docsGenerated?.contract?.url || null;
      const fallbackPoliceUrl = docsGenerated?.policeUrl || docsGenerated?.police?.url || null;
      
      // ✅ STOCKER : Sauvegarder dans l'état pour l'affichage
      setDocsGeneratedState(docsGenerated);
      
      console.log('📄 [UNIFIED MODAL] Étape 1-2 - URLs directes:', {
        directContractUrl: !!directContractUrl,
        directPoliceUrl: !!directPoliceUrl,
        fallbackContractUrl: !!fallbackContractUrl,
        fallbackPoliceUrl: !!fallbackPoliceUrl,
        docsGeneratedType: typeof docsGenerated,
        docsGeneratedValue: docsGenerated
      });
      
      // ✅ PRIORITÉ : Utiliser les URLs directes, sinon fallback
      const initialContractUrl = directContractUrl || fallbackContractUrl;
      const initialPoliceUrl = directPoliceUrl || fallbackPoliceUrl;
      
      // ✅ AFFICHAGE INSTANTANÉ : Si on a des URLs, les afficher immédiatement
      if (initialContractUrl || initialPoliceUrl || docsGenerated?.contract || docsGenerated?.police) {
        console.log('✅ [UNIFIED MODAL] Documents trouvés directement dans booking:', {
          contract: !!initialContractUrl,
          police: !!initialPoliceUrl,
          hasDocsGenerated: !!(docsGenerated?.contract || docsGenerated?.police)
        });
        
        setDocuments({
          contractUrl: initialContractUrl,
          contractId: null,
          policeUrl: initialPoliceUrl,
          policeId: null,
          identityDocuments: directIdentityUrl ? [{ id: 'direct-identity', url: directIdentityUrl }] : [],
          loading: false
        });
        
        // ✅ Afficher les icônes même si documents_generated indique juste true
        if (!initialContractUrl && docsGenerated?.contract === true) {
          console.log('📄 [UNIFIED MODAL] Contrat marqué comme généré dans documents_generated');
        }
        if (!initialPoliceUrl && docsGenerated?.police === true) {
          console.log('📄 [UNIFIED MODAL] Police marquée comme générée dans documents_generated');
        }
      } else {
        // Pas d'URLs directes, on initialise avec loading
        setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: true });
      }

      // ✅ ÉTAPE 3 : Chargement depuis uploaded_documents avec timeout progressif
      // ✅ AUGMENTÉ : 10 secondes pour laisser le temps aux requêtes parallèles de se terminer
      const TIMEOUT_MS = 10000; // 10 secondes
      let timeoutReached = false;
      const timeoutId = setTimeout(() => {
        timeoutReached = true;
        console.warn(`⏱️ [UNIFIED MODAL] Timeout de ${TIMEOUT_MS/1000}s atteint - Affichage du bouton de vérification manuelle`);
        setShowManualCheck(true);
        // ✅ NE PAS arrêter le loading - laisser les requêtes continuer en arrière-plan
        // Les documents seront mis à jour dès qu'ils arriveront
      }, TIMEOUT_MS);

      try {
        const startTime = Date.now();
        console.log('⏱️ [UNIFIED MODAL] Début des requêtes parallèles...');
        
        // ✅ PARALLÉLISATION : Utiliser Promise.allSettled pour ne pas bloquer
        const [uploadedDocsResult, generatedDocsResult, bookingDataResult, edgeFunctionResult, guestSubmissionsResult] = await Promise.allSettled([
          // Requête 1 : uploaded_documents (documents uploadés ou générés)
          supabase
            .from('uploaded_documents')
            .select('id, document_url, file_path, document_type, is_signed, extracted_data, guests(full_name, document_number)')
            .eq('booking_id', booking.id) // ✅ UUID correct
            .in('document_type', ['contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport'])
            .order('created_at', { ascending: false }),
          // ✅ NOUVEAU : Requête 1.5 : generated_documents (si cette table existe)
          supabase
            .from('generated_documents')
            .select('id, document_url, document_type, is_signed, created_at')
            .eq('booking_id', booking.id) // ✅ UUID correct
            .in('document_type', ['contract', 'police', 'identity'])
            .order('created_at', { ascending: false })
            .then(result => result)
            .catch(() => ({ data: [], error: null })), // ✅ Fallback si la table n'existe pas
          // Requête 3 : documents_generated depuis bookings (si pas déjà fait)
          // ✅ CORRIGÉ : Ne sélectionner que documents_generated (les colonnes legacy n'existent pas)
          !docsGenerated ? supabase
            .from('bookings')
            .select('documents_generated')
            .eq('id', booking.id) // ✅ UUID correct
            .single() : Promise.resolve({ data: null, error: null }),
          // Requête 4 : Edge function get-guest-documents-unified (fallback complet)
          supabase.functions.invoke('get-guest-documents-unified', {
            body: { bookingId: booking.id }
          }).catch(err => {
            console.warn('⚠️ [UNIFIED MODAL] Edge function error (non-bloquant):', err);
            return { data: null, error: err };
          }),
          // ✅ NOUVEAU : Requête 5 : guest_submissions (Meet Guest Info) - document_urls
          supabase
            .from('guest_submissions')
            .select('id, document_urls, guest_data, submitted_at')
            .eq('booking_id', booking.id) // ✅ UUID correct
            .order('submitted_at', { ascending: false })
            .limit(1)
        ]);

        clearTimeout(timeoutId);
        
        const elapsedTime = Date.now() - startTime;
        console.log(`⏱️ [UNIFIED MODAL] Requêtes terminées en ${elapsedTime}ms`);
        
        // ✅ Si le timeout avait été atteint, masquer le bouton maintenant que les données arrivent
        if (timeoutReached) {
          console.log('✅ [UNIFIED MODAL] Requêtes terminées après le timeout - Mise à jour des documents');
          setShowManualCheck(false);
        } else {
          setShowManualCheck(false);
        }
        
        console.log('✅ [UNIFIED MODAL] Toutes les requêtes terminées avec succès');

        // Traiter uploaded_documents
        let uploadedDocs: any[] = [];
        if (uploadedDocsResult.status === 'fulfilled' && !uploadedDocsResult.value.error) {
          uploadedDocs = uploadedDocsResult.value.data || [];
          console.log('📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents:', uploadedDocs.length);
        } else if (uploadedDocsResult.status === 'rejected') {
          console.error('❌ [UNIFIED MODAL] Erreur uploaded_documents:', uploadedDocsResult.reason);
        } else if (uploadedDocsResult.value.error) {
          console.error('❌ [UNIFIED MODAL] Erreur uploaded_documents:', uploadedDocsResult.value.error);
        }

        // ✅ NOUVEAU : Traiter generated_documents
        let generatedDocs: any[] = [];
        if (generatedDocsResult.status === 'fulfilled' && !generatedDocsResult.value.error) {
          generatedDocs = generatedDocsResult.value.data || [];
          console.log('📄 [UNIFIED MODAL] Documents trouvés dans generated_documents:', generatedDocs.length);
          
          // ✅ COMBINER : Ajouter generated_documents à uploadedDocs pour traitement unifié
          if (generatedDocs.length > 0) {
            uploadedDocs = [
              ...uploadedDocs,
              ...generatedDocs.map(doc => ({
                ...doc,
                file_path: doc.document_url, // ✅ Normaliser le format
                extracted_data: null
              }))
            ];
            console.log('✅ [UNIFIED MODAL] Documents combinés (uploaded + generated):', uploadedDocs.length);
          }
        } else if (generatedDocsResult.status === 'rejected') {
          console.warn('⚠️ [UNIFIED MODAL] Table generated_documents n\'existe peut-être pas:', generatedDocsResult.reason);
        } else if (generatedDocsResult.value?.error) {
          console.warn('⚠️ [UNIFIED MODAL] Erreur generated_documents (non-bloquant):', generatedDocsResult.value.error);
        }

        // Traiter documents_generated
        let bookingDocsGenerated: any = null;
        
        if (bookingDataResult.status === 'fulfilled' && !bookingDataResult.value.error) {
          const bookingData = bookingDataResult.value.data;
          bookingDocsGenerated = bookingData?.documents_generated || null;
          
          if (bookingDocsGenerated) {
            console.log('📄 [UNIFIED MODAL] documents_generated depuis DB:', bookingDocsGenerated);
          }
        }
        
        // ✅ STOCKER : Sauvegarder dans l'état pour l'affichage
        setBookingDocsGeneratedState(bookingDocsGenerated);

        // Traiter edge function get-guest-documents-unified
        let edgeFunctionDocs: any = null;
        if (edgeFunctionResult.status === 'fulfilled' && !edgeFunctionResult.value.error) {
          const edgeData = edgeFunctionResult.value.data;
          if (edgeData?.success && edgeData?.bookings && edgeData.bookings.length > 0) {
            edgeFunctionDocs = edgeData.bookings[0];
            console.log('📄 [UNIFIED MODAL] Documents depuis edge function:', {
              hasContract: edgeFunctionDocs?.documents?.contract?.length > 0,
              hasPolice: edgeFunctionDocs?.documents?.police?.length > 0,
              hasIdentity: edgeFunctionDocs?.documents?.identity?.length > 0
            });
          }
        } else if (edgeFunctionResult.status === 'rejected') {
          console.warn('⚠️ [UNIFIED MODAL] Edge function rejected:', edgeFunctionResult.reason);
        }

        // ✅ NOUVEAU : Traiter guest_submissions (Meet Guest Info) - document_urls
        let guestSubmissionsDocs: { contractUrl?: string; policeUrl?: string; identityUrls?: string[] } = {};
        if (guestSubmissionsResult.status === 'fulfilled' && !guestSubmissionsResult.value.error) {
          const submissions = guestSubmissionsResult.value.data || [];
          if (submissions.length > 0) {
            const submission = submissions[0];
            const documentUrls = submission.document_urls || [];
            
            console.log('📄 [UNIFIED MODAL] Documents depuis guest_submissions (Meet Guest Info):', {
              submissionId: submission.id,
              documentUrlsCount: documentUrls.length,
              documentUrls: documentUrls
            });
            
            // ✅ Extraire les URLs par type depuis document_urls
            // Les URLs peuvent être des strings simples ou des objets avec type
            documentUrls.forEach((urlOrObj: any, index: number) => {
              let url: string;
              let docType: string | null = null;
              
              if (typeof urlOrObj === 'string') {
                url = urlOrObj;
                // ✅ DÉTECTION INTELLIGENTE : Essayer de détecter le type depuis l'URL
                const urlLower = url.toLowerCase();
                if (urlLower.includes('contract') || urlLower.includes('contrat') || urlLower.includes('/contract/')) {
                  docType = 'contract';
                } else if (urlLower.includes('police') || urlLower.includes('fiche') || urlLower.includes('/police/')) {
                  docType = 'police';
                } else if (urlLower.includes('identity') || urlLower.includes('identite') || 
                          urlLower.includes('passport') || urlLower.includes('id') || 
                          urlLower.includes('/identity/') || urlLower.includes('/identities/')) {
                  docType = 'identity';
                }
              } else if (urlOrObj && typeof urlOrObj === 'object') {
                url = urlOrObj.url || urlOrObj.document_url || urlOrObj.documentUrl || '';
                docType = urlOrObj.type || urlOrObj.document_type || urlOrObj.documentType || null;
              } else {
                console.warn(`⚠️ [UNIFIED MODAL] Format invalide dans document_urls[${index}]:`, urlOrObj);
                return; // Skip invalid entries
              }
              
              if (!url) {
                console.warn(`⚠️ [UNIFIED MODAL] URL vide dans document_urls[${index}]`);
                return;
              }
              
              // ✅ VALIDATION : Vérifier que c'est une URL HTTP valide
              if (!url.startsWith('http') && !url.startsWith('https')) {
                console.warn(`⚠️ [UNIFIED MODAL] URL non-HTTP dans document_urls[${index}]:`, url.substring(0, 50));
                return; // Skip non-HTTP URLs
              }
              
              console.log(`📄 [UNIFIED MODAL] Document extrait de guest_submissions:`, {
                index,
                url: url.substring(0, 50) + '...',
                detectedType: docType || 'unknown'
              });
              
              // ✅ CATÉGORISATION : Catégoriser par type détecté
              if (docType === 'contract') {
                if (!guestSubmissionsDocs.contractUrl) {
                  guestSubmissionsDocs.contractUrl = url;
                }
              } else if (docType === 'police') {
                if (!guestSubmissionsDocs.policeUrl) {
                  guestSubmissionsDocs.policeUrl = url;
                }
              } else if (docType === 'identity') {
                if (!guestSubmissionsDocs.identityUrls) {
                  guestSubmissionsDocs.identityUrls = [];
                }
                guestSubmissionsDocs.identityUrls.push(url);
              } else {
                // ✅ FALLBACK : Si le type n'est pas détecté, essayer de le deviner depuis l'index ou l'ordre
                // Par défaut, on considère que les premiers documents sont des pièces d'identité
                // et on cherche contract/police dans les noms de fichiers
                const urlLower = url.toLowerCase();
                if (urlLower.includes('contract') || urlLower.includes('contrat')) {
                  if (!guestSubmissionsDocs.contractUrl) {
                    guestSubmissionsDocs.contractUrl = url;
                  }
                } else if (urlLower.includes('police') || urlLower.includes('fiche')) {
                  if (!guestSubmissionsDocs.policeUrl) {
                    guestSubmissionsDocs.policeUrl = url;
                  }
                } else {
                  // Par défaut, considérer comme pièce d'identité
                  if (!guestSubmissionsDocs.identityUrls) {
                    guestSubmissionsDocs.identityUrls = [];
                  }
                  guestSubmissionsDocs.identityUrls.push(url);
                }
              }
            });
            
            console.log('✅ [UNIFIED MODAL] Documents extraits de guest_submissions:', {
              hasContract: !!guestSubmissionsDocs.contractUrl,
              hasPolice: !!guestSubmissionsDocs.policeUrl,
              identityCount: guestSubmissionsDocs.identityUrls?.length || 0
            });
          }
        } else if (guestSubmissionsResult.status === 'rejected') {
          console.warn('⚠️ [UNIFIED MODAL] guest_submissions rejected:', guestSubmissionsResult.reason);
        } else if (guestSubmissionsResult.value?.error) {
          console.warn('⚠️ [UNIFIED MODAL] guest_submissions error:', guestSubmissionsResult.value.error);
        }

        // Utilitaire pour obtenir une URL exploitable (public ou signée)
        const resolveDocumentUrl = async (doc: any) => {
          if (doc?.document_url) {
            return doc.document_url;
          }
          
          if (doc?.file_path) {
            try {
              const { data: signed, error: signError } = await supabase.storage
                .from('guest-documents')
                .createSignedUrl(doc.file_path, 3600);
              
              if (signError) {
                console.error('❌ [RESOLVE URL] Erreur signature:', signError);
                return null;
              }
              
              return signed?.signedUrl || null;
            } catch (signError) {
              console.error('❌ [RESOLVE URL] Exception signature:', signError);
              return null;
            }
          }
          
          return null;
        };

        // ✅ PARALLÉLISATION : Résoudre toutes les URLs en parallèle
        const resolvePromises = [
          ...uploadedDocs.map(doc => resolveDocumentUrl(doc).then(url => ({ doc, url }))),
        ];
        
        const resolvedDocs = await Promise.allSettled(resolvePromises);
        const resolvedUrls = resolvedDocs
          .filter((r): r is PromiseFulfilledResult<{ doc: any; url: string | null }> => r.status === 'fulfilled')
          .map(r => r.value);

        // Extraire les documents par type
        const contractDoc = resolvedUrls.find(({ doc }) => doc.document_type === 'contract');
        const policeDoc = resolvedUrls.find(({ doc }) => doc.document_type === 'police');
        const identityDocs = resolvedUrls
          .filter(({ doc, url }) => ['identity', 'identity_upload', 'id-document', 'passport'].includes(doc.document_type) && url)
          .map(({ doc, url }) => {
            const guestName = (doc.extracted_data as any)?.guest_name || 
                            (doc.extracted_data as any)?.full_name || 
                            (doc.guests as any)?.full_name || 
                            'Invité';
            const documentNumber = (doc.extracted_data as any)?.document_number || 
                                  (doc.extracted_data as any)?.id_number || 
                                  (doc.guests as any)?.document_number || 
                                  undefined;
            
            return {
              id: doc.id,
              url: url!,
              guestName,
              documentNumber
            };
          });

        // ✅ PRIORITÉ : uploaded_documents > guest_submissions > edge function > documents_generated > legacy URLs > props directes
        const edgeContractUrl = edgeFunctionDocs?.documents?.contract?.[0]?.url || null;
        const edgePoliceUrl = edgeFunctionDocs?.documents?.police?.[0]?.url || null;
        const edgeIdentityDocs = edgeFunctionDocs?.documents?.identity?.map((doc: any, idx: number) => ({
          id: doc.id || `edge-identity-${idx}`,
          url: doc.url,
          guestName: doc.guestName || 'Invité',
          documentNumber: doc.documentNumber
        })) || [];

        // ✅ NOUVEAU : Ajouter les documents depuis guest_submissions (Meet Guest Info)
        const guestSubmissionsIdentityDocs = guestSubmissionsDocs.identityUrls?.map((url, idx) => ({
          id: `guest-submission-identity-${idx}`,
          url: url,
          guestName: 'Invité'
        })) || [];

        // ✅ PRIORITÉ : uploaded_documents > generated_documents > guest_submissions > edge function > documents_generated > legacy URLs > props directes
        // ✅ CORRECTION : Récupérer les URLs depuis documents_generated (contractUrl et policeUrl sont stockés directement)
        const contractUrlFromDocsGenerated = bookingDocsGenerated?.contractUrl || 
                                            docsGenerated?.contractUrl || 
                                            bookingDocsGenerated?.contract?.url || 
                                            docsGenerated?.contract?.url || null;
        const policeUrlFromDocsGenerated = bookingDocsGenerated?.policeUrl || 
                                          docsGenerated?.policeUrl || 
                                          bookingDocsGenerated?.police?.url || 
                                          docsGenerated?.police?.url ||
                                          bookingDocsGenerated?.policeForm?.url ||
                                          docsGenerated?.policeForm?.url || null;
        
        const finalContractUrl = contractDoc?.url || 
                                guestSubmissionsDocs.contractUrl || // ✅ NOUVEAU : Priorité guest_submissions
                                edgeContractUrl ||
                                contractUrlFromDocsGenerated || // ✅ CORRIGÉ : URLs depuis documents_generated
                                initialContractUrl || null;
        
        const finalPoliceUrl = policeDoc?.url || 
                              guestSubmissionsDocs.policeUrl || // ✅ NOUVEAU : Priorité guest_submissions
                              edgePoliceUrl ||
                              policeUrlFromDocsGenerated || // ✅ CORRIGÉ : URLs depuis documents_generated
                              initialPoliceUrl || null;
        
        // ✅ AMÉLIORATION : Récupérer aussi les pièces d'identité depuis documents_generated
        const identityUrlsFromDocsGenerated: string[] = [];
        if (bookingDocsGenerated?.identityUrl) {
          identityUrlsFromDocsGenerated.push(bookingDocsGenerated.identityUrl);
        }
        if (docsGenerated?.identityUrl) {
          identityUrlsFromDocsGenerated.push(docsGenerated.identityUrl);
        }
        // ✅ Support pour identity comme tableau d'URLs
        if (Array.isArray(bookingDocsGenerated?.identity)) {
          identityUrlsFromDocsGenerated.push(...bookingDocsGenerated.identity.filter((url: any) => typeof url === 'string'));
        }
        if (Array.isArray(docsGenerated?.identity)) {
          identityUrlsFromDocsGenerated.push(...docsGenerated.identity.filter((url: any) => typeof url === 'string'));
        }
        // ✅ Support pour identity comme objet avec url
        if (bookingDocsGenerated?.identity?.url) {
          identityUrlsFromDocsGenerated.push(bookingDocsGenerated.identity.url);
        }
        if (docsGenerated?.identity?.url) {
          identityUrlsFromDocsGenerated.push(docsGenerated.identity.url);
        }
        
        const identityDocsFromDocsGenerated = identityUrlsFromDocsGenerated.map((url, idx) => ({
          id: `docs-generated-identity-${idx}`,
          url: url,
          guestName: 'Invité'
        }));
        
        // ✅ COMBINER : Toutes les sources de pièces d'identité avec priorité
        const allIdentityDocs = [
          ...identityDocs, // uploaded_documents + generated_documents (priorité 1)
          ...guestSubmissionsIdentityDocs, // guest_submissions (priorité 2)
          ...edgeIdentityDocs, // edge function (priorité 3)
          ...identityDocsFromDocsGenerated, // documents_generated (priorité 4)
          ...(directIdentityUrl ? [{ 
            id: 'direct-identity', 
            url: directIdentityUrl,
            guestName: 'Invité'
          }] : []) // props directes (priorité 5)
        ];
        
        // ✅ DÉDUPLIQUER : Éviter les doublons basés sur l'URL
        const uniqueIdentityDocs = allIdentityDocs.reduce((acc, doc) => {
          if (!acc.find(d => d.url === doc.url)) {
            acc.push(doc);
          }
          return acc;
        }, [] as typeof allIdentityDocs);
        
        const finalIdentityDocs = uniqueIdentityDocs;

        // ✅ DÉTECTION : Vérifier si documents_generated indique que les documents sont générés
        // ✅ AMÉLIORATION : Vérifier aussi contractUrl et policeUrl directement dans documents_generated
        const hasContractGenerated = docsGenerated?.contract === true || 
                                    bookingDocsGenerated?.contract === true || 
                                    !!docsGenerated?.contractUrl ||
                                    !!bookingDocsGenerated?.contractUrl ||
                                    (typeof docsGenerated?.contract === 'object' && docsGenerated?.contract !== null) ||
                                    (typeof bookingDocsGenerated?.contract === 'object' && bookingDocsGenerated?.contract !== null);
        const hasPoliceGenerated = docsGenerated?.police === true || 
                                  bookingDocsGenerated?.police === true ||
                                  docsGenerated?.policeForm === true ||
                                  bookingDocsGenerated?.policeForm === true ||
                                  !!docsGenerated?.policeUrl ||
                                  !!bookingDocsGenerated?.policeUrl ||
                                  (typeof docsGenerated?.police === 'object' && docsGenerated?.police !== null) ||
                                  (typeof bookingDocsGenerated?.police === 'object' && bookingDocsGenerated?.police !== null);

        console.log('✅ [UNIFIED MODAL] Documents finaux:', {
          contractUrl: !!finalContractUrl,
          policeUrl: !!finalPoliceUrl,
          identityCount: finalIdentityDocs.length,
          hasContractGenerated,
          hasPoliceGenerated,
          uploadedDocsCount: uploadedDocs.length,
          generatedDocsCount: generatedDocs.length,
          edgeFunctionDocs: !!edgeFunctionDocs,
          guestSubmissionsDocs: {
            hasContract: !!guestSubmissionsDocs.contractUrl,
            hasPolice: !!guestSubmissionsDocs.policeUrl,
            identityCount: guestSubmissionsDocs.identityUrls?.length || 0
          },
          identitySources: {
            fromUploadedDocs: identityDocs.length,
            fromGuestSubmissions: guestSubmissionsIdentityDocs.length,
            fromEdgeFunction: edgeIdentityDocs.length,
            fromDocsGenerated: identityDocsFromDocsGenerated.length,
            fromDirect: directIdentityUrl ? 1 : 0,
            totalUnique: finalIdentityDocs.length
          },
          sources: {
            fromUploadedDocs: !!contractDoc?.url || !!policeDoc?.url,
            fromGuestSubmissions: !!guestSubmissionsDocs.contractUrl || !!guestSubmissionsDocs.policeUrl,
            fromEdgeFunction: !!edgeContractUrl || !!edgePoliceUrl,
            fromInitial: !!initialContractUrl || !!initialPoliceUrl,
            fromDocsGenerated: !!(bookingDocsGenerated?.contractUrl || bookingDocsGenerated?.policeUrl)
          }
        });
        
        // ✅ DIAGNOSTIC : Log détaillé si aucun document n'est trouvé
        if (!finalContractUrl && !finalPoliceUrl && finalIdentityDocs.length === 0) {
          console.warn('⚠️ [UNIFIED MODAL] AUCUN DOCUMENT TROUVÉ - Diagnostic:', {
            bookingId: booking.id,
            uploadedDocs: uploadedDocs.length,
            generatedDocs: generatedDocs.length,
            edgeFunctionSuccess: !!edgeFunctionDocs,
            guestSubmissionsCount: guestSubmissionsResult.status === 'fulfilled' ? (guestSubmissionsResult.value.data?.length || 0) : 0,
            docsGenerated: bookingDocsGenerated,
            initialUrls: {
              contract: !!initialContractUrl,
              police: !!initialPoliceUrl,
              identity: !!directIdentityUrl
            },
            identitySources: {
              fromUploadedDocs: identityDocs.length,
              fromGuestSubmissions: guestSubmissionsIdentityDocs.length,
              fromEdgeFunction: edgeIdentityDocs.length,
              fromDocsGenerated: identityDocsFromDocsGenerated.length,
              fromDirect: directIdentityUrl ? 1 : 0
            }
          });
        }
        
        // ✅ DIAGNOSTIC SPÉCIFIQUE : Log si aucune pièce d'identité n'est trouvée
        if (finalIdentityDocs.length === 0) {
          console.warn('⚠️ [UNIFIED MODAL] AUCUNE PIÈCE D\'IDENTITÉ TROUVÉE - Diagnostic:', {
            bookingId: booking.id,
            uploadedDocsIdentity: uploadedDocs.filter(d => ['identity', 'identity_upload', 'id-document', 'passport'].includes(d.document_type)).length,
            generatedDocsIdentity: generatedDocs.filter(d => d.document_type === 'identity').length,
            guestSubmissionsIdentityUrls: guestSubmissionsDocs.identityUrls?.length || 0,
            edgeFunctionIdentity: edgeIdentityDocs.length,
            docsGeneratedIdentity: {
              identityUrl: !!bookingDocsGenerated?.identityUrl || !!docsGenerated?.identityUrl,
              identityArray: Array.isArray(bookingDocsGenerated?.identity) || Array.isArray(docsGenerated?.identity),
              identityObject: !!(bookingDocsGenerated?.identity?.url) || !!(docsGenerated?.identity?.url)
            },
            directIdentityUrl: !!directIdentityUrl
          });
        }

        // ✅ STOCKAGE : Stocker aussi les indicateurs de génération pour l'affichage
        const documentsToSet = {
          contractUrl: finalContractUrl,
          contractId: contractDoc?.doc?.id || null,
          policeUrl: finalPoliceUrl,
          policeId: policeDoc?.doc?.id || null,
          identityDocuments: finalIdentityDocs,
          loading: false,
          // ✅ NOUVEAU : Stocker les indicateurs de génération dans l'état (via extension)
          ...(hasContractGenerated && !finalContractUrl ? { contractGenerated: true } : {}),
          ...(hasPoliceGenerated && !finalPoliceUrl ? { policeGenerated: true } : {})
        } as any;
        
        console.log('💾 [UNIFIED MODAL] Mise à jour de l\'état documents:', {
          contractUrl: !!documentsToSet.contractUrl,
          policeUrl: !!documentsToSet.policeUrl,
          identityCount: documentsToSet.identityDocuments.length,
          loading: documentsToSet.loading
        });
        
        setDocuments(documentsToSet);
        
        // ✅ Vérifier si la réservation a des données clients suffisantes
        const hasIdentityDocuments = finalIdentityDocs.length > 0;
        const bookingTyped = booking as Booking;
        const hasCompleteGuests = bookingTyped?.guests && bookingTyped.guests.length > 0 && 
          bookingTyped.guests.some(guest => 
            guest.fullName && 
            guest.documentNumber && 
            guest.nationality
          );
        
        // ✅ AMÉLIORATION : hasGuestData doit être true si :
        // 1. Il y a des pièces d'identité
        // 2. OU il y a des guests complets
        // 3. OU il y a des documents générés (même sans URL, cela signifie que les données existent)
        const hasGuestDataValue = hasIdentityDocuments || 
                                 hasCompleteGuests || 
                                 hasContractGenerated || 
                                 hasPoliceGenerated ||
                                 (bookingTyped?.guest_name && bookingTyped.guest_name.trim().length > 0) ||
                                 false;
        
        console.log('📊 [UNIFIED MODAL] État hasGuestData:', {
          hasIdentityDocuments,
          hasCompleteGuests,
          hasContractGenerated,
          hasPoliceGenerated,
          hasGuestName: !!(bookingTyped?.guest_name && bookingTyped.guest_name.trim().length > 0),
          finalValue: hasGuestDataValue
        });
        
        setHasGuestData(hasGuestDataValue);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Erreur lors du chargement des documents:', error);
        
        // ✅ AMÉLIORATION : Ne pas arrêter complètement - utiliser les données déjà chargées
        // Si on a déjà des documents depuis les props ou documents_generated, les garder
        const currentDocs = documents;
        if (currentDocs.contractUrl || currentDocs.policeUrl || currentDocs.identityDocuments.length > 0) {
          console.log('✅ [UNIFIED MODAL] Conservation des documents déjà chargés malgré l\'erreur');
          setDocuments(prev => ({ ...prev, loading: false }));
        } else {
          setDocuments(prev => ({ ...prev, loading: false }));
          setShowManualCheck(true);
        }
        setHasGuestData(false);
      }
    };

    loadDocuments();
  }, [rawStatus, isAirbnb, booking?.id]);

  // ✅ GÉNÉRATION DU CONTRAT (copié depuis BookingCard)
  const handleGenerateContract = async () => {
    if (!booking || isAirbnb) return;
    
    setIsGeneratingContract(true);
    try {
      const bookingTyped = booking as Booking;
      const result = await ContractService.generateAndDownloadContract(bookingTyped, { locale: contractLocale });
      
      if (result.success) {
        toast({
          title: "Contrat généré",
          description: result.message,
        });
        
        // Recharger les documents
        const { data: uploadedDocs } = await supabase
          .from('uploaded_documents')
          .select('document_url, document_type, id')
          .eq('booking_id', bookingTyped.id)
          .eq('document_type', 'contract')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (uploadedDocs && uploadedDocs.length > 0) {
          setDocuments(prev => ({
            ...prev,
            contractUrl: uploadedDocs[0].document_url,
            contractId: uploadedDocs[0].id
          }));
        }
        
        // Rafraîchir les réservations
        await refreshBookings();
      } else {
        toast({
          title: "Erreur",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Erreur génération contrat:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer le contrat",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingContract(false);
    }
  };

  // ✅ GÉNÉRATION DE LA FICHE DE POLICE (copié depuis BookingCard)
  const handleGeneratePolice = async () => {
    if (!booking || isAirbnb) return;
    
    setIsGeneratingPolice(true);
    try {
      const bookingTyped = booking as Booking;
      console.log('📄 [UNIFIED MODAL] Génération de la fiche de police pour booking:', bookingTyped.id);
      
      await UnifiedDocumentService.downloadPoliceFormsForAllGuests(bookingTyped);
      
      console.log('✅ [UNIFIED MODAL] Fiche de police générée avec succès');
      
      toast({
        title: "Fiches police générées",
        description: `${bookingTyped.guests?.length || 1} fiche(s) police téléchargée(s) et sauvegardée(s)`,
      });
      
      // Attendre un peu pour que la base de données soit à jour
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Recharger les documents
      const { data: uploadedDocs } = await supabase
        .from('uploaded_documents')
        .select('document_url, document_type, id')
        .eq('booking_id', bookingTyped.id)
        .eq('document_type', 'police')
        .order('created_at', { ascending: false })
        .limit(1);
      
      console.log('📄 [UNIFIED MODAL] Fiche de police rechargée depuis BD:', uploadedDocs);
      
      if (uploadedDocs && uploadedDocs.length > 0) {
        setDocuments(prev => ({
          ...prev,
          policeUrl: uploadedDocs[0].document_url,
          policeId: uploadedDocs[0].id
        }));
      }
      
      // Rafraîchir les réservations
      await refreshBookings();
    } catch (error: any) {
      console.error('❌ Erreur génération fiche police:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer les fiches de police",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPolice(false);
    }
  };

  // ✅ SUPPRESSION DE RÉSERVATION
  const handleDeleteBooking = async () => {
    // ✅ PROTECTION : Empêcher la suppression des réservations Airbnb et ICS
    if (!booking || isAirbnb || !('id' in booking)) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer cette réservation",
        variant: "destructive"
      });
      return;
    }
    
    // ✅ PROTECTION : Empêcher la suppression des réservations issues de fichiers ICS
    if (isICSReservation) {
      toast({
        title: "Suppression impossible",
        description: "Cette réservation provient d'un fichier ICS Airbnb et ne peut pas être supprimée manuellement. Elle sera synchronisée automatiquement.",
        variant: "destructive"
      });
      return;
    }

    console.log('🗑️ [UNIFIED MODAL] Suppression de la réservation:', booking.id);
    setIsDeleting(true);
    try {
      await deleteBooking(booking.id);
      console.log('✅ [UNIFIED MODAL] Réservation supprimée de la base de données');
      
      // ✅ AMÉLIORATION : Le rafraîchissement est maintenant automatique via :
      // 1. Mise à jour optimiste immédiate dans deleteBooking()
      // 2. Subscription en temps réel qui va confirmer le changement
      // Plus besoin d'appeler refreshBookings() manuellement
      
      toast({
        title: "Réservation supprimée",
        description: "La réservation a été supprimée avec succès",
      });
      
      setShowDeleteDialog(false);
      
      // Fermer le modal immédiatement (la réservation disparaît déjà de l'UI)
      onClose();
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la réservation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la réservation",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ✅ RETURN CONDITIONNEL : Après tous les hooks
  if (!booking) {
    return null;
  }

  const hasAllRequiredDocuments = documents.contractUrl && documents.policeUrl && documents.identityDocuments.length > 0;

  // Effective status: downgrade 'completed' to 'confirmed' when documents are missing.
  // A booking should only show "Terminé" if it truly has all required documents.
  const status = (() => {
    if (rawStatus === 'completed' && !documents.loading && !hasAllRequiredDocuments) {
      return 'confirmed';
    }
    return rawStatus;
  })();

  const handleClose = (open: boolean) => {
    if (!open) onClose();
  };
  
  // ✅ CORRIGÉ : Fonction pour générer les documents manquants individuellement
  const handleGenerateMissingDocuments = async () => {
    setIsGeneratingMissingDocs(true);
    try {
      const missingDocs: string[] = [];
      if (!documents.contractUrl) missingDocs.push('contract');
      if (!documents.policeUrl) missingDocs.push('police');
      
      if (missingDocs.length === 0) {
        toast({
          title: "Aucun document à générer",
          description: "Tous les documents sont déjà présents.",
        });
        setIsGeneratingMissingDocs(false);
        return;
      }
      
      console.log('📄 Génération des documents manquants:', missingDocs);
      
      // ✅ Générer le contrat si manquant
      if (missingDocs.includes('contract')) {
        try {
          await handleGenerateContract();
        } catch (error) {
          console.error('❌ Erreur génération contrat:', error);
        }
      }
      
      // ✅ Générer la fiche de police si manquante
      if (missingDocs.includes('police')) {
        try {
          await handleGeneratePolice();
        } catch (error) {
          console.error('❌ Erreur génération police:', error);
        }
      }
      
      toast({
        title: "Documents générés",
        description: `Les documents manquants (${missingDocs.join(', ')}) ont été générés avec succès.`,
      });
      
      // ✅ Rafraîchir les documents
      await refreshBookings();
      
    } catch (error: any) {
      console.error('❌ Erreur lors de la génération des documents manquants:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer les documents manquants",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingMissingDocs(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        isMobile 
          ? "max-w-full w-full min-h-screen m-0 rounded-none px-3 py-4 pb-safe" 
          : "max-w-4xl w-[95vw] sm:w-full"
      )}>
        <DialogHeader className={cn(isMobile ? "px-1 py-2" : "")}>
          <div className={cn(
            "flex items-center justify-between gap-2",
            isMobile ? "flex-wrap" : ""
          )}>
            <DialogTitle className={cn(
              "flex items-center gap-2",
              isMobile ? "text-lg" : ""
            )}>
              <div className="w-3 h-3 rounded-full" style={{
                backgroundColor: status === 'completed' ? '#10b981' : 
                                status === 'pending' ? BOOKING_COLORS.pending.hex : 
                                BOOKING_COLORS.completed.hex
              }}></div>
              {getTitle()}
              {getStatusBadge()}
            </DialogTitle>
            <div className={cn(
              "flex items-center gap-2",
              isMobile ? "w-full justify-end" : ""
            )}>
              {/* ✅ BOUTON SUPPRESSION : Uniquement pour les réservations non-Airbnb et non-ICS */}
              {!isAirbnb && !isICSReservation && 'id' in booking && (
                <Button 
                  variant="ghost" 
                  size={isMobile ? "sm" : "icon"}
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Supprimer la réservation"
                >
                  <Trash2 className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
                  {isMobile && <span className="ml-1 text-xs">Supprimer</span>}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size={isMobile ? "sm" : "icon"} 
                onClick={onClose}
                className={isMobile ? "w-full sm:w-auto" : ""}
              >
                <X className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
                {isMobile && <span className="ml-1 text-xs">Fermer</span>}
              </Button>
            </div>
          </div>
          <DialogDescription className={cn(isMobile ? "text-xs" : "")}>
            Détails et actions pour la réservation du {formatDate(checkIn)} au {formatDate(checkOut)}
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          isMobile ? "space-y-3 px-1" : "space-y-6"
        )}>
          {/* ✅ UNIFIÉ : Section Référence */}
          <Card>
            <CardHeader className={cn(isMobile ? "p-3 pb-2" : "")}>
              <CardTitle className={cn(isMobile ? "text-base" : "text-lg")}>{t('booking.reference')}</CardTitle>
            </CardHeader>
            <CardContent className={cn(
              isMobile ? "p-3 pt-0 space-y-2" : "space-y-4"
            )}>
              <div>
                <p className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>{isAirbnb ? t('booking.reservationCodeAirbnb') : t('booking.reservationCode')}</p>
                <p className={cn(
                  "font-mono break-all",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  {getReservationCode()}
                </p>
              </div>

              <div className={cn(
                "grid gap-3 sm:gap-4",
                isMobile ? "grid-cols-1" : "grid-cols-2"
              )}>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('booking.arrival')}</p>
                    <p className="text-muted-foreground">{formatDate(checkIn)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('booking.departure')}</p>
                    <p className="text-muted-foreground">{formatDate(checkOut)}</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <span className="text-lg sm:text-2xl font-bold">{t('booking.nights', { count: calculateNights() })}</span>
              </div>
            </CardContent>
          </Card>

          {/* ✅ SUPPRIMÉ : Section dupliquée - Fusionnée avec "Documents enregistrés" ci-dessous */}

          {/* ✅ DOCUMENTS : Section pour les réservations terminées ET pending avec données clients */}
          {/* ✅ CORRIGÉ : Afficher les boutons "Générer" uniquement si :
              - La réservation est terminée (completed) OU
              - La réservation est en attente (pending) ET a des données clients (guests complets OU pièces d'identité) */}
          {(status === 'completed' || status === 'confirmed' || (status === 'pending' && hasGuestData)) && !isAirbnb && (
            <Card>
              <CardHeader className={cn(isMobile ? "p-3 pb-2" : "")}>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  <FileText className={cn(
                    "text-brand-teal",
                    isMobile ? "w-4 h-4" : "w-5 h-5"
                  )} />
                  Documents enregistrés
                </CardTitle>
              </CardHeader>
              <CardContent className={cn(
                isMobile ? "p-3 pt-0 space-y-2" : "space-y-4"
              )}>
                {/* ✅ NOUVEAU : Afficher un avertissement si documents manquants pour réservation completed */}
                {(status === 'confirmed' || (rawStatus === 'completed' && !hasAllRequiredDocuments)) && !documents.loading && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <p className="font-semibold text-amber-900">Documents manquants</p>
                    </div>
                    <p className="text-sm text-amber-700">
                      Cette réservation ne contient pas tous les documents requis (ID, Contrat, Police). Générez-les pour finaliser le dossier.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-amber-700">
                      {!documents.contractUrl && <span className="px-2 py-1 bg-amber-100 rounded">❌ Contrat manquant</span>}
                      {!documents.policeUrl && <span className="px-2 py-1 bg-amber-100 rounded">❌ Police manquante</span>}
                      {documents.identityDocuments.length === 0 && <span className="px-2 py-1 bg-amber-100 rounded">❌ ID manquant</span>}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleGenerateMissingDocuments}
                      disabled={isGeneratingMissingDocs}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {isGeneratingMissingDocs ? (
                        <>
                          <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Générer les documents manquants
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {documents.loading && !showManualCheck ? (
                  <div className="flex items-center justify-center py-4">
                    <span className="w-4 h-4 border-2 border-brand-teal border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    <span className="text-sm text-muted-foreground">Chargement des documents...</span>
                  </div>
                ) : showManualCheck ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Le chargement prend plus de temps que prévu.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setShowManualCheck(false);
                        setDocuments(prev => ({ ...prev, loading: true }));
                        // Recharger les documents
                        const { data: uploadedDocs } = await supabase
                          .from('uploaded_documents')
                          .select('id, document_url, file_path, document_type, is_signed, extracted_data, guests(full_name, document_number)')
                          .eq('booking_id', booking?.id)
                          .in('document_type', ['contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport'])
                          .order('created_at', { ascending: false });
                        
                        if (uploadedDocs && uploadedDocs.length > 0) {
                          // Traiter les documents trouvés
                          const contractDoc = uploadedDocs.find(doc => doc.document_type === 'contract');
                          const policeDoc = uploadedDocs.find(doc => doc.document_type === 'police');
                          setDocuments(prev => ({
                            ...prev,
                            contractUrl: contractDoc?.document_url || prev.contractUrl,
                            contractId: contractDoc?.id || prev.contractId,
                            policeUrl: policeDoc?.document_url || prev.policeUrl,
                            policeId: policeDoc?.id || prev.policeId,
                            loading: false
                          }));
                        } else {
                          setDocuments(prev => ({ ...prev, loading: false }));
                        }
                      }}
                      className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Vérification manuelle
                    </Button>
                  </div>
                ) : (
                  <>
                {/* Contrat */}
                <div className={cn(
                  "bg-gray-50 rounded-lg border border-gray-200",
                  isMobile ? "p-3" : "p-4",
                  "flex",
                  isMobile ? "flex-col gap-3" : "items-center justify-between"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "rounded-lg bg-brand-teal/10 flex items-center justify-center flex-shrink-0",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )}>
                      <FileText className={cn(
                        "text-brand-teal",
                        isMobile ? "w-4 h-4" : "w-5 h-5"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-semibold text-gray-900",
                            isMobile ? "text-sm" : ""
                          )}>Contrat {status === 'completed' ? 'signé' : ''}</p>
                          <p className={cn(
                            "text-gray-600",
                            isMobile ? "text-xs" : "text-sm"
                          )}>Document contractuel {status === 'completed' ? 'signé' : 'à signer physiquement'}</p>
                    </div>
                  </div>
                  {/* ✅ DIAGNOSTIC : Log pour comprendre pourquoi les documents ne s'affichent pas */}
                  {(() => {
                    console.log('🔍 [UNIFIED MODAL] État d\'affichage contrat:', {
                      hasContractUrl: !!documents.contractUrl,
                      hasGuestData,
                      status,
                      contractUrl: documents.contractUrl ? documents.contractUrl.substring(0, 50) + '...' : null,
                      docsGeneratedState: docsGeneratedState,
                      bookingDocsGeneratedState: bookingDocsGeneratedState,
                      canGenerate: hasGuestData || (docsGeneratedState?.contract === true) || (bookingDocsGeneratedState?.contract === true)
                    });
                    return null;
                  })()}
                  {documents.contractUrl ? (
                    <div className={cn(
                      "flex flex-wrap items-center gap-2",
                      isMobile ? "w-full justify-end" : ""
                    )}>
                      <select
                        value={contractLocale}
                        onChange={(e) => setContractLocale(e.target.value as 'fr' | 'en' | 'es')}
                        aria-label={t('contract.language.label')}
                        className={cn(
                          "h-10 rounded-md border-2 border-brand-teal/30 bg-background px-3 py-2 text-sm w-[130px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-teal/50",
                          isMobile && "flex-1 min-w-0"
                        )}
                      >
                        <option value="fr">{t('contract.language.fr')}</option>
                        <option value="en">{t('contract.language.en')}</option>
                        <option value="es">{t('contract.language.es')}</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isOpeningContractView}
                        onClick={async () => {
                          const bookingId = (booking as any)?.id;
                          if (!bookingId) return;
                          setIsOpeningContractView(true);
                          try {
                            const url = await getContractPdfUrl({
                              supabase,
                              bookingId,
                              isPreview: false,
                              locale: contractLocale,
                            });
                            if (url.startsWith('data:application/pdf')) {
                              const w = window.open('', '_blank');
                              if (w) w.document.write(`<iframe title="Contrat" src="${url}" style="width:100%;height:100%;border:0" />`);
                            } else {
                              window.open(url, '_blank');
                            }
                          } catch (err: any) {
                            toast({ title: 'Erreur', description: err?.message || 'Impossible d\'ouvrir le contrat', variant: 'destructive' });
                          } finally {
                            setIsOpeningContractView(false);
                          }
                        }}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "flex-1"
                        )}
                      >
                        {isOpeningContractView ? (
                          <>
                            <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            Ouverture...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Voir
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const bookingTyped = booking as Booking;
                          const result = await ContractService.generateAndDownloadContract(bookingTyped, { locale: contractLocale });
                          if (result.success) toast({ title: 'Contrat téléchargé', description: result.message });
                          else toast({ title: 'Erreur', description: result.message, variant: 'destructive' });
                        }}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "flex-1"
                        )}
                      >
                        Télécharger
                      </Button>
                    </div>
                  ) : (hasGuestData || (docsGeneratedState?.contract === true) || (bookingDocsGeneratedState?.contract === true)) ? (
                    <div className={cn("flex flex-wrap items-center gap-2", isMobile && "w-full justify-end")}>
                      <select
                        value={contractLocale}
                        onChange={(e) => setContractLocale(e.target.value as 'fr' | 'en' | 'es')}
                        aria-label={t('contract.language.label')}
                        className={cn(
                          "h-10 rounded-md border-2 border-brand-teal/30 bg-background px-3 py-2 text-sm w-[130px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-teal/50",
                          isMobile && "flex-1 min-w-0"
                        )}
                      >
                        <option value="fr">{t('contract.language.fr')}</option>
                        <option value="en">{t('contract.language.en')}</option>
                        <option value="es">{t('contract.language.es')}</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateContract}
                        disabled={isGeneratingContract}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "flex-1 sm:flex-initial"
                        )}
                      >
                        {isGeneratingContract ? (
                          <>
                            <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Générer
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className={cn(isMobile && "w-full text-right")}>
                      <span className="text-sm text-gray-400">En attente des informations clients</span>
                    </div>
                  )}
                </div>

                {/* Police */}
                <div className={cn(
                  "bg-gray-50 rounded-lg border border-gray-200",
                  isMobile ? "p-3" : "p-4",
                  "flex",
                  isMobile ? "flex-col gap-3" : "items-center justify-between"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "rounded-lg bg-brand-teal/10 flex items-center justify-center flex-shrink-0",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )}>
                      <Shield className={cn(
                        "text-brand-teal",
                        isMobile ? "w-4 h-4" : "w-5 h-5"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-semibold text-gray-900",
                        isMobile ? "text-sm" : ""
                      )}>Fiche de police</p>
                      <p className={cn(
                        "text-gray-600",
                        isMobile ? "text-xs" : "text-sm"
                      )}>Formulaire de déclaration de police</p>
                    </div>
                  </div>
                  {/* ✅ DIAGNOSTIC : Log pour comprendre pourquoi les documents ne s'affichent pas */}
                  {(() => {
                    console.log('🔍 [UNIFIED MODAL] État d\'affichage police:', {
                      hasPoliceUrl: !!documents.policeUrl,
                      hasGuestData,
                      status,
                      policeUrl: documents.policeUrl ? documents.policeUrl.substring(0, 50) + '...' : null
                    });
                    return null;
                  })()}
                  {documents.policeUrl ? (
                    <div className={cn(
                      "flex gap-2",
                      isMobile ? "w-full justify-end" : ""
                    )}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(documents.policeUrl!, '_blank')}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "flex-1"
                        )}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Voir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = documents.policeUrl!;
                          link.download = `police-${getReservationCode()}.pdf`;
                          link.click();
                        }}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "flex-1"
                        )}
                      >
                        Télécharger
                      </Button>
                    </div>
                  ) : (hasGuestData || (docsGeneratedState?.police === true) || (bookingDocsGeneratedState?.police === true)) ? (
                    <div className={cn(isMobile && "w-full flex justify-end")}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGeneratePolice}
                        disabled={isGeneratingPolice}
                        className={cn(
                          "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                          isMobile && "w-full sm:w-auto"
                        )}
                      >
                        {isGeneratingPolice ? (
                          <>
                            <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Générer
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className={cn(isMobile && "w-full text-right")}>
                      <span className="text-sm text-gray-400">En attente des informations clients</span>
                    </div>
                  )}
                </div>

                    {/* Pièces d'identité */}
                    {documents.identityDocuments.length > 0 && (
                      <>
                        {documents.identityDocuments.map((identityDoc, index) => (
                          <div key={index} className={cn(
                            "bg-gray-50 rounded-lg border border-gray-200",
                            isMobile ? "p-3" : "p-4",
                            "flex",
                            isMobile ? "flex-col gap-3" : "items-center justify-between"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "rounded-lg bg-brand-teal/10 flex items-center justify-center flex-shrink-0",
                                isMobile ? "w-8 h-8" : "w-10 h-10"
                              )}>
                                <CreditCard className={cn(
                                  "text-brand-teal",
                                  isMobile ? "w-4 h-4" : "w-5 h-5"
                                )} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-semibold text-gray-900",
                                  isMobile ? "text-sm" : ""
                                )}>
                                  Pièce d'identité {documents.identityDocuments.length > 1 ? `#${index + 1}` : ''}
                                </p>
                                <p className={cn(
                                  "text-gray-600",
                                  isMobile ? "text-xs" : "text-sm"
                                )}>
                                  {identityDoc.guestName || 'Invité'}
                                  {identityDoc.documentNumber && ` • ${identityDoc.documentNumber}`}
                                </p>
                              </div>
                            </div>
                            {identityDoc.url ? (
                              <div className={cn(
                                "flex gap-2",
                                isMobile ? "w-full justify-end" : ""
                              )}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(identityDoc.url, '_blank')}
                                  className={cn(
                                    "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                                    isMobile && "flex-1"
                                  )}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Voir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = identityDoc.url;
                                    link.download = `piece-identite-${identityDoc.guestName?.replace(/\s+/g, '-') || 'invite'}-${index + 1}.pdf`;
                                    link.click();
                                  }}
                                  className={cn(
                                    "border-2 border-brand-teal/30 hover:border-brand-teal/50",
                                    isMobile && "flex-1"
                                  )}
                                >
                                  Télécharger
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Non disponible</span>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ✅ UNIFIÉ : Section Actions - Bouton bleu (uniquement pour les réservations non terminées) */}
          {propertyId && status !== 'completed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('booking.actions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={(e) => handleGenerateGuestLink(e)} 
                  disabled={isGeneratingLocal || isGeneratingLink} 
                  className="w-full flex items-center justify-center bg-brand-1 hover:bg-brand-1/90 text-white"
                >
                  <span className="flex items-center">
                    {isGeneratingLocal || isGeneratingLink ? (
                      <>
                        <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        <span>{t('booking.generating')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        <span>{t('booking.copyLink')}</span>
                      </>
                    )}
                  </span>
                </Button>
                
                <p className="text-xs text-muted-foreground mt-2">
                  {cachedGuestLinkUrl
                    ? t('booking.copyLinkDescriptionReady')
                    : isMobile
                      ? t('booking.copyLinkDescriptionMobile')
                      : t('booking.copyLinkDescriptionGenerate')
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>

      {/* ✅ DIALOGUE DE CONFIRMATION DE SUPPRESSION */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('booking.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('booking.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('booking.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('booking.deleting') : t('booking.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ NOUVEAU : Modal de partage pour mobile */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={shareModalUrl}
        propertyName={propertyName}
        guestName={displayName || undefined}
        checkIn={formatDate(checkIn)}
        checkOut={formatDate(checkOut)}
      />
    </Dialog>
  );
};

