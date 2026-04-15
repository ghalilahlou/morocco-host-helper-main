import { memo } from 'react';
import { Booking } from '@/types/booking';
import { CheckinNotDoneCrossIcon, FigmaConflictIcon } from './ReservationStatusIcons';
import { BookingLayout, isBookingStayPast } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getBookingDisplayTitle, isValidGuestName } from '@/utils/bookingDisplay';
import { shouldShowIcalSyncBadge } from '@/domain/calendarReservationModel';
import { useT } from '@/i18n/GuestLocaleProvider';
import { BOOKING_COLORS } from '@/constants/bookingColors';

const CHECKIN_DONE_ICON_SRC = '/lovable-uploads/imagecheckcalendar.png';

interface CalendarBookingBarProps {
  bookingData: BookingLayout;
  bookingIndex: number;
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
}

export const CalendarBookingBar = memo(({ 
  bookingData, 
  bookingIndex: _bookingIndex,
  conflicts, 
  onBookingClick 
}: CalendarBookingBarProps) => {
  const t = useT();
  const booking = bookingData.booking as Booking | AirbnbReservation;

  // 1. Détecter les conflits (priorité absolue = rouge)
  const isConflict = conflicts.includes(booking.id);
  
  // 2. Obtenir le label à afficher
  const displayLabel = getBookingDisplayTitle(booking);
  
  // 3. ✅ CLEF : Déterminer si le displayLabel est un NOM VALIDE (comme "Mouhcine", "Zaineb")
  // ou un CODE (comme "HM8548HWET", "CLXYZ123")
  // Si c'est un nom valide → réservation VALIDÉE (gris)
  // Si c'est un code → réservation EN ATTENTE (noir)
  const isValidName = isValidGuestName(displayLabel);
  const showIcalSyncBadge = shouldShowIcalSyncBadge(booking, displayLabel);
  
  // Figma: bar #222222, circle #000000 (checkin done) or #B3B3B3 (not done)
  const bookingTyped = 'status' in booking ? (booking as Booking) : null;
  const hasDocs = bookingTyped?.documentsGenerated?.contract && bookingTyped?.documentsGenerated?.policeForm;
  const isCheckinDone = hasDocs;
  const isPastStay = isBookingStayPast(booking);

  let barColor: string;
  let textColor: string;
  let circleBg: string;

  if (isConflict) {
    barColor = BOOKING_COLORS.conflict.hex;
    textColor = 'text-white';
    circleBg = '#000000';
  } else if (isPastStay) {
    barColor = '#D1D5DB';
    textColor = 'text-neutral-900';
    circleBg = isCheckinDone ? '#000000' : '#B3B3B3';
  } else {
    barColor = '#222222';
    textColor = 'text-white';
    circleBg = isCheckinDone ? '#000000' : '#B3B3B3';
  }
  
  // ✅ CRITIQUE : Vérifier que booking existe
  if (!bookingData.booking) {
    console.error('❌ [CalendarBookingBar] bookingData.booking is undefined');
    return null;
  }

  return (
    <div
      className={`
        w-full h-full
        rounded-full flex items-center pl-2 pr-3 sm:pl-2.5 sm:pr-4 text-xs font-semibold ${textColor}
        cursor-pointer transition-all duration-200
        ${isConflict ? 'ring-2 ring-red-300/70' : 'ring-0'}
      `}
      style={{
        backgroundColor: barColor,
        // ✅ PAS DE DÉGRADÉ : Utiliser la couleur unie (noir pour ICS, gris pour validées, etc.)
        background: barColor,
        // Largeur : le grid gère startOffsetPercent/endOffsetPercent. Sinon, isEnd → 92% pour léger espace.
        width: bookingData.endOffsetPercent ? '100%' : (bookingData.isEnd ? '92%' : '100%'),
        zIndex: 1000 + (bookingData.layer || 0),
        boxShadow: isConflict 
          ? '0 4px 12px rgba(220,38,38,0.25)' 
          : isPastStay && !isConflict
            ? '0 2px 6px rgba(15,23,42,0.08)'
            : '0 2px 6px rgba(15,23,42,0.20)',
        border: 'none',
        pointerEvents: 'auto', // ✅ CRITIQUE : S'assurer que les événements sont activés
      }}
      onClick={(e) => {
        e.stopPropagation();
        
        if (bookingData.booking && onBookingClick) {
          onBookingClick(bookingData.booking);
        }
      }}
      title={
        showIcalSyncBadge
          ? t('calendar.icalBadge.tooltip', { name: displayLabel })
          : displayLabel
      }
    >
      {bookingData.isStart ? (
        <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
          <div
            className="-translate-x-px flex items-center justify-center flex-shrink-0 rounded-full w-5 h-5 sm:w-6 sm:h-6 sm:-translate-x-0.5"
            style={{ backgroundColor: circleBg }}
          >
            {isConflict ? (
              <FigmaConflictIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : isCheckinDone ? (
              <img
                src={CHECKIN_DONE_ICON_SRC}
                alt=""
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain pointer-events-none"
              />
            ) : (
              <CheckinNotDoneCrossIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </div>

          {isValidName && (
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden ${
                isPastStay && !isConflict ? 'bg-neutral-200/90' : 'bg-white/20'
              }`}
            >
              <span className={`text-[9px] sm:text-[10px] font-bold ${textColor}`}>
                {displayLabel.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CL'}
              </span>
            </div>
          )}

          <div className={`flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1 ${textColor}`}>
            {showIcalSyncBadge && (
              <span
                className="flex-shrink-0 rounded px-1 py-px text-[8px] sm:text-[9px] font-bold uppercase tracking-wide border border-white/35 bg-black/15"
                aria-hidden
              >
                {t('calendar.icalBadge.short')}
              </span>
            )}
            <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
              {isValidName
                ? displayLabel.split(' ')[0]
                : displayLabel.substring(0, 10) + (displayLabel.length > 10 ? '...' : '')}
            </span>
            {(() => {
              const guestCount = 'numberOfGuests' in booking
                ? (booking as any).numberOfGuests || 1
                : (booking as any).guests?.length || 1;
              return guestCount > 1 ? (
                <span className="text-[10px] sm:text-[11px] font-medium opacity-80 flex-shrink-0 leading-tight">
                  +{guestCount - 1}
                </span>
              ) : null;
            })()}
          </div>
        </div>
      ) : (
        <div className={`flex items-center min-w-0 w-full pl-1 ${textColor}`}>
          <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
            {isValidName
              ? displayLabel.split(' ')[0]
              : displayLabel.substring(0, 12) + (displayLabel.length > 12 ? '…' : '')}
          </span>
        </div>
      )}
    </div>
  );
});
