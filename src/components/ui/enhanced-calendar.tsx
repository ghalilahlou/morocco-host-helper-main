import React, { useState, useEffect, useMemo } from 'react';
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
  /** Cibles tactiles plus grandes (flux invité mobile). */
  touchFriendly?: boolean;
  /** Mois affiché au premier rendu / à l’ouverture du panneau. */
  focusDate?: Date;
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
  showWeekends = true,
  touchFriendly = false,
  focusDate,
}) => {
  const t = useT();
  const monthNames = MONTH_KEYS.map((key) => t(key));
  const weekDays = WEEKDAY_KEYS_MON_FIRST.map((key) => t(key));

  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = focusDate ?? (mode === 'range' ? rangeStart : selected);
    return base ? startOfMonth(base) : startOfMonth(new Date());
  });

  const [selectionInProgress, setSelectionInProgress] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!focusDate) return;
    setCurrentMonth(startOfMonth(focusDate));
  }, [focusDate?.getTime()]);

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

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, i) => y - 5 + i);
  }, []);

  const isDateDisabled = (date: Date) => {
    const d = startOfDay(date);
    if (minDate && d < startOfDay(minDate)) return true;
    if (maxDate && d > startOfDay(maxDate)) return true;
    if (!showWeekends && isWeekend(d)) return true;
    return disabledDates.some((disabledDate) => isSameDay(d, startOfDay(disabledDate)));
  };

  const rangeAnchor =
    selectionInProgress ?? (rangeStart && !rangeEnd ? startOfDay(rangeStart) : null);

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

  const previewEnd = (day: Date) => {
    if (mode !== 'range' || !rangeAnchor) return;
    setHoveredDate(startOfDay(day));
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
        boxShadow: 'none',
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
      transform = 'scale(1.05)';
    }

    if (isRangeStart(date)) {
      border = '2px solid #55BA9F';
      backgroundColor = '#55BA9F';
      color = '#FFFFFF';
      fontWeight = 600;
      transform = 'scale(1.05)';
      boxShadow = '0 2px 8px rgba(85, 186, 159, 0.3)';
    }

    if (isRangeEnd(date)) {
      border = '2px solid #55BA9F';
      backgroundColor = '#55BA9F';
      color = '#FFFFFF';
      fontWeight = 600;
      transform = 'scale(1.05)';
      boxShadow = '0 2px 8px rgba(85, 186, 159, 0.3)';
    }

    return { backgroundColor, border, borderRadius, color, cursor, transform, boxShadow, fontWeight, opacity };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const cellClass = touchFriendly
    ? 'guest-calendar-day guest-calendar-day--touch'
    : 'guest-calendar-day';

  return (
    <div
      className={cn('bg-white guest-calendar-root', touchFriendly && 'guest-calendar-root--touch', className)}
      style={{
        width: touchFriendly ? '100%' : 'min(360px, calc(100vw - 32px))',
        maxWidth: '100%',
        border: '1px solid #D9D9D9',
        borderRadius: '16px',
        padding: touchFriendly ? '12px 10px 16px' : '16px',
        isolation: 'isolate',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2" style={{ minHeight: '40px' }}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('prev')}
          className="flex items-center justify-center transition-colors guest-calendar-nav touch-target"
          aria-label={t('guest.calendar.prevMonth')}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#1E1E1E' }} />
        </motion.button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => {
              const newMonth = new Date(currentMonth.getFullYear(), parseInt(e.target.value, 10), 1);
              setCurrentMonth(newMonth);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="guest-calendar-select flex-1 min-w-0"
          >
            {monthNames.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>

          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => {
              const newMonth = new Date(parseInt(e.target.value, 10), currentMonth.getMonth(), 1);
              setCurrentMonth(newMonth);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="guest-calendar-select w-[5.5rem] shrink-0"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth('next')}
          className="flex items-center justify-center transition-colors guest-calendar-nav touch-target"
          aria-label={t('guest.calendar.nextMonth')}
        >
          <ChevronRight className="w-5 h-5" style={{ color: '#1E1E1E' }} />
        </motion.button>
      </div>

      <div className="grid grid-cols-7 mb-1 sm:mb-2 gap-0.5">
        {weekDays.map((day) => (
          <div key={day} className="guest-calendar-weekday text-center">
            {day}
          </div>
        ))}
      </div>

      <motion.div
        className="grid grid-cols-7 gap-0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        {calendarDays.map((date) => {
          const dayStyle = getDayStyle(date);
          const disabled = isDateDisabled(date);

          return (
            <motion.button
              type="button"
              key={date.getTime()}
              className={cn(
                cellClass,
                'relative flex items-center justify-center transition-all duration-150',
                disabled && 'pointer-events-none'
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleDateClick(date);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => previewEnd(date)}
              onPointerEnter={() => previewEnd(date)}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (mode === 'range' && rangeAnchor) previewEnd(date);
              }}
              onMouseLeave={() => setHoveredDate(null)}
              onPointerLeave={() => setHoveredDate(null)}
              whileHover={{ scale: disabled ? 1 : 1.04 }}
              whileTap={{ scale: disabled ? 1 : 0.96 }}
              style={{
                ...dayStyle,
                fontFamily: 'Fira Sans Condensed, Inter, sans-serif',
                fontSize: touchFriendly ? '17px' : '16px',
                lineHeight: '140%',
              }}
              disabled={disabled}
              aria-pressed={isRangeStart(date) || isRangeEnd(date)}
            >
              <span className="relative z-10">{date.getDate()}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};
