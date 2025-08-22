import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link as LinkIcon, Save, Check, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAirbnbSync } from '@/hooks/useAirbnbSync';
import { useToast } from '@/hooks/use-toast';

interface AirbnbSyncManagerProps {
  propertyId: string;
  currentIcsUrl?: string;
  onUrlUpdated?: (newUrl: string) => void;
}

export const AirbnbSyncManager = ({ 
  propertyId, 
  currentIcsUrl = '', 
  onUrlUpdated 
}: AirbnbSyncManagerProps) => {
  
  
  const [icsUrl, setIcsUrl] = useState(currentIcsUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [canEdit, setCanEdit] = useState(!currentIcsUrl); // Allow editing if no URL set initially
  const { toast } = useToast();
  
  const { 
    syncStatus, 
    isLoading, 
    isSyncing, 
    performSync 
  } = useAirbnbSync(propertyId);

  const handleSave = async () => {
    if (!icsUrl.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez entrer une URL de calendrier Airbnb valide.",
        variant: "destructive"
      });
      return;
    }

    // Validation plus robuste pour tous les domaines Airbnb
    const airbnbPattern = /airbnb\.[a-z]{2,4}/i; // airbnb.com, airbnb.fr, airbnb.ca, etc.
    const isAirbnbUrl = airbnbPattern.test(icsUrl);
    const isIcalUrl = icsUrl.includes('ical') || icsUrl.includes('.ics');
    
    if (!isAirbnbUrl || !isIcalUrl) {
      toast({
        title: "URL invalide",
        description: "L'URL doit être un lien de calendrier Airbnb (.ics).",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    setIsSuccess(false);

    try {
      const { error } = await supabase
        .from('properties')
        .update({ airbnb_ics_url: icsUrl.trim() })
        .eq('id', propertyId);

      if (error) throw error;

      setIsSuccess(true);
      setCanEdit(false); // Hide edit mode after successful save
      onUrlUpdated?.(icsUrl.trim());
      
      toast({
        title: "Configuration sauvegardée",
        description: "L'URL du calendrier Airbnb a été mise à jour avec succès."
      });

      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving ICS URL:', error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder l'URL du calendrier.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    if (!currentIcsUrl) {
      toast({
        title: "Configuration requise",
        description: "Veuillez d'abord configurer l'URL du calendrier Airbnb.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await performSync(currentIcsUrl);
      
      if (result.success) {
        // Silent success on mobile, only show on desktop
        if (window.innerWidth >= 768) {
          toast({
            title: "Synchronisation réussie",
            description: `${result.count || 0} réservations synchronisées.`
          });
        }
      } else {
        toast({
          title: "Erreur de synchronisation",
          description: result.error || "Impossible de synchroniser le calendrier Airbnb.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Exception in handleSync:', error);
      toast({
        title: "Erreur de synchronisation",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive"
      });
    }
  };

  const getSyncStatusDisplay = () => {
    if (isLoading) return { text: 'Chargement...', color: 'text-muted-foreground', icon: RefreshCw };
    if (!syncStatus) return { text: 'Non configuré', color: 'text-muted-foreground', icon: AlertCircle };

    switch (syncStatus.sync_status) {
      case 'success':
        return { text: 'Synchronisé', color: 'text-green-600', icon: CheckCircle };
      case 'error':
        return { text: 'Erreur', color: 'text-red-600', icon: AlertCircle };
      case 'syncing':
        return { text: 'En cours...', color: 'text-blue-600', icon: RefreshCw };
      default:
        return { text: 'En attente', color: 'text-yellow-600', icon: AlertCircle };
    }
  };

  const statusDisplay = getSyncStatusDisplay();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Synchronisation Airbnb
        </CardTitle>
        <CardDescription>
          Synchronisez automatiquement vos réservations Airbnb en configurant l'URL de votre calendrier (.ics).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="airbnb-ics-url">
              URL du calendrier Airbnb (.ics)
            </Label>
            {currentIcsUrl && !canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  
                  setCanEdit(true);
                }}
                className="h-auto p-1 text-blue-600 hover:text-blue-800"
              >
                Modifier l'URL
              </Button>
            )}
          </div>
          
          {/* Show current URL as read-only if not editing */}
          {currentIcsUrl && !canEdit ? (
            <div className="space-y-2">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-2">
                  <LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium mb-1">URL configurée :</p>
                     <p className="text-xs text-muted-foreground break-all overflow-hidden line-clamp-2 sm:line-clamp-none">
                       {window.innerWidth < 768 ? `${currentIcsUrl.substring(0, 50)}...` : currentIcsUrl}
                     </p>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            /* Editable input */
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="airbnb-ics-url"
                  type="url"
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  className="pl-10"
                  disabled={isSaving}
                />
              </div>
              <Button 
                onClick={handleSave}
                disabled={isSaving || !icsUrl.trim()}
                variant={isSuccess ? "default" : "outline"}
                className="min-w-0 sm:min-w-[120px] flex-shrink-0"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Sauvé
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Sauvegarder</span>
                    <span className="sm:hidden">Sauver</span>
                  </>
                )}
              </Button>
              {currentIcsUrl && canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCanEdit(false);
                    setIcsUrl(currentIcsUrl); // Reset to current URL
                  }}
                  className="px-3"
                >
                  Annuler
                </Button>
              )}
            </div>
          )}
          
          {/* Status and Sync button */}
          {currentIcsUrl && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <statusDisplay.icon className={`h-4 w-4 ${statusDisplay.color}`} />
                <span className="text-sm font-medium">Statut: {statusDisplay.text}</span>
                {syncStatus?.reservations_count !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    ({syncStatus.reservations_count} réservations)
                  </span>
                )}
              </div>
              <Button 
                onClick={handleSync}
                disabled={isSyncing || !currentIcsUrl}
                size="sm"
                variant="secondary"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sync...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Synchroniser</span>
                    <span className="sm:hidden">Sync</span>
                  </>
                )}
              </Button>
            </div>
          )}
          
          {syncStatus?.last_sync_at && (
            <div className="text-xs text-muted-foreground">
              Dernière synchronisation: {new Date(syncStatus.last_sync_at).toLocaleString('fr-FR')}
            </div>
          )}
        </div>

        {/* Help Section */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Comment obtenir votre URL de calendrier Airbnb :</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Connectez-vous à votre compte Airbnb hôte</li>
                <li>Allez dans "Calendrier" → "Disponibilité"</li>
                <li>Cliquez sur "Importer/Exporter calendrier"</li>
                <li>Copiez l'URL d'exportation (.ics) et collez-la ci-dessus</li>
              </ol>
              <p className="text-xs mt-2 text-muted-foreground">
                💡 Vous pouvez modifier cette URL à tout moment pour changer de calendrier Airbnb.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};