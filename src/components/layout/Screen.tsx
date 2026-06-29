import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * <Screen> — primitive d'écran plein-page (source unique de la refonte mobile).
 *
 * Encapsule les décisions « toujours pareilles » qui étaient jusqu'ici
 * réinventées page par page (cf. REFONTE_MOBILE_FRONTEND.md §1.6) :
 *  - hauteur fiable cross-navigateur (min-h-screen → upgrade dvh automatique
 *    via @supports dans index.css, fallback vh) ;
 *  - safe-area iOS (encoche + barre d'accueil) quand `safe` est activé ;
 *  - pas de débordement horizontal.
 *
 * À privilégier pour tout nouvel écran, et lors de la migration des layouts
 * existants (GuestLayout, Layout, etc.).
 */
export interface ScreenProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Applique les safe-area insets (encoche / home indicator iOS). Défaut: true. */
  safe?: boolean;
  /** Élément HTML rendu. Défaut: div. */
  as?: React.ElementType;
}

export const Screen = React.forwardRef<HTMLDivElement, ScreenProps>(
  ({ className, safe = true, as, children, ...props }, ref) => {
    const Comp = (as ?? "div") as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(
          "min-h-screen w-full overflow-x-hidden",
          safe && "safe-area-all",
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Screen.displayName = "Screen";

export default Screen;
