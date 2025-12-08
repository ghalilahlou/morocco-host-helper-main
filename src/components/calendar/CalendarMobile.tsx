import React, { useState, useMemo, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isToday, 
  isSameMonth, 
  addMonths, 
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarMobileProps {
  calendarDays: Array<{
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
  }>;
  bookingLayout: { [key: string]: Array<{
    booking: Booking | AirbnbReservation;
    startDayIndex: number;
    span: number;
    layer: number;
  }> };
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  // ✅ NOUVEAU : Toutes les réservations pour affichage multi-mois
  allReservations?: (Booking | AirbnbReservation)[];
}

// Jours de la semaine format Airbnb (première lettre) - Lundi à Dimanche
const dayNamesShort = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Générer les initiales pour l'avatar
const getInitials = (name: string): string => {
  if (!name || name.length === 0) return '?';
  
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Vérifier si un nom est valide (pas un code)
const isValidGuestName = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower === 'réservation' || lower === 'airbnb') return false;
  if (/^(UID|HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9\-:]+/i.test(trimmed)) return false;
  
  const condensed = trimmed.replace(/\s+/g, '');
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(trimmed)) return false;
  if (!/[a-z]/.test(trimmed) && !trimmed.includes(' ') && /^[A-Z0-9]+$/.test(condensed) && condensed.length >= 4) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  
  const forbiddenWords = ['phone', 'airbnb', 'reservation', 'guest', 'client', 'booking'];
  if (forbiddenWords.some(word => lower.includes(word))) return false;
  
  return true;
};

interface BookingBarData {
  booking: Booking | AirbnbReservation;
  startDate: Date;
  endDate: Date;
  guestName: string;
  guestCount: number;
  isValidName: boolean;
  color: string;
  textColor: string;
  isConflict: boolean;
  photoUrl?: string;
}

export const CalendarMobile: React.FC<CalendarMobileProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calendarDays: _calendarDays,
  bookingLayout,
  conflicts,
  onBookingClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentDate: _currentDate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDateChange: _onDateChange,
  allReservations = [],
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Générer les mois à afficher (mois actuel + 11 mois suivants)
  const monthsToShow = useMemo(() => {
    const months: Date[] = [];
    const startMonth = startOfMonth(new Date());
    
    for (let i = 0; i < 12; i++) {
      months.push(addMonths(startMonth, i));
    }
    
    return months;
  }, []);

  // ✅ CORRIGÉ : Utiliser allReservations directement si disponible, sinon extraire de bookingLayout
  const allBookings = useMemo(() => {
    const bookingsMap = new Map<string, BookingBarData>();
    
    // ✅ SOURCE 1 : Utiliser allReservations passées en prop (multi-mois)
    if (allReservations && allReservations.length > 0) {
      allReservations.forEach((booking) => {
        if (!bookingsMap.has(booking.id)) {
          const isAirbnb = 'source' in booking && booking.source === 'airbnb';
          
          const startDate = isAirbnb
            ? new Date((booking as AirbnbReservation).startDate)
            : new Date((booking as Booking).checkInDate);
          
          const endDate = isAirbnb
            ? new Date((booking as AirbnbReservation).endDate)
            : new Date((booking as Booking).checkOutDate);
          
          const displayText = getUnifiedBookingDisplayText(booking, true);
          const isValidName = isValidGuestName(displayText);
          
          const guestCount = isAirbnb
            ? (booking as AirbnbReservation).numberOfGuests || 1
            : (booking as Booking).numberOfGuests || 1;
          
          const isConflict = conflicts.includes(booking.id);
          let color: string;
          let textColor: string;
          
          if (isConflict) {
            color = BOOKING_COLORS.conflict.hex;
            textColor = 'text-white';
          } else if (isValidName) {
            color = BOOKING_COLORS.completed.hex;
            textColor = 'text-teal-900';
          } else {
            color = BOOKING_COLORS.pending.hex;
            textColor = 'text-white';
          }
          
          bookingsMap.set(booking.id, {
            booking,
            startDate,
            endDate,
            guestName: displayText,
            guestCount,
            isValidName,
            color,
            textColor,
            isConflict,
            photoUrl: undefined
          });
        }
      });
    }
    
    // ✅ SOURCE 2 : Fallback sur bookingLayout (compatibilité)
    Object.values(bookingLayout).forEach((weekBookings) => {
      weekBookings.forEach((bookingData) => {
        if (bookingData.booking && !bookingsMap.has(bookingData.booking.id)) {
          const isAirbnb = 'source' in bookingData.booking && bookingData.booking.source === 'airbnb';
          
          const startDate = isAirbnb
            ? new Date((bookingData.booking as AirbnbReservation).startDate)
            : new Date((bookingData.booking as Booking).checkInDate);
          
          const endDate = isAirbnb
            ? new Date((bookingData.booking as AirbnbReservation).endDate)
            : new Date((bookingData.booking as Booking).checkOutDate);
          
          const displayText = getUnifiedBookingDisplayText(bookingData.booking, true);
          const isValidName = isValidGuestName(displayText);
          
          const guestCount = isAirbnb
            ? (bookingData.booking as AirbnbReservation).numberOfGuests || 1
            : (bookingData.booking as Booking).numberOfGuests || 1;
          
          const isConflict = conflicts.includes(bookingData.booking.id);
          let color: string;
          let textColor: string;
          
          if (isConflict) {
            color = BOOKING_COLORS.conflict.hex;
            textColor = 'text-white';
          } else if (isValidName) {
            color = BOOKING_COLORS.completed.hex;
            textColor = 'text-teal-900';
          } else {
            color = BOOKING_COLORS.pending.hex;
            textColor = 'text-white';
          }
          
          bookingsMap.set(bookingData.booking.id, {
            booking: bookingData.booking,
            startDate,
            endDate,
            guestName: displayText,
            guestCount,
            isValidName,
            color,
            textColor,
            isConflict,
            photoUrl: undefined
          });
        }
      });
    });
    
    return Array.from(bookingsMap.values());
  }, [allReservations, bookingLayout, conflicts]);

  // Gérer le scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 300);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Générer les semaines pour un mois donné
  const getWeeksForMonth = (monthDate: Date) => {
    const firstDay = startOfMonth(monthDate);
    const lastDay = endOfMonth(monthDate);
    
    // ✅ CORRIGÉ : Commencer la première semaine au lundi précédent
    const start = startOfWeek(firstDay, { weekStartsOn: 1 });
    // ✅ CORRIGÉ : Terminer la dernière semaine au dimanche suivant
    const end = endOfWeek(lastDay, { weekStartsOn: 1 });
    
    const days = eachDayOfInterval({ start, end });
    const weeks: Date[][] = [];
    
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return weeks;
  };

  // Obtenir les réservations qui chevauchent une semaine donnée
  const getBookingsForWeek = (week: Date[]): { booking: BookingBarData; startCol: number; span: number }[] => {
    const weekStart = week[0];
    const weekEnd = week[6];
    
    const result: { booking: BookingBarData; startCol: number; span: number }[] = [];
    
    allBookings.forEach(bookingData => {
      const bookingStart = new Date(bookingData.startDate.getFullYear(), bookingData.startDate.getMonth(), bookingData.startDate.getDate());
      const bookingEnd = new Date(bookingData.endDate.getFullYear(), bookingData.endDate.getMonth(), bookingData.endDate.getDate());
      
      // Vérifier si la réservation chevauche cette semaine
      const weekStartNorm = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      const weekEndNorm = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
      
      // La réservation chevauche si elle commence avant la fin de la semaine ET se termine après le début
      if (bookingStart <= weekEndNorm && bookingEnd > weekStartNorm) {
        // Calculer la colonne de départ (0-6)
        let startCol = 0;
        for (let i = 0; i < 7; i++) {
          const dayNorm = new Date(week[i].getFullYear(), week[i].getMonth(), week[i].getDate());
          if (dayNorm.getTime() >= bookingStart.getTime()) {
            startCol = i;
            break;
          }
          if (i === 6) startCol = 0; // La réservation commence avant cette semaine
        }
        
        // Si la réservation commence avant cette semaine
        if (bookingStart < weekStartNorm) {
          startCol = 0;
        }
        
        // Calculer le span (nombre de jours dans cette semaine)
        let span = 0;
        for (let i = startCol; i < 7; i++) {
          const dayNorm = new Date(week[i].getFullYear(), week[i].getMonth(), week[i].getDate());
          // Inclure le jour si il est >= début ET < fin (exclusif)
          if (dayNorm >= bookingStart && dayNorm < bookingEnd) {
            span++;
          }
        }
        
        // S'assurer qu'on a au moins 1 jour
        if (span > 0) {
          result.push({ booking: bookingData, startCol, span });
        }
      }
    });
    
    // Trier par date de début puis par durée
    return result.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.span - a.span;
    });
  };

  // Composant pour afficher un mois
  const MonthView = ({ monthDate }: { monthDate: Date }) => {
    const weeks = getWeeksForMonth(monthDate);
    const monthName = format(monthDate, 'MMMM', { locale: fr });
    const year = format(monthDate, 'yyyy');
    const currentYear = new Date().getFullYear();
    const monthYear = monthDate.getFullYear();
    const showYear = monthYear !== currentYear || monthDate.getMonth() === 0; // Montrer l'année si différente ou janvier
    
    return (
      <div className="mb-4">
        {/* En-tête du mois - Style Airbnb */}
        <div className="pb-2 pt-5">
          <h2 className="text-base font-bold text-gray-900 capitalize">
            {monthName}{showYear && <span className="font-normal text-gray-400 ml-1">{year}</span>}
          </h2>
        </div>

        {/* Semaines */}
        <div className="border-t border-gray-200">
          {weeks.map((week, weekIndex) => {
            const bookingsInWeek = getBookingsForWeek(week);
            // Calculer la hauteur basée sur le nombre de réservations (responsive)
            const bookingRowsCount = Math.max(0, bookingsInWeek.length);
            const baseHeight = 28; // Hauteur pour les numéros de jour (mobile)
            const bookingHeight = 28; // Hauteur par réservation (mobile) - ajusté pour h-7
            const totalHeight = baseHeight + (bookingRowsCount * bookingHeight) + 4;
            
            return (
              <div key={`${monthDate.getTime()}-week-${weekIndex}`} className="relative border-b border-gray-100" style={{ minHeight: `${totalHeight}px` }}>
                {/* ✅ Grille des jours avec bordures visibles */}
                <div className="grid grid-cols-7 relative">
                  {week.map((day, dayIndex) => {
                    const isCurrentMonthDay = isSameMonth(day, monthDate);
                    const isTodayDay = isToday(day);
                    
                    return (
                      <div
                        key={`${day.getTime()}-${dayIndex}`}
                        className={cn(
                          "relative flex items-start justify-center pt-1.5",
                          "border-r border-gray-100 last:border-r-0",
                          !isCurrentMonthDay && "bg-gray-50/50"
                        )}
                        style={{ minHeight: `${totalHeight}px` }}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium z-20 relative",
                            isTodayDay && "bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-xs",
                            !isTodayDay && isCurrentMonthDay && "text-gray-900",
                            !isCurrentMonthDay && "text-gray-300"
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Barres de réservation - Style Airbnb */}
                {bookingsInWeek.length > 0 && (
                  <div 
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: '26px' }}
                  >
                    {bookingsInWeek.map((item, idx) => {
                      const { booking: bookingData, startCol, span } = item;
                      const isStartOfBooking = week.some(d => {
                        const dayNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const bookingStartNorm = new Date(
                          bookingData.startDate.getFullYear(),
                          bookingData.startDate.getMonth(),
                          bookingData.startDate.getDate()
                        );
                        return dayNorm.getTime() === bookingStartNorm.getTime();
                      });
                      
                      // ✅ CORRIGÉ : La fin de la réservation = dernier jour INCLUS (checkout - 1)
                      const lastNightDate = new Date(
                        bookingData.endDate.getFullYear(),
                        bookingData.endDate.getMonth(),
                        bookingData.endDate.getDate() - 1
                      );
                      
                      const isEndOfBooking = week.some(d => {
                        const dayNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        return dayNorm.getTime() === lastNightDate.getTime();
                      });
                      
                      // ✅ Calculer les positions avec extension vers la date de sortie
                      const cellWidth = 100 / 7; // ~14.28% par cellule
                      const leftPercent = startCol * cellWidth;
                      // ✅ Étendre la barre jusqu'au BORD DROIT de la dernière cellule
                      const widthPercent = span * cellWidth;
                      
                      // ✅ Style de bordure arrondie - arrondi seulement aux extrémités
                      let borderRadius = '0';
                      if (isStartOfBooking && isEndOfBooking) {
                        borderRadius = '14px';
                      } else if (isStartOfBooking) {
                        borderRadius = '14px 0 0 14px';
                      } else if (isEndOfBooking) {
                        borderRadius = '0 14px 14px 0';
                      }
                      
                      return (
                        <div
                          key={`${bookingData.booking.id}-${weekIndex}-${idx}`}
                          className="absolute h-7 sm:h-8 pointer-events-auto cursor-pointer"
                          style={{
                            left: `calc(${leftPercent}% + 1px)`,
                            width: `calc(${widthPercent}% - 2px)`,
                            top: `${idx * 28}px`,
                          }}
                          onClick={() => onBookingClick(bookingData.booking)}
                        >
                          <div
                            className={cn(
                              "h-full flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2",
                              "shadow-sm transition-all duration-200",
                              "hover:shadow-md active:scale-[0.99]",
                              bookingData.isConflict && "ring-2 ring-red-400"
                            )}
                            style={{ 
                              backgroundColor: bookingData.color,
                              borderRadius,
                            }}
                          >
                            {/* ✅ Avatar avec initiales ou photo (seulement au début si nom valide) */}
                            {isStartOfBooking && bookingData.isValidName && (
                              <div
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white/20"
                              >
                                {bookingData.photoUrl ? (
                                  <img 
                                    src={bookingData.photoUrl} 
                                    alt={bookingData.guestName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className={cn("text-[8px] sm:text-[9px] font-bold", bookingData.textColor)}>
                                    {getInitials(bookingData.guestName)}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* ✅ Nom OU Code de réservation (pas de "?") - Responsive */}
                            {isStartOfBooking && (
                              <div className={cn("flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1", bookingData.textColor)}>
                                <span className="text-[10px] sm:text-[11px] font-semibold truncate leading-tight">
                                  {bookingData.isValidName 
                                    ? bookingData.guestName.split(' ')[0]
                                    : bookingData.guestName.substring(0, 10) + (bookingData.guestName.length > 10 ? '...' : '')
                                  }
                                </span>
                                {bookingData.guestCount > 1 && (
                                  <span className="text-[9px] sm:text-[10px] font-medium opacity-80 flex-shrink-0 leading-tight">
                                    +{bookingData.guestCount - 1}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* En-tête fixe avec jours de la semaine */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-3">
        <div className="grid grid-cols-7">
          {dayNamesShort.map((day, index) => (
            <div
              key={`header-${index}`}
              className="text-center text-xs font-semibold text-gray-500 py-2.5 border-r border-gray-100 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
      </div>
      
      {/* Container scrollable */}
      <div 
        ref={scrollContainerRef}
        className="h-[calc(100vh-220px)] overflow-y-auto px-3 scroll-smooth"
        onScroll={handleScroll}
      >
        {/* Mois */}
        {monthsToShow.map((month) => (
          <MonthView key={month.getTime()} monthDate={month} />
        ))}
        
        {/* Espace en bas */}
        <div className="h-24" />
      </div>

      {/* Bouton scroll to top - Style Airbnb */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-6 right-4 z-40"
          >
            <Button
              size="icon"
              variant="outline"
              onClick={scrollToTop}
              className="rounded-full shadow-lg bg-white border-gray-200 hover:bg-gray-50 h-10 w-10"
            >
              <ChevronUp className="h-5 w-5 text-gray-700" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
