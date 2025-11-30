import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth, addMonths, subMonths } from 'date-fns';
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
}

const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const CalendarMobile: React.FC<CalendarMobileProps> = ({
  calendarDays,
  bookingLayout,
  conflicts,
  onBookingClick,
  currentDate,
  onDateChange
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Récupérer toutes les réservations
  const allBookings = useMemo(() => {
    const bookings: Array<{ booking: Booking | AirbnbReservation; date: Date }> = [];
    
    Object.values(bookingLayout).forEach((weekBookings) => {
      weekBookings.forEach((bookingData) => {
        if (bookingData.booking) {
          const isAirbnb = 'source' in bookingData.booking && bookingData.booking.source === 'airbnb';
          const date = isAirbnb
            ? (bookingData.booking as AirbnbReservation).startDate
            : new Date((bookingData.booking as Booking).checkInDate);
          bookings.push({ booking: bookingData.booking, date });
        }
      });
    });
    
    return bookings.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [bookingLayout]);

  // Filtrer les réservations pour la date sélectionnée
  const bookingsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return allBookings.filter(({ booking, date }) => {
      const isAirbnb = 'source' in booking && booking.source === 'airbnb';
      const checkIn = isAirbnb
        ? (booking as AirbnbReservation).startDate
        : new Date((booking as Booking).checkInDate);
      const checkOut = isAirbnb
        ? (booking as AirbnbReservation).endDate
        : new Date((booking as Booking).checkOutDate);
      
      return isSameDay(checkIn, selectedDate) || 
             (selectedDate >= checkIn && selectedDate <= checkOut);
    });
  }, [selectedDate, allBookings]);

  // Navigation mois
  const previousMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  // Obtenir les réservations pour un jour donné
  const getBookingsForDay = (day: Date) => {
    const dayIndex = calendarDays.findIndex(d => isSameDay(d.date, day));
    if (dayIndex === -1) return [];
    
    const weekIndex = Math.floor(dayIndex / 7);
    return bookingLayout[weekIndex]?.filter(b => {
      const startIndex = calendarDays.findIndex(d => {
        const isAirbnb = 'source' in b.booking && b.booking.source === 'airbnb';
        const checkIn = isAirbnb
          ? (b.booking as AirbnbReservation).startDate
          : new Date((b.booking as Booking).checkInDate);
        return isSameDay(d.date, checkIn);
      });
      return startIndex === dayIndex;
    }) || [];
  };

  // Vue Calendrier Compact
  const CalendarView = () => {
    const weeks: Date[][] = [];
    const firstDay = startOfMonth(currentDate);
    const lastDay = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: firstDay, end: lastDay });
    
    // Ajouter les jours du mois précédent pour compléter la première semaine
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lundi = 0
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDayOfWeek);
    
    const allDays = eachDayOfInterval({ 
      start: startDate, 
      end: lastDay 
    });
    
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    return (
      <div className="space-y-4">
        {/* En-tête du mois */}
        <div className="flex items-center justify-between px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={previousMonth}
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h2>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-1 px-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-600 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grille du calendrier */}
        <div className="grid grid-cols-7 gap-1 px-2">
          {weeks.flat().map((day, index) => {
            const isCurrentMonthDay = isSameMonth(day, currentDate);
            const isTodayDay = isToday(day);
            const dayBookings = getBookingsForDay(day);
            const hasConflict = dayBookings.some(b => conflicts.includes(b.booking.id));
            
            return (
              <button
                key={index}
                onClick={() => {
                  if (isCurrentMonthDay) {
                    setSelectedDate(day);
                    if (dayBookings.length > 0) {
                      setViewMode('list');
                    }
                  }
                }}
                className={cn(
                  "relative aspect-square rounded-lg border-2 transition-all",
                  "flex flex-col items-center justify-start p-1.5",
                  !isCurrentMonthDay && "opacity-40",
                  isTodayDay && "border-cyan-500 bg-cyan-50",
                  !isTodayDay && isCurrentMonthDay && "border-gray-200 bg-white",
                  !isCurrentMonthDay && "border-gray-100 bg-gray-50",
                  dayBookings.length > 0 && "border-brand-teal/50 bg-brand-teal/5",
                  hasConflict && "border-red-400 bg-red-50",
                  "active:scale-95"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-semibold mb-0.5",
                    isTodayDay && "text-cyan-700",
                    !isTodayDay && isCurrentMonthDay && "text-gray-900",
                    !isCurrentMonthDay && "text-gray-400"
                  )}
                >
                  {format(day, 'd')}
                </span>
                
                {/* Indicateurs de réservations */}
                {dayBookings.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 justify-center w-full mt-0.5">
                    {dayBookings.slice(0, 3).map((bookingData, idx) => {
                      const isAirbnb = 'source' in bookingData.booking && bookingData.booking.source === 'airbnb';
                      const status = isAirbnb ? 'pending' : (bookingData.booking as Booking).status || 'pending';
                      const color = status === 'completed' 
                        ? BOOKING_COLORS.completed.hex 
                        : BOOKING_COLORS.pending.hex;
                      
                      return (
                        <div
                          key={idx}
                          className="h-1.5 w-full rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <span className="text-[8px] text-gray-600 font-medium">
                        +{dayBookings.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Vue Liste des réservations
  const ListView = () => {
    return (
      <div className="space-y-3">
        {/* En-tête avec retour */}
        <div className="flex items-center justify-between px-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setViewMode('calendar');
              setSelectedDate(null);
            }}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </Button>
          
          {selectedDate && (
            <div className="text-sm font-semibold text-gray-700">
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </div>
          )}
        </div>

        {/* Liste des réservations */}
        <div className="space-y-2 px-2">
          {selectedDate ? (
            bookingsForSelectedDate.length > 0 ? (
              <AnimatePresence>
                {bookingsForSelectedDate.map(({ booking }) => {
                  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
                  const checkIn = isAirbnb
                    ? (booking as AirbnbReservation).startDate
                    : new Date((booking as Booking).checkInDate);
                  const checkOut = isAirbnb
                    ? (booking as AirbnbReservation).endDate
                    : new Date((booking as Booking).checkOutDate);
                  const status = isAirbnb ? 'pending' : (booking as Booking).status || 'pending';
                  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                  const displayText = getUnifiedBookingDisplayText(booking, false);
                  const color = status === 'completed' 
                    ? BOOKING_COLORS.completed.hex 
                    : BOOKING_COLORS.pending.hex;
                  
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => onBookingClick(booking)}
                    >
                      <Card className="border-l-4 shadow-sm active:scale-[0.98] transition-transform">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <h3 className="font-semibold text-base text-gray-900 truncate">
                                  {displayText}
                                </h3>
                              </div>
                              
                              <div className="space-y-1.5 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                                  <span>
                                    {format(checkIn, 'd MMM', { locale: fr })} - {format(checkOut, 'd MMM yyyy', { locale: fr })}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span>{nights} nuit{nights > 1 ? 's' : ''}</span>
                                </div>
                                
                                {!isAirbnb && (booking as Booking).numberOfGuests && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-gray-400" />
                                    <span>{(booking as Booking).numberOfGuests} invité{(booking as Booking).numberOfGuests! > 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Badge
                              variant="secondary"
                              style={{ backgroundColor: color, color: 'white' }}
                              className="flex-shrink-0"
                            >
                              {status === 'completed' ? 'Terminé' : 'En attente'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucune réservation pour cette date</p>
              </div>
            )
          ) : (
            // Vue de toutes les réservations
            allBookings.length > 0 ? (
              <AnimatePresence>
                {allBookings.map(({ booking, date }) => {
                  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
                  const checkIn = isAirbnb
                    ? (booking as AirbnbReservation).startDate
                    : new Date((booking as Booking).checkInDate);
                  const checkOut = isAirbnb
                    ? (booking as AirbnbReservation).endDate
                    : new Date((booking as Booking).checkOutDate);
                  const status = isAirbnb ? 'pending' : (booking as Booking).status || 'pending';
                  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                  const displayText = getUnifiedBookingDisplayText(booking, false);
                  const color = status === 'completed' 
                    ? BOOKING_COLORS.completed.hex 
                    : BOOKING_COLORS.pending.hex;
                  
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => onBookingClick(booking)}
                    >
                      <Card className="border-l-4 shadow-sm active:scale-[0.98] transition-transform">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <h3 className="font-semibold text-base text-gray-900 truncate">
                                  {displayText}
                                </h3>
                              </div>
                              
                              <div className="space-y-1.5 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                                  <span>
                                    {format(checkIn, 'd MMM', { locale: fr })} - {format(checkOut, 'd MMM yyyy', { locale: fr })}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span>{nights} nuit{nights > 1 ? 's' : ''}</span>
                                </div>
                                
                                {!isAirbnb && (booking as Booking).numberOfGuests && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-gray-400" />
                                    <span>{(booking as Booking).numberOfGuests} invité{(booking as Booking).numberOfGuests! > 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Badge
                              variant="secondary"
                              style={{ backgroundColor: color, color: 'white' }}
                              className="flex-shrink-0"
                            >
                              {status === 'completed' ? 'Terminé' : 'En attente'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucune réservation</p>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-border/50 p-4">
      {/* Toggle vue */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Button
          variant={viewMode === 'calendar' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('calendar')}
          className="flex-1"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Calendrier
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => {
            setViewMode('list');
            setSelectedDate(null);
          }}
          className="flex-1"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Liste
        </Button>
      </div>

      {/* Contenu selon la vue */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === 'list' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === 'list' ? -20 : 20 }}
          transition={{ duration: 0.2 }}
        >
          {viewMode === 'calendar' ? <CalendarView /> : <ListView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

