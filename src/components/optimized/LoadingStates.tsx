import React, { memo } from 'react';
import { Loader2, Skeleton } from 'lucide-react';

// Skeleton pour les cartes de booking
export const BookingCardSkeleton = memo(() => (
  <div className="border rounded-lg p-4 space-y-3 animate-pulse">
    <div className="flex justify-between items-start">
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      <div className="h-5 bg-gray-200 rounded w-16"></div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="flex gap-2 pt-2">
      <div className="h-8 bg-gray-200 rounded flex-1"></div>
      <div className="h-8 bg-gray-200 rounded w-20"></div>
    </div>
  </div>
));

BookingCardSkeleton.displayName = 'BookingCardSkeleton';

// Skeleton pour les listes
export const ListSkeleton = memo(({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <BookingCardSkeleton key={index} />
    ))}
  </div>
));

ListSkeleton.displayName = 'ListSkeleton';

// Composant de chargement avec animation
export const LoadingSpinner = memo(({ 
  size = 'default',
  text = 'Chargement...',
  className = ''
}: {
  size?: 'sm' | 'default' | 'lg';
  text?: string;
  className?: string;
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

// Composant de chargement pour les pages
export const PageLoading = memo(({ 
  title = 'Chargement en cours...',
  description = 'Veuillez patienter pendant que nous chargeons vos données.'
}: {
  title?: string;
  description?: string;
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-blue-600"></div>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  </div>
));

PageLoading.displayName = 'PageLoading';

// Composant de chargement progressif
export const ProgressiveLoading = memo(({
  steps,
  currentStep,
  onComplete
}: {
  steps: string[];
  currentStep: number;
  onComplete?: () => void;
}) => {
  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Étape {currentStep} sur {steps.length}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="text-center">
        <p className="text-sm font-medium">{steps[currentStep - 1]}</p>
      </div>
    </div>
  );
});

ProgressiveLoading.displayName = 'ProgressiveLoading';

// Hook pour la gestion des états de chargement
export const useLoadingState = () => {
  const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>({});

  const setLoading = React.useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  }, []);

  const isLoading = React.useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = React.useMemo(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    loadingStates
  };
};

// Import nécessaire
import React from 'react';




















