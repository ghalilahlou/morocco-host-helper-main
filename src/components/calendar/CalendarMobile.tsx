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
import type { ConflictGroupForCalendar } from './CalendarGrid';
import { ConflictCadran } from './ConflictCadran';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

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
  /** Mois le plus visible au scroll — ne doit pas modifier `currentDate` (évite rebuild de la liste / sauts). */
  onVisibleMonthChange?: (date: Date) => void;
  /** Lignes affichées (souvent dédupliquées pour le layout). */
  allReservations?: (Booking | AirbnbReservation)[];
  /** Recherche fiche réservation (liste complète) pour le panneau conflit. */
  conflictBookingLookup?: (Booking | AirbnbReservation)[];
  conflictGroupsWithPosition?: ConflictGroupForCalendar[];
}

const dayNamesShort = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const getInitials = (name: string): string => {
  if (!name || name.length === 0) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

/** Minuit local du jour civil (aligné CalendarUtils / desktop). */
const toLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Airbnb : startDate/endDate sont des Date ; on les ramène au jour local comme les bookings. */
const airbnbStayBounds = (r: AirbnbReservation) => ({
  start: toLocalDay(new Date(r.startDate)),
  end: toLocalDay(new Date(r.endDate)),
});

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
  hidden: { opacity: 0, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.03, type: 'spring', stiffness: 380, damping: 30 },
  }),
  tap: { scale: 0.98 },
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
  onVisibleMonthChange,
  allReservations = [],
  conflictBookingLookup,
  conflictGroupsWithPosition = [],
}) => {
  const t = useT();
  const bookingPool = conflictBookingLookup ?? allReservations;
  const [openConflictGroup, setOpenConflictGroup] = useState<ConflictGroupForCalendar | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrolledMonth = useRef<string | null>(null);
  const lastEmittedVisibleMonth = useRef<string | null>(null);

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

  useEffect(() => {
    lastEmittedVisibleMonth.current = null;
  }, [currentDate]);

  useEffect(() => () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); }, []);

  /* ---------- Build all bookings once ---------- */
  const allBookings = useMemo(() => {
    const map = new Map<string, BookingBarData>();

    const push = (booking: Booking | AirbnbReservation) => {
      if (map.has(booking.id)) return;
      const isAirbnb = 'source' in booking && booking.source === 'airbnb';
      let startDate: Date;
      let endDate: Date;
      if (isAirbnb) {
        const b = airbnbStayBounds(booking as AirbnbReservation);
        startDate = b.start;
        endDate = b.end;
      } else {
        startDate = parseStayDateForCalendar((booking as Booking).checkInDate);
        endDate = parseStayDateForCalendar((booking as Booking).checkOutDate);
      }
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
      if (vis && onVisibleMonthChange && vis !== lastEmittedVisibleMonth.current) {
        lastEmittedVisibleMonth.current = vis;
        const [y, m] = vis.split('-').map(Number);
        onVisibleMonthChange(new Date(y, m, 1));
      }
    }, 150);
  }, [onVisibleMonthChange]);

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
    const ws = toLocalDay(week[0]);
    const we = toLocalDay(week[6]);
    const result: { booking: BookingBarData; startCol: number; span: number }[] = [];

    allBookings.forEach((bd) => {
      const bs = toLocalDay(bd.startDate);
      const be = toLocalDay(bd.endDate);
      // Aligné CalendarUtils : plage [check-in, check-out] inclusive (jour de départ inclus).
      if (bs.getTime() <= we.getTime() && be.getTime() >= ws.getTime()) {
        let sc = -1;
        let sp = 0;
        for (let i = 0; i < 7; i++) {
          const d = toLocalDay(week[i]);
          if (d.getTime() >= bs.getTime() && d.getTime() <= be.getTime()) {
            if (sc === -1) sc = i;
            sp++;
          }
        }
        if (sc >= 0 && sp > 0) {
          result.push({ booking: bd, startCol: sc, span: sp });
        }
      }
    });
    return result.sort((a, b) => (a.startCol !== b.startCol ? a.startCol - b.startCol : b.span - a.span));
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
      <div className="mb-2" data-month={dataMonth}>
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
                      const checkInDay = toLocalDay(bd.startDate);
                      const checkOutDay = toLocalDay(bd.endDate);
                      const isStart = week.some((d) => toLocalDay(d).getTime() === checkInDay.getTime());
                      const isEnd = week.some((d) => toLocalDay(d).getTime() === checkOutDay.getTime());

                      let radius = '0';
                      if (isStart && isEnd) radius = '16px';
                      else if (isStart) radius = '16px 0 0 16px';
                      else if (isEnd) radius = '0 16px 16px 0';

                      const isCheckinDone = bd.circleBg === '#000000' && !bd.isConflict;

                      return (
                        <div
                          key={`${bd.booking.id}-${weekIndex}-${idx}-row`}
                          className="absolute left-0 right-0 grid grid-cols-7 min-w-0"
                          style={{
                            top: `${idx * (BAR_H + BAR_GAP)}px`,
                            height: `${BAR_H}px`,
                          }}
                        >
                        <motion.div
                          className="min-w-0 pointer-events-auto cursor-pointer px-[1px]"
                          custom={idx}
                          variants={barVariants}
                          initial="hidden"
                          animate="visible"
                          whileTap="tap"
                          style={{
                            gridColumn: `${startCol + 1} / span ${span}`,
                          }}
                          onClick={() => {
                            if (conflicts.includes(bd.booking.id) && conflictGroupsWithPosition.length > 0) {
                              const g = conflictGroupsWithPosition.find((gr) => gr.ids.includes(bd.booking.id));
                              if (g) {
                                setOpenConflictGroup(g);
                                return;
                              }
                            }
                            onBookingClick(bd.booking);
                          }}
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

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <>
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
        className="h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden px-3 scroll-auto overscroll-y-contain touch-pan-y [overflow-anchor:none]"
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

    <Drawer open={!!openConflictGroup} onOpenChange={(open) => !open && setOpenConflictGroup(null)}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Conflit sur ces dates</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">
          {openConflictGroup && (
            <ConflictCadran
              variant="inline"
              reservations={openConflictGroup.reservations}
              onSelectReservation={(id) => {
                const res = bookingPool.find((r) => r.id === id);
                if (res) {
                  onBookingClick(res);
                  setOpenConflictGroup(null);
                }
              }}
              onClose={() => setOpenConflictGroup(null)}
              className="border border-slate-200 shadow-md rounded-2xl"
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
};
