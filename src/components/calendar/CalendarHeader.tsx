import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BOOKING_COLORS } from '@/constants/bookingColors';
interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  bookingCount: number;
  onAirbnbSync: () => void;
  isSyncing: boolean;
  lastSyncDate?: Date;
  isConnected: boolean;
  hasIcs: boolean;
  onOpenConfig: () => void;
  stats: {
    completed: number;
    pending: number;
    conflicts: number;
  };
}

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const CalendarHeader = ({
  currentDate,
  onDateChange,
  bookingCount,
  onAirbnbSync,
  isSyncing,
  lastSyncDate,
  isConnected,
  hasIcs,
  onOpenConfig,
  stats
}: CalendarHeaderProps) => {
  const previousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const [showNotConfigured, setShowNotConfigured] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header with navigation and sync */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" onClick={previousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select
            value={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
            onValueChange={(value) => {
              const [year, month] = value.split('-').map(Number);
              onDateChange(new Date(year, month, 1));
            }}
          >
            <SelectTrigger className="w-[140px] sm:w-[200px] border-0 text-base sm:text-xl lg:text-2xl font-semibold bg-transparent hover:bg-muted/50 transition-colors">
              <SelectValue placeholder="Sélectionner le mois">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {Array.from({ length: 24 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - 12 + i);
                const value = `${date.getFullYear()}-${date.getMonth()}`;
                return (
                  <SelectItem key={value} value={value}>
                    {monthNames[date.getMonth()]} {date.getFullYear()}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center">
          {/* Sync Airbnb Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => hasIcs ? onAirbnbSync() : setShowNotConfigured(true)}
            disabled={isSyncing}
            className={`flex items-center space-x-1 min-w-0 justify-center sm:space-x-2 sm:size-lg sm:min-w-[180px] lg:min-w-[220px] ${
              hasIcs && isConnected
                ? 'bg-[hsl(var(--teal-hover))] text-white hover:bg-[hsl(var(--teal-hover))]/90 border-[hsl(var(--teal-hover))]'
                : 'hover:bg-[hsl(var(--teal-hover))] hover:text-white'
            }`}
            data-tutorial="sync-airbnb"
          >
            {isSyncing ? (
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            ) : hasIcs ? (
              <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <WifiOff className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
            <span className="text-xs sm:text-base">{isSyncing ? 'Sync…' : <><span className="hidden sm:inline">Synchroniser avec votre </span><span className="sm:hidden">Sync </span><span>Airbnb</span></>}</span>
          </Button>
        </div>
      </div>

      {/* Stats and Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-4">
          {/* Color Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BOOKING_COLORS.completed.hex }}></div>
            <span className="text-muted-foreground">Complétées ({stats.completed})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BOOKING_COLORS.pending.hex }}></div>
            <span className="text-muted-foreground">En attente ({stats.pending})</span>
          </div>
          {stats.conflicts > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BOOKING_COLORS.conflict.hex }}></div>
              <span className="text-muted-foreground">Conflits ({stats.conflicts})</span>
            </div>
          )}
        </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 sm:justify-end">
          <div className="flex items-center justify-end space-x-3">
            <Badge variant="outline" className="bg-background">
              {bookingCount} réservation(s)
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Configurer la synchronisation"
              onClick={onOpenConfig}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Sync Status - below on mobile */}
          {lastSyncDate && (
            <div className="text-xs text-muted-foreground text-right sm:text-left">
              Dernière sync: {lastSyncDate.toLocaleDateString('fr-FR')} à {lastSyncDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Not Configured Dialog */}
      <AlertDialog open={showNotConfigured} onOpenChange={setShowNotConfigured}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchronisation non configurée</AlertDialogTitle>
            <AlertDialogDescription>
              La synchronisation Airbnb n’est pas encore configurée pour cette propriété.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNotConfigured(false); onOpenConfig(); }}>
              Configurer maintenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
