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
    <div className="rounded-xl overflow-hidden bg-card shadow-xl border border-border/60">
      {/* ✅ AMÉLIORÉ : En-têtes avec meilleur contraste, espacement et esthétique moderne */}
      <div className="grid grid-cols-7 bg-gradient-to-r from-slate-100 via-blue-50/30 to-slate-100 border-b-2 border-slate-300/50 shadow-md">
        {dayNames.map((day, index) => (
          <div 
            key={day} 
            className={`
              p-3 sm:p-4 text-center text-xs sm:text-sm font-bold text-slate-800
              transition-all duration-200 hover:bg-cyan-100/50 hover:shadow-inner
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
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="relative">
            {/* Week Row with Days */}
            <div className="grid grid-cols-7">
              {week.map((day, dayIndex) => {
                const isToday = day.date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={dayIndex}
                    className={`
                      border-r border-b border-slate-300/50 p-2 sm:p-3 bg-white relative 
                      hover:bg-gradient-to-br hover:from-cyan-50/80 hover:to-teal-50/80
                      transition-all duration-300 ease-in-out group
                      ${!day.isCurrentMonth ? 'bg-slate-100/30 text-slate-400' : 'bg-white'}
                      ${isToday ? 'bg-gradient-to-br from-cyan-200/60 via-teal-100/40 to-cyan-200/60 ring-2 ring-cyan-500 ring-offset-2 shadow-lg' : ''}
                      ${dayIndex === 6 ? 'border-r-0' : ''}
                      ${isToday ? 'shadow-cyan-400/50 z-10' : 'hover:shadow-md'}
                    `}
                    style={{
                      // ✅ OPTIMISÉ : Hauteur dynamique basée sur le nombre de réservations dans la semaine
                      minHeight: (() => {
                        const layersInWeek = bookingLayout[weekIndex] ? 
                          Math.max(...bookingLayout[weekIndex].map(b => b.layer || 0)) + 1 : 1;
                        const baseHeight = isMobile ? 20 : 26;
                        const spacing = isMobile ? 8 : 12;
                        const headerSpace = isMobile ? 30 : 40;
                        const padding = isMobile ? 16 : 20;
                        const calculatedHeight = headerSpace + (layersInWeek * (baseHeight + spacing)) + padding;
                        const minHeight = isMobile ? 80 : 120;
                        return `${Math.max(minHeight, calculatedHeight)}px`;
                      })(),
                      height: 'auto', // Permettre l'expansion automatique
                    }}
                  >
                    {/* ✅ AMÉLIORÉ : Numéro de jour avec meilleur contraste et style moderne */}
                    <div className={`
                      text-sm sm:text-base font-bold mb-1 sm:mb-2 
                      transition-all duration-300 group-hover:scale-125 group-hover:font-extrabold
                      ${isToday ? 'text-teal-700 font-extrabold drop-shadow-sm' : 'text-slate-800'}
                      ${!day.isCurrentMonth ? 'text-slate-400 font-normal' : ''}
                    `}>
                      {day.dayNumber}
                    </div>
                    
                    {/* ✅ AMÉLIORÉ : Indicateur de réservations multiples avec meilleure visibilité */}
                    {bookingLayout[weekIndex] && bookingLayout[weekIndex].length > 2 && (
                      <div className="absolute top-1 right-1 bg-gradient-to-br from-cyan-600 to-teal-700 text-white text-[10px] px-2 py-1 rounded-full font-bold z-20 shadow-lg border border-white/30 backdrop-blur-sm">
                        +{bookingLayout[weekIndex].length - 2}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Booking Bars (grid-column spanning for pixel-perfect ends at day boundaries) */}
            {bookingLayout[weekIndex] && (
              <div className="absolute inset-0 top-6 sm:top-8 pointer-events-none z-20">
                <div className="grid grid-cols-7 h-full">
                  {bookingLayout[weekIndex].map((bookingData, arrayIndex) => {
                    const layer = bookingData.layer || 0;
                    const maxLayers = Math.max(...bookingLayout[weekIndex].map(b => b.layer || 0)) + 1;
                    
                    // ✅ OPTIMISÉ : Calcul dynamique amélioré de l'espacement avec meilleures valeurs
                    const baseHeight = isMobile ? 22 : 28; // Hauteur de base augmentée pour plus de lisibilité
                    const minSpacing = isMobile ? 5 : 7; // Espacement minimum garanti entre les barres
                    const idealSpacing = isMobile ? 9 : 13; // Espacement idéal quand l'espace le permet
                    
                    // Calculer la hauteur totale de la cellule dynamiquement
                    const headerOffset = isMobile ? 20 : 30;
                    const cellPadding = isMobile ? 8 : 12;
                    const availableSpace = (isMobile ? 80 : 120) - headerOffset - cellPadding;
                    
                    // Calculer l'espacement optimal en fonction du nombre de couches
                    const totalRequiredSpace = maxLayers * baseHeight + (maxLayers - 1) * idealSpacing;
                    
                    let actualSpacing: number;
                    if (totalRequiredSpace <= availableSpace) {
                      // Assez d'espace pour l'espacement idéal
                      actualSpacing = idealSpacing;
                    } else {
                      // Calculer un espacement réduit mais jamais inférieur au minimum
                      const calculatedSpacing = (availableSpace - (maxLayers * baseHeight)) / (maxLayers - 1);
                      actualSpacing = Math.max(minSpacing, calculatedSpacing);
                    }
                    
                    // Position verticale avec espacement optimisé
                    const topOffset = headerOffset + (layer * (baseHeight + actualSpacing));
                    
                    // Marges horizontales pour une meilleure séparation visuelle
                    const endDayIndex = bookingData.startDayIndex + bookingData.span - 1;
                    const overhangRight = endDayIndex < 6 ? (isMobile ? 3 : 8) : 0;
                    const startInset = bookingData.startDayIndex > 0 ? (isMobile ? 3 : 8) : 0;

                    return (
                      <div
                        key={`${bookingData.booking.id}-${arrayIndex}`}
                        className="relative pointer-events-auto"
                        style={{
                          gridColumn: `${bookingData.startDayIndex + 1} / span ${bookingData.span}`,
                        }}
                      >
                        <div
                          className="absolute transition-all duration-300 ease-out hover:scale-[1.02]"
                          style={{
                            top: `${topOffset}px`,
                            height: `${baseHeight}px`,
                            zIndex: 100 + layer,
                            left: `${startInset}px`,
                            right: `-${overhangRight}px`,
                            // ✅ OPTIMISÉ : Meilleure séparation visuelle entre les couches avec espacement amélioré
                            marginTop: `${layer > 0 ? 2 : 0}px`, // Marge supplémentaire pour les couches supérieures
                            marginBottom: `${layer < maxLayers - 1 ? 2 : 0}px`,
                            opacity: 1, // Opacité pleine pour toutes les couches
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
