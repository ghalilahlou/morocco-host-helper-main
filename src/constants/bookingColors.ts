/**
 * Centralized booking color constants
 * ✅ AIRBNB : Couleurs synchronisées avec la palette Airbnb
 */

export const BOOKING_COLORS = {
  // ✅ AIRBNB : Gris clair pour réservations complétées (comme dans Figma)
  pending: {
    hex: '#E5E5E5', // Gris clair Airbnb
    gradient: 'linear-gradient(135deg, #F7F7F7 0%, #E5E5E5 50%, #D4D4D4 100%)',
    tailwind: 'bg-gray-200',
    text: 'text-gray-900',
    shadow: 'shadow-gray-300/50',
    hover: 'hover:bg-gray-300'
  },
  // ✅ AIRBNB : Gris clair avec checkmark vert pour réservations complétées
  completed: {
    hex: '#E5E5E5', // Gris clair Airbnb (comme dans Figma)
    gradient: 'linear-gradient(135deg, #F7F7F7 0%, #E5E5E5 50%, #D4D4D4 100%)',
    tailwind: 'bg-gray-200',
    text: 'text-gray-900',
    shadow: 'shadow-gray-300/50',
    hover: 'hover:bg-gray-300'
  },
  // ✅ AIRBNB : Rouge Airbnb (#FF5A5F) pour conflits/annulations
  conflict: {
    hex: '#FF5A5F', // Rouge Airbnb principal
    gradient: 'linear-gradient(135deg, #FF5A5F 0%, #E04A4F 50%, #C73A3F 100%)',
    tailwind: 'bg-red-500',
    text: 'text-white',
    shadow: 'shadow-red-300/50',
    hover: 'hover:bg-red-600'
  },
  // ✅ AIRBNB : Gris foncé/noir pour certaines réservations (comme dans Figma)
  airbnb: {
    hex: '#1A1A1A', // Gris foncé/noir Airbnb
    gradient: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 50%, #0A0A0A 100%)',
    tailwind: 'bg-gray-900',
    text: 'text-white',
    shadow: 'shadow-gray-800/50',
    hover: 'hover:bg-gray-800'
  },
  manual: {
    hex: '#1A1A1A', // Gris foncé/noir Airbnb
    gradient: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 50%, #0A0A0A 100%)',
    tailwind: 'bg-gray-900',
    text: 'text-white',
    shadow: 'shadow-gray-800/50',
    hover: 'hover:bg-gray-800'
  },
  // ✅ AIRBNB : Couleur par défaut - gris foncé
  default: {
    hex: '#1A1A1A', // Gris foncé/noir Airbnb
    gradient: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 50%, #0A0A0A 100%)',
    tailwind: 'bg-gray-900',
    text: 'text-white',
    shadow: 'shadow-gray-800/50',
    hover: 'hover:bg-gray-800'
  }
} as const;

export type BookingColorType = keyof typeof BOOKING_COLORS;