import React, { useState, useEffect } from 'react';
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
  minDate = undefined,
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

  // ✅ CRITIQUE : Synchroniser currentMonth avec les dates sélectionnées
  useEffect(() => {
    if (mode === 'range' && rangeStart) {
      // Si une date de début est sélectionnée, afficher le mois de cette date
      const startMonth = startOfMonth(rangeStart);
      if (!isSameMonth(startMonth, currentMonth)) {
        setCurrentMonth(startMonth);
      }
      // ✅ DEBUG : Log pour vérifier que les dates sont bien reçues
      console.log('🗓️ [EnhancedCalendar] rangeStart reçu:', {
        rangeStart: rangeStart.toISOString(),
        rangeStartLocal: rangeStart.toLocaleDateString('fr-FR'),
        rangeStartFormatted: `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}-${String(rangeStart.getDate()).padStart(2, '0')}`,
        rangeEnd: rangeEnd ? {
          iso: rangeEnd.toISOString(),
          local: rangeEnd.toLocaleDateString('fr-FR'),
          formatted: `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`
        } : null
      });
    } else if (mode === 'range' && rangeEnd) {
      // Si seulement une date de fin est sélectionnée, afficher le mois de cette date
      const endMonth = startOfMonth(rangeEnd);
      if (!isSameMonth(endMonth, currentMonth)) {
        setCurrentMonth(endMonth);
      }
    } else if (mode === 'single' && selected) {
      // En mode single, afficher le mois de la date sélectionnée
      const selectedMonth = startOfMonth(selected);
      if (!isSameMonth(selectedMonth, currentMonth)) {
        setCurrentMonth(selectedMonth);
      }
    }
  }, [rangeStart, rangeEnd, selected, mode, currentMonth]);

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
    // ✅ SUPPRESSION : Plus de restriction sur les dates passées
    // if (isPast(date) && !isSameDay(date, new Date())) return true;
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
    const baseClasses = "relative w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-50";
    
    if (isDateDisabled(date)) {
      return cn(baseClasses, "text-gray-300 cursor-not-allowed opacity-50 hover:bg-transparent");
    }

    // Date de fin de range (sélectionnée) - Style Figma avec fond teal
    if (isRangeEnd(date)) {
      return cn(baseClasses, "text-white font-semibold");
    }

    // Date de début de range (sélectionnée) - Style Figma
    if (isRangeStart(date)) {
      return cn(baseClasses, "text-white font-semibold");
    }

    // Dates dans la plage sélectionnée - Style Figma avec fond gris clair
    if (isDateInRange(date)) {
      return cn(baseClasses, "text-gray-700 font-normal");
    }

    // Plage temporaire pendant la sélection
    if (isDateInTempRange(date)) {
      return cn(baseClasses, "bg-gray-100 text-gray-700");
    }

    // Date de début temporaire
    if (tempRangeStart && isSameDay(date, tempRangeStart)) {
      return cn(baseClasses, "text-white font-semibold");
    }

    // Aujourd'hui - Style Figma
    if (isToday(date)) {
      return cn(baseClasses, "text-gray-700 font-normal");
    }

    // Dates d'autres mois
    if (!isSameMonth(date, currentMonth)) {
      return cn(baseClasses, "text-gray-300 hover:text-gray-500");
    }

    // Date unique sélectionnée
    if (mode === 'single' && selected && isSameDay(date, selected)) {
      return cn(baseClasses, "text-white font-semibold");
    }

    // Default pour les dates normales - Style Figma
    return cn(baseClasses, "text-gray-700 hover:bg-gray-100");
  };

  return (
    <div className={cn("bg-white w-full", className)}>
      {/* Header avec navigation - Style Figma */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </motion.button>

        <div className="flex items-center gap-2">
          <motion.select
            key={`month-${currentMonth.getTime()}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            value={currentMonth.getMonth()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(parseInt(e.target.value));
              setCurrentMonth(newMonth);
            }}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none cursor-pointer appearance-none pr-2"
            style={{ 
              backgroundImage: 'none',
              paddingRight: '1.5rem'
            }}
          >
            {monthNames.map((month, index) => (
              <option key={index} value={index}>
                {month.substring(0, 3)}
              </option>
            ))}
          </motion.select>
          
          <motion.select
            key={`year-${currentMonth.getTime()}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            value={currentMonth.getFullYear()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth);
              newMonth.setFullYear(parseInt(e.target.value));
              setCurrentMonth(newMonth);
            }}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none cursor-pointer appearance-none"
            style={{ 
              backgroundImage: 'none'
            }}
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </motion.select>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </motion.button>
      </div>

      {/* En-têtes des jours - Style Figma */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier - Style Figma */}
      <motion.div 
        className="grid grid-cols-7 gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {calendarDays.map((date, index) => {
            const isInRange = isDateInRange(date);
            const isStart = isRangeStart(date);
            const isEnd = isRangeEnd(date);
            const isInTempRange = isDateInTempRange(date) && !isStart && !isEnd;
            const isTempStart = tempRangeStart && isSameDay(date, tempRangeStart);
            
            return (
              <motion.div
                key={date.getTime()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01, duration: 0.2 }}
                className={getDayClassName(date)}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => mode === 'range' && tempRangeStart && setHoveredDate(date)}
                whileHover={{ scale: isDateDisabled(date) ? 1 : 1.05 }}
                whileTap={{ scale: isDateDisabled(date) ? 1 : 0.95 }}
                style={{
                  backgroundColor: 
                    isEnd || isStart || isTempStart 
                      ? '#50ACB4' // Teal pour les dates sélectionnées
                      : isInRange || isInTempRange
                        ? '#F3F4F6' // Gris clair pour les dates dans la plage
                        : 'transparent'
                }}
              >
                <span className="relative z-10">
                  {date.getDate()}
                </span>
              </motion.div>
            );
          })}
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

    </div>
  );
};
