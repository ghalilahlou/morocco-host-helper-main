import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Building2, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  LogOut,
  Plus,
  Eye,
  Edit,
  Trash2,
  CreditCard,
  BarChart3,
  PieChart,
  Activity,
  UserPlus,
  Shield,
  Target,
  ArrowLeft
} from 'lucide-react';
import { useAdminContext } from '@/contexts/AdminContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminBookings } from '@/components/admin/AdminBookings';
import { AdminTokens } from '@/components/admin/AdminTokens';
import { AdminProperties } from '@/components/admin/AdminProperties';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isLoading, dashboardData } = useAdminContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // TODO: Réimplémenter loadDashboardData dans le contexte si nécessaire
  // useEffect(() => {
  //   if (isAdmin) {
  //     loadDashboardData();
  //   }
  // }, [isAdmin]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté avec succès."
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Erreur de déconnexion",
        description: "Une erreur s'est produite lors de la déconnexion.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du dashboard administrateur...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder au dashboard administrateur.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour Client
              </Button>
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Dashboard Administrateur
                </h1>
                <p className="text-sm text-gray-500">
                  Super User - Gestion globale de l'application
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Target className="h-4 w-4 mr-1" />
                Super Admin
              </Badge>
              <div className="text-sm text-gray-500">
                Connecté en tant que {user?.email}
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Vue d'ensemble</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Utilisateurs</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Réservations</span>
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Propriétés</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Tokens</span>
            </TabsTrigger>
          </TabsList>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Utilisateurs totaux</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData?.stats.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +12% par rapport au mois dernier
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Propriétés</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData?.stats.totalProperties || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +5% par rapport au mois dernier
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Réservations</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData?.stats.totalBookings || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +8% par rapport au mois dernier
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('fr-FR', { 
                      style: 'currency', 
                      currency: 'MAD' 
                    }).format(dashboardData?.stats.totalRevenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +15% par rapport au mois dernier
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Graphiques rapides */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Réservations récentes</CardTitle>
                  <CardDescription>
                    Les 10 dernières réservations créées
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(dashboardData?.recentBookings || []).slice(0, 5).map((booking: any) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{booking.bookingReference}</p>
                          <p className="text-sm text-gray-500">
                            {booking.properties?.name || 'Propriété inconnue'}
                          </p>
                        </div>
                        <Badge variant={booking.status === 'completed' ? 'default' : 'secondary'}>
                          {booking.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Utilisateurs récents</CardTitle>
                  <CardDescription>
                    Les 10 derniers utilisateurs inscrits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(dashboardData?.recentUsers || []).slice(0, 5).map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{user.email}</p>
                          <p className="text-sm text-gray-500">
                            Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Badge variant="outline">Nouveau</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics">
            <AdminAnalytics data={dashboardData} />
          </TabsContent>

          {/* Utilisateurs */}
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>

          {/* Réservations */}
          <TabsContent value="bookings">
            <AdminBookings />
          </TabsContent>

          {/* Propriétés */}
          <TabsContent value="properties">
            <AdminProperties />
          </TabsContent>

          {/* Tokens */}
          <TabsContent value="tokens">
            <AdminTokens />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
