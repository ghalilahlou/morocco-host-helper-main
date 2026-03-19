import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, Users, Link as LinkIcon, ArrowLeft, HelpCircle, CalendarDays, ArrowRight, Pencil } from 'lucide-react';
import { Property, Booking } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/hooks/useAuth';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/i18n/GuestLocaleProvider';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Dashboard } from './Dashboard';
import { BookingWizardWithBoundary as BookingWizard } from './BookingWizard';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { PropertyTutorial } from './PropertyTutorial';
import { ShareModal } from './ShareModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { isAirbnbCode } from '@/utils/airbnbCodeFilter';



interface BookingsStatHoverProps {
  label: string;
  count: number;
  bookings: any[];
  className: string;
  formatDate: (d: string) => string;
  extraCount?: number;
}

const BookingsStatHover = ({ label, count, bookings, className, formatDate, extraCount = 0 }: BookingsStatHoverProps) => {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
  );
  const displayed = sorted.slice(0, 12);
  const remaining = bookings.length - displayed.length + extraCount;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`text-xl md:text-2xl font-bold cursor-default hover:opacity-75 transition-opacity ${className}`}
        >
          {count} {label}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="center"
        className="w-80 p-0 rounded-xl shadow-xl border border-gray-200"
      >
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <p className="text-sm font-semibold text-gray-700">
            {count} {label}
          </p>
        </div>
        {bookings.length === 0 && extraCount === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Aucune réservation
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {displayed.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {b.guest_name || b.bookingReference || 'Sans nom'}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {formatDate(b.checkInDate)}
                    <ArrowRight className="w-3 h-3" />
                    {formatDate(b.checkOutDate)}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  (b.documentsGenerated?.contract && b.documentsGenerated?.policeForm)
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {(b.documentsGenerated?.contract && b.documentsGenerated?.policeForm) ? 'Terminé' : 'En attente'}
                </span>
              </div>
            ))}
            {remaining > 0 && (
              <div className="px-4 py-2 text-center text-xs text-gray-400">
                + {remaining} autre{remaining > 1 ? 's' : ''} réservation{remaining > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export const PropertyDetail = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { getPropertyById, isLoading: propertiesLoading, properties } = useProperties();
  // ✅ PHASE 1 : Passer propertyId pour filtrer les réservations
  const { bookings, deleteBooking, refreshBookings } = useBookings({ propertyId: propertyId || undefined });
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { generatePropertyVerificationUrl, isLoading: isGeneratingLink } = useGuestVerification();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // All state hooks
  const [property, setProperty] = useState<Property | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | undefined>();
  const [showEditProperty, setShowEditProperty] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [airbnbReservationsCount, setAirbnbReservationsCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalUrl, setShareModalUrl] = useState<string>('');
  
  // ✅ NETTOYAGE STRICT : Référence du propertyId précédent pour détecter les changements
  const previousPropertyIdRef = useRef<string | undefined>(propertyId);
  
  // ✅ OPTIMISATION : Cache et debounce pour éviter les appels multiples
  const airbnbCountCacheRef = useRef<{ propertyId: string; count: number; timestamp: number } | null>(null);
  const airbnbCountLoadingRef = useRef(false);
  const AIRBNB_CACHE_DURATION = 60000; // 1 minute

  const loadAirbnbCount = useCallback(async () => {
    if (!property?.id) return;

    const cache = airbnbCountCacheRef.current;
    const now = Date.now();
    if (cache && cache.propertyId === property.id && (now - cache.timestamp) < AIRBNB_CACHE_DURATION) {
      setAirbnbReservationsCount(cache.count);
      return;
    }

    if (airbnbCountLoadingRef.current) return;
    airbnbCountLoadingRef.current = true;

    try {
      if (!property.airbnb_ics_url) {
        setAirbnbReservationsCount(0);
        airbnbCountCacheRef.current = { propertyId: property.id, count: 0, timestamp: Date.now() };
        return;
      }

      const { count, error } = await supabase
        .from('airbnb_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', property.id);

      if (error) {
        console.error('Error loading Airbnb count:', error);
        setAirbnbReservationsCount(0);
        return;
      }

      const total = count ?? 0;
      setAirbnbReservationsCount(total);
      airbnbCountCacheRef.current = { propertyId: property.id, count: total, timestamp: Date.now() };
    } catch (error) {
      console.error('Error loading Airbnb count:', error);
      setAirbnbReservationsCount(0);
    } finally {
      airbnbCountLoadingRef.current = false;
    }
  }, [property?.id, property?.airbnb_ics_url]);

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
      const userEvent = event || undefined;
      // Générer le lien sans copie automatique, puis ouvrir le pop-up de partage (même format que réservations)
      const url = await generatePropertyVerificationUrl(property.id, undefined, {
        userEvent: userEvent,
        skipCopy: true
      });
      if (url) {
        if (isMobile) {
          setShareModalUrl(url);
          setShareModalOpen(true);
        } else {
          // ✅ CORRIGÉ : Copie desktop avec fallback execCommand
          // navigator.clipboard.writeText peut échouer si le geste utilisateur
          // a expiré pendant l'appel API (generatePropertyVerificationUrl est async ~1-2s)
          let copied = false;
          
          if (navigator.clipboard && window.isSecureContext) {
            try {
              await navigator.clipboard.writeText(url);
              copied = true;
            } catch (clipErr) {
              console.warn('⚠️ Clipboard API échoué (geste utilisateur expiré), fallback execCommand', clipErr);
            }
          }
          
          // Fallback : textarea + execCommand('copy')
          if (!copied) {
            try {
              const textarea = document.createElement('textarea');
              textarea.value = url;
              textarea.style.position = 'fixed';
              textarea.style.top = '0';
              textarea.style.left = '0';
              textarea.style.width = '1px';
              textarea.style.height = '1px';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              textarea.focus();
              textarea.select();
              textarea.setSelectionRange(0, url.length);
              copied = document.execCommand('copy');
              document.body.removeChild(textarea);
            } catch (fallbackErr) {
              console.error('❌ Fallback execCommand échoué:', fallbackErr);
            }
          }
          
          if (copied) {
            toast({
              title: t('toast.linkCopied'),
              description: t('toast.linkCopiedDesc'),
            });
          } else {
            toast({
              title: t('toast.linkGenerated'),
              description: t('toast.linkGeneratedDesc'),
              duration: 10000,
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la génération du lien:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.cannotCopyLink'),
        variant: "destructive"
      });
    } finally {
      // ✅ TOUJOURS réinitialiser le flag local
      setIsGeneratingLocal(false);
    }
  }, [property?.id, generatePropertyVerificationUrl, toast, isGeneratingLocal, isGeneratingLink, isMobile]);

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

  // Diagnostic removed - was causing unnecessary re-renders on every bookings change

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

  const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);

  const isBookingCompleted = (booking: any) =>
    booking.documentsGenerated?.contract && booking.documentsGenerated?.policeForm;

  const airbnbCodedBookings = propertyBookings.filter(b => isAirbnbCode(b.bookingReference));
  const manualBookings = propertyBookings.filter(b => !isAirbnbCode(b.bookingReference));

  const uniqueAirbnbOnly = Math.max(0, airbnbReservationsCount - airbnbCodedBookings.length);

  const completedBookings = propertyBookings.filter(b => isBookingCompleted(b));
  const pendingBookings = propertyBookings.filter(b => !isBookingCompleted(b));

  const totalAll = manualBookings.length + airbnbCodedBookings.length + uniqueAirbnbOnly;

  const stats = {
    total: totalAll,
    completed: completedBookings.length,
    pending: totalAll - completedBookings.length,
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
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
          <span>{t('dashboard.title')}</span>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowEditProperty(true)}
                    aria-label={t('property.dialog.editTitle')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {property.property_type && (
                    <span className="px-2 py-0.5 rounded-full bg-[#55BA9F]/10 text-[#55BA9F] text-xs font-medium">
                      {property.property_type}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{property.max_occupancy} {t('dashboard.guests')}</span>
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
              {/* Stats with hover preview */}
              <div className="flex items-center gap-4">
                <BookingsStatHover
                  label={t('dashboard.total')}
                  count={stats.total}
                  bookings={propertyBookings}
                  className="text-black"
                  formatDate={formatDate}
                  extraCount={uniqueAirbnbOnly}
                />
                <BookingsStatHover
                  label={t('dashboard.completed')}
                  count={stats.completed}
                  bookings={completedBookings}
                  className="text-emerald-600"
                  formatDate={formatDate}
                />
                <BookingsStatHover
                  label={t('dashboard.pending')}
                  count={stats.pending}
                  bookings={pendingBookings}
                  className="text-gray-500"
                  formatDate={formatDate}
                  extraCount={uniqueAirbnbOnly}
                />
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
                  <span className="text-sm font-medium">{t('dashboard.copyLink')}</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleStartTutorial}
                  className="gap-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                  data-tutorial="tutorial-button"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('dashboard.tutorial')}</span>
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
          airbnbIcsUrl={property.airbnb_ics_url}
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

      {/* Pop-up partage (même format que réservations : lien + message, WhatsApp, copier) */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={shareModalUrl}
        title="Partager le lien client"
        propertyName={property?.name}
      />
    </div>
  );
};