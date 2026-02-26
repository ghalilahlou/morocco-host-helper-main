import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Plus, 
  Calendar, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { PropertyList } from '@/components/PropertyList';
import { CreatePropertyDialog } from '@/components/CreatePropertyDialog';
import { useT } from '@/i18n/GuestLocaleProvider';

export const MainDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { properties, isLoading: propertiesLoading, refreshProperties } = useProperties();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const t = useT();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('mainDashboard.logoutSuccess'),
        description: t('mainDashboard.logoutSuccessDesc')
      });
      navigate('/');
    } catch (error) {
      toast({
        title: t('mainDashboard.logoutError'),
        description: t('mainDashboard.logoutErrorDesc'),
        variant: "destructive"
      });
    }
  };

  const handlePropertySelect = (property: any) => {
    navigate(`/dashboard/property/${property.id}`);
  };

  // Statistiques
  const stats = {
    totalProperties: properties?.length || 0,
    totalBookings: bookings?.length || 0,
    pendingBookings: bookings?.filter(b => b.status === 'pending').length || 0,
    completedBookings: bookings?.filter(b => b.status === 'completed').length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img
                src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png"
                alt="Checky Logo"
                className="w-8 h-8 object-contain"
              />
              <h1 className="text-xl font-semibold text-gray-900">{t('mainDashboard.title')}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {t('mainDashboard.welcome', { email: user?.email || '' })}
              </span>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('mainDashboard.logout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('mainDashboard.stats.properties')}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                {t('mainDashboard.stats.propertiesRegistered')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('mainDashboard.stats.bookings')}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
              <p className="text-xs text-muted-foreground">
                {t('mainDashboard.stats.totalBookings')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('mainDashboard.stats.pending')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingBookings}</div>
              <p className="text-xs text-muted-foreground">
                {t('mainDashboard.stats.pendingBookings')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('mainDashboard.stats.completed')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedBookings}</div>
              <p className="text-xs text-muted-foreground">
                {t('mainDashboard.stats.completedBookings')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowCreateDialog(true)}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>{t('mainDashboard.actions.newProperty')}</span>
              </CardTitle>
              <CardDescription>
                {t('mainDashboard.actions.newPropertyDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/profile')}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{t('mainDashboard.actions.profile')}</span>
              </CardTitle>
              <CardDescription>
                {t('mainDashboard.actions.profileDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/account-settings')}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>{t('mainDashboard.actions.settings')}</span>
              </CardTitle>
              <CardDescription>
                {t('mainDashboard.actions.settingsDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/change-password')}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{t('mainDashboard.actions.security')}</span>
              </CardTitle>
              <CardDescription>
                {t('mainDashboard.actions.securityDesc')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Liste des propriétés */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('mainDashboard.myProperties')}</h2>
              <Button onClick={() => setShowCreateDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('properties.addProperty')}
              </Button>
            </div>
          </div>
          <div className="p-6">
            <PropertyList onPropertySelect={handlePropertySelect} />
          </div>
        </div>

        {/* Modale de création de propriété */}
        <CreatePropertyDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={refreshProperties}
        />
      </main>
    </div>
  );
};
