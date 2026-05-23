import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
} from 'date-fns';
import { useT } from '@/i18n/GuestLocaleProvider';

interface EnhancedCalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  mode?: 'single' | 'range';
  rangeStart?: Date;
  rangeEnd?: Date;
  onRangeSelect?: (start: Date, end: Date) => void;
  /** Appelé à chaque clic en mode range (1er clic = fin null, 2e clic = plage complète). */
  onRangeProgress?: (start: Date | null, end: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
  showWeekends?: boolean;
}

const MONTH_KEYS = [
  'calendar.monthJan',
  'calendar.monthFeb',
  'calendar.monthMar',
  'calendar.monthApr',
  'calendar.monthMay',
  'calendar.monthJun',
  'calendar.monthJul',
  'calendar.monthAug',
  'calendar.monthSep',
  'calendar.monthOct',
  'calendar.monthNov',
  'calendar.monthDec',
] as const;

const WEEKDAY_KEYS_MON_FIRST = [
  'calendar.weekdayMon',
  'calendar.weekdayTue',
  'calendar.weekdayWed',
  'calendar.weekdayThu',
  'calendar.weekdayFri',
  'calendar.weekdaySat',
  'calendar.weekdaySun',
] as const;

export const EnhancedCalendar: React.FC<EnhancedCalendarProps> = ({
  selected,
  onSelect,
  mode = 'single',
  rangeStart,
  rangeEnd,
  onRangeSelect,
  onRangeProgress,
  minDate = undefined,
  maxDate,
  disabledDates = [],
  className,
  showWeekends = true
}) => {
  const t = useT();
  const monthNames = MONTH_KEYS.map((key) => t(key));
  const weekDays = WEEKDAY_KEYS_MON_FIRST.map((key) => t(key));

  // Initialiser sur le mois de rangeStart/selected au premier rendu uniquement.
  // On NE synchronise plus automatiquement après la navigation : l'utilisateur
  // peut librement naviguer sans que le calendrier revienne en arrière.
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = mode === 'range' ? rangeStart : selected;
    return base ? startOfMonth(base) : startOfMonth(new Date());
  });

  const [selectionInProgress, setSelectionInProgress] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Réinitialiser uniquement quand la plage est complète côté parent (les deux bornes).
  // Ne pas réagir à rangeStart seul : sinon le 1er clic efface selectionInProgress
  // et le 2e clic est traité comme une nouvelle arrivée.
  useEffect(() => {
    if (rangeStart && rangeEnd) {
      setSelectionInProgress(null);
      setHoveredDate(null);
    }
  }, [mode, rangeStart?.getTime(), rangeEnd?.getTime()]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const getMondayIndex = (date: Date) => {
    const day = date.getDay();
    return (day + 6) % 7;
  };

  const startDate = new Date(monthStart);
  const startOffset = getMondayIndex(monthStart);
  startDate.setDate(startDate.getDate() - startOffset);

  const endDate = new Date(monthEnd);
  const endIndex = getMondayIndex(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endIndex));

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const isDateDisabled = (date: Date) => {
    const d = startOfDay(date);
    if (minDate && d < startOfDay(minDate)) return true;
    if (maxDate && d > startOfDay(maxDate)) return true;
    if (!showWeekends && isWeekend(d)) return true;
    return disabledDates.some(disabledDate => isSameDay(d, startOfDay(disabledDate)));
  };

  const isDateInRange = (date: Date) => {
    if (mode !== 'range') return false;
    const d = startOfDay(date).getTime();
    if (rangeStart && rangeEnd) {
      const a = startOfDay(rangeStart).getTime();
      const b = startOfDay(rangeEnd).getTime();
      return d >= a && d <= b;
    }
    if (rangeAnchor && hoveredDate) {
      const a = rangeAnchor.getTime();
      const b = startOfDay(hoveredDate).getTime();
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return d >= lo && d <= hi;
    }
    return false;
  };

  const rangeAnchor =
    selectionInProgress ??
    (rangeStart && !rangeEnd ? startOfDay(rangeStart) : null);

  const isRangeStart = (date: Date) => {
    if (mode !== 'range') return false;
    if (rangeAnchor && isSameDay(date, rangeAnchor)) return true;
    return !!(rangeStart && rangeEnd && isSameDay(date, rangeStart));
  };

  const isRangeEnd = (date: Date) => {
    return mode === 'range' && rangeEnd && isSameDay(date, rangeEnd);
  };

  const isDateInHoverRange = (date: Date) => {
    if (mode !== 'range' || !rangeAnchor || !hoveredDate) return false;
    const start = rangeAnchor <= hoveredDate ? rangeAnchor : hoveredDate;
    const end = rangeAnchor <= hoveredDate ? hoveredDate : rangeAnchor;
    return date >= start && date <= end;
  };

  const handleDateClick = (date: Date) => {
    const day = startOfDay(date);
    if (isDateDisabled(day)) return;

    if (mode === 'single') {
      onSelect?.(day);
      return;
    }

    if (mode === 'range') {
      const anchor =
        selectionInProgress ??
        (rangeStart && !rangeEnd ? startOfDay(rangeStart) : null);

      if (!anchor) {
        setSelectionInProgress(day);
        setHoveredDate(null);
        onRangeProgress?.(day, null);
        return;
      }
      if (isSameDay(anchor, day)) return;

      const start = anchor <= day ? anchor : day;
      const end = anchor <= day ? day : anchor;
      onRangeProgress?.(start, end);
      onRangeSelect?.(start, end);
      setSelectionInProgress(null);
      setHoveredDate(null);
    }
  };

  const getDayStyle = (date: Date) => {
    let backgroundColor = 'transparent';
    let border = 'none';
    let borderRadius = '50%';
    let color = '#1E1E1E';
    let cursor = 'pointer';
    let transform = 'scale(1)';
    let boxShadow = 'none';
    let opacity = 1;
    let fontWeight: number | string = 400;

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

    if (!isSameMonth(date, currentMonth)) {
      color = '#9CA3AF';
      opacity = 0.5;
    }

    if (isDateInHoverRange(date)) {
      backgroundColor = '#F0F9F7';
      color = '#1E1E1E';
    }

    if (isDateInRange(date) && !isRangeStart(date) && !isRangeEnd(date)) {
      backgroundColor = '#F5F5F5';
      color = '#2C2C2C';
    }

    if (rangeAnchor && !rangeEnd && isSameDay(date, rangeAnchor)) {
      border = '2px solid #55BA9F';
      backgroundColor = 'transparent';
      color = '#55BA9F';
      fontWeight = 600;
      transform = 'scale(1.1)';
    }

    if (isRangeStart(date)) {
      border = '2px solid #55BA9F';
      backgroundColor = '#55BA9F';
      color = '#FFFFFF';
      fontWeight = 600;
      transform = 'scale(1.1)';
      boxShadow = '0 2px 8px rgba(85, 186, 159, 0.3)';
    }

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

  return (
    <div
      className={cn("bg-white", className)}
      style={{
        width: 'min(360px, calc(100vw - 32px))',
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
          style={{ width: '36px', height: '36px', borderRadius: '32px', padding: '8px' }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#1E1E1E' }} />
        </motion.button>

        <div className="flex items-center" style={{ gap: '8px', flex: '1' }}>
          {/* Sélecteur de mois — onMouseDown stopPropagation empêche la fermeture du panneau parent */}
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth.getFullYear(), parseInt(e.target.value), 1);
              setCurrentMonth(newMonth);
            }}
            onMouseDown={(e) => e.stopPropagation()}
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
          </select>

          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => {
              const newMonth = new Date(parseInt(e.target.value), currentMonth.getMonth(), 1);
              setCurrentMonth(newMonth);
            }}
            onMouseDown={(e) => e.stopPropagation()}
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
            {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('next')}
          className="flex items-center justify-center transition-colors"
          style={{ width: '36px', height: '36px', borderRadius: '32px', padding: '8px' }}
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

      {/* Grille du calendrier — animation sur le conteneur uniquement, pas par cellule */}
      <motion.div
        className="grid grid-cols-7"
        style={{ gap: '1px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {calendarDays.map((date) => {
          const dayStyle = getDayStyle(date);

          return (
            <motion.div
              key={date.getTime()}
              className="relative w-10 h-10 flex items-center justify-center text-base font-normal transition-all duration-200 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleDateClick(date);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => mode === 'range' && rangeAnchor && setHoveredDate(startOfDay(date))}
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
      </motion.div>
    </div>
  );
};
