import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isPast, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EnhancedCalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  mode?: 'single' | 'range';
  rangeStart?: Date;
  rangeEnd?: Date;
  onRangeSelect?: (start: Date, end: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
  showWeekends?: boolean;
  quickSelections?: boolean;
  timeSlots?: boolean;
}

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const EnhancedCalendar: React.FC<EnhancedCalendarProps> = ({
  selected,
  onSelect,
  mode = 'single',
  rangeStart,
  rangeEnd,
  onRangeSelect,
  minDate = new Date(),
  maxDate,
  disabledDates = [],
  className,
  showWeekends = true,
  quickSelections = true,
  timeSlots = false
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempRangeStart, setTempRangeStart] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('14:00');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Ajouter les jours du mois précédent et suivant pour compléter les semaines
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay());
  
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()));
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const isDateDisabled = (date: Date) => {
    if (isPast(date) && !isSameDay(date, new Date())) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    if (!showWeekends && isWeekend(date)) return true;
    return disabledDates.some(disabledDate => isSameDay(date, disabledDate));
  };

  const isDateInRange = (date: Date) => {
    if (mode !== 'range') return false;
    if (!rangeStart || !rangeEnd) return false;
    return date >= rangeStart && date <= rangeEnd;
  };

  const isRangeStart = (date: Date) => {
    return mode === 'range' && rangeStart && isSameDay(date, rangeStart);
  };

  const isRangeEnd = (date: Date) => {
    return mode === 'range' && rangeEnd && isSameDay(date, rangeEnd);
  };

  const isDateInTempRange = (date: Date) => {
    if (mode !== 'range' || !tempRangeStart || !hoveredDate) return false;
    const start = tempRangeStart;
    const end = hoveredDate;
    return date >= (start <= end ? start : end) && date <= (start <= end ? end : start);
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'range') {
      if (!tempRangeStart || (tempRangeStart && rangeStart && rangeEnd)) {
        // Commencer une nouvelle sélection
        setTempRangeStart(date);
        setHoveredDate(null);
      } else if (tempRangeStart) {
        // Finaliser la sélection de plage
        const start = tempRangeStart <= date ? tempRangeStart : date;
        const end = tempRangeStart <= date ? date : tempRangeStart;
        onRangeSelect?.(start, end);
        setTempRangeStart(null);
        setHoveredDate(null);
      }
    }
  };

  const handleQuickSelect = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    
    if (mode === 'range') {
      onRangeSelect?.(start, end);
    } else {
      onSelect?.(end);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const getDayClassName = (date: Date) => {
    const baseClasses = "relative w-10 h-10 flex items-center justify-center text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer hover:bg-blue-50";
    
    if (isDateDisabled(date)) {
      return cn(baseClasses, "text-gray-300 cursor-not-allowed opacity-50 hover:bg-transparent");
    }

    if (isRangeStart(date)) {
      return cn(baseClasses, "bg-brand-teal text-white font-bold shadow-lg");
    }

    if (isRangeEnd(date)) {
      return cn(baseClasses, "bg-brand-teal text-white font-bold shadow-lg");
    }

    if (isDateInRange(date)) {
      return cn(baseClasses, "bg-brand-teal/20 text-brand-teal font-medium");
    }

    if (isDateInTempRange(date)) {
      return cn(baseClasses, "bg-blue-100 text-blue-600");
    }

    if (tempRangeStart && isSameDay(date, tempRangeStart)) {
      return cn(baseClasses, "bg-brand-teal text-white font-bold");
    }

    if (isToday(date)) {
      return cn(baseClasses, "bg-blue-500 text-white font-bold");
    }

    if (!isSameMonth(date, currentMonth)) {
      return cn(baseClasses, "text-gray-400 hover:text-gray-600 hover:bg-gray-100");
    }

    if (mode === 'single' && selected && isSameDay(date, selected)) {
      return cn(baseClasses, "bg-primary text-white shadow-lg scale-105");
    }

    // Default pour les dates normales
    return cn(baseClasses, "text-gray-700 hover:bg-brand-teal/10 hover:text-brand-teal");
  };

  return (
    <div className={cn("p-6 bg-white rounded-2xl shadow-xl border border-gray-100", className)}>
      {/* Header avec navigation */}
      <div className="flex items-center justify-between mb-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </motion.div>

        <motion.h2 
          key={currentMonth.getTime()}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold text-gray-900"
        >
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </motion.h2>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>

      {/* Sélections rapides */}
      {quickSelections && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 mb-6"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSelect(0)}
            className="text-xs px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSelect(1)}
            className="text-xs px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
          >
            Demain
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSelect(7)}
            className="text-xs px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
          >
            +1 semaine
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSelect(30)}
            className="text-xs px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
          >
            +1 mois
          </Button>
        </motion.div>
      )}

      {/* En-têtes des jours */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <motion.div 
        className="grid grid-cols-7 gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="wait">
          {calendarDays.map((date, index) => (
            <motion.div
              key={date.getTime()}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01, duration: 0.2 }}
              className={getDayClassName(date)}
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => mode === 'range' && tempRangeStart && setHoveredDate(date)}
              whileHover={{ scale: isDateDisabled(date) ? 1 : 1.1 }}
              whileTap={{ scale: isDateDisabled(date) ? 1 : 0.95 }}
            >
              <span className="relative z-10">
                {date.getDate()}
              </span>
              
              {/* Indicateur pour aujourd'hui */}
              {isToday(date) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 rounded-xl border-2 border-blue-400 opacity-50"
                />
              )}

              {/* Effet de survol pour les ranges */}
              {mode === 'range' && tempRangeStart && hoveredDate && isDateInTempRange(date) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-primary/30 rounded-xl"
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Sélection d'heure (optionnel) */}
      {timeSlots && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 pt-6 border-t border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-medium text-gray-700">Heure d'arrivée</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(time => (
              <motion.button
                key={time}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedTime(time)}
                className={cn(
                  "px-3 py-2 text-sm rounded-lg border transition-all duration-200",
                  selectedTime === time 
                    ? "bg-primary text-white border-primary shadow-md" 
                    : "bg-gray-50 border-gray-200 hover:border-primary hover:bg-primary/10"
                )}
              >
                {time}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Légende */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-4 text-xs text-gray-500"
      >
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Aujourd'hui</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span>Sélectionné</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-200 rounded"></div>
          <span>Non disponible</span>
        </div>
      </motion.div>
    </div>
  );
};
