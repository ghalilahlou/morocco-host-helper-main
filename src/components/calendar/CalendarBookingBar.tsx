import { memo } from 'react';
import { Booking } from '@/types/booking';
import { BookingLayout } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { Check, X, Loader2, AlertCircle, HelpCircle } from 'lucide-react';

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
  const booking = bookingData.booking as Booking | AirbnbReservation;

  // 1. Détecter les conflits (priorité absolue = rouge)
  const isConflict = conflicts.includes(booking.id);
  
  // 2. Obtenir le label à afficher
  const displayLabel = getUnifiedBookingDisplayText(booking, bookingData.isStart);
  
  // 3. Déterminer si c'est un nom (comme "Marcel", "Michel") ou un code
  const isName = isValidGuestName(displayLabel);
  
  // 4. Déterminer le statut (uniquement pour les bookings manuels)
  const status = 'status' in booking ? (booking as Booking).status : undefined;
  
  // ✅ TIMEOUT GRACIEUX : Extraire les indicateurs de chargement/erreur/timeout des documents
  const documentsLoading = 'documentsLoading' in booking ? (booking as EnrichedBooking).documentsLoading : false;
  const enrichmentError = 'enrichmentError' in booking ? (booking as EnrichedBooking).enrichmentError : false;
  const documentsTimeout = 'documentsTimeout' in booking ? (booking as EnrichedBooking).documentsTimeout : false;
  const isCompleted = status === 'completed';
  const isConfirmed = status === 'confirmed';
  
  // ✅ AIRBNB : Détecter si c'est une réservation Airbnb
  const isAirbnb = 'airbnb_booking_id' in booking || 
                   'source' in booking && (booking as any).source === 'airbnb' ||
                   ('booking_reference' in booking && 
                    typeof (booking as any).booking_reference === 'string' && 
                    /^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]+/.test((booking as any).booking_reference));

  // 5. Palette visuelle des barres (alignée sur la maquette)
  const { barColor, textColor } = (() => {
    if (isConflict) {
      return {
        barColor: BOOKING_COLORS.conflict.hex, // Rouge vif
        textColor: 'text-white'
      };
    }

    // ✅ AIRBNB : Réservation Airbnb avec couleur rose/orange distinctive
    if (isAirbnb) {
      return {
        barColor: '#FF385C', // Rose Airbnb principal (#FF385C)
        textColor: 'text-white'
      };
    }

    // Réservation terminée : barre gris clair comme "Samy"
    if (isCompleted) {
      return {
        barColor: BOOKING_COLORS.completed.hex,
        textColor: 'text-slate-900'
      };
    }

    // Réservation confirmée : barre verte comme les réservations confirmées
    if (isConfirmed) {
      return {
        barColor: BOOKING_COLORS.confirmed?.hex || BOOKING_COLORS.manual.hex,
        textColor: 'text-white'
      };
    }

    // Réservation active / en attente : barre noire comme "Abdelilah"
    return {
      barColor: BOOKING_COLORS.manual.hex,
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
        // ✅ AIRBNB : Dégradé rose/orange pour les réservations Airbnb
        background: isAirbnb 
          ? 'linear-gradient(135deg, #FF5A5F 0%, #FF385C 50%, #E61E4D 100%)'
          : barColor,
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
              <X
                className="w-full h-full"
                style={{ color: '#DC2626' }}
                strokeWidth={2}
              />
            ) : documentsLoading ? ( // ✅ Spinner si documents en cours de chargement (pas de timeout)
              <Loader2 
                className="w-full h-full animate-spin text-gray-400" 
                strokeWidth={2}
                title="Documents en cours de chargement..."
              />
            ) : documentsTimeout ? ( // ✅ TIMEOUT GRACIEUX : Icône discrète (point d'interrogation) pour timeout
              <HelpCircle 
                className="w-full h-full text-gray-500" 
                strokeWidth={2}
                title="Documents en attente de vérification manuelle (timeout) - La réservation reste affichée"
              />
            ) : enrichmentError ? ( // ✅ Icône d'erreur si l'enrichissement a échoué (non-timeout)
              <AlertCircle 
                className="w-full h-full text-gray-400" 
                strokeWidth={2}
                title="Erreur lors du chargement des documents"
              />
            ) : (
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

          {/* ✅ NOUVEAU : Indicateur de chargement des documents (spinner discret) */}
          {'documentsLoading' in booking && (booking as EnrichedBooking).documentsLoading && (
            <Loader2 
              className="w-3 h-3 text-gray-400 animate-spin flex-shrink-0" 
              strokeWidth={2}
              title="Documents en cours de chargement..."
            />
          )}

          {/* ✅ NOUVEAU : Indicateur d'erreur d'enrichissement (icône grise) */}
          {'enrichmentError' in booking && (booking as EnrichedBooking).enrichmentError && !(booking as EnrichedBooking).documentsLoading && (
            <AlertCircle 
              className="w-3 h-3 text-gray-400 flex-shrink-0" 
              strokeWidth={2}
              title="Documents non disponibles temporairement"
            />
          )}
        </div>
      )}
    </div>
  );
});
