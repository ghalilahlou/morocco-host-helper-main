import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Building2, Edit, MapPin, Users, FileText, Calendar, Link as LinkIcon, ChevronDown, CheckCircle, ExternalLink, HelpCircle, MessageCircleQuestion } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Property, Booking } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { useToast } from '@/hooks/use-toast';
import { Dashboard } from './Dashboard';
import { BookingWizardWithBoundary as BookingWizard } from './BookingWizard';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { TestDocumentUpload } from './TestDocumentUpload';
import { AirbnbSyncManager } from './AirbnbSyncManager';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { BOOKING_COLORS } from '@/constants/bookingColors';
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
  const [airbnbSyncCompleted, setAirbnbSyncCompleted] = useState(false);
  const [clientLinkShared, setClientLinkShared] = useState(false);
  const [showRemainingActions, setShowRemainingActions] = useState(true);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false); // ✅ State local pour bloquer immédiatement
  const [airbnbReservationsCount, setAirbnbReservationsCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);

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
  useEffect(() => {
    if (airbnbSyncCompleted && clientLinkShared) {
      setShowRemainingActions(false);
      // Store the state to prevent showing again for this property
      localStorage.setItem(`actions-completed-${property?.id}`, 'true');
    }
  }, [airbnbSyncCompleted, clientLinkShared, property?.id]);

  useEffect(() => {
    if (property) {
      // Check if actions were already completed for this property
      const actionsCompleted = localStorage.getItem(`actions-completed-${property.id}`);
      if (actionsCompleted) {
        setShowRemainingActions(false);
      }
      
      // Synchronisation considérée comme terminée si on a une URL ICS OU des réservations Airbnb
      setAirbnbSyncCompleted(!!property.airbnb_ics_url || airbnbReservationsCount > 0);
    }
  }, [property, airbnbReservationsCount]);

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

      console.log('🔍 [PROPERTY DETAIL] Diagnostic du filtrage des réservations:', {
        propertyId: property.id,
        totalBookingsFromHook: bookings.length,
        filteredBookings: propertyBookings.length,
        bookingsWithCorrectPropertyId: bookingsWithPropertyId.length,
        bookingsWithoutPropertyId: bookingsWithoutPropertyId.length,
        bookingsWithOtherPropertyId: bookingsWithOtherPropertyId.length,
        airbnbReservationsCount,
        statsTotal: propertyBookings.length + airbnbReservationsCount,
        bookingDetails: bookings.map(b => ({
          id: b.id.substring(0, 8),
          propertyId: b.propertyId,
          matches: b.propertyId === property.id,
          status: b.status,
          checkIn: b.checkInDate
        }))
      });

      // ⚠️ ALERTE si des réservations d'autres propriétés sont présentes
      if (bookingsWithOtherPropertyId.length > 0) {
        console.warn('⚠️ [PROPERTY DETAIL] PROBLÈME DÉTECTÉ: Des réservations d\'autres propriétés sont présentes!', {
          expectedPropertyId: property.id,
          otherPropertyIds: [...new Set(bookingsWithOtherPropertyId.map(b => b.propertyId))],
          count: bookingsWithOtherPropertyId.length
        });
      }

      // ⚠️ ALERTE si des réservations sans propertyId sont présentes
      if (bookingsWithoutPropertyId.length > 0) {
        console.warn('⚠️ [PROPERTY DETAIL] PROBLÈME DÉTECTÉ: Des réservations sans propertyId sont présentes!', {
          count: bookingsWithoutPropertyId.length,
          bookingIds: bookingsWithoutPropertyId.map(b => b.id.substring(0, 8))
        });
      }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2 hover:bg-[hsl(var(--teal-hover))] hover:text-white w-fit">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Retour à Vos Propriétés</span>
          <span className="sm:hidden">Retour</span>
        </Button>
      </div>

      {/* Property Header - aligné sur le modèle Figma */}
      <Card className="border-0 shadow-md rounded-2xl bg-white relative">
        <CardHeader className="pb-4">
          {/* Mobile help trigger - top right */}
          <div className="absolute top-4 right-4 sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0"
                  aria-label="Aide"
                  data-tutorial="tutorial-button"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="bg-background border shadow-lg z-50">
                <DropdownMenuItem onClick={handleStartTutorial}>
                  Visite Guidée
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/help/client-link/${property?.id}`)}>
                  Lien de check-in
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
            
            {/* Property Info Section */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 lg:max-w-[50%] xl:max-w-[45%] pr-4 lg:pr-8">
              {property.photo_url ? (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img 
                    src={property.photo_url} 
                    alt={property.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                  <CardTitle className="text-lg sm:text-xl font-bold truncate">
                    {property.name}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs w-fit flex-shrink-0">{property.property_type}</Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  {property.address && (
                    <div className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-[300px] lg:max-w-[250px] xl:max-w-[350px]">{property.address?.split(',')[0]?.trim()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Users className="h-3 w-3 flex-shrink-0" />
                    <span>{property.max_occupancy}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats and Actions Section */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-shrink-0">
              {/* Compact Stats - style Figma (37 / 23 / 14) */}
              <div className="flex items-center justify-center lg:justify-end gap-4" data-tutorial="stats">
                <div className="flex flex-col items-center min-w-[70px]">
                  <div className="px-4 py-1 rounded-xl bg-slate-100 text-slate-900 text-lg sm:text-xl lg:text-2xl font-bold">
                    {stats.total}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    Total
                  </div>
                </div>
                <div className="flex flex-col items-center min-w-[70px]">
                  <div
                    className="px-4 py-1 rounded-xl text-lg sm:text-xl lg:text-2xl font-bold"
                    style={{ backgroundColor: '#E0F9EF', color: '#059669' }}
                  >
                    {stats.completed}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    Terminé
                  </div>
                </div>
                <div className="flex flex-col items-center min-w-[70px]">
                  <div
                    className="px-4 py-1 rounded-xl text-lg sm:text-xl lg:text-2xl font-bold"
                    style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                  >
                    {stats.pending}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    En attente
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowEditProperty(true)} 
                  className="gap-2 hover:bg-[hsl(var(--teal-hover))] hover:text-white bg-white"
                  data-tutorial="edit-property"
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">Modifier le bien</span>
                </Button>
                <Button 
                  size="sm"
                  onClick={(e) => handleGenerateGuestLink(e)}
                  disabled={isGeneratingLocal || isGeneratingLink}
                  className="gap-2 hover:bg-[hsl(var(--teal-hover))] hover:text-white bg-white"
                  data-tutorial="generate-link"
                  variant="outline"
                >
                  {isGeneratingLocal || isGeneratingLink ? (
                    <>
                      <div className="h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs sm:text-sm">Génération...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">Copier le lien</span>
                    </>
                  )}
                </Button>
                {/* Help dropdown inline - single trigger to keep position correct */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="hidden sm:flex gap-2 hover:bg-[hsl(var(--teal-hover))] hover:text-white bg-white"
                      data-tutorial="tutorial-button"
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Comment ça marche ?</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="bg-background border shadow-lg z-50">
                    <DropdownMenuItem onClick={handleStartTutorial}>
                      Visite Guidée
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/help/client-link/${property?.id}`)}>
                      Lien de check-in
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>


      {/* Actions restantes */}
      {showRemainingActions && (
        <Card data-tutorial="remaining-actions">
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Actions restantes
                    </CardTitle>
                    <CardDescription>
                      Réalisez les actions restantes pour finaliser la configuration de votre bien
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="airbnb-sync" 
                      checked={airbnbSyncCompleted}
                      onCheckedChange={(checked) => setAirbnbSyncCompleted(!!checked)}
                    />
                    <label 
                      htmlFor="airbnb-sync" 
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        airbnbSyncCompleted ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      Synchronisation du calendrier Airbnb
                    </label>
                  </div>
                  <Link to={`/help/airbnb-sync/${property?.id}`} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 ml-auto sm:ml-0">
                    En savoir plus
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="client-link" 
                      checked={clientLinkShared}
                      onCheckedChange={(checked) => setClientLinkShared(!!checked)}
                    />
                    <label 
                      htmlFor="client-link" 
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        clientLinkShared ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      Partagez le lien à vos clients
                    </label>
                  </div>
                  <Link to={`/help/client-link/${property?.id}`} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 ml-auto sm:ml-0">
                    En savoir plus
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}


      {/* Test Document Upload */}
      {propertyBookings.length > 0 && (
        <TestDocumentUpload bookingId={propertyBookings[0].id} />
      )}


      {/* Bookings Dashboard */}
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