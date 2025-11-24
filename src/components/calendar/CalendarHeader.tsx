import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
  conflictDetails?: Array<{
    id1: string;
    id2: string;
    name1: string;
    name2: string;
    start1: string;
    end1: string;
    start2: string;
    end2: string;
  }>;
  allReservations?: (Booking | AirbnbReservation)[];
  onBookingClick?: (booking: Booking | AirbnbReservation) => void;
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
  stats,
  conflictDetails = [],
  allReservations = [],
  onBookingClick
}: CalendarHeaderProps) => {
  const isMountedRef = useRef(true);
  const [showNotConfigured, setShowNotConfigured] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // ✅ CORRIGÉ : Cleanup lors du démontage pour éviter les erreurs Portal
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      setTooltipOpen(false); // Fermer le tooltip avant démontage
    };
  }, []);

  const previousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

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
            key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
            value={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
            onValueChange={(value) => {
              const [year, month] = value.split('-').map(Number);
              onDateChange(new Date(year, month, 1));
            }}
          >
            <SelectTrigger className="w-[140px] sm:w-[200px] border-0 text-base sm:text-xl lg:text-2xl font-semibold bg-transparent hover:bg-muted/50 transition-colors">
              <span className="flex-1 text-left">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {Array.from({ length: 24 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - 12 + i);
                const value = `${date.getFullYear()}-${date.getMonth()}`;
                // Créer une clé unique pour éviter les doublons
                const uniqueKey = `${date.getFullYear()}-${date.getMonth()}-${i}`;
                return (
                  <SelectItem key={uniqueKey} value={value}>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
            <div className="flex items-center space-x-2 shrink-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: BOOKING_COLORS.completed.hex }}></div>
              <span className="text-muted-foreground whitespace-nowrap">Complétées ({stats.completed})</span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: BOOKING_COLORS.pending.hex }}></div>
              <span className="text-muted-foreground whitespace-nowrap">En attente ({stats.pending})</span>
            </div>
            {stats.conflicts > 0 && (
              <ErrorBoundary>
                <TooltipProvider>
                  <Tooltip open={tooltipOpen} onOpenChange={(open) => {
                    if (isMountedRef.current) {
                      setTooltipOpen(open);
                    }
                  }}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 shrink-0 cursor-help">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: BOOKING_COLORS.conflict.hex }}></div>
                        <span className="text-muted-foreground whitespace-nowrap">Conflits ({stats.conflicts})</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="bottom" 
                      className="max-w-md p-4"
                      onPointerDownOutside={(e) => {
                        // Ne pas fermer si on clique sur une réservation
                        const target = e.target as HTMLElement;
                        if (target.closest('[data-reservation-click]')) {
                          e.preventDefault();
                        }
                      }}
                      onEscapeKeyDown={() => {
                        if (isMountedRef.current) {
                          setTooltipOpen(false);
                        }
                      }}
                    >
                    <div className="space-y-2">
                      <div className="font-semibold text-sm mb-2">Dates en conflit :</div>
                      {conflictDetails.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {conflictDetails.map((conflict, index) => {
                            // Trouver les réservations correspondantes
                            const reservation1 = allReservations.find(r => r.id === conflict.id1);
                            const reservation2 = allReservations.find(r => r.id === conflict.id2);
                            
                            return (
                              <div key={`${conflict.id1}-${conflict.id2}-${index}`} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                <div className="font-medium mb-1">
                                  <span className="text-destructive">{conflict.name1}</span>
                                  {' '}↔️{' '}
                                  <span className="text-destructive">{conflict.name2}</span>
                                </div>
                                <div className="text-muted-foreground space-y-0.5">
                                  <div 
                                    data-reservation-click
                                    className={reservation1 && onBookingClick ? "cursor-pointer hover:text-foreground hover:underline transition-colors font-medium" : ""}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (reservation1 && onBookingClick) {
                                        onBookingClick(reservation1);
                                      }
                                    }}
                                    title={reservation1 && onBookingClick ? "Cliquez pour voir les détails" : ""}
                                  >
                                    📅 {conflict.name1}: {conflict.start1} → {conflict.end1}
                                  </div>
                                  <div 
                                    data-reservation-click
                                    className={reservation2 && onBookingClick ? "cursor-pointer hover:text-foreground hover:underline transition-colors font-medium" : ""}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (reservation2 && onBookingClick) {
                                        onBookingClick(reservation2);
                                      }
                                    }}
                                    title={reservation2 && onBookingClick ? "Cliquez pour voir les détails" : ""}
                                  >
                                    📅 {conflict.name2}: {conflict.start2} → {conflict.end2}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Aucun détail disponible</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ErrorBoundary>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-end shrink-0">
          <div className="flex items-center justify-end space-x-3 shrink-0">
            <Badge variant="outline" className="bg-background whitespace-nowrap shrink-0">
              {bookingCount} réservation{bookingCount > 1 ? 's' : ''}
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
            <div className="text-xs text-muted-foreground text-right sm:text-left whitespace-nowrap shrink-0">
              <span className="inline-flex items-center gap-1">
                <span>Dernière sync:</span>
                <span className="font-medium">{lastSyncDate.toLocaleDateString('fr-FR')} à {lastSyncDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
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