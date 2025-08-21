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
    <div className="rounded-xl overflow-hidden bg-card shadow-sm border">
      {/* Day Headers */}
      <div className="grid grid-cols-7 bg-muted/30 border-b">
        {dayNames.map(day => (
          <div key={day} className="p-2 sm:p-4 text-center text-xs sm:text-sm font-medium text-foreground">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
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
                      h-[80px] sm:h-[120px] border-r border-b p-1 sm:p-3 bg-background relative hover:bg-muted/20 transition-colors
                      ${!day.isCurrentMonth ? 'bg-muted/10 text-muted-foreground' : ''}
                      ${isToday ? 'bg-primary/5 ring-1 ring-primary/20' : ''}
                      ${dayIndex === 6 ? 'border-r-0' : ''}
                    `}
                  >
                    {/* Day Number */}
                    <div className={`text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-foreground`}>
                      {day.dayNumber}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Booking Bars (grid-column spanning for pixel-perfect ends at day boundaries) */}
            {bookingLayout[weekIndex] && (
              <div className="absolute inset-0 top-6 sm:top-8 pointer-events-none z-20">
                <div className="grid grid-cols-7 h-full">
                  {bookingLayout[weekIndex].map((bookingData, arrayIndex) => {
                    const barHeight = isMobile ? 16 : 24;
                    const layer = bookingData.layer ?? 0;
                    const topOffset = isMobile ? 12 + (layer * 18) : 20 + (layer * 26);
                    const endDayIndex = bookingData.startDayIndex + bookingData.span - 1;
                    const overhangRight = endDayIndex < 6 ? (isMobile ? 4 : 12) : 0;
                    const startInset = bookingData.startDayIndex > 0 ? (isMobile ? 4 : 12) : 0;

                    return (
                      <div
                        key={`${bookingData.booking.id}-${arrayIndex}`}
                        className="relative pointer-events-auto"
                        style={{
                          gridColumn: `${bookingData.startDayIndex + 1} / span ${bookingData.span}`,
                        }}
                      >
                        <div
                          className="absolute"
                          style={{
                            top: `${topOffset}px`,
                            height: `${barHeight}px`,
                            zIndex: 100 + layer,
                            left: `${startInset}px`,
                            right: `-${overhangRight}px`,
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
