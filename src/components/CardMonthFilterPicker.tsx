import { useMemo, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { groupMonthKeysByYearDescending } from '@/utils/bookingMonthFilter';

export interface CardMonthFilterPickerProps {
  value: string;
  onValueChange: (v: string) => void;
  monthKeys: string[];
  intlLocale: string;
  allMonthsLabel: string;
  /** Titre du panneau (ex. « Mois du séjour ») */
  panelTitle: string;
  panelHint: string;
  triggerClassName?: string;
  /** Hauteur du déclencheur (ex. h-12 sur mobile) */
  size?: 'default' | 'comfortable';
}

function ymToDate(ym: string): Date {
  const [ys, ms] = ym.split('-');
  return new Date(Number(ys), Number(ms) - 1, 1);
}

export function CardMonthFilterPicker({
  value,
  onValueChange,
  monthKeys,
  intlLocale,
  allMonthsLabel,
  panelTitle,
  panelHint,
  triggerClassName,
  size = 'default',
}: CardMonthFilterPickerProps) {
  const [open, setOpen] = useState(false);

  const longFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }),
    [intlLocale],
  );
  const shortFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'short' }),
    [intlLocale],
  );

  const grouped = useMemo(() => groupMonthKeysByYearDescending(monthKeys), [monthKeys]);

  const triggerLabel =
    value === 'all' ? allMonthsLabel : longFmt.format(ymToDate(value));

  const triggerHeight = size === 'comfortable' ? 'h-12' : 'h-10';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between gap-2 rounded-xl border-gray-200 bg-white px-3 font-normal text-left shadow-sm hover:bg-gray-50/80',
            triggerHeight,
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-[#55BA9F]" aria-hidden />
            <span className="truncate text-sm text-gray-900">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 opacity-80" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(100vw-1.5rem,22rem)] max-w-[22rem] border-gray-200/90 p-0 shadow-xl sm:w-[22rem]"
        sideOffset={6}
      >
        <div className="border-b border-gray-100 bg-gradient-to-br from-[#55BA9F]/[0.08] to-transparent px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#55BA9F]">{panelTitle}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{panelHint}</p>
        </div>

        <ScrollArea className="h-[min(26rem,70dvh)]">
          <div className="space-y-5 p-4 pb-5">
            <button
              type="button"
              onClick={() => {
                onValueChange('all');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                value === 'all'
                  ? 'border-[#55BA9F] bg-[#55BA9F] text-white shadow-md shadow-[#55BA9F]/25'
                  : 'border-gray-200 bg-white hover:border-[#55BA9F]/40 hover:bg-gray-50',
              )}
            >
              {value === 'all' ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border border-gray-300" aria-hidden />
              )}
              <span className="font-medium">{allMonthsLabel}</span>
            </button>

            {grouped.map(({ year, keys }) => (
              <div key={year}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums text-gray-900">{year}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {keys.map((ym) => {
                    const d = ymToDate(ym);
                    const selected = value === ym;
                    const label = shortFmt.format(d);
                    const cap = label.length ? label.charAt(0).toUpperCase() + label.slice(1) : label;
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => {
                          onValueChange(ym);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex min-h-[2.75rem] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center text-xs font-semibold transition-all',
                          selected
                            ? 'border-[#55BA9F] bg-[#55BA9F] text-white shadow-md shadow-[#55BA9F]/20 ring-2 ring-[#55BA9F]/30'
                            : 'border-gray-200/90 bg-white text-gray-800 hover:border-[#55BA9F]/45 hover:bg-[#55BA9F]/[0.06]',
                        )}
                      >
                        <span className="leading-tight">{cap}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
