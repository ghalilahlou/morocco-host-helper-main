import { useMemo } from 'react';
import { useT } from '@/i18n/GuestLocaleProvider';

const MONTH_KEYS = [
  'calendar.monthJan', 'calendar.monthFeb', 'calendar.monthMar',
  'calendar.monthApr', 'calendar.monthMay', 'calendar.monthJun',
  'calendar.monthJul', 'calendar.monthAug', 'calendar.monthSep',
  'calendar.monthOct', 'calendar.monthNov', 'calendar.monthDec',
] as const;

export type GuestDateSelectVariant = 'birth' | 'expiry';

type Props = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  variant: GuestDateSelectVariant;
  id: string;
  disabled?: boolean;
};

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

export function GuestDateSelectField({ value, onChange, variant, id, disabled }: Props) {
  const t = useT();
  const today = new Date();
  const currentYear = today.getFullYear();

  const monthNames = MONTH_KEYS.map((k) => t(k));

  const day   = value ? value.getDate()        : 0;
  const month = value ? value.getMonth() + 1   : 0; // 1-12
  const year  = value ? value.getFullYear()    : 0;

  const yearMin = variant === 'birth' ? 1900 : currentYear - 2;
  const yearMax = variant === 'birth' ? currentYear : currentYear + 20;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearMax; y >= yearMin; y--) arr.push(y);
    return arr;
  }, [yearMin, yearMax]);

  const maxDays = daysInMonth(year, month);

  const commit = (newDay: number, newMonth: number, newYear: number) => {
    if (!newDay || !newMonth || !newYear) {
      onChange(undefined);
      return;
    }
    const safeDay = Math.min(newDay, daysInMonth(newYear, newMonth));
    onChange(new Date(newYear, newMonth - 1, safeDay));
  };

  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isExpired = variant === 'expiry' && !!value && value < today0;

  const selectBase =
    'px-2 py-3 text-base border rounded-lg focus:border-gray-900 focus:outline-none transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none';
  const borderColor = isExpired ? 'border-amber-400' : 'border-gray-300';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* Jour */}
        <select
          id={id}
          value={day || ''}
          disabled={disabled}
          onChange={(e) => commit(parseInt(e.target.value) || 0, month, year)}
          className={`${selectBase} ${borderColor} w-16`}
          aria-label={t('guest.dateSelect.dayPlaceholder')}
          autoComplete={variant === 'birth' ? 'bday-day' : 'off'}
        >
          <option value="">{t('guest.dateSelect.dayPlaceholder')}</option>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Mois */}
        <select
          value={month || ''}
          disabled={disabled}
          onChange={(e) => commit(day, parseInt(e.target.value) || 0, year)}
          className={`${selectBase} ${borderColor} flex-1 min-w-0`}
          aria-label={t('guest.dateSelect.monthPlaceholder')}
          autoComplete={variant === 'birth' ? 'bday-month' : 'off'}
        >
          <option value="">{t('guest.dateSelect.monthPlaceholder')}</option>
          {monthNames.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>

        {/* Année */}
        <select
          value={year || ''}
          disabled={disabled}
          onChange={(e) => commit(day, month, parseInt(e.target.value) || 0)}
          className={`${selectBase} ${borderColor} w-24`}
          aria-label={t('guest.dateSelect.yearPlaceholder')}
          autoComplete={variant === 'birth' ? 'bday-year' : 'off'}
        >
          <option value="">{t('guest.dateSelect.yearPlaceholder')}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isExpired && (
        <p className="text-xs text-amber-600 flex items-center gap-1" role="alert">
          <span aria-hidden="true">⚠</span>
          {t('guestVerification.expiredDocWarning')}
        </p>
      )}
    </div>
  );
}
