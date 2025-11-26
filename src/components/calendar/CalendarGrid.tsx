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
}

const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const CalendarGrid = ({ 
  calendarDays, 
  bookingLayout, 
  conflicts, 
  onBookingClick 
}: CalendarGridProps) => {
  const isMobile = useIsMobile();
  // Calculate weeks for layout
  const weeks = [] as CalendarDay[][];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-border/50">
      {/* ✅ SIMPLIFIÉ : En-têtes sobres */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {dayNames.map((day, index) => (
          <div 
            key={day} 
            className={`
              p-3 sm:p-4 text-center text-xs sm:text-sm font-semibold text-slate-600
              ${index === 0 ? 'rounded-tl-xl' : ''}
              ${index === 6 ? 'rounded-tr-xl' : ''}
            `}
          >
            <span className="hidden sm:inline font-semibold tracking-wide text-slate-800">{day}</span>
            <span className="sm:hidden font-bold text-slate-800">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="relative">
        {weeks.map((week, weekIndex) => {
          // ✅ CALCULER les valeurs une seule fois par semaine pour cohérence
          const layersInWeek = bookingLayout[weekIndex] ? 
            Math.max(...bookingLayout[weekIndex].map(b => b.layer || 0)) + 1 : 1;
          // ✅ MOBILE-FRIENDLY : Augmenter l'espacement pour mobile
          const baseHeight = isMobile ? 28 : 32; // Augmenté de 24 à 28
          const spacing = isMobile ? 12 : 14; // Augmenté de 10 à 12
          const headerSpace = isMobile ? 42 : 45; // Augmenté de 35 à 42
          const padding = isMobile ? 24 : 25; // Augmenté de 20 à 24
          const calculatedHeight = headerSpace + (layersInWeek * (baseHeight + spacing)) + padding;
          const minHeight = isMobile ? 120 : 150; // Augmenté de 100 à 120
          const cellHeight = Math.max(minHeight, calculatedHeight);
          
          return (
            <div key={weekIndex} className="relative" style={{ minHeight: `${cellHeight}px` }}>
              {/* Week Row with Days */}
              <div className="grid grid-cols-7 relative" style={{ minHeight: `${cellHeight}px` }}>
                {week.map((day, dayIndex) => {
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`
                        border-r border-b border-slate-100 p-3 sm:p-4 bg-white relative
                        ${!day.isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white'}
                        ${isToday ? 'bg-cyan-50 border-cyan-200 z-10' : ''}
                        ${dayIndex === 6 ? 'border-r-0' : ''}
                      `}
                      style={{
                        minHeight: `${cellHeight}px`,
                        height: `${cellHeight}px`,
                      }}
                    >
                      <div className={`
                        text-base sm:text-lg font-semibold mb-2 sm:mb-3
                        ${isToday ? 'text-cyan-700' : 'text-slate-700'}
                        ${!day.isCurrentMonth ? 'text-slate-400 font-normal' : ''}
                      `}>
                        {day.dayNumber}
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
                    
                    const layer = bookingData.layer || 0;
                    const maxLayers = layersInWeek;
                    
                    // ✅ DIAGNOSTIC EXHAUSTIF : Log détaillé pour chaque barre
                    if (arrayIndex === 0) {
                      // ✅ CORRIGÉ : Vérifier le type de booking avant d'accéder aux propriétés
                      const isAirbnbBooking = 'source' in bookingData.booking && bookingData.booking.source === 'airbnb';
                      const booking = isAirbnbBooking 
                        ? null // Ne pas traiter les réservations Airbnb ici
                        : (bookingData.booking as Booking);
                      
                      // ✅ CORRIGÉ : Ne faire le log que pour les réservations Booking (pas Airbnb)
                      if (booking) {
                        const expectedDay = week.find(d => {
                          const dDate = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate(), 0, 0, 0, 0);
                          const checkIn = new Date(booking.checkInDate);
                          const checkInNorm = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0);
                          return dDate.getTime() === checkInNorm.getTime();
                        });
                        
                        console.log(`📊 [RENDU BARRE] Semaine ${weekIndex}, première barre:`, {
                          bookingId: booking.id.substring(0, 8),
                          startDayIndex: bookingData.startDayIndex,
                          span: bookingData.span,
                          layer,
                          gridColumn: `${bookingData.startDayIndex + 1} / span ${bookingData.span}`,
                          checkIn: booking.checkInDate,
                          checkOut: booking.checkOutDate,
                          cellHeight,
                          weekDayNumbers: week.map(d => d.dayNumber),
                          expectedDayNumber: expectedDay?.dayNumber,
                          actualDayNumber: week[bookingData.startDayIndex]?.dayNumber,
                          alignmentMatch: expectedDay?.dayNumber === week[bookingData.startDayIndex]?.dayNumber,
                          hasBooking: !!bookingData.booking,
                          bookingType: 'manual'
                        });
                      }
                    }
                    
                    // ✅ CALCUL PRÉCIS : Valeurs pour le positionnement
                    const cellPadding = isMobile ? 8 : 12; // p-2 (8px) ou p-3 (12px)
                    const dayNumberHeight = isMobile ? 20 : 24; // Hauteur du numéro
                    const dayNumberMargin = isMobile ? 4 : 8; // mb-1 (4px) ou mb-2 (8px)
                    const spaceAfterNumber = dayNumberHeight + dayNumberMargin;
                    
                    // ✅ ESPACEMENT : Calcul dynamique entre les couches
                    const minSpacing = isMobile ? 6 : 8;
                    const idealSpacing = isMobile ? 10 : 14;
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
                    
                    // ✅ POSITION VERTICALE : Depuis le haut de la cellule (inclut le padding)
                    const topOffset = cellPadding + spaceAfterNumber + (layer * (baseHeight + actualSpacing));

                    // ✅ CRITIQUE : Utiliser un ID unique pour la clé
                    const bookingId = bookingData.booking.id || `unknown-${arrayIndex}`;
                    
                    return (
                      <div
                        key={`${bookingId}-${weekIndex}-${arrayIndex}`}
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
                          className="grid grid-cols-7 h-full"
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
                                zIndex: 100 + layer, // ✅ AUGMENTÉ : Z-index plus élevé pour être au-dessus
                                left: '0px',
                                right: '0px',
                                width: '100%',
                                opacity: 1,
                                pointerEvents: 'auto', // ✅ CRITIQUE : Activer les événements uniquement sur la barre
                              }}
                              onClick={(e) => {
                                // ✅ DIAGNOSTIC : Log du clic
                                console.log('🖱️ [CLIC BARRE]', {
                                  bookingId: bookingData.booking.id,
                                  bookingType: 'source' in bookingData.booking ? 'airbnb' : 'manual',
                                  layer,
                                  weekIndex,
                                  arrayIndex
                                });
                                
                                // ✅ CRITIQUE : Empêcher la propagation pour éviter les clics multiples
                                e.stopPropagation();
                                
                                // ✅ CRITIQUE : Vérifier que booking existe avant d'appeler
                                if (bookingData.booking && onBookingClick) {
                                  onBookingClick(bookingData.booking);
                                } else {
                                  console.error('❌ [CLIC BARRE] Erreur:', {
                                    hasBooking: !!bookingData.booking,
                                    hasOnClick: !!onBookingClick
                                  });
                                }
                              }}
                            >
                              <CalendarBookingBar
                                bookingData={bookingData}
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
};
