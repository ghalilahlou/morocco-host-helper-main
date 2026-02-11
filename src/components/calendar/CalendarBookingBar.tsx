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
  
  // 4. Déterminer le statut (uniquement pour les bookings manuels)
  const status = 'status' in booking ? (booking as Booking).status : undefined;
  const isCompleted = status === 'completed';
  const isConfirmed = status === 'confirmed';
  
  // ✅ ICS/AIRBNB : Détecter les réservations ICS/Airbnb issues de fichiers ICS
  // Toute réservation avec bookingReference au format Airbnb (HM, CL, etc.) est considérée comme ICS/Airbnb
  const hasAirbnbCode = 'bookingReference' in booking && 
    (booking as Booking).bookingReference && 
    (booking as Booking).bookingReference !== 'INDEPENDENT_BOOKING' &&
    /^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]+/.test((booking as Booking).bookingReference);
  
  // ✅ RÉSERVATION INDÉPENDANTE : Détecter si c'est une réservation indépendante confirmée
  const isIndependentConfirmed = 'bookingReference' in booking &&
    (booking as Booking).bookingReference === 'INDEPENDENT_BOOKING' &&
    (isConfirmed || isCompleted);
  
  // ✅ AIRBNB : Détecter si c'est une réservation Airbnb réelle (depuis airbnb_reservations)
  const isAirbnb = 'airbnb_booking_id' in booking || 
    ('source' in booking && (booking as any).source === 'airbnb');

  // ✅ COPIÉ EXACTEMENT DE CalendarMobile.tsx (lignes 224-242)
  // Couleurs selon le design Figma - ALIGNÉ AVEC MOBILE
  // 1. Rouge pour conflits
  // 2. GRIS pour codes Airbnb/ICS COMPLÉTÉS/CONFIRMÉS OU avec nom valide
  // 3. NOIR pour codes Airbnb/ICS EN ATTENTE
  // 4. GRIS pour noms valides
  // 5. NOIR par défaut
  let barColor: string;
  let textColor: string;

  if (isConflict) {
    barColor = BOOKING_COLORS.conflict.hex; // Rouge #FF5A5F
    textColor = 'text-white';
  } else if ((hasAirbnbCode || isAirbnb) && (isCompleted || isConfirmed || isValidName)) {
    // ✅ EXACTEMENT COMME MOBILE : GRIS pour codes Airbnb/ICS complétés/confirmés ou avec nom valide
    barColor = BOOKING_COLORS.completed.hex; // Gris clair #E5E5E5
    textColor = 'text-gray-900';
  } else if (hasAirbnbCode || isAirbnb) {
    // NOIR pour codes Airbnb/ICS en attente
    barColor = '#222222'; // Noir pour codes (comme dans Figma)
    textColor = 'text-white';
  } else if (isValidName) {
    // GRIS pour noms valides (vérifier APRÈS les codes)
    barColor = BOOKING_COLORS.completed.hex; // Gris clair #E5E5E5
    textColor = 'text-gray-900';
  } else {
    barColor = BOOKING_COLORS.default.hex; // Noir #1A1A1A pour autres réservations en attente
    textColor = 'text-white';
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
        // Jour de départ : réduire la largeur pour laisser un léger espace avant la réservation suivante (ex. 06-08 et 08-10).
        width: bookingData.isEnd ? '88%' : '100%',
        zIndex: 1000 + (bookingData.layer || 0),
        boxShadow: isConflict 
          ? '0 4px 12px rgba(220,38,38,0.25)' 
          : isAirbnb
          ? '0 2px 8px rgba(255,56,92,0.30)' // ✅ AIRBNB : Ombre rose pour Airbnb
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
      {/* ✅ COPIÉ EXACTEMENT DE CalendarMobile.tsx (lignes 608-658) */}
      {bookingData.isStart && (
        <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
          {/* ✅ Icône de statut : ✓ vert ou ✕ blanc/rouge */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isConflict ? (
              // ❌ Croix blanche pour conflits (fond rouge)
              <span className="text-white text-sm font-bold leading-none">✕</span>
            ) : barColor === '#222222' ? (
              // ❌ Croix blanche pour codes Airbnb en attente (barres noires)
              <span className="text-white text-sm font-bold leading-none">✕</span>
            ) : isValidName ? (
              // ✅ Checkmark vert pour réservations validées (barres grises)
              <span className="text-green-600 text-sm font-bold leading-none">✓</span>
            ) : null}
          </div>
          
          {/* ✅ Avatar avec initiales (seulement pour noms valides) */}
          {isValidName && (
            <div
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white/20"
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
