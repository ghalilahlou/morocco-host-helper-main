import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  DollarSign,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { AdminDashboardData } from '@/types/admin';

interface AdminAnalyticsProps {
  data: AdminDashboardData | null;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ data }) => {
  // Créer des données par défaut si pas de données
  const defaultData = {
    bookingAnalytics: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      bookings: Math.floor(Math.random() * 5),
      revenue: Math.floor(Math.random() * 1000)
    })),
    userAnalytics: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      newUsers: Math.floor(Math.random() * 3)
    })),
    propertyAnalytics: [
      {
        propertyId: '1',
        propertyName: 'Propriété Example 1',
        totalBookings: 15,
        totalRevenue: 3500,
        occupancyRate: 75,
        averageRating: 4.5
      },
      {
        propertyId: '2',
        propertyName: 'Propriété Example 2',
        totalBookings: 8,
        totalRevenue: 2100,
        occupancyRate: 60,
        averageRating: 4.2
      }
    ]
  };

  const analyticsData = data || defaultData;

  // Calculer les tendances avec protection contre undefined
  const calculateTrend = (data: any[], key: string) => {
    if (!data || !Array.isArray(data) || data.length < 2) return 0;
    const recent = data[data.length - 1][key] || 0;
    const previous = data[data.length - 2][key] || 0;
    if (previous === 0) return 100;
    return ((recent - previous) / previous) * 100;
  };

  const bookingTrend = calculateTrend(analyticsData.bookingAnalytics || [], 'bookings');
  const userTrend = calculateTrend(analyticsData.userAnalytics || [], 'newUsers');
  const revenueTrend = calculateTrend(analyticsData.bookingAnalytics || [], 'revenue');

  return (
    <div className="space-y-6">
      {/* Tendances principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendance Réservations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {bookingTrend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-2xl font-bold ${bookingTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(bookingTrend).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              vs période précédente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendance Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {userTrend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-2xl font-bold ${userTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(userTrend).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              vs période précédente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendance Revenus</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {revenueTrend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-2xl font-bold ${revenueTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(revenueTrend).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              vs période précédente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques des 30 derniers jours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Évolution des Réservations (30 jours)</CardTitle>
            <CardDescription>
              Nombre de réservations par jour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-1">
              {(analyticsData.bookingAnalytics || []).slice(-30).map((day, index) => {
                const maxBookings = Math.max(...(analyticsData.bookingAnalytics || []).map(d => d.bookings || 0));
                return (
                  <div
                    key={index}
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{
                      height: `${maxBookings > 0 ? (day.bookings / maxBookings) * 100 : 10}%`,
                      minHeight: '4px'
                    }}
                    title={`${day.date}: ${day.bookings} réservations`}
                  />
                );
              })}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Dernières 30 jours
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Évolution des Utilisateurs (30 jours)</CardTitle>
            <CardDescription>
              Nouveaux utilisateurs par jour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-1">
              {(analyticsData.userAnalytics || []).slice(-30).map((day, index) => {
                const maxUsers = Math.max(...(analyticsData.userAnalytics || []).map(d => d.newUsers || 0));
                return (
                  <div
                    key={index}
                    className="flex-1 bg-green-500 rounded-t"
                    style={{
                      height: `${maxUsers > 0 ? (day.newUsers / maxUsers) * 100 : 10}%`,
                      minHeight: '4px'
                    }}
                    title={`${day.date}: ${day.newUsers} nouveaux utilisateurs`}
                  />
                );
              })}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Dernières 30 jours
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques des propriétés */}
      <Card>
        <CardHeader>
          <CardTitle>Performance des Propriétés</CardTitle>
          <CardDescription>
            Statistiques détaillées par propriété
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(analyticsData.propertyAnalytics || []).map((property) => (
              <div key={property.propertyId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{property.propertyName}</h4>
                  <p className="text-sm text-muted-foreground">
                    {property.totalBookings} réservations • {property.totalRevenue.toLocaleString('fr-FR')} €
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {property.occupancyRate.toFixed(1)}% d'occupation
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Note: {property.averageRating.toFixed(1)}/5
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
