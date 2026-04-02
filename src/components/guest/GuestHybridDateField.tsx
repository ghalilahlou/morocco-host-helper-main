import { formatLocalDate, parseLocalDate } from '@/utils/dateUtils';

export type GuestHybridDateVariant = 'birth' | 'expiry';

type Props = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  variant: GuestHybridDateVariant;
  id: string;
  /** Libellé accessibilité (champ vide), ex. « Sélectionner une date » */
  ariaLabel?: string;
};

function safeParseYmd(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  try {
    return parseLocalDate(s);
  } catch {
    return undefined;
  }
}

function toSafeDate(v: Date | undefined): Date | undefined {
  if (!v || !(v instanceof Date) || isNaN(v.getTime())) return undefined;
  return v;
}

/**
 * Une seule barre date (native) : saisie directe, sélecteur du navigateur,
 * préremplissage OCR inchangé via `value` / `onChange` → même modèle que avant.
 */
export function GuestHybridDateField({ value, onChange, variant, id, ariaLabel }: Props) {
  const safeValue = toSafeDate(value);

  const yNow = new Date().getFullYear();
  const birthFromYear = 1920;
  const birthToYear = yNow;
  const expiryFromYear = yNow - 35;
  const expiryToYear = yNow + 25;

  const fromYear = variant === 'birth' ? birthFromYear : expiryFromYear;
  const toYear = variant === 'birth' ? birthToYear : expiryToYear;

  const minYmd = `${fromYear}-01-01`;
  const maxYmd =
    variant === 'birth' ? formatLocalDate(new Date()) : `${expiryToYear}-12-31`;

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
      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-colors bg-white text-gray-900 [color-scheme:light]"
    />
  );
}
