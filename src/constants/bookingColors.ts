/**
 * Centralized booking color constants
 * This ensures consistency across all components that display booking status colors
 */

export const BOOKING_COLORS = {
  // Nouveau système de couleurs simplifié (3 catégories uniquement)
  pending: {
    hex: '#D0D0D0',
    tailwind: 'bg-gray-300',
    text: 'text-gray-400'
  },
  completed: {
    hex: '#00BD9D', 
    tailwind: 'bg-[hsl(var(--teal-hover))]',
    text: 'text-[hsl(var(--teal-hover))]'
  },
  conflict: {
    hex: '#DC2626',
    tailwind: 'bg-red-600',
    text: 'text-red-600'
  }
} as const;

export type BookingColorType = keyof typeof BOOKING_COLORS;