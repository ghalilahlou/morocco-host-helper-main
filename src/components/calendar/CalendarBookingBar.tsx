import { memo } from 'react';
import { Booking } from '@/types/booking';
import { BookingLayout } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';

interface CalendarBookingBarProps {
  bookingData: BookingLayout;
  bookingIndex: number;
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
}

/**
 * Détermine si une chaîne est un nom valide (comme "Marcel", "Michel", "Jean Dupont")
 * vs un code (comme "HM8548HWET", "UID:...", etc.)
 */
const isValidGuestName = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  
  const trimmed = value.trim();
  
  // Si c'est "Réservation" ou "Airbnb", ce n'est pas un nom
  const lower = trimmed.toLowerCase();
  if (lower === 'réservation' || lower === 'airbnb') return false;
  
  // Si ça commence par "UID:" ou contient des patterns de codes, ce n'est pas un nom
  if (/^(UID|HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9\-:]+/i.test(trimmed)) {
    return false;
  }
  
  // Si c'est principalement des lettres majuscules et chiffres sans espaces (code alphanumérique)
  // Exemples: "HM8548HWET", "HM4AWWQFRB", "HMBEANEF3K"
  const condensed = trimmed.replace(/\s+/g, '');
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(trimmed)) {
    return false; // Code alphanumérique en majuscules
  }
  
  // Si ça ressemble à un code (que des majuscules + chiffres, pas d'espaces, pas de minuscules)
  // Même pour des codes courts comme "HM4A"
  if (!/[a-z]/.test(trimmed) && !trimmed.includes(' ') && /^[A-Z0-9]+$/.test(condensed) && condensed.length >= 4) {
    return false;
  }
  
  // Un nom valide doit contenir au moins une lettre
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
  
  // Un nom valide doit avoir au moins 2 caractères
  if (trimmed.length < 2) return false;
  
  // Un nom valide ne doit pas être trop long
  if (trimmed.length > 50) return false;
  
  // Si ça contient des mots interdits, ce n'est pas un nom
  const forbiddenWords = ['phone', 'airbnb', 'reservation', 'guest', 'client', 'booking'];
  if (forbiddenWords.some(word => lower.includes(word))) return false;
  
  // Si on arrive ici, c'est probablement un nom (comme "Marcel", "Michel", "Jean Dupont")
  // Les noms ont généralement des minuscules ou des espaces
  return true;
};

export const CalendarBookingBar = memo(({ 
  bookingData, 
  bookingIndex: _bookingIndex,
  conflicts, 
  onBookingClick 
}: CalendarBookingBarProps) => {
  // 1. Détecter les conflits (priorité absolue = rouge)
  const isConflict = conflicts.includes(bookingData.booking.id);
  
  // 2. Obtenir le label à afficher
  const displayLabel = getUnifiedBookingDisplayText(bookingData.booking, bookingData.isStart);
  
  // 3. Déterminer si c'est un nom (comme "Marcel", "Michel") ou un code
  const isName = isValidGuestName(displayLabel);
  
  // 4. Déterminer la couleur : nom = vert, code = gris, conflit = rouge
  const colorInfo = (() => {
    if (isConflict) return BOOKING_COLORS.conflict;
    if (isName) return BOOKING_COLORS.completed; // Nom affiché = VERT
    return BOOKING_COLORS.pending; // Code affiché = GRIS
  })();
  
  // ✅ HARMONISÉ : Ajuster la couleur du texte selon la couleur de fond pour un meilleur contraste
  const textColor = isConflict 
    ? 'text-white' 
    : colorInfo.hex === BOOKING_COLORS.completed.hex 
      ? 'text-teal-900' // Texte foncé pour le teal clair (#8BD7D2)
      : 'text-white'; // Texte blanc pour le gris et autres couleurs
  
  // ✅ CRITIQUE : Vérifier que booking existe
  if (!bookingData.booking) {
    console.error('❌ [CalendarBookingBar] bookingData.booking is undefined');
    return null;
  }

  return (
    <div
      className={`
        rounded-lg flex items-center px-3 py-1.5 text-xs font-semibold ${textColor}
        cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg
        ${isConflict ? 'ring-2 ring-red-300' : ''}
        w-full
      `}
      style={{
        backgroundColor: colorInfo.hex,
        minHeight: '100%',
        height: '100%',
        zIndex: 1000 + (bookingData.layer || 0),
        boxShadow: isConflict 
          ? '0 4px 12px rgba(220,38,38,0.25)' 
          : `0 2px 8px ${colorInfo.hex}30`,
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
        <div className="flex items-center gap-2 w-full min-w-0">
          <span className="truncate">{displayLabel}</span>
        </div>
      )}
    </div>
  );
});
