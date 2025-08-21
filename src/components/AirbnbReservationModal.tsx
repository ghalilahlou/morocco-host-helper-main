import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Users, MapPin, Building, Clock, Link as LinkIcon, Mail, X, Copy, Trash2 } from 'lucide-react';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { toast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { copyToClipboard } from '@/lib/clipboardUtils';
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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Function to generate guest verification link with Airbnb booking ID
  const handleGenerateGuestLink = async () => {
    if (!propertyId || !reservation?.airbnbBookingId) {
      toast({
        title: "Erreur",
        description: "Informations manquantes pour générer le lien",
        variant: "destructive"
      });
      return;
    }

    // Extract the actual booking code from raw event if needed
    const rawEvent = reservation.rawEvent || '';
    const patterns = [/details\/([A-Z0-9]{8,12})/i, /tails\/([A-Z0-9]{8,12})/i, /\/([A-Z0-9]{8,12})\//i, /\b([A-Z0-9]{8,12})\b/g];
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
    const url = await generatePropertyVerificationUrl(propertyId, bookingCode);
    if (url) {
      const success = await copyToClipboard(url);
      if (success) {
        toast({
          title: "Lien généré et copié",
          description: `Lien de vérification avec code Airbnb ${bookingCode} copié dans le presse-papiers`
        });
      } else {
        toast({
          title: "Lien généré",
          description: `URL: ${url}`
        });
      }
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
              const patterns = [/details\/([A-Z0-9]{8,12})/i, /tails\/([A-Z0-9]{8,12})/i, /\/([A-Z0-9]{8,12})\//i, /\b([A-Z0-9]{8,12})\b/g];
              for (const pattern of patterns) {
                const matches = rawEvent.match(pattern);
                if (matches) {
                  const code = matches[1].toUpperCase();
                  if (code !== 'RESERVED' && code !== 'AVAILABLE' && /^[A-Z0-9]{8,12}$/.test(code)) {
                    return code;
                  }
                }
              }
              return reservation?.guestName || 'Réservation Airbnb';
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
                <Button onClick={handleGenerateGuestLink} disabled={isGeneratingLink} className="w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  {isGeneratingLink ? 'Génération...' : 'Générer lien'}
                </Button>


                <p className="text-xs text-muted-foreground mt-2">
                  Génère un lien de vérification client avec les dates de cette réservation Airbnb pré-remplies
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
    </Dialog>;
};
