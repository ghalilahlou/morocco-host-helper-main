import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, Users, Link as LinkIcon, ArrowLeft, Edit, HelpCircle } from 'lucide-react';
import { Property, Booking } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { useToast } from '@/hooks/use-toast';
import { Dashboard } from './Dashboard';
import { BookingWizardWithBoundary as BookingWizard } from './BookingWizard';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { PropertyTutorial } from './PropertyTutorial';
import { supabase } from '@/integrations/supabase/client';



export const PropertyDetail = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { getPropertyById, isLoading: propertiesLoading, properties } = useProperties();
  // ✅ PHASE 1 : Passer propertyId pour filtrer les réservations
  const { bookings, deleteBooking, refreshBookings } = useBookings({ propertyId: propertyId || undefined });
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { generatePropertyVerificationUrl, isLoading: isGeneratingLink } = useGuestVerification();
  const { toast } = useToast();
  
  // All state hooks
  const [property, setProperty] = useState<Property | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | undefined>();
  const [showEditProperty, setShowEditProperty] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [airbnbReservationsCount, setAirbnbReservationsCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // ✅ NETTOYAGE STRICT : Référence du propertyId précédent pour détecter les changements
  const previousPropertyIdRef = useRef<string | undefined>(propertyId);

  // All useCallback hooks MUST be before any early returns
  const loadAirbnbCount = useCallback(async () => {
    if (!property?.id) return;
    
    try {
      // ✅ CORRIGÉ : Charger seulement les réservations Airbnb actives (non passées)
      // Pour correspondre à ce qui est affiché dans le calendrier
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: reservations, error } = await supabase
        .from('airbnb_reservations')
        .select('id, start_date, end_date')
        .eq('property_id', property.id)
        .gte('end_date', today.toISOString().split('T')[0]) // Seulement les réservations non terminées
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error loading Airbnb reservations count:', error);
        setAirbnbReservationsCount(0);
        return;
      }
      
      // ✅ DIAGNOSTIC : Log pour vérifier le comptage
      console.log('🔍 [PROPERTY DETAIL] Airbnb reservations count:', {
        propertyId: property.id,
        totalReservations: reservations?.length || 0,
        today: today.toISOString().split('T')[0],
        reservations: reservations?.map(r => ({
          id: r.id.substring(0, 8),
          start: r.start_date,
          end: r.end_date
        }))
      });
      
      setAirbnbReservationsCount(reservations?.length || 0);
    } catch (error) {
      console.error('Error loading Airbnb reservations count:', error);
      setAirbnbReservationsCount(0);
    }
  }, [property?.id]);

  const handleNewBooking = useCallback(() => {
    setEditingBooking(undefined);
    setShowWizard(true);
  }, []);

  const handleEditBooking = useCallback((booking: Booking) => {
    setEditingBooking(booking);
    setShowWizard(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setShowWizard(false);
    setEditingBooking(undefined);
    // Refresh bookings and Airbnb data after wizard closes
    refreshBookings();
    loadAirbnbCount(); // Recharger aussi le compte Airbnb
  }, [refreshBookings, loadAirbnbCount]);

  const handleGenerateGuestLink = useCallback(async (event?: React.MouseEvent) => {
    // ✅ PROTECTION IMMÉDIATE : Bloquer si déjà en cours
    if (isGeneratingLocal || isGeneratingLink) {
      console.warn('⚠️ Génération déjà en cours, clic ignoré');
      return;
    }

    if (!property?.id) return;
    
    // ✅ BLOQUER IMMÉDIATEMENT (avant même l'appel API)
    setIsGeneratingLocal(true);

    try {
      // ✅ SIMPLIFIÉ : Le lien est automatiquement copié dans le hook
      // ✅ MOBILE-OPTIMIZED : Préserver l'événement utilisateur complet pour la copie mobile
      const userEvent = event || undefined;
      await generatePropertyVerificationUrl(property.id, undefined, {
        userEvent: userEvent
      });
      // Le toast de succès est déjà affiché dans le hook
    } catch (error) {
      console.error('❌ Erreur lors de la génération du lien:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le lien. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      // ✅ TOUJOURS réinitialiser le flag local
      setIsGeneratingLocal(false);
    }
  }, [property?.id, generatePropertyVerificationUrl, toast, isGeneratingLocal, isGeneratingLink]);

  // All useEffect hooks

  // ✅ NETTOYAGE STRICT : Vider l'état si le propertyId de l'URL change
  useEffect(() => {
    const currentPropertyId = propertyId;
    const previousPropertyId = previousPropertyIdRef.current;
    
    // Si le propertyId a changé, vider complètement l'état
    if (previousPropertyId !== undefined && previousPropertyId !== currentPropertyId) {
      console.log('🧹 [PROPERTY DETAIL] Nettoyage strict : propertyId de l\'URL a changé, vidage de l\'état', {
        previousPropertyId,
        currentPropertyId
      });
      
      // Vider l'état de la propriété
      setProperty(null);
      
      // Les bookings seront automatiquement vidés par useBookings grâce au nettoyage strict
      // mais on peut forcer un refresh pour être sûr
      refreshBookings();
    }
    
    // Mettre à jour la référence
    previousPropertyIdRef.current = currentPropertyId;
  }, [propertyId, refreshBookings]);

  useEffect(() => {
    // Check authentication first
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Only proceed if we have propertyId, user is authenticated
    if (propertyId && isAuthenticated && !propertiesLoading && properties.length > 0) {
      const foundProperty = getPropertyById(propertyId);
      if (foundProperty) {
        setProperty(foundProperty);
      } else {
        // Property not found after properties loaded - redirect
        setTimeout(() => navigate('/'), 100);
      }
    }
  }, [propertyId, getPropertyById, navigate, isAuthenticated, authLoading, propertiesLoading, properties]);

  // Load count when property changes and on page focus (after sync)
  useEffect(() => {
    loadAirbnbCount();
    
    // Recharger quand la page reprend le focus (ex: retour depuis sync help)
    const handleFocus = () => {
      loadAirbnbCount();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadAirbnbCount]);


  // Refresh bookings immediately when a deletion event is emitted
  useEffect(() => {
    const handler = () => {
      refreshBookings();
    };
    window.addEventListener('booking-deleted', handler as EventListener);
    return () => window.removeEventListener('booking-deleted', handler as EventListener);
  }, [refreshBookings]);

  // Show tutorial on first visit (only on first client login)
  useEffect(() => {
    if (property) {
      const tutorialKey = 'client-dashboard-tutorial-seen';
      const hasSeenTutorial = localStorage.getItem(tutorialKey);
      if (!hasSeenTutorial) {
        // Small delay to ensure elements are rendered
        setTimeout(() => setShowTutorial(true), 500);
      }
    }
  }, [property]);

  // ✅ DIAGNOSTIC : Log pour vérifier le filtrage et identifier les problèmes
  useEffect(() => {
    if (property?.id && bookings.length > 0) {
      const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);
      const bookingsWithPropertyId = bookings.filter(b => b.propertyId === property.id);
      const bookingsWithoutPropertyId = bookings.filter(b => !b.propertyId);
      const bookingsWithOtherPropertyId = bookings.filter(b => b.propertyId && b.propertyId !== property.id);

      // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
      // Ce log était dans un useEffect et s'exécutait à chaque changement de bookings/property
      // console.log('🔍 [PROPERTY DETAIL] Diagnostic du filtrage des réservations:', ...);

      // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
      // Ces logs étaient dans un useEffect et s'exécutaient à chaque changement
      // if (bookingsWithOtherPropertyId.length > 0) {
      //   console.warn('⚠️ [PROPERTY DETAIL] PROBLÈME DÉTECTÉ: Des réservations d\'autres propriétés sont présentes!', ...);
      // }
      // if (bookingsWithoutPropertyId.length > 0) {
      //   console.warn('⚠️ [PROPERTY DETAIL] PROBLÈME DÉTECTÉ: Des réservations sans propertyId sont présentes!', ...);
      // }
    }
  }, [bookings, property?.id, airbnbReservationsCount]);

  const handleTutorialComplete = () => {
    localStorage.setItem('client-dashboard-tutorial-seen', 'true');
    setShowTutorial(false);
  };

  const handleStartTutorial = () => {
    setShowTutorial(true);
  };

  if (!property && propertiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement Biens…</p>
        </div>
      </div>
    );
  }

  if (!property && !propertiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Bien non trouvé</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Retour aux biens
          </Button>
        </div>
      </div>
    );
  }

  // Filter bookings by this property
  const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);

  const stats = {
    total: propertyBookings.length + airbnbReservationsCount,
    pending: propertyBookings.filter(b => b.status === 'pending').length + airbnbReservationsCount,
    completed: propertyBookings.filter(b => b.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Flèche retour + Titre "Tableau de bord" selon modèle Figma */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/dashboard')} 
          className="gap-2 text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Tableau de bord</span>
        </Button>
      </div>

      {/* Property Card - aligné exactement sur le modèle Figma */}
      <Card className="border-0 shadow-sm rounded-2xl" style={{ backgroundColor: '#F9FAFB' }}>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Partie gauche : Icône + Nom + Infos */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Icône propriété */}
              {property.photo_url ? (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: '#E5E7EB' }}>
                  <img 
                    src={property.photo_url} 
                    alt={property.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E5E7EB' }}>
                  <Building2 className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
                </div>
              )}
              
              {/* Nom et infos */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg md:text-xl font-bold text-black truncate">
                    {property.name}
                  </h2>
                  {property.property_type && (
                    <span className="px-2 py-0.5 rounded-full bg-[#0BD9D0]/10 text-[#0BD9D0] text-xs font-medium">
                      {property.property_type}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{property.max_occupancy} guests</span>
                  </div>
                  {property.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{property.address?.split(',')[0]?.trim()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Partie droite : Stats + Boutons */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-shrink-0">
              {/* Stats selon modèle Figma (37 / 23 / 14) */}
              <div className="flex items-center gap-4">
                <div className="text-xl md:text-2xl font-bold text-black">
                  {stats.total} Total
                </div>
                <div className="text-xl md:text-2xl font-bold" style={{ color: '#059669' }}>
                  {stats.completed} Terminé
                </div>
                <div className="text-xl md:text-2xl font-bold text-gray-500">
                  {stats.pending} En attente
                </div>
              </div>
              
              {/* Boutons selon modèle Figma */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => handleGenerateGuestLink(e)}
                  disabled={isGeneratingLocal || isGeneratingLink}
                  className="gap-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                  data-tutorial="generate-link"
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">Copier le lien</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleStartTutorial}
                  className="gap-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                  data-tutorial="tutorial-button"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Tutoriel</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Dashboard (Calendrier) */}
      <div data-tutorial="bookings">
        <Dashboard
          bookings={propertyBookings}
          onNewBooking={handleNewBooking}
          onEditBooking={handleEditBooking}
          onDeleteBooking={deleteBooking}
          onRefreshBookings={refreshBookings}
          propertyId={property.id}
        />
      </div>

      {/* Tutorial */}
      {showTutorial && (
        <PropertyTutorial onComplete={handleTutorialComplete} />
      )}

      {/* Dialogs */}
      {showWizard && (
        <BookingWizard
          propertyId={property.id}
          onClose={handleCloseWizard}
          editingBooking={editingBooking}
        />
      )}

      <CreatePropertyDialog 
        open={showEditProperty} 
        onOpenChange={setShowEditProperty}
        property={property}
        onSuccess={() => {
          // Refresh the property data after successful update
          const updatedProperty = getPropertyById(propertyId!);
          if (updatedProperty) {
            setProperty(updatedProperty);
          }
        }}
      />
    </div>
  );
};