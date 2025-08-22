import { ArrowLeft, Link as LinkIcon, Pencil, Trash2 } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // Scroll to top when component mounts and load current ICS URL
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadCurrent = async () => {
      if (!propertyId) return;
      const { data, error } = await supabase
        .from('properties')
        .select('airbnb_ics_url')
        .eq('id', propertyId)
        .single();
      if (!error) {
        const url = data?.airbnb_ics_url || null;
        setCurrentIcsUrl(url);
        if (url) setAirbnbUrl(url);
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
      // 1) Persist the URL in the property
      const { error: upErr } = await supabase
        .from('properties')
        .update({ airbnb_ics_url: airbnbUrl.trim() })
        .eq('id', propertyId);
      if (upErr) throw upErr;

      setCurrentIcsUrl(airbnbUrl.trim());
      setIsEditing(false);
      toast.success("URL du calendrier sauvegardée");
      
      // 2) Trigger synchronization using the edge function
      toast.info('Synchronisation des réservations en cours...');
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, airbnbUrl.trim());
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la synchronisation');
      }
      
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

  const handleDeleteUrl = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ airbnb_ics_url: null })
        .eq('id', propertyId);
      if (error) throw error;
      setCurrentIcsUrl(null);
      setAirbnbUrl('');
      setIsEditing(true);
      toast.success("URL supprimée");
    } catch (err) {
      console.error(err);
      toast.error("Impossible de supprimer l'URL");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 min-w-0 overflow-x-hidden">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={() => {
            console.log('Retour button clicked, navigating to:', `/dashboard/property/${propertyId}`);
            navigate(`/dashboard/property/${propertyId}`);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la propriété
        </Button>
      </div>

      <div className="space-y-6">
        {/* Section Synchronisation Airbnb */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <LinkIcon className="h-6 w-6" />
              Synchronisation Airbnb
            </CardTitle>
            <CardDescription>
              Synchronisez automatiquement vos réservations Airbnb en configurant l'URL de votre calendrier (.ics).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="airbnb-url">URL du calendrier Airbnb (.ics)</Label>
              {currentIcsUrl && !isEditing ? (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 bg-muted/50 rounded-lg border gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground font-mono truncate sm:break-words">
                        {currentIcsUrl}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        URL configurée et synchronisée
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Modifier</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteUrl} disabled={isLoading}>
                      <Trash2 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Supprimer</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="airbnb-url"
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      className="pl-10"
                      value={airbnbUrl}
                      onChange={(e) => setAirbnbUrl(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveAirbnbUrl} disabled={isLoading || !airbnbUrl.trim()}>
                    {isLoading ? 'Synchronisation...' : <><span className="hidden sm:inline">Sauvegarder et Synchroniser</span><span className="sm:hidden">Sauver et Sync</span></>}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-primary">ℹ️</span>
                Comment obtenir votre URL de calendrier Airbnb :
              </h3>
              <ol className="space-y-2 text-sm">
                <li>1. Connectez-vous à votre compte Airbnb hôte</li>
                <li>2. Allez dans "Calendrier" → "Disponibilité"</li>
                <li>3. Cliquez sur "Importer/Exporter calendrier"</li>
                <li>4. Copiez l'URL d'exportation (.ics) et collez-la ci-dessus</li>
              </ol>
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <span>💡</span>
                Vous pouvez modifier cette URL à tout moment pour changer de calendrier Airbnb.
              </p>
            </div>
          </CardContent>
        </Card>

        <div>
          <h1 className="text-3xl font-bold">Guide détaillé de synchronisation</h1>
          <p className="text-muted-foreground mt-2">
            Suivez ces étapes détaillées pour connecter automatiquement vos réservations Airbnb
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Accéder à votre calendrier Airbnb</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>1. Connectez-vous à votre compte Airbnb</p>
            <p>2. Allez dans "Hôte" → "Calendrier"</p>
            <p>3. Sélectionnez l'annonce que vous voulez synchroniser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 2: Exporter le calendrier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>1. Cliquez sur "Disponibilité" dans le menu de gauche</p>
            <p>2. Faites défiler vers le bas jusqu'à "Synchronisation du calendrier"</p>
            <p>3. Cliquez sur "Exporter le calendrier"</p>
            <p>4. Copiez l'URL du calendrier (.ics) qui s'affiche</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 3: Configurer dans Checky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>1. Retournez sur la page de votre propriété dans Checky</p>
            <p>2. Dans la section "Synchronisation Airbnb", collez l'URL du calendrier</p>
            <p>3. Cliquez sur "Sauvegarder"</p>
            <p>4. Vos réservations Airbnb apparaîtront automatiquement dans votre calendrier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚠️ Important à retenir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>• La synchronisation peut prendre quelques minutes pour s'effectuer</p>
            <p>• Les réservations existantes seront importées automatiquement</p>
            <p>• Les nouvelles réservations apparaîtront dans un délai de 15 minutes</p>
            <p>• Assurez-vous que l'URL se termine bien par ".ics"</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};