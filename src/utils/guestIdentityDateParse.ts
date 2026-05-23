import { parseLocalDate } from '@/utils/dateUtils';

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, january: 1, janvier: 1,
  feb: 2, february: 2, fevrier: 2, février: 2, fev: 2, fév: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4, avril: 4, avr: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juillet: 7,
  aug: 8, august: 8, aout: 8, août: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, decembre: 12, décembre: 12, déc: 12,
};

/** YYMMDD (MRZ) → YYYY-MM-DD en calendrier local. */
export function yymmddMrzToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  const dd = parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy >= 40 ? 1900 + yy : 2000 + yy;
  try {
    const d = new Date(year, mm - 1, dd);
    if (d.getFullYear() !== year || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/** Extrait naissance + expiration depuis la 2e ligne MRZ (TD3 passeport). */
export function parseTd3MrzLine2Dates(mrzLine2: string): {
  dateOfBirth?: string;
  documentExpiryDate?: string;
} {
  const s = mrzLine2.replace(/\s/g, '').toUpperCase().replace(/</g, '');
  if (s.length < 27) return {};

  const dobRaw = s.substring(13, 19);
  const expRaw = s.substring(21, 27);
  const dob = yymmddMrzToIso(dobRaw);
  const exp = yymmddMrzToIso(expRaw);
  return {
    ...(dob ? { dateOfBirth: dob } : {}),
    ...(exp ? { documentExpiryDate: exp } : {}),
  };
}

/**
 * Parse une date extraite par l'OCR (texte libre, ISO, DD/MM/YYYY, « 22 Sep 1999 »).
 */
export function parseGuestIdentityDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoStrict = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoStrict) {
    try {
      return parseLocalDate(trimmed);
    } catch {
      return null;
    }
  }

  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const textMonth = trimmed.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})$/i);
  if (textMonth) {
    const day = parseInt(textMonth[1], 10);
    const year = parseInt(textMonth[3], 10);
    const monthKey = textMonth[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const monthNum =
      MONTH_ALIASES[monthKey] ??
      MONTH_ALIASES[monthKey.slice(0, 3)] ??
      MONTH_ALIASES[monthKey.slice(0, 4)];
    if (monthNum) {
      const d = new Date(year, monthNum - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const isoFromMrz = yymmddMrzToIso(trimmed);
  if (isoFromMrz) {
    try {
      return parseLocalDate(isoFromMrz);
    } catch {
      return null;
    }
  }

  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) {
    return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate());
  }

  return null;
}
