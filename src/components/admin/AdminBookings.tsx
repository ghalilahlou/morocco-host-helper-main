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
  Filter, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    let filtered = bookings;

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.bookingReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.properties?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.guests.some(guest => 
          guest.fullName.toLowerCase().includes(searchTerm.toLowerCase())
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
          properties(name),
          guests(fullName)
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
                <TableHead>Clients</TableHead>
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
                    {booking.bookingReference}
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
                      <div>
                        <div className="text-sm font-medium">
                          {booking.guests?.[0]?.fullName || 'Client inconnu'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.numberOfGuests} personne(s)
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Du {new Date(booking.checkIn).toLocaleDateString('fr-FR')}</div>
                      <div>Au {new Date(booking.checkOut).toLocaleDateString('fr-FR')}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'MAD' 
                      }).format(booking.totalPrice || 0)}
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
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
