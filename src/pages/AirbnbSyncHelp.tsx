import { ArrowLeft, Link as LinkIcon, Pencil, Trash2, Wifi, RefreshCw, Info, Lightbulb } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { supabase } from '@/integrations/supabase/client';

export const AirbnbSyncHelp = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [airbnbUrl, setAirbnbUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentIcsUrl, setCurrentIcsUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Scroll to top when component mounts and load current ICS URL
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadCurrent = async () => {
      if (!propertyId) return;
      const { data, error } = await supabase
        .from('properties')
        .select('airbnb_ics_url, updated_at')
        .eq('id', propertyId)
        .single();
      if (!error) {
        const url = data?.airbnb_ics_url || null;
        setCurrentIcsUrl(url);
        if (url) setAirbnbUrl(url);
        
        // Récupérer la date de dernière synchronisation
        if (data?.updated_at) {
          const lastSyncDate = new Date(data.updated_at);
          const formattedDate = lastSyncDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          setLastSync(formattedDate);
        }
      }
    };
    loadCurrent();
  }, [propertyId]);

  const handleSaveAirbnbUrl = async () => {
    if (!airbnbUrl.trim()) {
      toast.error('Veuillez saisir une URL de calendrier Airbnb');
      return;
    }

    if (!airbnbUrl.includes('.ics')) {
      toast.error('L\'URL doit se terminer par .ics');
      return;
    }

    if (!propertyId) {
      toast.error('ID de propriété manquant');
      return;
    }

    setIsLoading(true);
    try {
      // ✅ NOUVEAU : Vérifier si le même lien ICS est utilisé par une autre propriété
      const { data: otherProperties, error: checkError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('airbnb_ics_url', airbnbUrl.trim())
        .neq('id', propertyId);
      
      if (!checkError && otherProperties && otherProperties.length > 0) {
        const names = otherProperties.map(p => p.name || 'Sans nom').join(', ');
        toast.warning(
          `⚠️ Ce lien ICS est déjà utilisé par : ${names}. Les mêmes réservations seront synchronisées sur les deux propriétés.`,
          { duration: 8000 }
        );
      }

      // 1) Persist the URL in the property
      const { error: upErr } = await supabase
        .from('properties')
        .update({ airbnb_ics_url: airbnbUrl.trim() })
        .eq('id', propertyId);
      if (upErr) throw upErr;

      setCurrentIcsUrl(airbnbUrl.trim());
      setIsEditing(false);
      toast.success("URL du calendrier sauvegardée");
      
      // 2) Trigger synchronization using the edge function (automatique)
      toast.info('Synchronisation des réservations en cours...');
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, airbnbUrl.trim());
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la synchronisation');
      }
      
      // Mettre à jour le statut de synchronisation
      const now = new Date();
      const formattedDate = now.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
          setLastSync(formattedDate);
      
      // Silent success on mobile, only show on desktop
      if (window.innerWidth >= 768) {
        toast.success(`Synchronisation réussie ! ${result.count || 0} réservations importées`);
      }
      
      // 3) Redirect to property calendar
      setTimeout(() => {
        navigate(`/dashboard/property/${propertyId}`);
      }, 1000);
      
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Erreur lors de la synchronisation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!propertyId || !currentIcsUrl) {
      toast.error('Aucune URL configurée');
      return;
    }

    setIsLoading(true);
    try {
      toast.info('Actualisation en cours...');
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, currentIcsUrl);
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de l\'actualisation');
      }

      const now = new Date();
      const formattedDate = now.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
          setLastSync(formattedDate);
      
      toast.success(`Actualisation réussie ! ${result.count || 0} réservations synchronisées`);
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error(error.message || 'Erreur lors de l\'actualisation');
    } finally {
      setIsLoading(false);
    }
  };


  const handleDeleteUrl = async () => {
    if (!propertyId) return;
    
    // Confirmation avant suppression
    const confirmed = window.confirm(
      "⚠️ Attention : Cette action supprimera :\n" +
      "1. Le lien ICS de synchronisation\n" +
      "2. Toutes les réservations Airbnb (table airbnb_reservations)\n" +
      "3. Toutes les réservations avec codes Airbnb (table bookings)\n" +
      "4. Les soumissions de guests associées\n\n" +
      "Êtes-vous sûr de vouloir continuer ?"
    );
    
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      let deletedAirbnbCount = 0;
      let deletedBookingsCount = 0;
      let deletedSubmissionsCount = 0;
      
      // 1. Supprimer toutes les réservations Airbnb de airbnb_reservations
      const { data: deletedAirbnb, error: deleteAirbnbError } = await supabase
        .from('airbnb_reservations')
        .delete()
        .eq('property_id', propertyId)
        .select('id');
      
      if (deleteAirbnbError) {
        console.error('Erreur lors de la suppression des airbnb_reservations:', deleteAirbnbError);
        throw deleteAirbnbError;
      }
      
      deletedAirbnbCount = deletedAirbnb?.length || 0;
      console.log(`✅ ${deletedAirbnbCount} réservations supprimées de airbnb_reservations`);
      
      // 2. ✅ NOUVEAU : Récupérer les IDs des bookings avec codes Airbnb
      const { data: bookingsToDelete, error: fetchError } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', propertyId)
        .or('booking_reference.like.HM%,booking_reference.like.CL%,booking_reference.like.PN%,booking_reference.like.ZN%,booking_reference.like.JN%,booking_reference.like.UN%,booking_reference.like.FN%,booking_reference.like.HN%,booking_reference.like.KN%,booking_reference.like.SN%,booking_reference.like.UID:%');
      
      if (fetchError) {
        console.error('Erreur lors de la récupération des bookings:', fetchError);
        throw fetchError;
      }
      
      if (bookingsToDelete && bookingsToDelete.length > 0) {
        const bookingIds = bookingsToDelete.map(b => b.id);
        
        // 3. ✅ IMPORTANT : Supprimer d'abord les guest_submissions (contrainte FK)
        const { data: deletedSubmissions, error: deleteSubmissionsError } = await supabase
          .from('guest_submissions')
          .delete()
          .in('booking_id', bookingIds)
          .select('id');
        
        if (deleteSubmissionsError) {
          console.error('Erreur lors de la suppression des guest_submissions:', deleteSubmissionsError);
          throw deleteSubmissionsError;
        }
        
        deletedSubmissionsCount = deletedSubmissions?.length || 0;
        console.log(`✅ ${deletedSubmissionsCount} soumissions supprimées de guest_submissions`);
        
        // 4. Maintenant supprimer les bookings (plus de contrainte FK)
        const { data: deletedBookings, error: deleteBookingsError } = await supabase
          .from('bookings')
          .delete()
          .in('id', bookingIds)
          .select('id');
        
        if (deleteBookingsError) {
          console.error('Erreur lors de la suppression des bookings:', deleteBookingsError);
          throw deleteBookingsError;
        }
        
        deletedBookingsCount = deletedBookings?.length || 0;
        console.log(`✅ ${deletedBookingsCount} réservations supprimées de bookings`);
      }
      
      // 5. Supprimer l'URL ICS de la propriété
      const { error } = await supabase
        .from('properties')
        .update({ airbnb_ics_url: null })
        .eq('id', propertyId);
      if (error) throw error;
      
      // 6. Invalider tous les caches pour forcer le rafraîchissement
      console.log('🔄 Invalidation des caches...');
      
      try {
        await AirbnbEdgeFunctionService.invalidateReservationsCache(propertyId);
        console.log('✅ Cache Airbnb invalidé');
      } catch (cacheError) {
        console.warn('⚠️ Erreur lors de l\'invalidation du cache Airbnb:', cacheError);
      }
      
      try {
        const { multiLevelCache } = await import('@/services/multiLevelCache');
        await multiLevelCache.invalidatePattern(`bookings-${propertyId}`);
        await multiLevelCache.invalidatePattern(`bookings-${propertyId}-*`);
        console.log('✅ Cache bookings invalidé');
      } catch (cacheError) {
        console.warn('⚠️ Erreur lors de l\'invalidation du cache bookings:', cacheError);
      }
      
      setCurrentIcsUrl(null);
      setAirbnbUrl('');
      setIsEditing(true);
      setLastSync(null);
      
      toast.success(
        `Suppression réussie !\n` +
        `- ${deletedAirbnbCount} réservations Airbnb\n` +
        `- ${deletedBookingsCount} réservations avec codes Airbnb\n` +
        `- ${deletedSubmissionsCount} soumissions de guests\n` +
        `- Lien ICS supprimé\n` +
        `- Caches invalidés`
      );
      
      // 7. Rediriger vers le calendrier pour forcer le rafraîchissement
      setTimeout(() => {
        navigate(`/dashboard/property/${propertyId}`);
      }, 1500);
      
    } catch (err) {
      console.error(err);
      toast.error("Impossible de supprimer l'URL et les réservations");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 min-w-0 overflow-x-hidden bg-[#F9F7F2] min-h-screen">
      {/* Bouton Retour selon modèle Figma */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-2 text-gray-700 hover:bg-gray-100"
        onClick={() => navigate(`/dashboard/property/${propertyId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la propriété
      </Button>

      {/* Titre centré selon modèle Figma */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-black">Synchronisation Airbnb</h1>
      </div>

      <div className="space-y-6">
        {/* Carte Configuration de la synchronisation selon modèle Figma */}
        <Card id="configuration" className="rounded-2xl shadow-sm border-2 border-[#0BD9D0]">
          <CardContent className="p-6 space-y-6">
            <p className="text-base text-black">
              Synchronisez automatiquement vos réservations Airbnb en configurant l'URL de votre calendrier (.ics).
            </p>
            
            {/* Champ URL */}
            <div className="space-y-4">
              {currentIcsUrl && !isEditing ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <LinkIcon className="h-5 w-5 text-gray-700 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-black font-mono break-words">
                          {currentIcsUrl}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          URL configurée et synchronisée
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditing(true)}
                        className="gap-2 text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">Modifier</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDeleteUrl} 
                        disabled={isLoading}
                        className="gap-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Supprimer</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Bouton Synchroniser maintenant */}
                  <Button 
                    onClick={handleRefresh} 
                    disabled={isLoading || !currentIcsUrl}
                    className="w-full sm:w-auto h-11 px-6 bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white rounded-xl gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Synchroniser maintenant</span>
                  </Button>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <Input
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      className="pl-10 h-11 rounded-xl border-gray-300"
                      value={airbnbUrl}
                      onChange={(e) => setAirbnbUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleSaveAirbnbUrl} 
                    disabled={isLoading || !airbnbUrl.trim()}
                    className="h-11 px-6 bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white rounded-xl gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Synchronisation...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4" />
                        <span>Sauvegarder et Synchroniser</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Instructions selon modèle Figma */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-gray-700 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-black mb-2">
                    Comment obtenir votre URL de calendrier Airbnb:
                  </h3>
                  <ol className="space-y-2 text-sm text-black list-decimal list-inside ml-2">
                    <li>Connectez-vous à votre compte Airbnb hôte</li>
                    <li>Allez dans "Calendrier" → "Disponibilité"</li>
                    <li>Cliquez sur "Importer/Exporter calendrier"</li>
                    <li>Copiez l'URL d'exportation (.ics) et collez-la ci-dessus</li>
                  </ol>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded-lg">
                <Lightbulb className="h-5 w-5 text-gray-700 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Vous pouvez modifier cette URL à tout moment pour changer de calendrier Airbnb.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Étapes détaillées selon modèle Figma */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-black mb-2">
              Étapes détaillées
            </h2>
            <p className="text-base text-gray-600">
              Suivez ces étapes détaillées pour connecter automatiquement vos réservations Airbnb
            </p>
          </div>

          {/* Étape 1 */}
          <Card className="rounded-2xl shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-black">
                Étape 1: Accéder à votre calendrier Airbnb
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-black list-decimal list-inside ml-2">
                <li>Connectez-vous à votre compte Airbnb</li>
                <li>Allez dans "Hôte" → "Calendrier"</li>
                <li>Sélectionnez l'annonce que vous voulez synchroniser</li>
              </ol>
            </CardContent>
          </Card>

          {/* Étape 2 */}
          <Card className="rounded-2xl shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-black">
                Étape 2: Exporter le calendrier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-black list-decimal list-inside ml-2">
                <li>Cliquez sur "Disponibilité" dans le menu de gauche</li>
                <li>Faites défiler vers le bas jusqu'à "Synchronisation du calendrier"</li>
                <li>Cliquez sur "Exporter le calendrier"</li>
                <li>Copiez l'URL du calendrier (.ics) qui s'affiche</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
