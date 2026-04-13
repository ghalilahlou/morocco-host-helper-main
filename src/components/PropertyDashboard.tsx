import { useState, useEffect } from 'react';
import { Property, Booking } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { PropertySelector } from './PropertySelector';
import { Dashboard } from './Dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, Users, FileCheck } from 'lucide-react';
import { SimpleUploadTest } from './SimpleUploadTest';
import { DocumentAccessTest } from './DocumentAccessTest';
import { SecureUploadTest } from './SecureUploadTest';

interface PropertyDashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
}

export const PropertyDashboard = ({ onNewBooking, onEditBooking }: PropertyDashboardProps) => {
  const { properties, isLoading: propertiesLoading } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  // ✅ PHASE 1 : Passer selectedProperty.id pour filtrer les réservations
  const { bookings, refreshBookings, isLoading: bookingsLoading } = useBookings({ 
    propertyId: selectedProperty?.id 
  });
  const [airbnbReservationsCount, setAirbnbReservationsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBookings();
      const currentFilteredBookings = selectedProperty 
        ? bookings.filter(booking => booking.propertyId === selectedProperty.id)
        : [];
      console.log('🔄 Manual refresh completed. Total bookings:', bookings.length);
      console.log('🔄 Bookings for selected property:', currentFilteredBookings.length);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-select first property when properties load
  useEffect(() => {
    if (properties.length > 0 && !selectedProperty) {
      setSelectedProperty(properties[0]);
    }
  }, [properties, selectedProperty]);

  // Load Airbnb reservations count when selected property changes
  useEffect(() => {
    const loadAirbnbCount = async () => {
      if (!selectedProperty?.id) return;
      
      try {
        const reservations = await AirbnbEdgeFunctionService.getReservations(selectedProperty.id);
        setAirbnbReservationsCount(reservations.length);
      } catch (error) {
        console.error('Error loading Airbnb reservations count:', error);
        setAirbnbReservationsCount(0);
      }
    };
    
    loadAirbnbCount();
  }, [selectedProperty?.id]);

  const filteredBookings = selectedProperty 
    ? bookings.filter(booking => booking.propertyId === selectedProperty.id)
: [];

  // ✅ DIAGNOSTIC CRITIQUE : Vérifier ce qui arrive dans filteredBookings
  useEffect(() => {
    if (selectedProperty) {
      console.log('🚨 [PROPERTY DASHBOARD DIAGNOSTIC]', {
        selectedPropertyId: selectedProperty.id,
        totalBookings: bookings.length,
        filteredBookings: filteredBookings.length,
        bookingsList: filteredBookings.map(b => ({
          id: b.id.substring(0, 8),
          propertyId: b.propertyId,
          guestName: b.guest_name,
          status: b.status,
          checkIn: b.checkInDate
        }))
      });
    }
  }, [selectedProperty, bookings, filteredBookings.length]);

  // Refresh bookings immediately when a deletion event is emitted
  useEffect(() => {
    const handler = () => {
      refreshBookings();
    };
    window.addEventListener('booking-deleted', handler as EventListener);
    return () => window.removeEventListener('booking-deleted', handler as EventListener);
  }, [refreshBookings]);



  // Total = réservations (bookings) uniquement ; ne pas additionner Airbnb pour éviter 50+29=79
  const completedCount = filteredBookings.filter(b =>
    b.documentsGenerated?.contract && b.documentsGenerated?.policeForm
  ).length;
  const stats = {
    total: filteredBookings.length,
    pending: filteredBookings.length - completedCount - filteredBookings.filter(b => b.status === 'archived').length,
    completed: completedCount,
    archived: filteredBookings.filter(b => b.status === 'archived').length,
    airbnb: airbnbReservationsCount,
  };

  if (propertiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement Biens…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gestion des biens</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your Airbnb listings and bookings
            </p>
          </div>
          {selectedProperty && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing || bookingsLoading}
              >
                {isRefreshing ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          )}
        </div>
        
        <PropertySelector
          properties={properties}
          selectedProperty={selectedProperty}
          onPropertySelect={setSelectedProperty}
          isLoading={propertiesLoading}
        />
      </div>

      {/* Property Overview */}
      {selectedProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedProperty.name}
            </CardTitle>
            <CardDescription>
              {selectedProperty.address && (
                <span>{selectedProperty.address} • </span>
              )}
              {selectedProperty.property_type} • Max {selectedProperty.max_occupancy} guests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg sm:text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total Bookings</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-primary">{stats.pending}</div>
                  <div className="text-xs text-muted-foreground">En attente</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-500" />
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-emerald-500">{stats.completed}</div>
                  <div className="text-xs text-muted-foreground">Terminé</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.archived}</div>
                  <div className="text-xs text-muted-foreground">Archivé</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
                <Calendar className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.airbnb}</div>
                  <div className="text-xs text-muted-foreground">Airbnb</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Upload Documents */}
      {selectedProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧪 Test Upload Documents
            </CardTitle>
            <CardDescription>
              Testez l'upload des pièces d'identité pour identifier le problème
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleUploadTest />
          </CardContent>
        </Card>
      )}

      {/* Test Accès Documents */}
      {selectedProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📄 Test Accès Documents d'Identité
            </CardTitle>
            <CardDescription>
              Testez l'accès et l'affichage des pièces d'identité (PDF et images)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentAccessTest />
          </CardContent>
        </Card>
      )}

      {/* Test Upload Sécurisé */}
      {selectedProperty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔒 Test Upload Sécurisé
            </CardTitle>
            <CardDescription>
              Testez l'upload avec des noms de fichiers sécurisés (sans caractères spéciaux)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecureUploadTest />
          </CardContent>
        </Card>
      )}

      {/* Bookings Dashboard */}
      {selectedProperty && (
        <Dashboard
          onNewBooking={onNewBooking}
          onEditBooking={onEditBooking}
          bookings={filteredBookings}
          onRefreshBookings={refreshBookings}
          propertyId={selectedProperty.id}
          airbnbIcsUrl={selectedProperty.airbnb_ics_url}
          bookingsLoading={bookingsLoading}
        />
      )}
    </div>
  );
};