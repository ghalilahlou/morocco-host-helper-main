import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { useT } from '@/i18n/GuestLocaleProvider';

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

  return (
    <div className="guest-stay-date-picker w-full max-w-md mx-auto">
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
