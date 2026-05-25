import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { useGuestLocale, useT } from '@/i18n/GuestLocaleProvider';
import { enUS, es, fr } from 'date-fns/locale';

type Props = {
  checkInDate?: Date;
  checkOutDate?: Date;
  isMobile: boolean;
  onConfirm: (checkIn: Date, checkOut: Date) => void;
  onClose: () => void;
  /** Mise à jour live pour la barre « Quand ? » pendant la sélection. */
  onDraftChange?: (start?: Date, end?: Date) => void;
};

function normalizeDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function GuestStayDatePicker({
  checkInDate,
  checkOutDate,
  isMobile,
  onConfirm,
  onClose,
  onDraftChange,
}: Props) {
  const t = useT();
  const { locale } = useGuestLocale();
  const dateLocale = locale === 'en' ? enUS : locale === 'es' ? es : fr;

  const [draftStart, setDraftStart] = useState<Date | undefined>(
    checkInDate ? normalizeDay(checkInDate) : undefined
  );
  const [draftEnd, setDraftEnd] = useState<Date | undefined>(
    checkOutDate ? normalizeDay(checkOutDate) : undefined
  );

  useEffect(() => {
    setDraftStart(checkInDate ? normalizeDay(checkInDate) : undefined);
    setDraftEnd(checkOutDate ? normalizeDay(checkOutDate) : undefined);
  }, [checkInDate?.getTime(), checkOutDate?.getTime()]);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current?.(draftStart, draftEnd);
  }, [draftStart?.getTime(), draftEnd?.getTime()]);

  const step: 'checkIn' | 'checkOut' | 'done' = useMemo(() => {
    if (draftStart && draftEnd) return 'done';
    if (draftStart) return 'checkOut';
    return 'checkIn';
  }, [draftStart, draftEnd]);

  const nights =
    draftStart && draftEnd ? Math.max(0, differenceInDays(draftEnd, draftStart)) : 0;

  const focusDate = draftStart ?? checkInDate ?? new Date();

  const applyRange = useCallback(
    (start: Date, end: Date) => {
      const normalizedCheckIn = normalizeDay(start);
      const normalizedCheckOut = normalizeDay(end);
      setDraftStart(normalizedCheckIn);
      setDraftEnd(normalizedCheckOut);
      if (!isMobile) {
        onConfirm(normalizedCheckIn, normalizedCheckOut);
        onClose();
      }
    },
    [isMobile, onConfirm, onClose]
  );

  const handleConfirm = () => {
    if (!draftStart || !draftEnd) return;
    onConfirm(draftStart, draftEnd);
    onClose();
  };

  const handleClear = () => {
    setDraftStart(undefined);
    setDraftEnd(undefined);
  };

  const formatChip = (d: Date | undefined, placeholder: string) =>
    d ? format(d, isMobile ? 'dd/MM/yyyy' : 'dd MMM yyyy', { locale: dateLocale }) : placeholder;

  return (
    <div className="guest-stay-date-picker w-full max-w-md mx-auto">
      <div className="mb-3 rounded-xl border border-[#55BA9F]/25 bg-[#F0F9F7]/80 p-3">
        <p className="text-xs font-medium text-[#2d6b5c] mb-2">
          {step === 'checkIn' && t('guest.calendar.stepCheckIn')}
          {step === 'checkOut' && t('guest.calendar.stepCheckOut')}
          {step === 'done' && t('guest.calendar.stepDone')}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div
            className={`rounded-lg px-2.5 py-2 border ${
              step === 'checkIn' ? 'border-[#55BA9F] bg-white shadow-sm' : 'border-gray-200 bg-white/70'
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
              {t('guest.calendar.checkInLabel')}
            </span>
            <span className="font-semibold text-gray-900 truncate block">
              {formatChip(draftStart, '—')}
            </span>
          </div>
          <div
            className={`rounded-lg px-2.5 py-2 border ${
              step === 'checkOut' ? 'border-[#55BA9F] bg-white shadow-sm' : 'border-gray-200 bg-white/70'
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
              {t('guest.calendar.checkOutLabel')}
            </span>
            <span className="font-semibold text-gray-900 truncate block">
              {formatChip(draftEnd, '—')}
            </span>
          </div>
        </div>
        {step === 'done' && nights > 0 && (
          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[#55BA9F]" />
            {t('guest.calendar.nightsCount', { count: nights })}
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-3 text-center px-1">{t('guest.calendar.rangeHowto')}</p>

      <EnhancedCalendar
        mode="range"
        touchFriendly
        focusDate={focusDate}
        rangeStart={draftStart}
        rangeEnd={draftEnd}
        onRangeProgress={(start, end) => {
          if (start && !end) {
            setDraftStart(normalizeDay(start));
            setDraftEnd(undefined);
          }
        }}
        onRangeSelect={applyRange}
        className="w-full"
      />

      <div
        className={`mt-4 flex gap-2 ${isMobile ? 'flex-col-reverse' : 'flex-row justify-between items-center'}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900 touch-target"
          onClick={handleClear}
          disabled={!draftStart && !draftEnd}
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          {t('guest.calendar.clear')}
        </Button>

        {isMobile ? (
          <Button
            type="button"
            className="w-full text-white font-semibold touch-target"
            style={{ backgroundColor: '#55BA9F', borderRadius: '10px' }}
            disabled={!draftStart || !draftEnd}
            onClick={handleConfirm}
          >
            {t('guest.calendar.confirm')}
          </Button>
        ) : (
          <p className="text-xs text-gray-500">{t('guest.calendar.desktopHint')}</p>
        )}
      </div>
    </div>
  );
}
