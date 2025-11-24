/**
 * Centralized booking color constants
 * This ensures consistency across all components that display booking status colors
 * ✅ HARMONISÉ : Couleurs synchronisées avec la palette du dashboard Host (teal/cyan clair et ouvert)
 */

export const BOOKING_COLORS = {
  // ✅ UNIFIÉ : Gris cohérent avec le style du dashboard (slate-400 unifié)
  pending: {
    hex: '#94A3B8', // slate-400 - gris unifié et cohérent avec CalendarGrid
    gradient: 'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 50%, #64748B 100%)',
    tailwind: 'bg-gradient-to-br from-slate-300 to-slate-500',
    text: 'text-slate-700',
    shadow: 'shadow-slate-300/50',
    hover: 'hover:from-slate-400 hover:to-slate-600'
  },
  // ✅ HARMONISÉ : Teal/cyan clair et ouvert pour correspondre au style du dashboard (#8BD7D2 ou #54DEFD)
  completed: {
    hex: '#8BD7D2', // brand-3 - turquoise doux, clair et ouvert comme dans le dashboard
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #8BD7D2 50%, #119DA4 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-300 to-teal-400',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-400 hover:to-teal-500'
  },
  conflict: {
    hex: '#DC2626',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
    tailwind: 'bg-gradient-to-br from-red-500 to-red-700',
    text: 'text-red-800',
    shadow: 'shadow-red-300/50',
    hover: 'hover:from-red-600 hover:to-red-800'
  },
  // ✅ HARMONISÉ : Réservations Airbnb en teal moyen (#119DA4) cohérent avec le dashboard
  airbnb: {
    hex: '#119DA4', // brand-1 - teal moyen du dashboard
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  },
  manual: {
    hex: '#119DA4', // brand-1 - teal moyen du dashboard
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  },
  // ✅ HARMONISÉ : Couleur par défaut en teal moyen (#119DA4) cohérent avec le dashboard
  default: {
    hex: '#119DA4', // brand-1 - teal moyen du dashboard
    gradient: 'linear-gradient(135deg, #54DEFD 0%, #119DA4 50%, #0C7489 100%)',
    tailwind: 'bg-gradient-to-br from-cyan-400 to-teal-600',
    text: 'text-teal-900',
    shadow: 'shadow-cyan-300/50',
    hover: 'hover:from-cyan-500 hover:to-teal-700'
  }
} as const;

export type BookingColorType = keyof typeof BOOKING_COLORS;