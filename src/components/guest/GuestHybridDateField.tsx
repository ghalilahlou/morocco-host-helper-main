import { formatLocalDate, parseLocalDate, parseStayDateForCalendar } from '@/utils/dateUtils';

export type GuestHybridDateVariant = 'birth' | 'expiry';

type Props = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  variant: GuestHybridDateVariant;
  id: string;
  /** Libellé accessibilité (champ vide), ex. « Sélectionner une date » */
  ariaLabel?: string;
  disabled?: boolean;
};

function safeParseYmd(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  try {
    return parseLocalDate(s);
  } catch {
    return undefined;
  }
}

function toSafeDate(v: Date | string | undefined): Date | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? undefined : v;
  }
  const parsed = parseStayDateForCalendar(v);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Étend min/max pour inclure une valeur OCR hors plage (sinon le champ date natif est figé). */
function boundsIncludingValue(
  variant: GuestHybridDateVariant,
  safeValue: Date | undefined
): { minYmd: string; maxYmd: string } {
  const yNow = new Date().getFullYear();
  const birthFromYear = 1900;
  const birthToYear = yNow;
  const expiryFromYear = yNow - 35;
  const expiryToYear = yNow + 30;

  let minYmd =
    variant === 'birth' ? `${birthFromYear}-01-01` : `${expiryFromYear}-01-01`;
  let maxYmd =
    variant === 'birth'
      ? formatLocalDate(new Date())
      : `${expiryToYear}-12-31`;

  if (safeValue) {
    const ymd = formatLocalDate(safeValue);
    if (ymd < minYmd) minYmd = ymd;
    if (ymd > maxYmd) maxYmd = ymd;
  }

  return { minYmd, maxYmd };
}

/**
 * Une seule barre date (native) : saisie directe, sélecteur du navigateur,
 * préremplissage OCR inchangé via `value` / `onChange` → même modèle que avant.
 */
export function GuestHybridDateField({ value, onChange, variant, id, ariaLabel, disabled }: Props) {
  const safeValue = toSafeDate(value);
  const { minYmd, maxYmd } = boundsIncludingValue(variant, safeValue);

  const isBirthFutureDisabled = (date: Date) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return date > end;
  };

  const inputValue = safeValue ? formatLocalDate(safeValue) : '';

  return (
    <input
      id={id}
      type="date"
      min={minYmd}
      max={maxYmd}
      value={inputValue}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) {
          onChange(undefined);
          return;
        }
        const parsed = safeParseYmd(v);
        if (parsed) {
          if (variant === 'birth' && isBirthFutureDisabled(parsed)) return;
          onChange(parsed);
        }
      }}
      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-colors bg-white text-gray-900 [color-scheme:light] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
    />
  );
}
