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
  Users, 
  Search, 
  Filter, 
  RefreshCw,
  Eye,
  UserPlus,
  Calendar,
  Mail
} from 'lucide-react';
import { useAdminContext } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { AdminUser } from '@/types/admin';

interface EnhancedUser {
  id: string;
  email: string;
  full_name: string;
  user_name?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  role: string;
  properties_count: number;
  is_property_owner: boolean;
  last_booking_date?: string;
  total_bookings: number;
}

export const AdminUsers = () => {
  const { isAdmin } = useAdminContext();
  const [users, setUsers] = useState<EnhancedUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<EnhancedUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      console.log('🔄 [AdminUsers] Chargement des utilisateurs enrichis...');
      
      // Utiliser la fonction SQL get_users_for_admin qui fonctionne
      const { data: authUsers, error: authError } = await supabase.rpc('get_all_users_for_admin');
      
      if (authError) {
        console.error('❌ Erreur récupération utilisateurs:', authError);
        return;
      }
      
      // authUsers est déjà un array d'utilisateurs enrichis
      if (!authUsers || !Array.isArray(authUsers)) {
        console.error('❌ Format données utilisateurs invalide');
        return;
      }
      console.log('✅ Utilisateurs auth récupérés:', authUsers.length);
      
      // Les données sont déjà enrichies par get_users_for_admin
      // Convertir au format EnhancedUser pour l'interface
      const enrichedUsers: EnhancedUser[] = authUsers.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        full_name: user.full_name || user.user_name || user.email || 'Utilisateur',
        user_name: user.user_name || user.email?.split('@')[0],
        created_at: user.created_at,
        last_login: user.last_sign_in_at || user.last_login,
        is_active: user.is_admin_active !== false,
        role: user.admin_role || (user.properties_count > 0 ? 'propriétaire' : 'user'),
        properties_count: Number(user.properties_count) || 0,
        is_property_owner: (user.properties_count || 0) > 0,
        last_booking_date: user.last_booking_date,
        total_bookings: Number(user.total_bookings) || 0
      }));
      
      setUsers(enrichedUsers);
      console.log('✅ [AdminUsers] Utilisateurs enrichis chargés:', enrichedUsers.length);
      
    } catch (error) {
      console.error('❌ [AdminUsers] Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(term) ||
      user.full_name.toLowerCase().includes(term) ||
      (user.user_name || '').toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  const handleRefresh = async () => {
    await loadUsers();
  };

  const getStatusBadge = (user: EnhancedUser) => {
    if (user.is_active) {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    }
    return <Badge variant="secondary">Inactif</Badge>;
  };

  const getRoleBadge = (user: EnhancedUser) => {
    if (user.role === 'super_admin') {
      return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>;
    }
    if (user.role === 'admin') {
      return <Badge className="bg-blue-100 text-blue-800">Admin</Badge>;
    }
    if (user.is_property_owner) {
      return <Badge className="bg-orange-100 text-orange-800">Propriétaire</Badge>;
    }
    return <Badge variant="outline">Client</Badge>;
  };

  const getPropertyBadge = (user: EnhancedUser) => {
    if (user.properties_count > 0) {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          {user.properties_count} propriété{user.properties_count > 1 ? 's' : ''}
        </Badge>
      );
    }
    return <Badge variant="outline">Aucune</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h2>
          <p className="text-gray-600">
            Gérez tous les utilisateurs de l'application
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Tous les utilisateurs inscrits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisateurs actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nouveaux ce mois</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => {
                const createdDate = new Date(u.created_at);
                const now = new Date();
                return createdDate.getMonth() === now.getMonth() && 
                       createdDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Inscriptions ce mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriétaires</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.is_property_owner).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ont des propriétés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche et filtres</CardTitle>
          <CardDescription>
            Trouvez rapidement les utilisateurs que vous recherchez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par email, nom ou nom d'utilisateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table des utilisateurs */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            {filteredUsers.length} utilisateur(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur (Email / Nom)</TableHead>
                  <TableHead>Rôle</TableHead>
                <TableHead>Propriétés</TableHead>
                <TableHead>Réservations</TableHead>
                <TableHead>Date d'inscription</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.user_name || user.full_name}</span>
                      <span className="text-sm text-gray-500">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user)}
                  </TableCell>
                  <TableCell>
                    {getPropertyBadge(user)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{user.total_bookings} réservation{user.total_bookings > 1 ? 's' : ''}</div>
                      {user.last_booking_date && (
                        <div className="text-gray-500">
                          Dernière: {new Date(user.last_booking_date).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    {user.last_login ? (
                      new Date(user.last_login).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })
                    ) : (
                      <span className="text-gray-400">Jamais</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" title="Voir détails">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Modifier">
                        Modifier
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {searchTerm ? 'Aucun utilisateur trouvé pour cette recherche' : 'Aucun utilisateur trouvé'}
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
          <CardTitle>Informations sur les utilisateurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <UserPlus className="h-4 w-4 mr-2 text-blue-600" />
                Types d'utilisateurs
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>• <strong>Client</strong> : Utilisateur standard sans propriété</div>
                <div>• <strong>Propriétaire</strong> : Utilisateur qui possède des propriétés</div>
                <div>• <strong>Admin</strong> : Accès administrateur limité</div>
                <div>• <strong>Super Admin</strong> : Accès complet à toutes les fonctionnalités</div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-green-600" />
                Gestion des comptes
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>• <strong>Propriétés</strong> : Nombre de biens immobiliers possédés</div>
                <div>• <strong>Réservations</strong> : Historique des réservations reçues</div>
                <div>• <strong>Dernière connexion</strong> : Indique l'activité récente</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
