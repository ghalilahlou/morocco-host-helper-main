import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SimpleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal simple sans Portal pour éviter les erreurs de removeChild
 * Utilisé dans les composants qui peuvent être démontés rapidement
 */
export const SimpleModal = ({ open, onOpenChange, children, className }: SimpleModalProps) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // Délai pour s'assurer que le montage se fait après le cycle de rendu
      const timer = setTimeout(() => setIsMounted(true), 0);
      return () => clearTimeout(timer);
    } else {
      // Délai pour le démontage pour éviter les conflits
      const timer = setTimeout(() => setIsMounted(false), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open && !isMounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[1100] flex items-center justify-center",
        open && isMounted ? "opacity-100" : "opacity-0 pointer-events-none",
        "transition-opacity duration-200"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/80 -z-10" />
      
      {/* Content */}
      <div
        className={cn(
          "relative bg-background border rounded-lg shadow-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-6 w-6"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        {children}
      </div>
    </div>
  );
};

interface SimpleModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const SimpleModalHeader = ({ children, className }: SimpleModalHeaderProps) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}>
    {children}
  </div>
);

interface SimpleModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const SimpleModalTitle = ({ children, className }: SimpleModalTitleProps) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
    {children}
  </h2>
);

interface SimpleModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const SimpleModalDescription = ({ children, className }: SimpleModalDescriptionProps) => (
  <p className={cn("text-sm text-muted-foreground", className)}>
    {children}
  </p>
);


