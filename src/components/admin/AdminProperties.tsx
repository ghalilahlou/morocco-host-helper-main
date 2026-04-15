import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, RefreshCw, MapPin, Users, Star, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminPropertyActions, AdminPropertyRow } from '@/components/admin/AdminPropertyActions';

export const AdminProperties = () => {
  const [properties, setProperties] = useState<AdminPropertyRow[]>([]);
  const [filtered, setFiltered] = useState<AdminPropertyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const loadProperties = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties((data as AdminPropertyRow[]) || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    let list = properties;
    if (statusFilter === 'active') list = list.filter((p) => p.is_active);
    if (statusFilter === 'inactive') list = list.filter((p) => !p.is_active);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          (p.city && p.city.toLowerCase().includes(t)) ||
          (p.country && p.country.toLowerCase().includes(t)) ||
          (p.address && p.address.toLowerCase().includes(t)) ||
          (p.user_id && p.user_id.toLowerCase().includes(t))
      );
    }
    setFiltered(list);
  }, [properties, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: properties.length,
      active: properties.filter((p) => p.is_active).length,
      inactive: properties.filter((p) => !p.is_active).length,
    }),
    [properties]
  );

  const capacityOf = (p: AdminPropertyRow) => p.max_occupancy ?? p.max_guests ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Propriétés</h2>
          <p className="text-gray-600">
            Consultation, édition complète et historique des réservations par logement
          </p>
        </div>
        <Button onClick={loadProperties} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Toutes les propriétés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actives</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Visibles / exploitables</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactives</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">Désactivées</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche et filtres</CardTitle>
          <CardDescription>Nom, ville, pays, adresse ou identifiant hôte (user_id)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actives seulement</SelectItem>
              <SelectItem value="inactive">Inactives seulement</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste</CardTitle>
          <CardDescription>
            {filtered.length} propriété(s) — actions : voir (aperçu + historique réservations), modifier, supprimer
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
                <TableHead>Créée le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">{property.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-sm">{property.city || '—'}</div>
                        <div className="text-xs text-gray-500">{property.country || ''}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{capacityOf(property)} pers.</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'MAD',
                      }).format(Number(property.price_per_night ?? 0))}
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
                    {property.created_at
                      ? new Date(property.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdminPropertyActions property={property} onUpdate={loadProperties} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {searchTerm || statusFilter !== 'all'
                      ? 'Aucune propriété pour ces critères'
                      : 'Aucune propriété'}
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
