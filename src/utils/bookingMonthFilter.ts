import { addMonths, startOfMonth } from 'date-fns';
import { parseStayDateForCalendar } from '@/utils/dateUtils';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toYearMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Séjour qui chevauche le mois civil [yearMonth] (format `YYYY-MM`). */
export function bookingOverlapsYearMonth(
  checkIn: string,
  checkOut: string,
  yearMonth: string,
): boolean {
  const parts = yearMonth.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return false;
  const ci = parseStayDateForCalendar(checkIn);
  const co = parseStayDateForCalendar(checkOut);
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) return false;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const ciT = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate()).getTime();
  const coT = new Date(co.getFullYear(), co.getMonth(), co.getDate()).getTime();
  const sT = start.getTime();
  const eT = end.getTime();
  return ciT <= eT && coT >= sT;
}

function collectMonthsFromStays(bookings: { checkInDate: string; checkOutDate: string }[]): Set<string> {
  const set = new Set<string>();
  for (const b of bookings) {
    const ci = parseStayDateForCalendar(b.checkInDate);
    const co = parseStayDateForCalendar(b.checkOutDate);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) continue;
    let cur = startOfMonth(ci);
    const endM = startOfMonth(co);
    while (cur.getTime() <= endM.getTime()) {
      set.add(toYearMonthKey(cur));
      cur = addMonths(cur, 1);
    }
  }
  return set;
}

/** Valeurs `YYYY-MM` pour le sélecteur : mois des séjours + fenêtre autour d’aujourd’hui, tri décroissant. */
export function buildCardMonthFilterValues(
  bookings: { checkInDate: string; checkOutDate: string }[],
): string[] {
  const fromBookings = collectMonthsFromStays(bookings);
  const now = new Date();
  const windowMonths = new Set<string>();
  for (let i = -24; i <= 36; i++) {
    windowMonths.add(toYearMonthKey(addMonths(startOfMonth(now), i)));
  }
  const merged = new Set<string>([...fromBookings, ...windowMonths]);
  return Array.from(merged).sort((a, b) => b.localeCompare(a));
}

/** Regroupe les clés `YYYY-MM` par année (années décroissantes, mois décroissants dans chaque année). */
export function groupMonthKeysByYearDescending(monthKeys: string[]): { year: number; keys: string[] }[] {
  const map = new Map<number, string[]>();
  for (const ym of monthKeys) {
    const y = parseInt(ym.slice(0, 4), 10);
    if (Number.isNaN(y)) continue;
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(ym);
  }
  for (const keys of map.values()) {
    keys.sort((a, b) => b.localeCompare(a));
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, keys]) => ({ year, keys }));
}
