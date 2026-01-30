import { memo } from 'react';
import { Booking } from '@/types/booking';
import { BookingLayout } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { getUnifiedBookingDisplayText, isAirbnbCode } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { Check, X } from 'lucide-react';

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
const isValidGuestName = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  
  const trimmed = value.trim();
  
  // ✅ PRIORITÉ 1 : Vérifier si c'est un code Airbnb (retourne false si oui)
  if (isAirbnbCode(trimmed)) {
    return false;
  }
  
  // ✅ PRIORITÉ 2 : Si c'est "Réservation" exact, ce n'est pas un nom
  const lower = trimmed.toLowerCase();
  if (lower === 'réservation' || lower === 'airbnb') return false;
  
  // ✅ PRIORITÉ 3 : Un nom valide doit contenir au moins une lettre
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
  
  // ✅ PRIORITÉ 4 : Un nom valide doit avoir au moins 2 caractères
  if (trimmed.length < 2) return false;
  
  // ✅ PRIORITÉ 5 : Pattern de codes alphanumériques (HM4A, CL123, etc.)
  const condensed = trimmed.replace(/\s+/g, '');
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(trimmed)) {
    return false; // Code alphanumérique en majuscules
  }
  
  // ✅ ACCEPTÉ : Un nom à un seul mot est valide (Mouhcine, Marcel, etc.)
  // Supprimé la vérification "au moins 2 mots" qui rejetait "Mouhcine"
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

  // ✅ CORRIGÉ : Palette visuelle des barres - PRIORITÉ AUX CODES (comme dans Figma)
  // 1. Rouge pour conflits
  // 2. NOIR pour codes Airbnb/ICS (EBXCFOIGUE, ZIUFIHGIHDF, HM..., CL...)
  // 3. GRIS pour noms valides (Mouhcine, Zaineb) ET réservations indépendantes confirmées
  const { barColor, textColor } = (() => {
    // 1. Rouge pour conflit (priorité absolue)
    if (isConflict) {
      return {
        barColor: BOOKING_COLORS.conflict.hex, // Rouge #FF5A5F
        textColor: 'text-white'
      };
    }

    // 2. Utiliser la couleur depuis colorOverrides si disponible (convertir tailwind en hex)
    // MAIS cette couleur peut être overridée par les vérifications suivantes (ex: independent confirmed)
    if (bookingData.color) {
      // Extraire la couleur hex depuis la classe tailwind
      let hexColor = bookingData.color;
      
      // Si c'est une classe tailwind avec couleur arbitraire [hex]
      const hexMatch = bookingData.color.match(/\[#([0-9A-Fa-f]{6})\]/);
      if (hexMatch) {
        hexColor = `#${hexMatch[1]}`;
      } else if (bookingData.color.includes('gray-200') || bookingData.color.includes('completed')) {
        hexColor = BOOKING_COLORS.completed.hex; // #E5E5E5 - Gris pour validées
      } else if (bookingData.color.includes('gray-900') || bookingData.color.includes('default') || bookingData.color.includes('manual')) {
        hexColor = BOOKING_COLORS.default.hex; // #1A1A1A
      } else if (bookingData.color.includes('red') || bookingData.color.includes('conflict')) {
        hexColor = BOOKING_COLORS.conflict.hex; // #FF5A5F
      }
      
      // ✅ CRITIQUE: Vérifier si c'est une réservation indépendante confirmée APRÈS avoir extrait la couleur
      // Cela garantit que les réservations indépendantes confirmées restent grises même avec ICS sync
      if (isIndependentConfirmed) {
        return {
          barColor: BOOKING_COLORS.completed.hex, // Gris clair #E5E5E5
          textColor: 'text-gray-900'
        };
      }
      
      // Déterminer la couleur du texte selon la couleur de fond
      const textColorClass = hexColor === BOOKING_COLORS.completed.hex ? 'text-gray-900' : 'text-white';
      
      return {
        barColor: hexColor,
        textColor: textColorClass
      };
    }

    // 3. ✅ PRIORITÉ: INDEPENDENT_BOOKING confirmées/completed → TOUJOURS GRIS
    // Cette vérification s'applique même si bookingData.color n'est pas défini
    if (isIndependentConfirmed) {
      return {
        barColor: BOOKING_COLORS.completed.hex, // Gris clair #E5E5E5
        textColor: 'text-gray-900'
      };
    }

    // 4. ✅ GRIS pour réservations ICS/Airbnb COMPLÉTÉES (validées par le guest)
    // Vérifier si c'est une réservation ICS/Airbnb ET qu'elle est complétée
    if ((hasAirbnbCode || isAirbnb) && (isCompleted || isValidName)) {
      return {
        barColor: BOOKING_COLORS.completed.hex, // Gris clair #E5E5E5 pour validées
        textColor: 'text-gray-900'
      };
    }

    // 5. ✅ NOIR pour réservations ICS/Airbnb EN ATTENTE (non complétées)
    // Codes : EBXCFOIGUE, ZIUFIHGIHDF, HM..., CL..., etc.
    if (hasAirbnbCode || isAirbnb) {
      return {
        barColor: '#222222', // Noir pour codes Airbnb/ICS en attente
        textColor: 'text-white'
      };
    }

    // 6. ✅ GRIS pour réservations avec NOM VALIDE (Mouhcine, Zaineb, etc.)
    // OU pour réservations completed (validées par le système)
    if (isValidName || isCompleted) {
      return {
        barColor: BOOKING_COLORS.completed.hex, // Gris clair #E5E5E5 pour validées
        textColor: 'text-gray-900'
      };
    }

    // 6. Noir pour autres réservations en attente
    return {
      barColor: BOOKING_COLORS.default.hex, // Noir #1A1A1A pour réservations en attente
      textColor: 'text-white'
    };
  })();
  
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
        // Si ce segment contient la date de check-out, réduire légèrement la largeur
        // pour suggérer que la journée de départ n'est que partiellement occupée.
        width: bookingData.isEnd && bookingData.span > 0
          ? `calc(100% - ${(0.75 * (100 / bookingData.span)).toFixed(2)}%)`
          : '100%',
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
      {bookingData.isStart && (
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* Icône de statut à gauche - paramètres alignés sur le modèle Figma */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 22,   // légèrement plus large que le vecteur Figma (~18)
              height: 16   // légèrement plus haut pour garder les proportions
            }}
          >
            {isConflict ? (
              // ❌ ROUGE : Croix rouge pour conflits
              <X
                className="w-full h-full"
                style={{ color: '#DC2626' }}
                strokeWidth={2}
              />
            ) : barColor === BOOKING_COLORS.completed.hex || barColor === '#E5E5E5' ? (
              // ✅ VERT : Checkmark vert pour barres GRISES (réservations validées)
              <Check
                className="w-full h-full"
                style={{ color: '#0BD9D0' }}
                strokeWidth={2}
              />
            ) : barColor === '#222222' || (hasAirbnbCode && !isCompleted) ? (
              // ❌ BLANC : Croix blanche pour barres NOIRES (codes Airbnb en attente)
              <X
                className="w-full h-full"
                style={{ color: '#FFFFFF' }}
                strokeWidth={2}
              />
            ) : (
              // Par défaut : checkmark vert
              <Check
                className="w-full h-full"
                style={{ color: '#0BD9D0' }}
                strokeWidth={2}
              />
            )}
          </div>

          {/* Label de réservation */}
          <span className="truncate flex-1">
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
});
