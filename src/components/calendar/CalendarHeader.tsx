import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Settings, Calendar, Grid3X3, Plus, Link } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { useT } from '@/i18n/GuestLocaleProvider';
import { cn } from '@/lib/utils';
import { FRONT_CALENDAR_ICS_SYNC_ENABLED } from '@/config/frontCalendarSync';
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
  onCreateBooking?: () => void;
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
  viewMode?: 'cards' | 'calendar';
  onViewModeChange?: (mode: 'cards' | 'calendar') => void;
}

const monthKeys = ['calendar.monthJan', 'calendar.monthFeb', 'calendar.monthMar', 'calendar.monthApr', 'calendar.monthMay', 'calendar.monthJun', 'calendar.monthJul', 'calendar.monthAug', 'calendar.monthSep', 'calendar.monthOct', 'calendar.monthNov', 'calendar.monthDec'] as const;

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
  onCreateBooking,
  stats,
  conflictDetails = [],
  allReservations = [],
  onBookingClick,
  viewMode = 'calendar',
  onViewModeChange
}: CalendarHeaderProps) => {
  const t = useT();
  const isMobile = useIsMobile();
  const isMountedRef = useRef(true);
  const [showNotConfigured, setShowNotConfigured] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const monthNames = useMemo(() => monthKeys.map((k) => t(k)), [t]);

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
      {/* ✅ MOBILE : Design optimisé selon Figma */}
      {isMobile ? (
        <>
          {/* Bouton "+ Ajouter" en haut */}
          {onCreateBooking && (
            <Button 
              onClick={onCreateBooking}
              className="w-full h-12 bg-[#55BA9F] hover:bg-[#55BA9F]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span>{t('dashboard.add')}</span>
            </Button>
          )}
          
          {/* Trois points séparateurs */}
          <div className="flex items-center justify-center gap-1 py-1">
            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
          </div>
          
          {FRONT_CALENDAR_ICS_SYNC_ENABLED && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onOpenConfig}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label={t('dashboard.sync')}
              >
                <Wifi className={cn(
                  "h-5 w-5",
                  hasIcs ? "text-[#55BA9F]" : "text-gray-400"
                )} />
              </button>
              <button
                onClick={onOpenConfig}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="Lien de synchronisation"
              >
                <Link className="h-5 w-5 text-gray-700" />
              </button>
            </div>
          )}
          
          {/* Navigation mois/année pour mobile */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={previousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select 
              key={`month-${currentDate.getMonth()}`}
              value={`${currentDate.getMonth()}`}
              onValueChange={(value) => {
                const month = Number(value);
                onDateChange(new Date(currentDate.getFullYear(), month, 1));
              }}
            >
              <SelectTrigger className="w-[100px] border-0 text-base font-semibold bg-transparent">
                <span className="flex-1 text-left">
                  {monthNames[currentDate.getMonth()].substring(0, 3)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, index) => (
                  <SelectItem key={index} value={`${index}`}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              key={`year-${currentDate.getFullYear()}`}
              value={`${currentDate.getFullYear()}`}
              onValueChange={(value) => {
                const year = Number(value);
                onDateChange(new Date(year, currentDate.getMonth(), 1));
              }}
            >
              <SelectTrigger className="w-[80px] border-0 text-base font-semibold bg-transparent">
                <span className="flex-1 text-left">
                  {currentDate.getFullYear()}
                </span>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = currentDate.getFullYear() - 5 + i;
                  return (
                    <SelectItem key={year} value={`${year}`}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Header with navigation and sync - Desktop */}
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
          
          {/* Dropdown Mois séparé */}
          <Select 
            key={`month-${currentDate.getMonth()}`}
            value={`${currentDate.getMonth()}`}
            onValueChange={(value) => {
              const month = Number(value);
              onDateChange(new Date(currentDate.getFullYear(), month, 1));
            }}
          >
            <SelectTrigger className="w-[100px] border-0 text-base sm:text-xl font-semibold bg-transparent hover:bg-muted/50 transition-colors">
              <span className="flex-1 text-left">
                {monthNames[currentDate.getMonth()].substring(0, 3)}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {monthNames.map((month, index) => (
                <SelectItem key={index} value={`${index}`}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Dropdown Année séparé */}
          <Select 
            key={`year-${currentDate.getFullYear()}`}
            value={`${currentDate.getFullYear()}`}
            onValueChange={(value) => {
              const year = Number(value);
              onDateChange(new Date(year, currentDate.getMonth(), 1));
            }}
          >
            <SelectTrigger className="w-[100px] border-0 text-base sm:text-xl font-semibold bg-transparent hover:bg-muted/50 transition-colors">
              <span className="flex-1 text-left">
                {currentDate.getFullYear()}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {Array.from({ length: 10 }, (_, i) => {
                const year = currentDate.getFullYear() - 5 + i;
                return (
                  <SelectItem key={year} value={`${year}`}>
                    {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {/* Icônes de vue (Calendrier et Cartes) - cliquables */}
          {onViewModeChange && (
            <div className="flex items-center gap-1 ml-2" role="toolbar" aria-label={t('dashboard.title')}>
              <Button 
                variant="ghost" 
                size="icon" 
                type="button"
                onClick={() => onViewModeChange('calendar')}
                className={cn(
                  'h-8 w-8 rounded-lg border',
                  viewMode === 'calendar'
                    ? 'border-[#55BA9F] bg-[#55BA9F]/10 text-[#55BA9F] hover:bg-[#55BA9F]/15'
                    : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                )}
                title={t('dashboard.viewCalendar')}
              >
                <Calendar className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                type="button"
                onClick={() => onViewModeChange('cards')}
                className={cn(
                  'h-8 w-8 rounded-lg border',
                  viewMode === 'cards'
                    ? 'border-[#55BA9F] bg-[#55BA9F]/10 text-[#55BA9F] hover:bg-[#55BA9F]/15'
                    : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                )}
                title={t('dashboard.viewGrid')}
              >
                <Grid3X3 className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {FRONT_CALENDAR_ICS_SYNC_ENABLED && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onOpenConfig}
              className="flex items-center gap-1 sm:gap-2 hover:bg-gray-100 border-gray-300 bg-white text-gray-900 px-2 sm:px-3"
              data-tutorial="sync-airbnb"
            >
              {hasIcs ? (
                <Wifi className="h-4 w-4 flex-shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="text-sm font-medium hidden sm:inline">{t('dashboard.sync')}</span>
              <span className="text-sm font-medium sm:hidden">{t('dashboard.syncShort')}</span>
            </Button>
          )}
          
          {/* Bouton Créer une réservation */}
          {onCreateBooking && (
            <Button 
              variant="default" 
              size="sm"
              onClick={onCreateBooking}
              className="flex items-center gap-1 sm:gap-2 bg-[#55BA9F] hover:bg-[#55BA9F]/90 text-white px-2 sm:px-3"
              data-tutorial="add-booking"
            >
              <Plus className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium hidden sm:inline">{t('dashboard.createBooking')}</span>
              <span className="text-sm font-medium sm:hidden">{t('dashboard.createShort')}</span>
            </Button>
          )}
        </div>
      </div>
        </>
      )}

      {/* Stats and Legend avec bouton Synchroniser selon modèle Figma */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Tabs Complétées et En attente selon modèle Figma */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {t('dashboard.completedCount', { count: stats.completed })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {t('dashboard.pendingCount', { count: stats.pending })}
            </Button>
            </div>
          
          {/* Color Legend pour les conflits uniquement */}
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
                        <span className="text-muted-foreground whitespace-nowrap">{t('dashboard.conflicts', { count: stats.conflicts })}</span>
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
                      <div className="font-semibold text-sm mb-2">{t('dashboard.datesInConflict')}</div>
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
                                    title={reservation1 && onBookingClick ? t('dashboard.clickForDetails') : ""}
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
                                    title={reservation2 && onBookingClick ? t('dashboard.clickForDetails') : ""}
                                  >
                                    📅 {conflict.name2}: {conflict.start2} → {conflict.end2}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{t('dashboard.noConflictDetails')}</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Not Configured Dialog */}
      <AlertDialog open={showNotConfigured} onOpenChange={setShowNotConfigured}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.syncNotConfigured')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.syncNotConfiguredDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dashboard.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNotConfigured(false); onOpenConfig(); }}>
              {t('dashboard.configureNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};