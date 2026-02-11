import { memo, useState, useMemo } from 'react';
import { CalendarDay, BookingLayout } from './CalendarUtils';
import { CalendarBookingBar } from './CalendarBookingBar';
import { ConflictCadran } from './ConflictCadran';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useT } from '@/i18n/GuestLocaleProvider';
import { BOOKING_COLORS } from '@/constants/bookingColors';

export interface ConflictGroupForCalendar {
  groupKey: string;
  ids: string[];
  /** Segments par semaine (une barre rouge par segment) */
  weekSegments: Array<{ weekIndex: number; startDayIndex: number; span: number }>;
  /** Réservation avec la date d’arrivée la plus tôt (affichée sur la barre rouge) */
  primaryReservation: { displayName: string; startFormatted: string; endFormatted: string };
  reservations: Array<{ id: string; displayName: string; startFormatted: string; endFormatted: string }>;
}

interface CalendarGridProps {
  calendarDays: CalendarDay[];
  bookingLayout: { [key: string]: BookingLayout[] };
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
  allReservations?: (Booking | AirbnbReservation)[];
  conflictGroupsWithPosition?: ConflictGroupForCalendar[];
  onDeleteBooking?: (id: string) => Promise<void>;
  /** Contrôle externe (ex. alerte cliquable) : ouvrir un conflit précis */
  openConflict?: { groupKey: string; weekIndex: number } | null;
  onOpenConflictChange?: (value: { groupKey: string; weekIndex: number } | null) => void;
}

const weekdayKeys = ['calendar.weekdayMon', 'calendar.weekdayTue', 'calendar.weekdayWed', 'calendar.weekdayThu', 'calendar.weekdayFri', 'calendar.weekdaySat', 'calendar.weekdaySun'] as const;

// ✅ PHASE 3 : Mémoriser CalendarGrid avec comparaison personnalisée
export const CalendarGrid = memo(({
  calendarDays,
  bookingLayout,
  conflicts,
  onBookingClick,
  allReservations = [],
  conflictGroupsWithPosition = [],
  onDeleteBooking,
  openConflict: openConflictProp,
  onOpenConflictChange,
}: CalendarGridProps) => {
  const t = useT();
  const dayNames = useMemo(() => weekdayKeys.map((k) => t(k)), [t]);
  const isMobile = useIsMobile();
  const [internalOpenConflict, setInternalOpenConflict] = useState<{ groupKey: string; weekIndex: number } | null>(null);
  const openConflict = onOpenConflictChange != null ? openConflictProp ?? null : internalOpenConflict;
  const setOpenConflict = onOpenConflictChange ?? setInternalOpenConflict;

  const conflictIds = useMemo(
    () => new Set(conflictGroupsWithPosition.flatMap((g) => g.ids)),
    [conflictGroupsWithPosition]
  );

  const weeks = [] as CalendarDay[][];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="rounded-2xl bg-transparent">
      {/* En-têtes des jours, fond très clair comme sur la maquette */}
      <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200 rounded-t-2xl">
        {dayNames.map((day, index) => (
          <div 
            key={day} 
            className={`
              px-3 py-2 sm:px-4 sm:py-3 text-center text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide
              ${index === 0 ? 'rounded-tl-2xl' : ''}
              ${index === 6 ? 'rounded-tr-2xl' : ''}
            `}
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden font-semibold text-slate-700">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="relative bg-transparent pt-2">
        {weeks.map((week, weekIndex) => {
          // Masquer complètement les lignes qui ne contiennent aucun jour du mois courant
          const hasCurrentMonthDay = week.some(d => d.isCurrentMonth);
          if (!hasCurrentMonthDay) {
            return null;
          }

          const weekBookings = bookingLayout[weekIndex] ?? [];
          const weekBookingsWithoutConflicts = weekBookings.filter((b) => b.booking && !conflictIds.has(b.booking.id));
          const hasConflictInWeek = conflictGroupsWithPosition.some((g) =>
            g.weekSegments.some((s) => s.weekIndex === weekIndex)
          );
          const nonConflictLayers = weekBookingsWithoutConflicts.length
            ? Math.max(...weekBookingsWithoutConflicts.map((b) => b.layer || 0)) + 1
            : 0;
          const layersInWeek = hasConflictInWeek ? nonConflictLayers + 1 : Math.max(1, nonConflictLayers);
          // ✅ MOBILE-FRIENDLY : Augmenter significativement les tailles pour mobile
          const baseHeight = isMobile ? 40 : 32; // Augmenté de 28 à 40 pour mobile
          const spacing = isMobile ? 24 : 22; // ✅ FIGMA : Augmenté pour correspondre au design (était 16:14)
          const headerSpace = isMobile ? 60 : 45; // Augmenté de 42 à 60 pour mobile
          const padding = isMobile ? 32 : 25; // Augmenté de 24 à 32 pour mobile
          // ✅ FIGMA : Lignes successives — hauteur adaptée au nombre de couches (chevauchements)
          const idealSpacing = isMobile ? 24 : 24;
          const calculatedHeight = layersInWeek > 1
            ? headerSpace + layersInWeek * baseHeight + (layersInWeek - 1) * idealSpacing + padding
            : headerSpace + baseHeight + padding;
          const minHeight = isMobile ? 140 : 120;
          const cellHeight = Math.max(minHeight, calculatedHeight);
          
          return (
            <div key={weekIndex} className="relative mb-6" style={{ minHeight: `${cellHeight}px` }}>
              {/* Week Row with Days */}
              <div className="grid grid-cols-7 gap-4 relative" style={{ minHeight: `${cellHeight}px` }}>
                {week.map((day, dayIndex) => {
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`
                        relative
                        ${day.isCurrentMonth
                          ? 'bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                          : 'bg-transparent border-transparent shadow-none'}
                        ${isMobile ? 'p-2' : 'p-3 sm:p-4'}
                        ${isToday ? 'ring-2 ring-[#0BD9D0] ring-offset-0 z-10' : ''}
                      `}
                      style={{
                        minHeight: `${cellHeight}px`,
                        height: `${cellHeight}px`,
                      }}
                    >
                      <div
                        className={`flex items-start`}
                      >
                        <div
                          className={`
                            inline-flex items-center justify-center font-semibold
                            ${isMobile ? 'text-sm' : 'text-sm sm:text-base'}
                            ${isToday ? 'text-[#0BD9D0]' : 'text-slate-700'}
                            ${!day.isCurrentMonth ? 'text-slate-400 font-normal' : ''}
                          `}
                        >
                          {/* N'afficher un numéro que pour les jours du mois courant */}
                          {day.isCurrentMonth ? day.dayNumber.toString().padStart(2, '0') : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* ✅ Une seule barre rouge par conflit (réservation la plus tôt) ; cadran au clic */}
              {!isMobile && conflictGroupsWithPosition.map((group) =>
                group.weekSegments
                  .filter((seg) => seg.weekIndex === weekIndex)
                  .map((seg, segIdx) => {
                    const cellPadding = isMobile ? 8 : 12;
                    const dayNumberHeight = isMobile ? 28 : 24;
                    const spaceAfterNumber = dayNumberHeight + 8;
                    const topOffset = cellPadding + spaceAfterNumber;
                    const isOpen = openConflict?.groupKey === group.groupKey && openConflict?.weekIndex === weekIndex;
                    return (
                      <div
                        key={`conflict-${group.groupKey}-${weekIndex}-${segIdx}`}
                        className={`absolute left-0 right-0 top-0 grid grid-cols-7 gap-4 pointer-events-none ${isOpen ? 'z-[110]' : 'z-30'}`}
                        style={{ height: `${cellHeight}px` }}
                      >
                        <div
                          className="relative pointer-events-auto"
                          style={{
                            gridColumn: `${seg.startDayIndex + 1} / span ${seg.span}`,
                          }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="absolute flex items-center px-3 rounded-full text-xs font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90 ring-2 ring-red-300/70"
                            style={{
                              top: `${topOffset}px`,
                              height: `${isMobile ? 40 : 32}px`,
                              left: '2px',
                              right: '2px',
                              width: 'calc(100% - 4px)',
                              backgroundColor: BOOKING_COLORS.conflict.hex,
                              boxShadow: '0 4px 12px rgba(220,38,38,0.25)',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenConflict(isOpen ? null : { groupKey: group.groupKey, weekIndex });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpenConflict(isOpen ? null : { groupKey: group.groupKey, weekIndex });
                              }
                            }}
                          >
                            <span className="truncate">
                              {group.primaryReservation.displayName} • {group.primaryReservation.startFormatted} – {group.primaryReservation.endFormatted}
                            </span>
                          </div>
                          {isOpen && (
                            <ConflictCadran
                              reservations={group.reservations}
                              onDelete={onDeleteBooking ? (id) => onDeleteBooking(id).catch(() => {}) : () => {}}
                              onSelectReservation={(id) => {
                                const res = allReservations.find((r) => r.id === id);
                                if (res) {
                                  onBookingClick(res);
                                  setOpenConflict(null);
                                }
                              }}
                              onClose={() => setOpenConflict(null)}
                              className="left-0 top-2"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
              )}

              {/* ✅ Barres normales (réservations hors conflit) */}
              {weekBookingsWithoutConflicts.length > 0 && (
                <>
                  {weekBookingsWithoutConflicts.map((bookingData, arrayIndex) => {
                    // ✅ CRITIQUE : Vérifier que bookingData.booking existe
                    if (!bookingData.booking) {
                      console.error('❌ [CALENDAR ERROR] bookingData.booking is undefined:', {
                        weekIndex,
                        arrayIndex,
                        bookingData
                      });
                      return null;
                    }
                    
                    // ✅ NOUVEAU : Enrichir bookingData.booking avec les données originales de allReservations
                    // Cela permet de récupérer le statut (completed/confirmed) qui peut être perdu dans bookingLayout
                    const originalReservation = allReservations.find(r => r.id === bookingData.booking.id);
                    const enrichedBookingData = {
                      ...bookingData,
                      booking: originalReservation || bookingData.booking
                    };
                    
                    const layer = bookingData.layer || 0;
                    const layerOffset = hasConflictInWeek ? 1 : 0;
                    const maxLayers = layersInWeek;
                    
                    // Les logs de rendu détaillés ont été désactivés pour améliorer les performances
                    
                    // ✅ CALCUL PRÉCIS : Valeurs pour le positionnement (augmentées pour mobile)
                    const cellPadding = isMobile ? 8 : 12; // p-2 (8px) ou p-3 (12px)
                    const dayNumberHeight = isMobile ? 28 : 24; // Augmenté de 20 à 28 pour mobile
                    const dayNumberMargin = isMobile ? 8 : 8; // Augmenté de 4 à 8 pour mobile
                    const spaceAfterNumber = dayNumberHeight + dayNumberMargin;
                    
                    // ✅ ESPACEMENT AMÉLIORÉ : Augmenté significativement pour mobile
                    const minSpacing = isMobile ? 18 : 18; // ✅ FIGMA : Augmenté pour correspondre au design (était 12:12)
                    const idealSpacing = isMobile ? 24 : 24; // ✅ FIGMA : Augmenté pour correspondre au design (était 18:18)
                    const availableSpace = cellHeight - cellPadding - spaceAfterNumber - cellPadding;
                    const totalRequiredSpace = maxLayers * baseHeight + (maxLayers > 1 ? (maxLayers - 1) * idealSpacing : 0);
                    
                    let actualSpacing: number;
                    if (totalRequiredSpace <= availableSpace) {
                      actualSpacing = idealSpacing;
                    } else {
                      const calculatedSpacing = maxLayers > 1 
                        ? (availableSpace - (maxLayers * baseHeight)) / (maxLayers - 1)
                        : 0;
                      actualSpacing = Math.max(minSpacing, calculatedSpacing);
                    }
                    
                    // ✅ FIGMA : Lignes successives ; décaler d’une ligne si une barre rouge (conflit) est dans la semaine
                    const topOffset = cellPadding + spaceAfterNumber + (layer + layerOffset) * (baseHeight + actualSpacing);

                    // ✅ CRITIQUE : Clé stable et unique pour éviter les erreurs removeChild
                    const bookingId = bookingData.booking?.id || `unknown-${arrayIndex}`;
                    const stableKey = `${bookingId}-${weekIndex}-${bookingData.startDayIndex}-${bookingData.span}-${layer}`;
                    
                    // ✅ PROTECTION : Vérifier que booking existe avant de rendre
                    if (!bookingData.booking) {
                      console.warn('⚠️ [CalendarGrid] Booking manquant, skip rendu');
                      return null;
                    }
                    
                    return (
                      <div
                        key={stableKey}
                        className="absolute z-30"
                        style={{
                          // ✅ CRITIQUE : Position dans la grille correspondant exactement aux cellules
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          pointerEvents: 'none', // Désactiver les événements sur le conteneur
                        }}
                      >
                        <div 
                          className="grid grid-cols-7 h-full gap-4"
                          style={{
                            // ✅ CRITIQUE : S'assurer que la grille correspond exactement aux cellules
                            height: `${cellHeight}px`,
                            pointerEvents: 'none', // Désactiver les événements sur la grille
                          }}
                        >
                          <div
                            className="relative"
                            style={{
                              // ✅ CRITIQUE : Utiliser gridColumn avec index basé sur 1 (CSS Grid)
                              gridColumn: `${bookingData.startDayIndex + 1} / span ${bookingData.span}`,
                              gridColumnStart: bookingData.startDayIndex + 1,
                              gridColumnEnd: bookingData.startDayIndex + bookingData.span + 1,
                              pointerEvents: 'none', // Désactiver les événements sur le conteneur de colonne
                            }}
                          >
                            <div
                              className="absolute transition-all duration-300 ease-out hover:scale-[1.02]"
                              style={{
                                top: `${topOffset}px`,
                                height: `${baseHeight}px`,
                                zIndex: 100 + layer,
                                left: bookingData.startOffsetPercent
                                  ? `calc(2px + ${(bookingData.startOffsetPercent / bookingData.span)}%)`
                                  : '2px',
                                right: '2px',
                                width: bookingData.startOffsetPercent
                                  ? `calc(100% - 4px - ${(bookingData.startOffsetPercent / bookingData.span)}%)`
                                  : 'calc(100% - 4px)',
                                opacity: 1,
                                pointerEvents: 'auto',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                
                                if (enrichedBookingData.booking && onBookingClick) {
                                  onBookingClick(enrichedBookingData.booking);
                                }
                              }}
                            >
                              <CalendarBookingBar
                                bookingData={enrichedBookingData}
                                bookingIndex={layer}
                                conflicts={conflicts}
                                onBookingClick={onBookingClick}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ PHASE 3 : Comparaison personnalisée pour éviter les re-renders inutiles
  if (prevProps.calendarDays.length !== nextProps.calendarDays.length) return false;
  if (prevProps.conflicts.length !== nextProps.conflicts.length) return false;
  if (JSON.stringify(prevProps.conflicts) !== JSON.stringify(nextProps.conflicts)) return false;
  if (prevProps.conflictGroupsWithPosition?.length !== nextProps.conflictGroupsWithPosition?.length) return false;
  if (prevProps.openConflict?.groupKey !== nextProps.openConflict?.groupKey || prevProps.openConflict?.weekIndex !== nextProps.openConflict?.weekIndex) return false;

  // Comparer les clés de bookingLayout
  const prevKeys = Object.keys(prevProps.bookingLayout);
  const nextKeys = Object.keys(nextProps.bookingLayout);
  if (prevKeys.length !== nextKeys.length) return false;
  
  // Comparer les valeurs de bookingLayout
  for (const key of prevKeys) {
    if (!nextProps.bookingLayout[key]) return false;
    if (prevProps.bookingLayout[key].length !== nextProps.bookingLayout[key].length) return false;
  }
  
  return true; // Props identiques, pas besoin de re-render
});

CalendarGrid.displayName = 'CalendarGrid';
