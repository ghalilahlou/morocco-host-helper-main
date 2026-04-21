import React, { useEffect, useState } from 'react';
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
  DialogTitle,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AdminGuestLinkSection } from '@/components/admin/AdminGuestLinkSection';
import { FRONT_CALENDAR_ICS_SYNC_ENABLED } from '@/config/frontCalendarSync';
import {
  Eye,
  Edit,
  Trash2,
  Save,
  X,
  MapPin,
  Building2,
  Users,
  DollarSign,
  Calendar,
  User,
  History,
} from 'lucide-react';

/** Ligne `properties` enrichie côté admin (colonnes réelles + optionnel hôte) */
export interface AdminPropertyRow {
  id: string;
  name: string;
  address: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  max_occupancy?: number | null;
  max_guests?: number | null;
  price_per_night?: number | string | null;
  created_at: string | null;
  is_active: boolean;
  user_id?: string | null;
  property_type?: string | null;
  photo_url?: string | null;
  airbnb_ics_url?: string | null;
}

interface AdminPropertyActionsProps {
  property: AdminPropertyRow;
  onUpdate: () => void;
}

type HostPreview = { full_name: string | null; phone: string | null };

type BookingRow = {
  id: string;
  booking_reference: string | null;
  status: string;
  check_in_date: string | null;
  check_out_date: string | null;
  created_at: string | null;
};

export const AdminPropertyActions: React.FC<AdminPropertyActionsProps> = ({ property, onUpdate }) => {
  const { toast } = useToast();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hostPreview, setHostPreview] = useState<HostPreview | null>(null);
  const [bookingHistory, setBookingHistory] = useState<BookingRow[]>([]);
  const [loadingView, setLoadingView] = useState(false);

  const occDefault =
    property.max_occupancy ?? property.max_guests ?? 4;

  const [editData, setEditData] = useState({
    name: property.name,
    address: property.address ?? '',
    city: property.city ?? '',
    country: property.country ?? '',
    max_occupancy: occDefault,
    price_per_night: Number(property.price_per_night ?? 0),
    is_active: property.is_active,
    description: property.description ?? '',
    property_type: property.property_type ?? '',
    photo_url: property.photo_url ?? '',
    airbnb_ics_url: property.airbnb_ics_url ?? '',
  });

  useEffect(() => {
    if (!isViewDialogOpen) return;
    let cancelled = false;
    const run = async () => {
      setLoadingView(true);
      try {
        if (property.user_id) {
          const { data: hp } = await supabase
            .from('host_profiles')
            .select('full_name, phone')
            .eq('id', property.user_id)
            .maybeSingle();
          if (!cancelled) setHostPreview(hp);
        } else {
          setHostPreview(null);
        }
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, booking_reference, status, check_in_date, check_out_date, created_at')
          .eq('property_id', property.id)
          .order('check_in_date', { ascending: false, nullsFirst: false })
          .limit(100);
        if (!cancelled) setBookingHistory(bookings ?? []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setHostPreview(null);
          setBookingHistory([]);
        }
      } finally {
        if (!cancelled) setLoadingView(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isViewDialogOpen, property.id, property.user_id]);

  const handleView = () => {
    setIsViewDialogOpen(true);
  };

  const handleEdit = () => {
    const o = property.max_occupancy ?? property.max_guests ?? 4;
    setEditData({
      name: property.name,
      address: property.address ?? '',
      city: property.city ?? '',
      country: property.country ?? '',
      max_occupancy: o,
      price_per_night: Number(property.price_per_night ?? 0),
      is_active: property.is_active,
      description: property.description ?? '',
      property_type: property.property_type ?? '',
      photo_url: property.photo_url ?? '',
      airbnb_ics_url: property.airbnb_ics_url ?? '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const saveEdit = async () => {
    setIsLoading(true);
    try {
      const occ = Math.max(1, Math.floor(Number(editData.max_occupancy) || 1));
      const { error } = await supabase
        .from('properties')
        .update({
          name: editData.name,
          address: editData.address || null,
          city: editData.city || null,
          country: editData.country || null,
          description: editData.description || null,
          max_occupancy: occ,
          max_guests: occ,
          price_per_night: editData.price_per_night,
          is_active: editData.is_active,
          property_type: editData.property_type || null,
          photo_url: editData.photo_url || null,
          airbnb_ics_url: editData.airbnb_ics_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', property.id);

      if (error) throw error;

      toast({
        title: 'Propriété mise à jour',
        description: 'Les modifications ont été enregistrées avec succès.',
      });

      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating property:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'enregistrer les modifications (vérifiez les droits RLS / admin).",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_delete_property', {
        p_property_id: property.id,
      });

      if (error) throw error;
      if (data === false) {
        toast({
          title: 'Introuvable',
          description: 'Cette propriété n’existe plus ou a déjà été supprimée.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Propriété supprimée',
        description: 'La propriété et les réservations associées ont été supprimées.',
      });

      setIsDeleteDialogOpen(false);
      onUpdate();
    } catch (error: unknown) {
      console.error('Error deleting property:', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Erreur inconnue';
      toast({
        title: 'Suppression impossible',
        description:
          msg.includes('Accès non autorisé') || msg.includes('permission denied')
            ? 'Droits insuffisants (compte non admin).'
            : msg.length < 200
              ? msg
              : 'Échec de la suppression. Si le problème persiste, vérifiez les journaux ou contactez le support.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Complétée</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800">Confirmée</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archivée</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={handleView} title="Voir détails et historique">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleEdit} title="Modifier">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} title="Supprimer">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Détails — {property.name}</DialogTitle>
            <DialogDescription>
              Informations propriétaire, fiche logement et historique des réservations sur cette propriété.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[65vh] pr-4">
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Statut</Label>
                  <div className="font-medium mt-1">
                    {property.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="font-medium mt-1">{property.property_type || '—'}</div>
                </div>
                <div className="sm:col-span-2">
                  <Label>Adresse</Label>
                  <div className="font-medium flex items-start gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>{property.address || '—'}</span>
                  </div>
                </div>
                <div>
                  <Label>Ville / Pays</Label>
                  <div className="font-medium mt-1">
                    {[property.city, property.country].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div>
                  <Label>Capacité (personnes)</Label>
                  <div className="font-medium flex items-center gap-2 mt-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    {occDefault}
                  </div>
                </div>
                <div>
                  <Label>Prix par nuit</Label>
                  <div className="font-medium flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    {formatMoney(Number(property.price_per_night ?? 0))}
                  </div>
                </div>
                <div>
                  <Label>Créée le</Label>
                  <div className="font-medium mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {property.created_at
                      ? new Date(property.created_at).toLocaleDateString('fr-FR')
                      : '—'}
                  </div>
                </div>
              </div>

              {property.description ? (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{property.description}</p>
                </div>
              ) : null}

              <div className="border rounded-lg p-4 bg-muted/40">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  Propriétaire (hôte)
                </h4>
                {loadingView ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : property.user_id ? (
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Profil : </span>
                      {hostPreview?.full_name || '—'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Téléphone : </span>
                      {hostPreview?.phone || '—'}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      user_id : {property.user_id}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun hôte associé (user_id vide).</p>
                )}
              </div>

              <AdminGuestLinkSection propertyId={property.id} visible={isViewDialogOpen} />

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <History className="h-4 w-4" />
                  Historique des réservations ({bookingHistory.length})
                </h4>
                {loadingView ? (
                  <p className="text-sm text-muted-foreground">Chargement de l’historique…</p>
                ) : bookingHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune réservation pour cette propriété.</p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/80">
                        <tr>
                          <th className="text-left p-2 font-medium">Réf.</th>
                          <th className="text-left p-2 font-medium">Statut</th>
                          <th className="text-left p-2 font-medium">Arrivée</th>
                          <th className="text-left p-2 font-medium">Départ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingHistory.map((b) => (
                          <tr key={b.id} className="border-t">
                            <td className="p-2 font-mono text-xs">{b.booking_reference || '—'}</td>
                            <td className="p-2">{statusBadge(b.status)}</td>
                            <td className="p-2">
                              {b.check_in_date
                                ? new Date(b.check_in_date).toLocaleDateString('fr-FR')
                                : '—'}
                            </td>
                            <td className="p-2">
                              {b.check_out_date
                                ? new Date(b.check_out_date).toLocaleDateString('fr-FR')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la propriété</DialogTitle>
            <DialogDescription>Mettre à jour la fiche logement (champs visibles par les hôtes selon votre produit).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="max_occupancy">Capacité (personnes)</Label>
                <Input
                  id="max_occupancy"
                  type="number"
                  min={1}
                  value={editData.max_occupancy}
                  onChange={(e) =>
                    setEditData({ ...editData, max_occupancy: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="property_type">Type de bien</Label>
                <Input
                  id="property_type"
                  value={editData.property_type}
                  onChange={(e) => setEditData({ ...editData, property_type: e.target.value })}
                  placeholder="appartement, villa…"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={editData.city}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  value={editData.country}
                  onChange={(e) => setEditData({ ...editData, country: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="price_per_night">Prix par nuit (MAD)</Label>
                <Input
                  id="price_per_night"
                  type="number"
                  step="0.01"
                  value={editData.price_per_night}
                  onChange={(e) =>
                    setEditData({ ...editData, price_per_night: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="photo_url">URL photo</Label>
                <Input
                  id="photo_url"
                  value={editData.photo_url}
                  onChange={(e) => setEditData({ ...editData, photo_url: e.target.value })}
                />
              </div>
              {FRONT_CALENDAR_ICS_SYNC_ENABLED && (
                <div className="col-span-2">
                  <Label htmlFor="airbnb_ics_url">URL calendrier ICS (Airbnb / sync)</Label>
                  <Input
                    id="airbnb_ics_url"
                    value={editData.airbnb_ics_url}
                    onChange={(e) => setEditData({ ...editData, airbnb_ics_url: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={editData.is_active}
                onCheckedChange={(checked) => setEditData({ ...editData, is_active: checked })}
              />
              <Label htmlFor="is_active">Propriété active</Label>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Description affichée aux voyageurs / contrats…"
                rows={5}
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
              {isLoading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette propriété ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive : la propriété et les réservations / données associées sur ce logement seront
              supprimées (via le serveur). Les autres comptes hôtes ne sont pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
