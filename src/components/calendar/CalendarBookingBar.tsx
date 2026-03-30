import { memo } from 'react';
import { Booking } from '@/types/booking';
import { CheckinNotDoneCrossIcon, FigmaConflictIcon } from './ReservationStatusIcons';
import { BookingLayout, isBookingStayPast } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';

const CHECKIN_DONE_ICON_SRC = '/lovable-uploads/imagecheckcalendar.png';

interface CalendarBookingBarProps {
  bookingData: BookingLayout;
  bookingIndex: number;
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
}

/**
 * ✅ CORRIGÉ : Fonction simplifiée pour détecter si un nom est valide
 * On ne vérifie plus le nombre de mots, juste si ce n'est pas un code Airbnb
 * Les noms à un seul mot comme "Mouhcine" sont maintenant acceptés
 */
// ✅ UNIFIÉ AVEC MOBILE : Fonction pour vérifier si un nom est valide
// Copié exactement de CalendarMobile.tsx (lignes 58-77)
const isValidGuestName = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  
  // Rejeter les mots-clés génériques
  if (lower === 'réservation' || lower === 'airbnb') return false;
  
  // Rejeter les codes ICS/Airbnb (UID:, HM, CL, etc.)
  if (/^(UID|HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9\-:]+/i.test(trimmed)) return false;
  
  // Rejeter les codes alphanumériques en majuscules (5+ caractères sans minuscules)
  const condensed = trimmed.replace(/\s+/g, '');
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(trimmed)) return false;
  
  // Rejeter les codes courts (4+ caractères majuscules/chiffres sans espaces ni minuscules)
  if (!/[a-z]/.test(trimmed) && !trimmed.includes(' ') && /^[A-Z0-9]+$/.test(condensed) && condensed.length >= 4) return false;
  
  // Doit contenir au moins une lettre
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
  
  // Doit avoir entre 2 et 50 caractères
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  
  // Rejeter les mots interdits
  const forbiddenWords = ['phone', 'airbnb', 'reservation', 'guest', 'client', 'booking'];
  if (forbiddenWords.some(word => lower.includes(word))) return false;
  
  return true;
};

export const CalendarBookingBar = memo(({ 
  bookingData, 
  bookingIndex: _bookingIndex,
  conflicts, 
  onBookingClick 
}: CalendarBookingBarProps) => {
  const booking = bookingData.booking as Booking | AirbnbReservation;

  // 1. Détecter les conflits (priorité absolue = rouge)
  const isConflict = conflicts.includes(booking.id);
  
  // 2. Obtenir le label à afficher
  const displayLabel = getUnifiedBookingDisplayText(booking, bookingData.isStart);
  
  // 3. ✅ CLEF : Déterminer si le displayLabel est un NOM VALIDE (comme "Mouhcine", "Zaineb")
  // ou un CODE (comme "HM8548HWET", "CLXYZ123")
  // Si c'est un nom valide → réservation VALIDÉE (gris)
  // Si c'est un code → réservation EN ATTENTE (noir)
  const isValidName = isValidGuestName(displayLabel);
  
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
        rounded-full flex items-center px-3 sm:px-4 text-xs font-semibold ${textColor}
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
      title={displayLabel}
    >
      {bookingData.isStart && (
        <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
          {/* Figma: cercle #000000 (done) ou #B3B3B3 (not done), icône Check ou X stylisée */}
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-full w-5 h-5 sm:w-6 sm:h-6"
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
          
          {/* ✅ Avatar avec initiales (seulement pour noms valides) */}
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
          
          {/* ✅ Nom OU Code de réservation */}
          <div className={`flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1 ${textColor}`}>
            <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
              {isValidName 
                ? displayLabel.split(' ')[0]
                : displayLabel.substring(0, 10) + (displayLabel.length > 10 ? '...' : '')
              }
            </span>
            {/* ✅ Compteur de guests (+1, +2, etc.) */}
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
      )}
    </div>
  );
});
