import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Edit, Trash2, Save, X } from 'lucide-react';

interface Booking {
  id: string;
  bookingReference: string;
  status: string;
  checkIn: string;
  checkOut: string;
  numberOfGuests: number;
  totalPrice: number;
  created_at: string;
  properties: {
    name: string;
  };
  guests: Array<{
    fullName: string;
  }>;
}

interface AdminBookingActionsProps {
  booking: Booking;
  onUpdate: () => void;
}

export const AdminBookingActions: React.FC<AdminBookingActionsProps> = ({ booking, onUpdate }) => {
  const { toast } = useToast();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // État pour l'édition
  const [editData, setEditData] = useState({
    status: booking.status,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    numberOfGuests: booking.numberOfGuests,
    totalPrice: booking.totalPrice,
    notes: ''
  });

  const handleView = () => {
    setIsViewDialogOpen(true);
  };

  const handleEdit = () => {
    setEditData({
      status: booking.status,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      numberOfGuests: booking.numberOfGuests,
      totalPrice: booking.totalPrice,
      notes: ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const saveEdit = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: editData.status,
          check_in: editData.checkIn,
          check_out: editData.checkOut,
          number_of_guests: editData.numberOfGuests,
          total_price: editData.totalPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Réservation mise à jour",
        description: "Les modifications ont été enregistrées avec succès."
      });

      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la mise à jour.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Réservation supprimée",
        description: "La réservation a été supprimée avec succès."
      });

      setIsDeleteDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la suppression.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Boutons d'action */}
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={handleView}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la réservation</DialogTitle>
            <DialogDescription>
              Informations complètes sur la réservation {booking.bookingReference}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Référence</Label>
                <div className="font-medium">{booking.bookingReference}</div>
              </div>
              <div>
                <Label>Statut</Label>
                <div className="font-medium capitalize">{booking.status}</div>
              </div>
              <div>
                <Label>Propriété</Label>
                <div className="font-medium">{booking.properties?.name || 'Propriété inconnue'}</div>
              </div>
              <div>
                <Label>Nombre de personnes</Label>
                <div className="font-medium">{booking.numberOfGuests}</div>
              </div>
              <div>
                <Label>Date d'arrivée</Label>
                <div className="font-medium">
                  {new Date(booking.checkIn).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div>
                <Label>Date de départ</Label>
                <div className="font-medium">
                  {new Date(booking.checkOut).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div>
                <Label>Prix total</Label>
                <div className="font-medium">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'MAD' 
                  }).format(booking.totalPrice || 0)}
                </div>
              </div>
              <div>
                <Label>Date de création</Label>
                <div className="font-medium">
                  {new Date(booking.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
            <div>
              <Label>Clients</Label>
              <div className="space-y-1">
                {booking.guests?.map((guest, index) => (
                  <div key={index} className="font-medium">{guest.fullName}</div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la réservation {booking.bookingReference}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Statut</Label>
                <Select value={editData.status} onValueChange={(value) => setEditData({...editData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="completed">Complétée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                    <SelectItem value="archived">Archivée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="numberOfGuests">Nombre de personnes</Label>
                <Input
                  id="numberOfGuests"
                  type="number"
                  value={editData.numberOfGuests}
                  onChange={(e) => setEditData({...editData, numberOfGuests: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="checkIn">Date d'arrivée</Label>
                <Input
                  id="checkIn"
                  type="date"
                  value={editData.checkIn}
                  onChange={(e) => setEditData({...editData, checkIn: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="checkOut">Date de départ</Label>
                <Input
                  id="checkOut"
                  type="date"
                  value={editData.checkOut}
                  onChange={(e) => setEditData({...editData, checkOut: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="totalPrice">Prix total</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  value={editData.totalPrice}
                  onChange={(e) => setEditData({...editData, totalPrice: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editData.notes}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                placeholder="Notes additionnelles..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={saveEdit} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement la réservation 
              "{booking.bookingReference}" et toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
