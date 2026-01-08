import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isWeekend } from 'date-fns';

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
}

const monthNames = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  showWeekends = true
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // 🎯 NOUVELLE LOGIQUE SIMPLIFIÉE : Un seul état pour la sélection en cours
  const [selectionInProgress, setSelectionInProgress] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Synchroniser currentMonth avec les dates sélectionnées
  useEffect(() => {
    if (mode === 'range' && rangeStart) {
      const startMonth = startOfMonth(rangeStart);
      if (!isSameMonth(startMonth, currentMonth)) {
        setCurrentMonth(startMonth);
      }
    } else if (mode === 'single' && selected) {
      const selectedMonth = startOfMonth(selected);
      if (!isSameMonth(selectedMonth, currentMonth)) {
        setCurrentMonth(selectedMonth);
      }
    }
  }, [rangeStart, selected, mode, currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay());
  
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()));
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const isDateDisabled = (date: Date) => {
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

  const isDateInHoverRange = (date: Date) => {
    if (mode !== 'range' || !selectionInProgress || !hoveredDate) return false;
    const start = selectionInProgress <= hoveredDate ? selectionInProgress : hoveredDate;
    const end = selectionInProgress <= hoveredDate ? hoveredDate : selectionInProgress;
    return date >= start && date <= end;
  };

  // 🎯 LOGIQUE COMPLÈTEMENT REFAITE - CLAIRE ET DYNAMIQUE
  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      onSelect?.(date);
      return;
    }

    if (mode === 'range') {
      // CAS 1: Aucune sélection en cours - Démarrer une nouvelle sélection
      if (!selectionInProgress) {
        setSelectionInProgress(date);
        setHoveredDate(null);
        console.log('📅 Date de début:', date.toLocaleDateString());
        return;
      }

      // CAS 2: Une sélection est en cours - Finaliser la plage
      if (selectionInProgress) {
        // Ne pas permettre de sélectionner la même date
        if (isSameDay(selectionInProgress, date)) {
          console.log('⚠️ Veuillez sélectionner une date différente');
          return;
        }

        // Créer la plage (toujours start < end)
        const start = selectionInProgress <= date ? selectionInProgress : date;
        const end = selectionInProgress <= date ? date : selectionInProgress;

        console.log('✅ Plage sélectionnée:', {
          checkIn: start.toLocaleDateString(),
          checkOut: end.toLocaleDateString(),
          nuits: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        });

        // Finaliser
        onRangeSelect?.(start, end);
        setSelectionInProgress(null);
        setHoveredDate(null);
      }
    }
  };

  // 🎯 FONCTION SIMPLE: Annuler la sélection en cours
  const handleResetSelection = () => {
    setSelectionInProgress(null);
    setHoveredDate(null);
    console.log('🔄 Sélection annulée');
  };

  const getDayStyle = (date: Date) => {
    // 🎨 STYLE ÉPURÉ ET MODERNE - Comme l'image
    let backgroundColor = 'transparent';
    let border = 'none';
    let borderRadius = '50%';
    let color = '#1E1E1E';
    let cursor = 'pointer';
    let transform = 'scale(1)';
    let boxShadow = 'none';
    let opacity = 1;
    let fontWeight: number | string = 400;
    
    // Dates désactivées
    if (isDateDisabled(date)) {
      return {
        backgroundColor: 'transparent',
        color: '#D1D5DB',
        opacity: 0.4,
        cursor: 'not-allowed',
        border: 'none',
        borderRadius: '50%',
        transform: 'scale(1)',
        boxShadow: 'none'
      };
    }

    // Dates d'autres mois
    if (!isSameMonth(date, currentMonth)) {
      color = '#9CA3AF';
      opacity = 0.5;
    }

    // Plage hover (preview) - Subtil et élégant
    if (isDateInHoverRange(date)) {
      backgroundColor = '#F0F9F7'; // Très subtil
      color = '#1E1E1E';
    }

    // Dates dans la plage finalisée - Style épuré
    if (isDateInRange(date) && !isRangeStart(date) && !isRangeEnd(date)) {
      backgroundColor = '#F5F5F5'; // Gris très léger
      color = '#2C2C2C';
    }

    // Date de début de sélection en cours - Cercle turquoise élégant
    if (selectionInProgress && isSameDay(date, selectionInProgress)) {
      border = '2px solid #55BA9F';
      backgroundColor = 'transparent';
      color = '#55BA9F'; // Texte turquoise
      fontWeight = 600;
      transform = 'scale(1.1)';
    }

    // Check-in (début) - Cercle vert turquoise rempli
    if (isRangeStart(date)) {
      border = '2px solid #55BA9F';
      backgroundColor = '#55BA9F';
      color = '#FFFFFF';
      fontWeight = 600;
      transform = 'scale(1.1)';
      boxShadow = '0 2px 8px rgba(85, 186, 159, 0.3)';
    }

    // Check-out (fin) - Cercle turquoise rempli (même couleur que le check-in)
    if (isRangeEnd(date)) {
      border = '2px solid #55BA9F';
      backgroundColor = '#55BA9F';
      color = '#FFFFFF';
      fontWeight = 600;
      transform = 'scale(1.1)';
      boxShadow = '0 2px 8px rgba(85, 186, 159, 0.3)';
    }

    return { backgroundColor, border, borderRadius, color, cursor, transform, boxShadow, fontWeight, opacity };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  // Message d'aide contextuel
  const getHelpMessage = () => {
    if (mode !== 'range') return null;
    if (!selectionInProgress) {
      return '📅 Sélectionnez votre date d\'arrivée';
    }
    return '📅 Sélectionnez votre date de départ';
  };

  return (
    <div 
      className={cn("bg-white", className)}
      style={{
        width: '360px',
        // Pas de height fixe et pas de drop-shadow pour le fond blanc demandé
        border: '1px solid #D9D9D9',
        borderRadius: '16px',
        padding: '16px',
        isolation: 'isolate',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header avec navigation */}
      <div className="flex items-center justify-between mb-4" style={{ gap: '16px', height: '36px' }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('prev')}
          className="flex items-center justify-center transition-colors"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '32px',
            padding: '8px'
          }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#1E1E1E' }} />
        </motion.button>

        <div className="flex items-center" style={{ gap: '8px', flex: '1' }}>
          <motion.select
            key={`month-${currentMonth.getTime()}`}
            value={currentMonth.getMonth()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(parseInt(e.target.value));
              setCurrentMonth(newMonth);
            }}
            className="flex items-center cursor-pointer"
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9D9D9',
              borderRadius: '8px',
              padding: '6px',
              fontSize: '16px',
              lineHeight: '100%',
              color: '#1E1E1E',
              fontWeight: 400,
              fontFamily: 'Fira Sans Condensed, Inter, sans-serif',
              flex: '1'
            }}
          >
            {monthNames.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </motion.select>
          
          <motion.select
            key={`year-${currentMonth.getTime()}`}
            value={currentMonth.getFullYear()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth);
              newMonth.setFullYear(parseInt(e.target.value));
              setCurrentMonth(newMonth);
            }}
            className="flex items-center cursor-pointer"
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9D9D9',
              borderRadius: '8px',
              padding: '6px',
              fontSize: '16px',
              lineHeight: '100%',
              color: '#1E1E1E',
              fontWeight: 400,
              fontFamily: 'Fira Sans Condensed, Inter, sans-serif',
              flex: '1'
            }}
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </motion.select>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('next')}
          className="flex items-center justify-center transition-colors"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '32px',
            padding: '8px'
          }}
        >
          <ChevronRight className="w-5 h-5" style={{ color: '#1E1E1E' }} />
        </motion.button>
      </div>





      {/* En-têtes des jours */}
      <div className="grid grid-cols-7 mb-2" style={{ gap: '1px', paddingTop: '16px' }}>
        {weekDays.map(day => (
          <div 
            key={day} 
            className="text-center flex items-center justify-center"
            style={{
              fontSize: '12px',
              lineHeight: '20px',
              fontFamily: 'Fira Sans Condensed, sans-serif',
              fontWeight: 400,
              color: '#757575',
              width: '40px',
              height: '20px'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <motion.div 
        className="grid grid-cols-7"
        style={{ gap: '1px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {calendarDays.map((date, index) => {
            const dayStyle = getDayStyle(date);
            
            return (
              <motion.div
                key={date.getTime()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01, duration: 0.2 }}
                className="relative w-10 h-10 flex items-center justify-center text-base font-normal transition-all duration-200 cursor-pointer"
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => mode === 'range' && selectionInProgress && setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                whileHover={{ scale: isDateDisabled(date) ? 1 : 1.05 }}
                whileTap={{ scale: isDateDisabled(date) ? 1 : 0.95 }}
                style={{
                  ...dayStyle,
                  fontFamily: 'Fira Sans Condensed, Inter, sans-serif',
                  fontSize: '16px',
                  lineHeight: '140%',
                  fontWeight: 400
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
    </div>
  );
};
