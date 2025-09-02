import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Building2, 
  Search, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Users,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export const AdminProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    total: properties.length,
    active: properties.filter(p => p.is_active).length,
    inactive: properties.filter(p => !p.is_active).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Propriétés</h2>
          <p className="text-gray-600">
            Gérez toutes les propriétés de l'application
          </p>
        </div>
        <Button onClick={loadProperties} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total propriétés</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Toutes les propriétés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriétés actives</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Propriétés disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriétés inactives</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Propriétés désactivées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table des propriétés */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des propriétés</CardTitle>
          <CardDescription>
            {properties.length} propriété(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Prix/nuit</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    {property.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm">{property.city}</div>
                        <div className="text-xs text-gray-500">{property.country}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{property.capacity} personne(s)</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'MAD' 
                      }).format(property.price_per_night || 0)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {property.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(property.created_at).toLocaleDateString('fr-FR', {
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
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    Aucune propriété trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
