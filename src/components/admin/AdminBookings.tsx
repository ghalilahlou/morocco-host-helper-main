import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Calendar, 
  Search, 
  RefreshCw,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminBookingDetailModal } from './AdminBookingDetailModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Booking {
  id: string;
  booking_reference?: string;
  bookingReference?: string;
  status: string;
  check_in_date?: string;
  check_out_date?: string;
  checkIn?: string;
  checkOut?: string;
  number_of_guests?: number;
  numberOfGuests?: number;
  total_price?: number;
  totalPrice?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  created_at: string;
  properties?: {
    name: string;
    user_id?: string;
  };
  guests?: Array<{
    full_name?: string;
    fullName?: string;
    email?: string;
  }>;
}

const BOOKING_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'completed', label: 'Complétée' },
  { value: 'cancelled', label: 'Annulée' },
] as const;

export const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    let filtered = bookings;

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(booking =>
        (booking.booking_reference || booking.bookingReference || '').toLowerCase().includes(term) ||
        (booking.properties?.name || '').toLowerCase().includes(term) ||
        (booking.guest_name || '').toLowerCase().includes(term) ||
        (booking.guest_email || '').toLowerCase().includes(term) ||
        (booking.guests || []).some(guest => 
          ((guest.full_name || guest.fullName) || '').toLowerCase().includes(term) ||
          ((guest.email || '') || '').toLowerCase().includes(term)
        )
      );
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    setFilteredBookings(filtered);
  }, [bookings, searchTerm, statusFilter]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties(name, user_id),
          guests(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Complétée</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archivée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingStatusId(bookingId);
    try {
      const { error } = await supabase.rpc('admin_update_booking_status', {
        p_booking_id: bookingId,
        p_status: newStatus,
      });
      if (error) throw error;
      toast({
        title: 'Statut mis à jour',
        description: `La réservation a été marquée comme ${BOOKING_STATUSES.find(s => s.value === newStatus)?.label || newStatus}.`,
      });
      loadBookings();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le statut de la réservation.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Réservations</h2>
          <p className="text-gray-600">
            Gérez toutes les réservations de l'application
          </p>
        </div>
        <Button onClick={loadBookings} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total réservations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Toutes les réservations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Réservations en attente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complétées</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              Réservations complétées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annulées</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">
              Réservations annulées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche et filtres</CardTitle>
          <CardDescription>
            Trouvez rapidement les réservations que vous recherchez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par référence, propriété ou nom de client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="completed">Complétées</option>
              <option value="cancelled">Annulées</option>
              <option value="archived">Archivées</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table des réservations */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des réservations</CardTitle>
          <CardDescription>
            {filteredBookings.length} réservation(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Propriété</TableHead>
                <TableHead>Clients (Email)</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    {booking.booking_reference || booking.bookingReference || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span>{booking.properties?.name || 'Propriété inconnue'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {booking.guest_name || booking.guests?.[0]?.full_name || booking.guests?.[0]?.fullName || 'Client inconnu'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {booking.guest_email || booking.guests?.[0]?.email || '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(booking.number_of_guests ?? booking.numberOfGuests ?? 0)} personne(s)
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Du {(booking.check_in_date || booking.checkIn || '').toString() ? new Date(booking.check_in_date || booking.checkIn!).toLocaleDateString('fr-FR') : '—'}</div>
                      <div>Au {(booking.check_out_date || booking.checkOut || '').toString() ? new Date(booking.check_out_date || booking.checkOut!).toLocaleDateString('fr-FR') : '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'MAD' 
                      }).format(booking.total_price ?? booking.totalPrice ?? 0)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(booking.status)}
                      {getStatusBadge(booking.status)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(booking.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailBooking(booking);
                            setDetailModalOpen(true);
                          }}
                          title="Voir détails et documents"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Select
                          value={booking.status}
                          onValueChange={(v) => handleUpdateStatus(booking.id, v)}
                          disabled={updatingStatusId === booking.id}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue placeholder="Statut" />
                          </SelectTrigger>
                          <SelectContent>
                            {BOOKING_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {updatingStatusId === booking.id && (
                        <span className="text-xs text-muted-foreground">Mise à jour...</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Aucune réservation trouvée pour ces critères' 
                      : 'Aucune réservation trouvée'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminBookingDetailModal
        bookingId={detailBooking?.id ?? null}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        booking={detailBooking ? {
          id: detailBooking.id,
          booking_reference: detailBooking.booking_reference || detailBooking.bookingReference,
          check_in_date: detailBooking.check_in_date || detailBooking.checkIn,
          check_out_date: detailBooking.check_out_date || detailBooking.checkOut,
          guest_name: detailBooking.guest_name || detailBooking.guests?.[0]?.full_name || detailBooking.guests?.[0]?.fullName,
          guest_email: detailBooking.guest_email || detailBooking.guests?.[0]?.email,
          properties: detailBooking.properties,
        } : undefined}
      />

      {/* Informations */}
      <Card>
        <CardHeader>
          <CardTitle>Informations sur les réservations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Clock className="h-4 w-4 mr-2 text-yellow-600" />
                Statuts des réservations
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>• <strong>En attente</strong> : Réservation créée, en cours de traitement</div>
                <div>• <strong>Complétée</strong> : Séjour terminé avec succès</div>
                <div>• <strong>Annulée</strong> : Réservation annulée par le client ou l'hôte</div>
                <div>• <strong>Archivée</strong> : Réservation ancienne archivée</div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                Gestion des réservations
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>• <strong>Voir</strong> : Consulter les détails complets</div>
                <div>• <strong>Modifier</strong> : Modifier les informations</div>
                <div>• <strong>Supprimer</strong> : Supprimer la réservation</div>
                <div>• <strong>Filtres</strong> : Rechercher par statut ou critères</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
