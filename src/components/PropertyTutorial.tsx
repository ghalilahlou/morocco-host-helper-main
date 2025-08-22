import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, ChevronRight, ChevronLeft, Lightbulb } from 'lucide-react';
import { CSSProperties } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue dans votre tableau de bord propriété !',
    description: 'Découvrez les fonctionnalités principales pour gérer efficacement votre bien.',
    target: '',
    position: 'bottom'
  },
  {
    id: 'generate-link',
    title: 'Générer le lien client',
    description: 'Créez un lien unique à partager avec vos clients pour qu\'ils puissent soumettre leurs documents.',
    target: '[data-tutorial="generate-link"]',
    position: 'bottom'
  },
  {
    id: 'add-reservation',
    title: 'Ajouter une nouvelle réservation',
    description: 'Créez manuellement une réservation pour vos clients en renseignant leurs informations.',
    target: '[data-tutorial="add-booking"]',
    position: 'bottom'
  },
  {
    id: 'calendar',
    title: 'Consulter le calendrier',
    description: 'Visualisez toutes vos réservations dans le calendrier et gérez votre planning.',
    target: '[data-tutorial="calendar-view"]',
    position: 'top'
  },
  {
    id: 'sync-airbnb',
    title: 'Synchroniser avec Airbnb',
    description: 'Connectez votre calendrier Airbnb pour importer automatiquement vos réservations.',
    target: '[data-tutorial="sync-airbnb"]',
    position: 'bottom'
  },
  {
    id: 'remaining-actions',
    title: 'Actions restantes',
    description: 'Suivez votre progression dans la configuration complète de votre propriété.',
    target: '[data-tutorial="remaining-actions"]',
    position: 'top'
  },
  {
    id: 'tutorial-button',
    title: 'Accéder au tutoriel',
    description: 'Vous pouvez revoir ce tutoriel à tout moment en cliquant sur ce bouton.',
    target: '[data-tutorial="tutorial-button"]',
    position: 'bottom'
  }
];

interface PropertyTutorialProps {
  onComplete: () => void;
}

export const PropertyTutorial = ({ onComplete }: PropertyTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Don't prevent scrolling - user should be able to scroll during tutorial
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const currentStepData = tutorialSteps[currentStep];

  if (!isVisible) return null;

  const getTooltipPosition = (): CSSProperties => {
    // On mobile, always center the tooltip
    if (window.innerWidth < 768) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1002
      };
    }

    if (!currentStepData.target) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1002
      };
    }

    const element = document.querySelector(currentStepData.target);
    if (!element) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1002
      };
    }

    const rect = element.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 250;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate available space in each direction
    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // Determine the best position based on available space
    let bestPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let maxSpace = spaceBottom;

    if (spaceTop > maxSpace && spaceTop >= tooltipHeight + margin) {
      bestPosition = 'top';
      maxSpace = spaceTop;
    }
    if (spaceRight > maxSpace && spaceRight >= tooltipWidth + margin) {
      bestPosition = 'right';
      maxSpace = spaceRight;
    }
    if (spaceLeft > maxSpace && spaceLeft >= tooltipWidth + margin) {
      bestPosition = 'left';
      maxSpace = spaceLeft;
    }

    let top: number;
    let left: number;
    let transform = '';

    // Position tooltip based on the determined best position
    switch (bestPosition) {
      case 'bottom':
        top = rect.bottom + margin;
        left = rect.left + (rect.width / 2);
        transform = 'translateX(-50%)';
        
        // Ensure tooltip doesn't go off-screen horizontally
        const leftBoundary = tooltipWidth / 2 + margin;
        const rightBoundary = viewportWidth - tooltipWidth / 2 - margin;
        if (left < leftBoundary) {
          left = leftBoundary;
          transform = 'translateX(-50%)';
        } else if (left > rightBoundary) {
          left = rightBoundary;
          transform = 'translateX(-50%)';
        }
        break;

      case 'top':
        top = rect.top - tooltipHeight - margin;
        left = rect.left + (rect.width / 2);
        transform = 'translateX(-50%)';
        
        // Ensure tooltip doesn't go off-screen horizontally
        const leftBoundaryTop = tooltipWidth / 2 + margin;
        const rightBoundaryTop = viewportWidth - tooltipWidth / 2 - margin;
        if (left < leftBoundaryTop) {
          left = leftBoundaryTop;
          transform = 'translateX(-50%)';
        } else if (left > rightBoundaryTop) {
          left = rightBoundaryTop;
          transform = 'translateX(-50%)';
        }
        break;

      case 'right':
        top = rect.top + (rect.height / 2);
        left = rect.right + margin;
        transform = 'translateY(-50%)';
        
        // Ensure tooltip doesn't go off-screen vertically
        const topBoundary = tooltipHeight / 2 + margin;
        const bottomBoundary = viewportHeight - tooltipHeight / 2 - margin;
        if (top < topBoundary) {
          top = topBoundary;
          transform = 'translateY(-50%)';
        } else if (top > bottomBoundary) {
          top = bottomBoundary;
          transform = 'translateY(-50%)';
        }
        break;

      case 'left':
        top = rect.top + (rect.height / 2);
        left = rect.left - tooltipWidth - margin;
        transform = 'translateY(-50%)';
        
        // Ensure tooltip doesn't go off-screen vertically
        const topBoundaryLeft = tooltipHeight / 2 + margin;
        const bottomBoundaryLeft = viewportHeight - tooltipHeight / 2 - margin;
        if (top < topBoundaryLeft) {
          top = topBoundaryLeft;
          transform = 'translateY(-50%)';
        } else if (top > bottomBoundaryLeft) {
          top = bottomBoundaryLeft;
          transform = 'translateY(-50%)';
        }
        break;
    }

    // Final safety check - ensure tooltip is fully within viewport
    if (top < margin) top = margin;
    if (top + tooltipHeight > viewportHeight - margin) top = viewportHeight - tooltipHeight - margin;
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) left = viewportWidth - tooltipWidth - margin;

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      transform,
      zIndex: 1002
    };
  };

  // Highlight target element and scroll to it
  useEffect(() => {
    if (currentStepData.target) {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        // Scroll to element first
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
        
        // Add highlight after a small delay to ensure scroll is complete
        setTimeout(() => {
          (element as HTMLElement).style.position = 'relative';
          (element as HTMLElement).style.zIndex = '1001';
          (element as HTMLElement).style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 2px white';
          (element as HTMLElement).style.borderRadius = '8px';
        }, 300);
      }
    }

    return () => {
      if (currentStepData.target) {
        const element = document.querySelector(currentStepData.target);
        if (element) {
          (element as HTMLElement).style.position = '';
          (element as HTMLElement).style.zIndex = '';
          (element as HTMLElement).style.boxShadow = '';
          (element as HTMLElement).style.borderRadius = '';
        }
      }
    };
  }, [currentStep, currentStepData.target]);

  return (
    <>
      {/* Overlay with blur */}
      <div className="fixed inset-0 w-full h-full backdrop-blur-sm bg-black/30 z-[1000]" />
      
      {/* Tutorial Card - Responsive size */}
      <Card 
        className="fixed z-[1002] w-[90vw] max-w-80 mx-4 sm:w-80 shadow-2xl border-2 border-primary/20"
        style={getTooltipPosition()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-xs">
                {currentStep + 1}/{tutorialSteps.length}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSkip}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="text-sm mb-4 leading-relaxed">
            {currentStepData.description}
          </CardDescription>
          
          <div className="flex items-center justify-between">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="gap-2 bg-muted/50 hover:bg-muted text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            <Button 
              onClick={handleNext}
              size="sm"
              className="gap-2"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
              {currentStep === tutorialSteps.length - 1 ? null : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};