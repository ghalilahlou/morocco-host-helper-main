import { memo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConflictCadranReservation {
  id: string;
  displayName: string;
  startFormatted: string; // "25/09"
  endFormatted: string;   // "28/09"
}

interface ConflictCadranProps {
  reservations: ConflictCadranReservation[];
  onDelete: (id: string) => void;
  /** Au clic sur une ligne (hors bouton supprimer), ouvre le détail de la réservation (police, contrat, etc.) */
  onSelectReservation?: (id: string) => void;
  onClose?: () => void;
  deletingIds?: Set<string>;
  className?: string;
}

/**
 * Petit cadran Figma : liste des réservations en conflit sur une période,
 * avec message et bouton supprimer (x) par réservation.
 */
export const ConflictCadran = memo(({
  reservations,
  onDelete,
  onSelectReservation,
  onClose,
  deletingIds = new Set(),
  className,
}: ConflictCadranProps) => {
  if (reservations.length === 0) return null;

  return (
    <div
      className={cn(
        'absolute z-10 box-border p-4',
        'min-w-[200px] max-w-[min(320px,calc(100vw-2rem))]',
        className
      )}
      style={{
        background: '#FFFFFF',
        border: '1px solid #FDFDF9',
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
        borderRadius: '25px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Vous avez un conflit sur cette période.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Veuillez supprimer les réservations en trop
          </p>
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-slate-400 hover:text-slate-600"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {reservations.map((r) => {
          const isDeleting = deletingIds.has(r.id);
          return (
            <li
              key={r.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl border-l-4 px-2.5 py-2',
                'border-red-500 bg-red-50/90 text-red-900',
                onSelectReservation && 'cursor-pointer hover:bg-red-100/90 transition-colors',
                isDeleting && 'opacity-60'
              )}
              role={onSelectReservation ? 'button' : undefined}
              tabIndex={onSelectReservation ? 0 : undefined}
              title={onSelectReservation ? 'Cliquer pour voir le détail de la réservation (police, contrat, etc.)' : undefined}
              onClick={onSelectReservation && !isDeleting
                ? (e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    onSelectReservation(r.id);
                  }
                : undefined}
              onKeyDown={onSelectReservation && !isDeleting
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectReservation(r.id);
                    }
                  }
                : undefined}
            >
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {r.displayName} • {r.startFormatted} – {r.endFormatted}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 text-red-400 hover:text-red-600 hover:bg-red-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
                disabled={isDeleting}
                aria-label={`Supprimer ${r.displayName}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

ConflictCadran.displayName = 'ConflictCadran';
