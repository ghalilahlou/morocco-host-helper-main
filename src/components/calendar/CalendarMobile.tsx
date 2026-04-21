import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, CalendarDays } from 'lucide-react';
import { CheckinNotDoneCrossIcon, FigmaConflictIcon } from './ReservationStatusIcons';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getBookingDisplayTitle, isValidGuestName } from '@/utils/bookingDisplay';
import { shouldShowIcalSyncBadge } from '@/domain/calendarReservationModel';
import { useT } from '@/i18n/GuestLocaleProvider';
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
  endOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseStayDateForCalendar } from '@/utils/dateUtils';
import { isBookingStayPast, type BookingLayout } from './CalendarUtils';

const CHECKIN_DONE_ICON_SRC = '/lovable-uploads/imagecheckcalendar.png';

interface CalendarMobileProps {
  calendarDays: Array<{
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
  }>;
  bookingLayout: { [key: string]: BookingLayout[] };
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  allReservations?: (Booking | AirbnbReservation)[];
}

const dayNamesShort = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const getInitials = (name: string): string => {
  if (!name || name.length === 0) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

interface BookingBarData {
  booking: Booking | AirbnbReservation;
  startDate: Date;
  endDate: Date;
  guestName: string;
  guestCount: number;
  isValidName: boolean;
  showIcalBadge: boolean;
  color: string;
  textColor: string;
  isConflict: boolean;
  circleBg: string;
  isPastStay: boolean;
  photoUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const barVariants = {
  hidden: { opacity: 0, x: -6, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { delay: i * 0.04, type: 'spring', stiffness: 340, damping: 28 },
  }),
  tap: { scale: 0.97 },
};

const monthVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export const CalendarMobile: React.FC<CalendarMobileProps> = ({
  calendarDays: _calendarDays,
  bookingLayout,
  conflicts,
  onBookingClick,
  currentDate,
  onDateChange,
  allReservations = [],
}) => {
  const t = useT();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrolledMonth = useRef<string | null>(null);

  const monthsToShow = useMemo(() => {
    const months: Date[] = [];
    const startMonth = startOfMonth(currentDate);
    for (let i = -3; i < 12; i++) months.push(addMonths(startMonth, i));
    return months;
  }, [currentDate]);

  useEffect(() => {
    const targetMonth = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (lastScrolledMonth.current === targetMonth) return;

    const scrollToMonth = () => {
      if (!scrollContainerRef.current || isUserScrolling.current) return;
      const el = scrollContainerRef.current.querySelector(`[data-month="${targetMonth}"]`);
      if (el) {
        lastScrolledMonth.current = targetMonth;
        const cRect = scrollContainerRef.current.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const top = eRect.top - cRect.top + scrollContainerRef.current.scrollTop;
        scrollContainerRef.current.scrollTo({ top: top - 10, behavior: 'smooth' });
      }
    };

    const id = setTimeout(scrollToMonth, 100);
    return () => clearTimeout(id);
  }, [currentDate]);

  useEffect(() => () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); }, []);

  /* ---------- Build all bookings once ---------- */
  const allBookings = useMemo(() => {
    const map = new Map<string, BookingBarData>();

    const push = (booking: Booking | AirbnbReservation) => {
      if (map.has(booking.id)) return;
      const isAirbnb = 'source' in booking && booking.source === 'airbnb';
      const startDate = isAirbnb ? new Date((booking as AirbnbReservation).startDate) : parseStayDateForCalendar((booking as Booking).checkInDate);
      const endDate = isAirbnb ? new Date((booking as AirbnbReservation).endDate) : parseStayDateForCalendar((booking as Booking).checkOutDate);
      const displayText = getBookingDisplayTitle(booking);
      const valid = isValidGuestName(displayText);
      const guestCount = isAirbnb ? (booking as AirbnbReservation).numberOfGuests || 1 : (booking as Booking).numberOfGuests || 1;
      const isConflict = conflicts.includes(booking.id);
      const bTyped = 'status' in booking ? (booking as Booking) : null;
      const hasDocs = bTyped?.documentsGenerated?.contract && bTyped?.documentsGenerated?.policeForm;
      const isPast = isBookingStayPast(booking);

      let color: string, tc: string, circleBg: string;
      if (isConflict) { color = BOOKING_COLORS.conflict.hex; tc = 'text-white'; circleBg = '#000000'; }
      else if (isPast) { color = '#D1D5DB'; tc = 'text-neutral-900'; circleBg = hasDocs ? '#000000' : '#B3B3B3'; }
      else { color = '#222222'; tc = 'text-white'; circleBg = hasDocs ? '#000000' : '#B3B3B3'; }

      map.set(booking.id, {
        booking, startDate, endDate, guestName: displayText, guestCount,
        isValidName: valid, showIcalBadge: shouldShowIcalSyncBadge(booking, displayText),
        color, textColor: tc, isConflict, circleBg, isPastStay: isPast, photoUrl: undefined,
      });
    };

    allReservations.forEach(push);
    Object.values(bookingLayout).forEach((wk) => wk.forEach((bl) => { if (bl.booking) push(bl.booking); }));
    return Array.from(map.values());
  }, [allReservations, bookingLayout, conflicts]);

  /* ---------- Scroll handling ---------- */
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setShowScrollTop(scrollContainerRef.current.scrollTop > 300);
    isUserScrolling.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
      if (!scrollContainerRef.current) return;
      const cTop = scrollContainerRef.current.getBoundingClientRect().top;
      const els = scrollContainerRef.current.querySelectorAll('[data-month]');
      let vis: string | null = null;
      for (const el of els) { const r = el.getBoundingClientRect(); if (r.top >= cTop - 50 && r.top < cTop + 150) { vis = el.getAttribute('data-month'); break; } }
      if (!vis) { for (const el of els) { if (el.getBoundingClientRect().bottom > cTop) { vis = el.getAttribute('data-month'); break; } } }
      if (vis) {
        const [y, m] = vis.split('-').map(Number);
        const nd = new Date(y, m, 1);
        if (nd.getFullYear() !== currentDate.getFullYear() || nd.getMonth() !== currentDate.getMonth()) {
          lastScrolledMonth.current = vis;
          onDateChange(nd);
        }
      }
    }, 150);
  }, [currentDate, onDateChange]);

  const scrollToToday = useCallback(() => {
    const now = new Date();
    onDateChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setTimeout(() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 120);
  }, [onDateChange]);

  /* ---------- Week helpers ---------- */
  const getWeeksForMonth = (monthDate: Date) => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
    });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  };

  const getBookingsForWeek = (week: Date[]) => {
    const ws = new Date(week[0].getFullYear(), week[0].getMonth(), week[0].getDate());
    const we = new Date(week[6].getFullYear(), week[6].getMonth(), week[6].getDate());
    const result: { booking: BookingBarData; startCol: number; span: number }[] = [];

    allBookings.forEach((bd) => {
      const bs = new Date(bd.startDate.getFullYear(), bd.startDate.getMonth(), bd.startDate.getDate());
      const be = new Date(bd.endDate.getFullYear(), bd.endDate.getMonth(), bd.endDate.getDate());
      if (bs <= we && be > ws) {
        let sc = 0;
        if (bs < ws) sc = 0;
        else { for (let i = 0; i < 7; i++) { const d = new Date(week[i].getFullYear(), week[i].getMonth(), week[i].getDate()); if (d.getTime() >= bs.getTime()) { sc = i; break; } if (i === 6) sc = 0; } }
        let sp = 0;
        for (let i = sc; i < 7; i++) { const d = new Date(week[i].getFullYear(), week[i].getMonth(), week[i].getDate()); if (d >= bs && d < be) sp++; }
        if (sp > 0) result.push({ booking: bd, startCol: sc, span: sp });
      }
    });
    return result.sort((a, b) => a.startCol !== b.startCol ? a.startCol - b.startCol : b.span - a.span);
  };

  /* ---------- Bar height constants ---------- */
  const DAY_NUM_H = 30;
  const BAR_H = 32;
  const BAR_GAP = 6;

  /* ---------- Month sub-component ---------- */
  const MonthView = ({ monthDate, dataMonth }: { monthDate: Date; dataMonth?: string }) => {
    const weeks = getWeeksForMonth(monthDate);
    const monthName = format(monthDate, 'MMMM', { locale: fr });
    const year = format(monthDate, 'yyyy');
    const thisYear = new Date().getFullYear();
    const showYear = monthDate.getFullYear() !== thisYear || monthDate.getMonth() === 0;

    return (
      <motion.div
        className="mb-2"
        data-month={dataMonth}
        variants={monthVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className="pb-1.5 pt-6">
          <h2 className="text-[15px] font-bold text-gray-900 capitalize tracking-tight">
            {monthName}
            {showYear && <span className="font-normal text-gray-400 ml-1.5 text-[13px]">{year}</span>}
          </h2>
        </div>

        <div className="border-t border-gray-200/70 rounded-lg overflow-hidden">
          {weeks.map((week, weekIndex) => {
            const booksInWeek = getBookingsForWeek(week);
            const totalH = DAY_NUM_H + (booksInWeek.length > 0 ? booksInWeek.length * (BAR_H + BAR_GAP) - BAR_GAP + 6 : 0);

            return (
              <div
                key={`${monthDate.getTime()}-w${weekIndex}`}
                className="relative border-b border-gray-100/80"
                style={{ minHeight: `${totalH}px` }}
              >
                {/* Day number grid */}
                <div className="grid grid-cols-7 relative">
                  {week.map((day, di) => {
                    const inMonth = isSameMonth(day, monthDate);
                    const today = isToday(day);
                    const past = day < new Date(new Date().setHours(0, 0, 0, 0));
                    return (
                      <div
                        key={day.getTime()}
                        className={cn(
                          'relative flex items-start justify-center pt-1.5',
                          'border-r border-gray-100/60 last:border-r-0',
                          !inMonth && 'bg-gray-50/40',
                          inMonth && past && 'bg-[#FDFDF9]',
                        )}
                        style={{ minHeight: `${totalH}px` }}
                      >
                        <span
                          className={cn(
                            'z-20 relative font-medium select-none',
                            today
                              ? 'bg-[#55BA9F] text-white rounded-full w-7 h-7 flex items-center justify-center text-[11px] font-bold shadow-sm'
                              : inMonth
                                ? 'text-[13px] text-gray-800'
                                : 'text-[13px] text-gray-300',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Booking bars */}
                {booksInWeek.length > 0 && (
                  <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${DAY_NUM_H}px` }}>
                    {booksInWeek.map((item, idx) => {
                      const { booking: bd, startCol, span } = item;
                      const isStart = week.some(
                        (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() ===
                               new Date(bd.startDate.getFullYear(), bd.startDate.getMonth(), bd.startDate.getDate()).getTime(),
                      );
                      const lastNight = new Date(bd.endDate.getFullYear(), bd.endDate.getMonth(), bd.endDate.getDate() - 1);
                      const isEnd = week.some(
                        (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === lastNight.getTime(),
                      );

                      const cellW = 100 / 7;
                      const leftPct = startCol * cellW;
                      const widthPct = span * cellW;

                      let radius = '0';
                      if (isStart && isEnd) radius = '16px';
                      else if (isStart) radius = '16px 0 0 16px';
                      else if (isEnd) radius = '0 16px 16px 0';

                      const isCheckinDone = bd.circleBg === '#000000' && !bd.isConflict;

                      return (
                        <motion.div
                          key={`${bd.booking.id}-${weekIndex}-${idx}`}
                          className="absolute pointer-events-auto cursor-pointer"
                          custom={idx}
                          variants={barVariants}
                          initial="hidden"
                          animate="visible"
                          whileTap="tap"
                          style={{
                            left: `calc(${leftPct}% + 1px)`,
                            width: `calc(${widthPct}% - 2px)`,
                            top: `${idx * (BAR_H + BAR_GAP)}px`,
                            height: `${BAR_H}px`,
                          }}
                          onClick={() => onBookingClick(bd.booking)}
                        >
                          <div
                            className={cn(
                              'h-full flex items-center gap-1.5 pl-1.5 pr-2',
                              'transition-shadow duration-200',
                              bd.isConflict && 'ring-2 ring-red-400/80',
                            )}
                            style={{
                              backgroundColor: bd.color,
                              borderRadius: radius,
                              boxShadow: bd.isConflict
                                ? '0 3px 10px rgba(220,38,38,0.22)'
                                : bd.isPastStay
                                  ? '0 1px 4px rgba(15,23,42,0.06)'
                                  : '0 2px 8px rgba(15,23,42,0.14)',
                            }}
                          >
                            {/* Status icon */}
                            {isStart && (
                              <div
                                className="flex items-center justify-center flex-shrink-0 rounded-full w-[22px] h-[22px] -ml-px"
                                style={{ backgroundColor: bd.circleBg }}
                              >
                                {bd.isConflict ? (
                                  <FigmaConflictIcon className="w-3.5 h-3.5" />
                                ) : isCheckinDone ? (
                                  <img src={CHECKIN_DONE_ICON_SRC} alt="" className="w-3 h-3 object-contain pointer-events-none" />
                                ) : (
                                  <CheckinNotDoneCrossIcon className="w-3.5 h-3.5" />
                                )}
                              </div>
                            )}

                            {/* Avatar initials */}
                            {isStart && bd.isValidName && (
                              <div
                                className={cn(
                                  'w-[20px] h-[20px] rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden',
                                  bd.isPastStay && !bd.isConflict ? 'bg-neutral-200/90' : 'bg-white/20',
                                )}
                              >
                                {bd.photoUrl ? (
                                  <img src={bd.photoUrl} alt={bd.guestName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className={cn('text-[8px] font-bold', bd.textColor)}>
                                    {getInitials(bd.guestName)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Label */}
                            <div className={cn('flex items-center gap-0.5 min-w-0 flex-1', bd.textColor)}>
                              {isStart && bd.showIcalBadge && (
                                <span className="flex-shrink-0 rounded px-0.5 py-px text-[7px] font-bold uppercase tracking-wide border border-white/30 bg-black/15">
                                  {t('calendar.icalBadge.short')}
                                </span>
                              )}
                              <span className="text-[11px] font-semibold truncate leading-tight">
                                {bd.isValidName
                                  ? bd.guestName.split(' ')[0]
                                  : bd.guestName.substring(0, isStart ? 10 : 12) +
                                    (bd.guestName.length > (isStart ? 10 : 12) ? '…' : '')}
                              </span>
                              {isStart && bd.guestCount > 1 && (
                                <span className="text-[9px] font-medium opacity-75 flex-shrink-0 leading-tight">
                                  +{bd.guestCount - 1}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Sticky week-day header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3">
        <div className="grid grid-cols-7">
          {dayNamesShort.map((d, i) => (
            <div
              key={`hd-${i}`}
              className="text-center text-[11px] font-semibold text-gray-500 py-2.5 border-r border-gray-100/60 last:border-r-0 uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable months */}
      <div
        ref={scrollContainerRef}
        className="h-[calc(100vh-220px)] overflow-y-auto px-3 scroll-smooth overscroll-contain"
        onScroll={handleScroll}
      >
        {monthsToShow.map((month) => (
          <MonthView
            key={month.getTime()}
            monthDate={month}
            dataMonth={`${month.getFullYear()}-${month.getMonth()}`}
          />
        ))}
        <div className="h-28" />
      </div>

      {/* Floating actions */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="absolute bottom-6 right-4 z-40 flex flex-col gap-2"
          >
            <Button
              size="icon"
              variant="outline"
              onClick={scrollToToday}
              className="rounded-full shadow-lg bg-white border-gray-200 hover:bg-gray-50 h-10 w-10"
              title="Aujourd'hui"
            >
              <CalendarDays className="h-4 w-4 text-[#55BA9F]" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
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
