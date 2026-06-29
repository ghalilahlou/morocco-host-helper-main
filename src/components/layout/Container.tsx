import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * <Container> — largeur de contenu centrée + padding horizontal cohérent.
 *
 * Source unique pour les marges latérales (cf. REFONTE_MOBILE_FRONTEND.md §1.6),
 * à la place des `max-w-… mx-auto px-4 sm:px-6 lg:px-8` recopiés partout.
 */
const SIZE_MAP = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const;

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Largeur maximale. Défaut: lg. */
  size?: keyof typeof SIZE_MAP;
  as?: React.ElementType;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "lg", as, children, ...props }, ref) => {
    const Comp = (as ?? "div") as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          SIZE_MAP[size],
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Container.displayName = "Container";

export default Container;
