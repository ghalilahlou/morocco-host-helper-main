import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Booking } from '@/types/booking';
import { BookingLayout, getBookingDisplayText, getGuestInitials } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { Home } from 'lucide-react';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { EnrichedBooking } from '@/services/guestSubmissionService';

interface CalendarBookingBarProps {
  bookingData: BookingLayout;
  bookingIndex: number;
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
}

export const CalendarBookingBar = memo(({ 
  bookingData, 
  bookingIndex, 
  conflicts, 
  onBookingClick 
}: CalendarBookingBarProps) => {
  const isConflict = conflicts.includes(bookingData.booking.id);
  
  // ✅ CORRIGÉ : Système de couleurs optimisé - Bleu par défaut, rouge uniquement pour conflits
  const getBackgroundColor = () => {
    const c = bookingData.color;
    
    // ✅ PRIORITÉ 1: Rouge UNIQUEMENT pour les conflits
    if (isConflict || c === 'bg-destructive' || c === BOOKING_COLORS.conflict.tailwind) {
      return BOOKING_COLORS.conflict.gradient;
    }
    
    // ✅ PRIORITÉ 2: Vert pour les réservations complétées
    if (c === 'bg-success' || c === BOOKING_COLORS.completed.tailwind) {
      return BOOKING_COLORS.completed.gradient;
    }
    
    // ✅ PRIORITÉ 3: Bleu pour toutes les réservations normales (Airbnb ou manuelles)
    if (bookingData.isAirbnb || c === BOOKING_COLORS.airbnb.tailwind || c === BOOKING_COLORS.manual.tailwind) {
      return BOOKING_COLORS.airbnb.gradient; // Utilise le nouveau bleu turquoise
    }
    
    // ✅ PRIORITÉ 4: Bleu par défaut (au lieu de gris)
    return BOOKING_COLORS.default?.gradient || BOOKING_COLORS.airbnb.gradient;
  };

  // ✅ NOUVEAU : Obtenir la couleur de base opaque (sans gradient) pour le backgroundColor
  const getSolidBackgroundColor = () => {
    const c = bookingData.color;
    
    if (isConflict || c === 'bg-destructive' || c === BOOKING_COLORS.conflict.tailwind) {
      return BOOKING_COLORS.conflict.hex;
    }
    
    if (c === 'bg-success' || c === BOOKING_COLORS.completed.tailwind) {
      return BOOKING_COLORS.completed.hex;
    }
    
    // Bleu turquoise par défaut
    return BOOKING_COLORS.airbnb.hex;
  };

  // Style spécial pour les réservations en conflit avec un motif diagonal
  const getConflictStyle = () => {
    if (!isConflict) return {};
    
    return {
      backgroundImage: `repeating-linear-gradient(
        45deg,
        ${getBackgroundColor()},
        ${getBackgroundColor()} 4px,
        rgba(255,255,255,0.2) 4px,
        rgba(255,255,255,0.2) 8px
      )`,
      border: '1px solid rgba(255,255,255,0.4)'
    };
  };
  
  return (
    <div
      className={`
        text-white rounded-lg flex items-center px-2 md:px-3
        cursor-pointer transition-all duration-300 ease-in-out 
        hover:scale-[1.03] hover:z-[1010] hover:shadow-2xl hover:brightness-110
        ${isConflict ? 'ring-2 ring-red-500 ring-offset-2 shadow-red-600/50 animate-pulse' : 'ring-1 ring-white/40 shadow-lg hover:ring-2 hover:ring-white/60'}
        relative group w-full text-xs font-medium
      `}
      style={{
        // ✅ CORRIGÉ : Utiliser SEULEMENT backgroundColor avec couleur solide OPAQUE (#119DA4)
        // backgroundColor est toujours opaque, contrairement aux gradients qui peuvent être transparents
        // On utilise backgroundColor seul pour garantir une opacité complète
        backgroundColor: isConflict ? BOOKING_COLORS.conflict.hex : getSolidBackgroundColor(),
        minHeight: '100%',
        height: '100%',
        zIndex: 1000 + (bookingData.layer || 0),
        // ✅ CORRIGÉ : Opacité pleine (1) pour toutes les couches - pas de transparence
        opacity: 1,
        // ✅ OPTIMISÉ : Bordure visible pour toutes les couches avec meilleur contraste
        border: `2px solid ${bookingData.layer && bookingData.layer > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'}`,
        // ✅ OPTIMISÉ : Ombres progressives selon la couche pour créer de la profondeur
        boxShadow: (() => {
          const layer = bookingData.layer || 0;
          if (layer === 0) return '0 2px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)';
          if (layer === 1) return '0 3px 8px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.15)';
          if (layer === 2) return '0 4px 10px rgba(0,0,0,0.25), 0 2px 5px rgba(0,0,0,0.2)';
          return '0 5px 12px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.25)';
        })(),
        // ✅ OPTIMISÉ : Légère translation pour créer un effet de "carte empilée"
        transform: `translateY(0px)`,
        // Appliquer le style de conflit si nécessaire
        ...getConflictStyle()
      }}
      onClick={() => onBookingClick(bookingData.booking)}
      title={bookingData.isAirbnb ? 
        `${(bookingData.booking as any).guestName || 'Airbnb'} - Réservation Airbnb` :
        (() => {
          const enriched = bookingData.booking as EnrichedBooking;
          if (enriched.realGuestNames && enriched.realGuestNames.length > 0) {
            const names = enriched.realGuestNames.join(', ');
            return `${names} - ${enriched.realGuestCount} invité(s)`;
          }
          const regular = bookingData.booking as Booking;
          return `${regular.guests[0]?.fullName || 'Client'} - ${regular.guests.length} invité(s)`;
        })()
      }
    >
      {bookingData.isStart && (
        <div className="flex items-center space-x-1.5 text-white w-full min-w-0">
          {/* ✅ AMÉLIORÉ : Avatar optimisé avec meilleures animations et visibilité */}
          <Avatar className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white/40 flex-shrink-0 group-hover:border-white/70 group-hover:scale-110 transition-all duration-300 shadow-md">
            <AvatarFallback className="text-[10px] sm:text-xs bg-white/25 text-white font-bold group-hover:bg-white/35 transition-all duration-300">
              {getGuestInitials(bookingData.booking)}
            </AvatarFallback>
          </Avatar>
          
          {/* ✅ CORRIGÉ : Utilise directement getBookingDisplayText() qui gère déjà tout le nettoyage via getUnifiedBookingDisplayText() */}
          <span className="text-xs sm:text-[12px] font-semibold truncate drop-shadow-md group-hover:drop-shadow-lg transition-all duration-200 leading-tight text-white">
            {getBookingDisplayText(bookingData.booking, true)}
          </span>
          
          {/* ✅ AMÉLIORÉ : Icône Airbnb avec meilleure visibilité */}
          {bookingData.isAirbnb && (
            <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/90 flex-shrink-0 group-hover:text-white group-hover:scale-125 transition-all duration-300 shadow-sm" />
          )}
          
          {/* ✅ AMÉLIORÉ : Indicateur de couche avec meilleure visibilité */}
          {bookingData.layer && bookingData.layer > 0 && (
            <div className="ml-auto bg-white/30 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold shadow-md border border-white/20">
              {bookingData.layer + 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
});