import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Building2, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  CreditCard,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { AdminStats as AdminStatsType } from '@/types/admin';

interface AdminStatsProps {
  stats: AdminStatsType;
}

export const AdminStats: React.FC<AdminStatsProps> = ({ stats }) => {
  const statCards = [
    {
      title: "Total Utilisateurs",
      value: stats.totalUsers,
      icon: Users,
      description: "Utilisateurs inscrits",
      color: "text-blue-600"
    },
    {
      title: "Total Propriétés",
      value: stats.totalProperties,
      icon: Building2,
      description: "Propriétés enregistrées",
      color: "text-green-600"
    },
    {
      title: "Total Réservations",
      value: stats.totalBookings,
      icon: Calendar,
      description: "Réservations créées",
      color: "text-purple-600"
    },
    {
      title: "Revenus Totaux",
      value: `${stats.totalRevenue.toLocaleString('fr-FR')} €`,
      icon: DollarSign,
      description: "Chiffre d'affaires",
      color: "text-yellow-600"
    },
    {
      title: "Tokens Actifs",
      value: stats.activeTokens,
      icon: CreditCard,
      description: "Tokens disponibles",
      color: "text-indigo-600"
    },
    {
      title: "Réservations en Attente",
      value: stats.pendingBookings,
      icon: Clock,
      description: "En attente de confirmation",
      color: "text-orange-600"
    },
    {
      title: "Réservations Complétées",
      value: stats.completedBookings,
      icon: CheckCircle,
      description: "Réservations terminées",
      color: "text-green-600"
    },
    {
      title: "Réservations Annulées",
      value: stats.cancelledBookings,
      icon: XCircle,
      description: "Réservations annulées",
      color: "text-red-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
