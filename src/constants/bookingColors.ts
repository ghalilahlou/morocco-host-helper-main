/**
 * Centralized booking color constants
 * This ensures consistency across all components that display booking status colors
 */

export const BOOKING_COLORS = {
  // ✅ AMÉLIORÉ : Système de couleurs optimisé avec gradients plus riches et meilleur contraste
  pending: {
    hex: '#9CA3AF',
    gradient: 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 50%, #6B7280 100%)',
    tailwind: 'bg-gradient-to-br from-gray-300 to-gray-500',
    text: 'text-gray-700',
    shadow: 'shadow-gray-300/50',
    hover: 'hover:from-gray-400 hover:to-gray-600'
  },
  completed: {
    hex: '#059669', 
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)',
    tailwind: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    text: 'text-emerald-800',
    shadow: 'shadow-emerald-300/50',
    hover: 'hover:from-emerald-600 hover:to-emerald-800'
  },
  conflict: {
    hex: '#DC2626',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
    tailwind: 'bg-gradient-to-br from-red-500 to-red-700',
    text: 'text-red-800',
    shadow: 'shadow-red-300/50',
    hover: 'hover:from-red-600 hover:to-red-800'
  },
  // ✅ AMÉLIORÉ : Réservations en bleu turquoise (#119DA4) avec gradient plus riche pour meilleure visibilité
  airbnb: {
    hex: '#119DA4',
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  },
  manual: {
    hex: '#119DA4',
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  },
  // ✅ AMÉLIORÉ : Couleur par défaut en bleu turquoise avec gradient plus riche
  default: {
    hex: '#119DA4',
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  }
} as const;

export type BookingColorType = keyof typeof BOOKING_COLORS;