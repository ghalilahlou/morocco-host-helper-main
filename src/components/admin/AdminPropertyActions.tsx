import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Eye, Edit, Trash2, Save, X, MapPin, Building2, Users, DollarSign } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
  price_per_night: number;
  created_at: string;
  is_active: boolean;
}

interface AdminPropertyActionsProps {
  property: Property;
  onUpdate: () => void;
}

export const AdminPropertyActions: React.FC<AdminPropertyActionsProps> = ({ property, onUpdate }) => {
  const { toast } = useToast();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // État pour l'édition
  const [editData, setEditData] = useState({
    name: property.name,
    address: property.address,
    city: property.city,
    country: property.country,
    capacity: property.capacity,
    price_per_night: property.price_per_night,
    is_active: property.is_active,
    description: ''
  });

  const handleView = () => {
    setIsViewDialogOpen(true);
  };

  const handleEdit = () => {
    setEditData({
      name: property.name,
      address: property.address,
      city: property.city,
      country: property.country,
      capacity: property.capacity,
      price_per_night: property.price_per_night,
      is_active: property.is_active,
      description: ''
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
        .from('properties')
        .update({
          name: editData.name,
          address: editData.address,
          city: editData.city,
          country: editData.country,
          capacity: editData.capacity,
          price_per_night: editData.price_per_night,
          is_active: editData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', property.id);

      if (error) throw error;

      toast({
        title: "Propriété mise à jour",
        description: "Les modifications ont été enregistrées avec succès."
      });

      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating property:', error);
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
        .from('properties')
        .delete()
        .eq('id', property.id);

      if (error) throw error;

      toast({
        title: "Propriété supprimée",
        description: "La propriété a été supprimée avec succès."
      });

      setIsDeleteDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting property:', error);
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
            <DialogTitle>Détails de la propriété</DialogTitle>
            <DialogDescription>
              Informations complètes sur {property.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <div className="font-medium flex items-center">
                  <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                  {property.name}
                </div>
              </div>
              <div>
                <Label>Statut</Label>
                <div className="font-medium">
                  {property.is_active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </div>
              </div>
              <div>
                <Label>Adresse</Label>
                <div className="font-medium flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                  {property.address}
                </div>
              </div>
              <div>
                <Label>Ville</Label>
                <div className="font-medium">{property.city}</div>
              </div>
              <div>
                <Label>Pays</Label>
                <div className="font-medium">{property.country}</div>
              </div>
              <div>
                <Label>Capacité</Label>
                <div className="font-medium flex items-center">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  {property.capacity} personne(s)
                </div>
              </div>
              <div>
                <Label>Prix par nuit</Label>
                <div className="font-medium flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'MAD' 
                  }).format(property.price_per_night || 0)}
                </div>
              </div>
              <div>
                <Label>Date de création</Label>
                <div className="font-medium">
                  {new Date(property.created_at).toLocaleDateString('fr-FR')}
                </div>
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
            <DialogTitle>Modifier la propriété</DialogTitle>
            <DialogDescription>
              Modifiez les informations de {property.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacité</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={editData.capacity}
                  onChange={(e) => setEditData({...editData, capacity: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={editData.address}
                  onChange={(e) => setEditData({...editData, address: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={editData.city}
                  onChange={(e) => setEditData({...editData, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  value={editData.country}
                  onChange={(e) => setEditData({...editData, country: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="price_per_night">Prix par nuit</Label>
                <Input
                  id="price_per_night"
                  type="number"
                  value={editData.price_per_night}
                  onChange={(e) => setEditData({...editData, price_per_night: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={editData.is_active}
                onCheckedChange={(checked) => setEditData({...editData, is_active: checked})}
              />
              <Label htmlFor="is_active">Propriété active</Label>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editData.description}
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                placeholder="Description de la propriété..."
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
              Cette action ne peut pas être annulée. Cela supprimera définitivement la propriété 
              "{property.name}" et toutes les réservations associées.
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
