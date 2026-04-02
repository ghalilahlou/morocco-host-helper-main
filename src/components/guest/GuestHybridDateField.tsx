import { useState } from 'react';
import { format } from 'date-fns';
import { fr, enUS, es } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useT, useGuestLocale } from '@/i18n/GuestLocaleProvider';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';
import { formatLocalDate, parseLocalDate } from '@/utils/dateUtils';

const DATE_FNS_LOCALE: Record<Locale, DateFnsLocale> = {
  fr,
  en: enUS,
  es,
};

export type GuestHybridDateVariant = 'birth' | 'expiry';

type Props = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  variant: GuestHybridDateVariant;
  placeholder: string;
  id: string;
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

export function GuestHybridDateField({ value, onChange, variant, placeholder, id }: Props) {
  const t = useT();
  const { locale: appLocale } = useGuestLocale();
  const [popoverOpen, setPopoverOpen] = useState(false);
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
    variant === 'birth'
      ? formatLocalDate(new Date())
      : `${expiryToYear}-12-31`;

  const defaultMonth =
    safeValue ??
    (variant === 'birth' ? new Date(1990, 5, 15) : new Date(yNow, new Date().getMonth(), 1));

  const isBirthFutureDisabled = (date: Date) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return date > end;
  };

  const dateFnsLocale = DATE_FNS_LOCALE[appLocale] ?? fr;

  const displayValue = safeValue ? format(safeValue, 'dd/MM/yyyy') : null;
  const inputValue = safeValue ? formatLocalDate(safeValue) : '';

  return (
    <div className="space-y-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            className={cn(
              'w-full justify-start text-left h-12 border-2 transition-all duration-200',
              safeValue
                ? 'border-brand-teal/50 bg-brand-teal/5 hover:bg-brand-teal/10 hover:border-brand-teal shadow-sm'
                : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50',
              'focus-visible:ring-2 focus-visible:ring-brand-teal/20 focus-visible:ring-offset-2'
            )}
          >
            <CalendarIcon className={cn('mr-3 h-5 w-5', safeValue ? 'text-brand-teal' : 'text-gray-400')} />
            <span className={safeValue ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              {displayValue ?? placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-2 border-brand-teal/20 shadow-xl bg-[#FDFDF9]">
          <Calendar
            mode="single"
            selected={safeValue}
            onSelect={(d) => {
              onChange(d);
              setPopoverOpen(false);
            }}
            defaultMonth={defaultMonth}
            locale={dateFnsLocale}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            disabled={variant === 'birth' ? isBirthFutureDisabled : undefined}
            initialFocus
            className="rounded-md"
          />
        </PopoverContent>
      </Popover>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-direct`} className="text-xs font-medium text-gray-600">
          {t('guest.clients.dateDirectHint')}
        </Label>
        <input
          id={`${id}-direct`}
          type="date"
          min={minYmd}
          max={maxYmd}
          value={inputValue}
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
          className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 bg-white text-gray-900 [color-scheme:light]"
        />
      </div>
    </div>
  );
}
