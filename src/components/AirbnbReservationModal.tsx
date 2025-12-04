import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Users, MapPin, Building, Clock, Link as LinkIcon, Mail, X, Copy, Trash2, Share2 } from 'lucide-react';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { useToast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { isMobile as isMobileDevice } from '@/lib/shareUtils';
import { ShareModal } from '@/components/ShareModal';
interface AirbnbReservationModalProps {
  reservation: AirbnbReservation | null;
  isOpen: boolean;
  onClose: () => void;
  propertyId?: string;
}
export const AirbnbReservationModal = ({
  reservation,
  isOpen,
  onClose,
  propertyId
}: AirbnbReservationModalProps) => {
  const {
    generatePropertyVerificationUrl,
    isLoading: isGeneratingLink
  } = useGuestVerification();
  const { toast } = useToast(); // ✅ Utiliser le hook
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false); // ✅ State local pour bloquer immédiatement
  
  // ✅ NOUVEAU : État pour le modal de partage mobile (fallback)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalUrl, setShareModalUrl] = useState<string>('');

  // Function to generate guest verification link with Airbnb booking ID (sans validation de code)
  const handleGenerateGuestLink = async (event?: React.MouseEvent) => {
    console.log('🔵 handleGenerateGuestLink appelé', { propertyId, airbnbBookingId: reservation?.airbnbBookingId, hasEvent: !!event });
    
    // ✅ PROTECTION IMMÉDIATE : Bloquer si déjà en cours
    if (isGeneratingLocal || isGeneratingLink) {
      console.warn('⚠️ Génération déjà en cours, clic ignoré', { isGeneratingLocal, isGeneratingLink });
      return;
    }

    if (!propertyId || !reservation?.airbnbBookingId) {
      console.error('❌ Informations manquantes', { propertyId, airbnbBookingId: reservation?.airbnbBookingId });
      toast({
        title: "Erreur",
        description: "Informations manquantes pour générer le lien",
        variant: "destructive"
      });
      return;
    }

    // ✅ BLOQUER IMMÉDIATEMENT (avant même l'appel API)
    setIsGeneratingLocal(true);
    console.log('🟡 Génération de lien démarrée...');
    
    // ✅ MOBILE-OPTIMIZED : Préserver l'événement utilisateur complet pour la copie mobile
    const userEvent = event || undefined;

    // Extract the actual booking code from raw event if needed
    const rawEvent = reservation.rawEvent || '';
    const patterns = [/details\/([A-Z0-9]{8,12})/i, /tails\/([A-Z0-9]{8,12})/i, /\/([A-Z0-9]{8,12})\\/i, /\b([A-Z0-9]{8,12})\b/g];
    let bookingCode = reservation.airbnbBookingId;

    // Try to find a better booking code from raw event
    for (const pattern of patterns) {
      const matches = rawEvent.match(pattern);
      if (matches) {
        const code = matches[1].toUpperCase();
        if (code !== 'RESERVED' && code !== 'AVAILABLE' && /^[A-Z0-9]{8,12}$/.test(code)) {
          bookingCode = code;
          break;
        }
      }
    }

    console.log('🔵 Paramètres de génération:', {
      propertyId,
      bookingCode,
      startDate: reservation.startDate,
      endDate: reservation.endDate
    });

    try {
      // ✅ SIMPLIFIÉ : Le lien est automatiquement copié dans le hook
      // ✅ IMPORTANT : Passer l'événement utilisateur pour préserver le contexte
      const url = await generatePropertyVerificationUrl(propertyId, bookingCode, {
        linkType: 'ics_direct',
        reservationData: {
          airbnbCode: bookingCode,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          guestName: reservation.guestName,
          numberOfGuests: reservation.numberOfGuests
        },
        userEvent: userEvent // ✅ Passer l'événement pour préserver le contexte
      });
      
      console.log('✅ Lien généré avec succès:', url);
      
      // ✅ PARTAGE NATIF iOS/Android - Compatible avec les deux plateformes
      if (isMobileDevice() && url) {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            // Préparer les données de partage (compatible Android + iOS)
            const shareTitle = `Lien de réservation - ${bookingCode}`;
            let shareData: ShareData = {
              title: shareTitle,
              text: 'Cliquez ici pour compléter votre réservation',
              url: url
            };
            
            // Vérifier avec canShare si disponible
            if (navigator.canShare) {
              if (!navigator.canShare(shareData)) {
                // Fallback Android : essayer sans text
                console.log('📱 [SHARE] Fallback Android: URL seule');
                shareData = { title: shareTitle, url: url };
                
                if (!navigator.canShare(shareData)) {
                  shareData = { url: url };
                }
              }
            }
            
            console.log('📱 [SHARE] Tentative de partage natif:', shareData);
            await navigator.share(shareData);
            
            console.log('✅ Partage natif réussi');
            toast({
              title: "✅ Lien partagé !",
              description: "Le lien a été partagé avec succès",
            });
          } catch (shareError: any) {
            if (shareError.name === 'AbortError') {
              console.log('📱 Partage annulé par l\'utilisateur');
            } else if (shareError.name === 'NotAllowedError') {
              console.warn('⚠️ Partage non autorisé, ouverture du modal');
              setShareModalUrl(url);
              setShareModalOpen(true);
            } else {
              console.warn('⚠️ Partage natif échoué, fallback au modal:', shareError.message || shareError);
              setShareModalUrl(url);
              setShareModalOpen(true);
            }
          }
        } else {
          console.log('📱 [SHARE] Web Share API non disponible, ouverture du modal');
          setShareModalUrl(url);
          setShareModalOpen(true);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la génération du lien:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le lien. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      // ✅ TOUJOURS réinitialiser le flag local
      setIsGeneratingLocal(false);
      console.log('🟢 Génération terminée, flag réinitialisé');
    }
  };
  const confirmDeleteReservation = async () => {
    if (!reservation?.id) return;
    try {
      const {
        error
      } = await supabase.from('airbnb_reservations').delete().eq('id', reservation.id);
      if (error) throw error;
      toast({
        title: "Réservation supprimée",
        description: "La réservation Airbnb a été supprimée avec succès."
      });
      setIsDeleteOpen(false);
      onClose();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la réservation.",
        variant: "destructive"
      });
    }
  };
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const calculateNights = () => {
    if (!reservation?.startDate || !reservation?.endDate) return 0;
    const timeDiff = reservation.endDate.getTime() - reservation.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  };

  // Don't render if reservation is null
  if (!reservation) {
    return null;
  }
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{
              backgroundColor: BOOKING_COLORS.pending.hex
            }}></div>
              {(() => {
              // Extract booking code from raw event data for title
              const rawEvent = reservation?.rawEvent || '';
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
              // ✅ CORRIGÉ : Ne pas afficher le guestName si la réservation n'a pas de booking associé valide
              // Utiliser getUnifiedBookingDisplayText pour une validation cohérente
              const displayText = getUnifiedBookingDisplayText(reservation as any, true);
              // Si le texte affiché est juste "Réservation" ou le code, utiliser le code Airbnb
              if (displayText === 'Réservation' || displayText.length < 3) {
                return reservation?.airbnbBookingId || 'Réservation Airbnb';
              }
              return displayText;
            })()}
              <Badge variant="secondary">En attente</Badge>
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Détails et actions pour la réservation du {reservation?.startDate.toLocaleDateString('fr-FR')} au {reservation?.endDate.toLocaleDateString('fr-FR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations principales - Version simplifiée */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Référence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-sm">Code réservation Airbnb</p>
                <p className="text-lg font-mono">
                  {(() => {
                  // Extract booking code from raw event data
                  const rawEvent = reservation.rawEvent || '';
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
                  return reservation.airbnbBookingId || "Code non trouvé";
                })()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Arrivée</p>
                    <p className="text-muted-foreground">{reservation.startDate.toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Départ</p>
                    <p className="text-muted-foreground">{reservation.endDate.toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <span className="text-lg sm:text-2xl font-bold">{calculateNights()} nuit(s)</span>
              </div>

            </CardContent>
          </Card>

          {/* Actions simplifiées */}
          {propertyId && reservation.airbnbBookingId && <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={(e) => handleGenerateGuestLink(e)} 
                  disabled={isGeneratingLocal || isGeneratingLink} 
                  className="w-full flex items-center justify-center"
                >
                  {/* ✅ Conteneur stable pour éviter NotFoundError */}
                  <span className="flex items-center">
                    {isGeneratingLocal || isGeneratingLink ? (
                      <>
                        <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        <span>Génération...</span>
                      </>
                    ) : isMobileDevice() ? (
                      <>
                        <Share2 className="w-4 h-4 mr-2" />
                        <span>Partager le lien</span>
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
                  {isMobileDevice() 
                    ? 'Génère le lien et ouvre le menu de partage natif (Messages, WhatsApp, Mail...)'
                    : 'Génère et copie automatiquement le lien de vérification client avec les dates de cette réservation Airbnb pré-remplies'
                  }
                </p>
              </CardContent>
            </Card>}
        </div>
    </DialogContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette réservation Airbnb ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-destructive/10 p-4">
            <p className="font-semibold">⚠️ ATTENTION : Cette action supprimera définitivement :</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
              <li>Cette réservation synchronisée</li>
              <li>Toute référence liée dans l'historique de synchronisation</li>
            </ul>
            <p className="mt-2 font-medium">Cette action ne peut pas être annulée !</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteReservation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* ✅ Modal de partage (fallback si partage natif non disponible) */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={shareModalUrl}
        title={`Lien de réservation - ${reservation?.airbnbBookingId || ''}`}
        guestName={reservation?.guestName}
        checkIn={reservation?.startDate ? reservation.startDate.toLocaleDateString('fr-FR') : undefined}
        checkOut={reservation?.endDate ? reservation.endDate.toLocaleDateString('fr-FR') : undefined}
      />
    </Dialog>;
};