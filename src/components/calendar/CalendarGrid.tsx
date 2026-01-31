import { memo } from 'react';
import { CalendarDay, BookingLayout } from './CalendarUtils';
import { CalendarBookingBar } from './CalendarBookingBar';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarGridProps {
  calendarDays: CalendarDay[];
  bookingLayout: { [key: string]: BookingLayout[] };
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
  // ✅ NOUVEAU : Ajouter allReservations pour avoir accès au statut des réservations
  allReservations?: (Booking | AirbnbReservation)[];
}

// Libellés de jours pour desktop, comme sur la maquette ("lun.", "mar.", ...)
const dayNames = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

// ✅ PHASE 3 : Mémoriser CalendarGrid avec comparaison personnalisée
export const CalendarGrid = memo(({ 
  calendarDays, 
  bookingLayout, 
  conflicts, 
  onBookingClick,
  allReservations = []
}: CalendarGridProps) => {
  const isMobile = useIsMobile();
  // Calculate weeks for layout
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

          // ✅ CALCULER les valeurs une seule fois par semaine pour cohérence
          // Note: layersInWeek n'est plus utilisé car toutes les réservations sont alignées
          const layersInWeek = bookingLayout[weekIndex] ? 
            Math.max(...bookingLayout[weekIndex].map(b => b.layer || 0)) + 1 : 1;
          // ✅ MOBILE-FRIENDLY : Augmenter significativement les tailles pour mobile
          const baseHeight = isMobile ? 40 : 32; // Augmenté de 28 à 40 pour mobile
          const spacing = isMobile ? 24 : 22; // ✅ FIGMA : Augmenté pour correspondre au design (était 16:14)
          const headerSpace = isMobile ? 60 : 45; // Augmenté de 42 à 60 pour mobile
          const padding = isMobile ? 32 : 25; // Augmenté de 24 à 32 pour mobile
          // ✅ ALIGNEMENT : Hauteur fixe car toutes les réservations sont à la même position
          const calculatedHeight = headerSpace + baseHeight + padding;
          const minHeight = isMobile ? 140 : 120; // Réduit car pas de cascade
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
              
              {/* ✅ CORRIGÉ CRITIQUE : Booking Bars positionnées directement dans chaque cellule pour alignement parfait */}
              {bookingLayout[weekIndex] && bookingLayout[weekIndex].length > 0 && (
                <>
                  {bookingLayout[weekIndex].map((bookingData, arrayIndex) => {
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
                    
                    // ✅ ALIGNEMENT : Toutes les réservations à la même hauteur (pas de cascade)
                    const topOffset = cellPadding + spaceAfterNumber;

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
                                left: '2px', // ✅ NOUVEAU : Marge gauche pour délimiter
                                right: '2px', // ✅ NOUVEAU : Marge droite pour délimiter
                                width: 'calc(100% - 4px)', // ✅ AMÉLIORÉ : Réduire de 4px total (2px chaque côté)
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
