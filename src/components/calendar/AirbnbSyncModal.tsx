import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Calendar, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';

interface AirbnbSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (icsUrl: string) => Promise<void>;
  lastSyncDate?: Date;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
}

export const AirbnbSyncModal = ({ 
  isOpen, 
  onClose, 
  onSync, 
  lastSyncDate,
  syncStatus 
}: AirbnbSyncModalProps) => {
  const [icsUrl, setIcsUrl] = useState('https://www.airbnb.com/calendar/ical/1443787715795572441.ics?s=bb6ae14e907a21abef5295b2f51e2af8');
  const { toast } = useToast();

  const handleSync = async () => {
    if (!icsUrl.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez saisir l'URL du calendrier Airbnb",
        variant: "destructive"
      });
      return;
    }

    try {
      await onSync(icsUrl);
      // Silent success on mobile, only show on desktop
      if (window.innerWidth >= 768) {
        toast({
          title: "Synchronisation réussie",
          description: "Les réservations Airbnb ont été importées avec succès"
        });
      }
    } catch (error) {
      toast({
        title: "Erreur de synchronisation",
        description: "Impossible d'importer les réservations Airbnb",
        variant: "destructive"
      });
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Synchronisation en cours...';
      case 'success':
        return 'Synchronisé avec succès';
      case 'error':
        return 'Erreur de synchronisation';
      default:
        return 'Prêt à synchroniser';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Synchronisation Airbnb</span>
          </DialogTitle>
          <DialogDescription>
            Importez vos réservations Airbnb directement dans votre calendrier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-3">
              {getSyncStatusIcon()}
              <div>
                <p className="text-sm font-medium">{getSyncStatusText()}</p>
                {lastSyncDate && (
                  <p className="text-xs text-muted-foreground">
                    Dernière sync: {lastSyncDate.toLocaleDateString('fr-FR')} à {lastSyncDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={syncStatus === 'success' ? 'default' : 'secondary'}>
              {syncStatus === 'success' ? 'Connecté' : 'Non connecté'}
            </Badge>
          </div>

          {/* URL Input */}
          <div className="space-y-3">
            <Label htmlFor="ics-url" className="text-sm font-medium">
              URL du calendrier Airbnb (.ics)
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="ics-url"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                className="pl-10"
                disabled={syncStatus === 'syncing'}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Vous trouverez cette URL dans votre tableau de bord Airbnb, section "Calendrier"
              </p>
              {syncStatus === 'error' && (
                <p className="text-xs text-destructive">
                  ⚠️ Erreur: Impossible d'accéder au calendrier. Vérifiez que l'URL est correcte et accessible.
                </p>
              )}
            </div>
          </div>

          {/* Color Legend */}
          <div className="p-4 bg-card rounded-lg border">
            <h4 className="text-sm font-medium mb-3">Codes couleur après synchronisation</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BOOKING_COLORS.completed.hex }}></div>
                <span className="text-sm">Airbnb + Check-in complété</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BOOKING_COLORS.pending.hex }}></div>
                <span className="text-sm">Airbnb + Check-in en attente</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BOOKING_COLORS.pending.hex }}></div>
                <span className="text-sm">Réservations en attente</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BOOKING_COLORS.conflict.hex }}></div>
                <span className="text-sm">Conflits détectés</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button 
              onClick={handleSync} 
              disabled={syncStatus === 'syncing'}
              className="flex-1"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Synchroniser</span>
                  <span className="sm:hidden">Sync</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};