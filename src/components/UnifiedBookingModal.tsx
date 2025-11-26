/**
 * ✅ UNIFIÉ : Modal unifié pour toutes les réservations (Booking et Airbnb)
 * Basé sur AirbnbReservationModal (structure bleue) - le plus fonctionnel
 * Route: Utilisé par CalendarView pour afficher les détails de réservation
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, X, Copy, FileText, Shield, CreditCard, Trash2 } from 'lucide-react';
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
import { ContractService } from '@/services/contractService';

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
  const [hasGuestData, setHasGuestData] = useState(false); // ✅ NOUVEAU : Vérifier si la réservation a des données clients

  // ✅ DÉTECTION : Identifier le type de réservation (avant le useEffect)
  const isAirbnb = booking ? ('source' in booking && booking.source === 'airbnb') : false;
  const isEnriched = booking ? ('hasRealSubmissions' in booking) : false;
  
  // ✅ NOUVEAU : Détecter si c'est une réservation issue d'un fichier ICS (non supprimable)
  // Une réservation ICS est identifiée par :
  // - Status 'pending'
  // - booking_reference existe et n'est pas 'INDEPENDENT_BOOKING' (code Airbnb)
  // - Pas de guests complets (pas de full_name, document_number, nationality pour tous les guests)
  const bookingTyped = booking as Booking;
  const hasCompleteGuestsForICS = bookingTyped?.guests && bookingTyped.guests.length > 0 && 
    bookingTyped.guests.every(guest => 
      guest.fullName && 
      guest.documentNumber && 
      guest.nationality
    );
  const isICSReservation = !isAirbnb && 
    bookingTyped && 
    status === 'pending' && 
    bookingTyped.bookingReference && 
    bookingTyped.bookingReference !== 'INDEPENDENT_BOOKING' &&
    !hasCompleteGuestsForICS; // Pas de guests complets = réservation ICS non complétée
  
  // ✅ EXTRACTION : Données unifiées pour tous les types (avec vérification null)
  const bookingCode = booking 
    ? (isAirbnb 
        ? (booking as AirbnbReservation).airbnbBookingId 
        : (booking as Booking).bookingReference || (booking as Booking).id.slice(-12).toUpperCase())
    : '';
  
  const checkIn = booking
    ? (isAirbnb
        ? (booking as AirbnbReservation).startDate
        : new Date((booking as Booking).checkInDate))
    : new Date();
  
  const checkOut = booking
    ? (isAirbnb
        ? (booking as AirbnbReservation).endDate
        : new Date((booking as Booking).checkOutDate))
    : new Date();

  const status = booking
    ? (isAirbnb 
        ? 'pending' 
        : (booking as Booking).status || 'pending')
    : 'pending';

  // ✅ PROPERTY ID : Priorité propertyId > booking.propertyId > booking.property?.id
  const propertyId = propPropertyId || 
    (booking ? ((booking as Booking).propertyId || 
    (booking as EnrichedBooking).property?.id) : undefined);

  // ✅ STATUS BADGE : Couleur selon le statut
  const getStatusBadge = () => {
    const statusColors = {
      completed: { bg: '#10b981', text: 'Terminé' },
      pending: { bg: BOOKING_COLORS.pending.hex, text: 'En attente' },
      confirmed: { bg: BOOKING_COLORS.completed.hex, text: 'Confirmé' },
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

  // ✅ GÉNÉRATION DE LIEN : Logique enrichie et simplifiée
  const handleGenerateGuestLink = async (event?: React.MouseEvent) => {
    console.log('🔵 [UNIFIED MODAL] Génération de lien pour:', {
      bookingId: booking.id,
      bookingCode,
      propertyId,
      isAirbnb,
      hasEvent: !!event
    });
    
    // ✅ PROTECTION : Bloquer si déjà en cours
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
    const userEvent = event?.nativeEvent || undefined;

    try {
      // ✅ ENRICHIE : Pour les réservations Airbnb, inclure les dates pré-remplies
      if (isAirbnb) {
        const airbnbRes = booking as AirbnbReservation;
        await generatePropertyVerificationUrl(propertyId, airbnbRes.airbnbBookingId, {
          linkType: 'ics_direct',
          reservationData: {
            airbnbCode: airbnbRes.airbnbBookingId,
            startDate: airbnbRes.startDate,
            endDate: airbnbRes.endDate,
            guestName: airbnbRes.guestName,
            numberOfGuests: airbnbRes.numberOfGuests
          },
          userEvent: userEvent
        });
      } else {
        // ✅ ENRICHIE : Pour les réservations manuelles, inclure les dates avec linkType ics_direct
        const manualBooking = booking as Booking;
        await generatePropertyVerificationUrl(propertyId, manualBooking.id, {
          linkType: 'ics_direct', // ✅ FORCÉ : Toujours utiliser ics_direct
          reservationData: {
            airbnbCode: manualBooking.bookingReference || 'INDEPENDENT_BOOKING',
            startDate: new Date(manualBooking.checkInDate),
            endDate: new Date(manualBooking.checkOutDate),
            numberOfGuests: manualBooking.numberOfGuests
          },
          userEvent: userEvent
        });
      }
      
      console.log('✅ Lien généré avec succès');
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

  // ✅ CHARGEMENT DES DOCUMENTS : Pour les réservations terminées
  // ⚠️ CRITIQUE : Ce useEffect doit TOUJOURS être appelé (même si booking est null)
  useEffect(() => {
    const loadDocuments = async () => {
      // ✅ MODIFIÉ : Charger aussi pour les réservations 'pending' (nouvelles réservations créées par host)
      if (!booking || (status !== 'completed' && status !== 'pending') || isAirbnb || !booking.id) {
        setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: false });
        return;
      }

      console.log('📄 [UNIFIED MODAL] Chargement des documents pour booking:', booking.id);
      setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: true });

      try {
        // Récupérer tous les documents depuis uploaded_documents (contrat, police, et pièces d'identité)
        const { data: uploadedDocs, error } = await supabase
          .from('uploaded_documents')
          .select('id, document_url, file_path, document_type, is_signed, extracted_data, guests(full_name, document_number)')
          .eq('booking_id', booking.id)
          .in('document_type', ['contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport'])
          .order('created_at', { ascending: false});
        
        console.log('📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents:', uploadedDocs?.length || 0, uploadedDocs);

        if (error) {
          console.error('❌ Erreur lors du chargement des documents:', error);
          setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: false });
          return;
        }

        // Utilitaire pour obtenir une URL exploitable (public ou signée)
        const resolveDocumentUrl = async (doc: any) => {
          console.log('🔍 [RESOLVE URL] Document:', { id: doc?.id, type: doc?.document_type, hasUrl: !!doc?.document_url, hasPath: !!doc?.file_path });
          
          if (doc?.document_url) {
            console.log('✅ [RESOLVE URL] URL directe trouvée');
            return doc.document_url;
          }
          
          if (doc?.file_path) {
            console.log('🔑 [RESOLVE URL] Génération URL signée pour:', doc.file_path);
            try {
              // Méthode directe avec le SDK Supabase Storage
              const { data: signed, error: signError } = await supabase.storage
                .from('guest-documents')
                .createSignedUrl(doc.file_path, 3600);
              
              if (signError) {
                console.error('❌ [RESOLVE URL] Erreur signature:', signError);
                return null;
              }
              
              console.log('✅ [RESOLVE URL] URL signée générée:', signed?.signedUrl);
              return signed?.signedUrl || null;
            } catch (signError) {
              console.error('❌ [RESOLVE URL] Exception signature:', signError);
            }
          }
          
          console.warn('⚠️ [RESOLVE URL] Aucune URL trouvée pour ce document');
          return null;
        };

        // Extraire les URLs et IDs
        const contractDoc = uploadedDocs?.find(doc => doc.document_type === 'contract');
        const policeDoc = uploadedDocs?.find(doc => doc.document_type === 'police');
        const contractUrl = contractDoc ? await resolveDocumentUrl(contractDoc) : null;
        const policeUrl = policeDoc ? await resolveDocumentUrl(policeDoc) : null;
        
        // Extraire les pièces d'identité
        const identitySources = uploadedDocs
          ?.filter(doc => ['identity', 'identity_upload', 'id-document', 'passport'].includes(doc.document_type)) || [];

        console.log('🆔 [UNIFIED MODAL] Pièces d\'identité trouvées:', identitySources.length, identitySources);

        const identityDocs = await Promise.all(identitySources.map(async doc => {
          const url = await resolveDocumentUrl(doc);
          const guestName = (doc.extracted_data as any)?.guest_name || 
                            (doc.extracted_data as any)?.full_name || 
                      (doc.guests as any)?.full_name || 
                            'Invité';
          const documentNumber = (doc.extracted_data as any)?.document_number || 
                                (doc.extracted_data as any)?.id_number || 
                           (doc.guests as any)?.document_number || 
                                undefined;
          
          console.log('🆔 [UNIFIED MODAL] Document traité:', { 
            id: doc.id, 
            type: doc.document_type, 
            hasUrl: !!url, 
            guestName, 
            documentNumber 
          });
          
          return {
            id: doc.id,
            url: url,
            guestName,
            documentNumber
          };
        }));

        // Si pas de documents dans uploaded_documents, vérifier documents_generated dans bookings
        if (!contractDoc && !policeDoc && identityDocs.length === 0) {
          console.log('⚠️ [UNIFIED MODAL] Aucun document dans uploaded_documents, vérification dans documents_generated...');
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('documents_generated')
            .eq('id', booking.id)
            .single();

          console.log('📄 [UNIFIED MODAL] documents_generated:', bookingData?.documents_generated);

          if (bookingData?.documents_generated) {
            const docs = bookingData.documents_generated as any;
            setDocuments({
              contractUrl: docs.contractUrl || docs.contract?.url || null,
              contractId: null,
              policeUrl: docs.policeUrl || docs.police?.url || null,
              policeId: null,
              identityDocuments: [],
              loading: false
            });
            console.log('✅ [UNIFIED MODAL] Documents chargés depuis documents_generated:', {
              hasContract: !!(docs.contractUrl || docs.contract?.url),
              hasPolice: !!(docs.policeUrl || docs.police?.url)
            });
            return;
          }
        }

        console.log('✅ [UNIFIED MODAL] Documents finaux:', {
          contractUrl: !!contractUrl,
          policeUrl: !!policeUrl,
          identityCount: identityDocs.filter(doc => doc.url).length
        });

        const finalIdentityDocs = identityDocs.filter(doc => doc.url);
        
        setDocuments({
          contractUrl: contractUrl,
          contractId: contractDoc?.id || null,
          policeUrl: policeUrl,
          policeId: policeDoc?.id || null,
          identityDocuments: finalIdentityDocs,
          loading: false
        });
        
        // ✅ NOUVEAU : Vérifier si la réservation a des données clients suffisantes pour générer les documents
        // Les documents peuvent être générés si :
        // 1. Il y a des pièces d'identité uploadées
        // 2. OU il y a des guests avec informations complètes (full_name, document_number, etc.)
        const hasIdentityDocuments = finalIdentityDocs.length > 0;
        const bookingTyped = booking as Booking;
        const hasCompleteGuests = bookingTyped?.guests && bookingTyped.guests.length > 0 && 
          bookingTyped.guests.some(guest => 
            guest.fullName && 
            guest.documentNumber && 
            guest.nationality
          );
        
        setHasGuestData(hasIdentityDocuments || hasCompleteGuests || false);
      } catch (error) {
        console.error('❌ Erreur lors du chargement des documents:', error);
        setDocuments({ contractUrl: null, contractId: null, policeUrl: null, policeId: null, identityDocuments: [], loading: false });
        setHasGuestData(false);
      }
    };

    loadDocuments();
  }, [status, isAirbnb, booking?.id]);

  // ✅ GÉNÉRATION DU CONTRAT (copié depuis BookingCard)
  const handleGenerateContract = async () => {
    if (!booking || isAirbnb) return;
    
    setIsGeneratingContract(true);
    try {
      const bookingTyped = booking as Booking;
      const result = await ContractService.generateAndDownloadContract(bookingTyped);
      
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{
                backgroundColor: status === 'completed' ? '#10b981' : 
                                status === 'pending' ? BOOKING_COLORS.pending.hex : 
                                BOOKING_COLORS.completed.hex
              }}></div>
              {getTitle()}
              {getStatusBadge()}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* ✅ BOUTON SUPPRESSION : Uniquement pour les réservations non-Airbnb et non-ICS */}
              {!isAirbnb && !isICSReservation && 'id' in booking && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Supprimer la réservation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogDescription>
            Détails et actions pour la réservation du {formatDate(checkIn)} au {formatDate(checkOut)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ✅ UNIFIÉ : Section Référence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Référence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-sm">Code réservation {isAirbnb ? 'Airbnb' : ''}</p>
                <p className="text-lg font-mono">
                  {getReservationCode()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Arrivée</p>
                    <p className="text-muted-foreground">{formatDate(checkIn)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Départ</p>
                    <p className="text-muted-foreground">{formatDate(checkOut)}</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <span className="text-lg sm:text-2xl font-bold">{calculateNights()} nuit(s)</span>
              </div>
            </CardContent>
          </Card>

          {/* ✅ SUPPRIMÉ : Section dupliquée - Fusionnée avec "Documents enregistrés" ci-dessous */}

          {/* ✅ DOCUMENTS : Section pour les réservations terminées ET pending avec données clients */}
          {/* ✅ CORRIGÉ : Afficher les boutons "Générer" uniquement si :
              - La réservation est terminée (completed) OU
              - La réservation est en attente (pending) ET a des données clients (guests complets OU pièces d'identité) */}
          {(status === 'completed' || (status === 'pending' && hasGuestData)) && !isAirbnb && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-teal" />
                  Documents enregistrés
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {documents.loading ? (
                  <div className="flex items-center justify-center py-4">
                    <span className="w-4 h-4 border-2 border-brand-teal border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    <span className="text-sm text-muted-foreground">Chargement des documents...</span>
                  </div>
                ) : (
                  <>
                {/* Contrat */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-brand-teal" />
                    </div>
                    <div>
                          <p className="font-semibold text-gray-900">Contrat {status === 'completed' ? 'signé' : ''}</p>
                          <p className="text-sm text-gray-600">Document contractuel {status === 'completed' ? 'signé' : 'à signer physiquement'}</p>
                    </div>
                  </div>
                  {documents.contractUrl ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(documents.contractUrl!, '_blank')}
                        className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Voir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = documents.contractUrl!;
                          link.download = `contrat-${getReservationCode()}.pdf`;
                          link.click();
                        }}
                        className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
                      >
                        Télécharger
                      </Button>
                    </div>
                  ) : hasGuestData ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateContract}
                      disabled={isGeneratingContract}
                      className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
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
                  ) : (
                    <span className="text-sm text-gray-400">En attente des informations clients</span>
                  )}
                </div>

                {/* Police */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-brand-teal" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Fiche de police</p>
                          <p className="text-sm text-gray-600">Formulaire de déclaration de police</p>
                    </div>
                  </div>
                  {documents.policeUrl ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(documents.policeUrl!, '_blank')}
                        className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
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
                        className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
                      >
                        Télécharger
                      </Button>
                    </div>
                  ) : hasGuestData ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGeneratePolice}
                      disabled={isGeneratingPolice}
                      className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
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
                  ) : (
                    <span className="text-sm text-gray-400">En attente des informations clients</span>
                  )}
                    </div>

                    {/* Pièces d'identité */}
                    {documents.identityDocuments.length > 0 && (
                      <>
                        {documents.identityDocuments.map((identityDoc, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-brand-teal" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Pièce d'identité {documents.identityDocuments.length > 1 ? `#${index + 1}` : ''}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {identityDoc.guestName || 'Invité'}
                                  {identityDoc.documentNumber && ` • ${identityDoc.documentNumber}`}
                                </p>
                              </div>
                            </div>
                            {identityDoc.url ? (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(identityDoc.url, '_blank')}
                                  className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
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
                                  className="border-2 border-brand-teal/30 hover:border-brand-teal/50"
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
                <CardTitle className="text-lg">Actions</CardTitle>
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
                        <span>Génération...</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        <span>Copier le lien</span>
                      </>
                    )}
                  </span>
                </Button>
                
                <p className="text-xs text-muted-foreground mt-2">
                  Génère et copie automatiquement le lien de vérification client avec les dates de cette réservation pré-remplies
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
            <AlertDialogTitle>Supprimer la réservation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette réservation ? Cette action est irréversible et supprimera également tous les documents associés (contrat, fiche de police, pièces d'identité).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

