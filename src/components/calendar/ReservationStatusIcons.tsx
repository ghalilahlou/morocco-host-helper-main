/**
 * Icônes statut réservation (conflit, check-in non fait).
 * Check-in fait : image dans les barres (imagecheckcalendar.png).
 */
import { cn } from '@/lib/utils';

type IconProps = { className?: string };

/** Check-in non fait : croix noire sur cercle #B3B3B3 */
export function CheckinNotDoneCrossIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={cn('text-black', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 4L10 10M10 4L4 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Conflit : deux segments en croix stylisés */
export function FigmaConflictIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={cn('text-white', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 4L10 10M10 4L4 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
