import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, ChevronRight, ChevronLeft, Lightbulb } from 'lucide-react';
import { CSSProperties } from 'react';
import { useDeviceType } from '@/hooks/use-mobile';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Étapes de tutoriel pour version Desktop
const desktopTutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue dans votre tableau de bord propriété !',
    description: 'Découvrez les fonctionnalités principales pour gérer efficacement votre bien depuis votre ordinateur. Naviguez facilement entre les différentes sections.',
    target: '',
    position: 'bottom'
  },
  {
    id: 'generate-link',
    title: 'Générer le lien client',
    description: 'Cliquez sur "Copier le lien" pour créer un lien unique à partager avec vos clients. Ce lien leur permettra de soumettre leurs documents d\'identité et de signer le contrat en ligne.',
    target: '[data-tutorial="generate-link"]',
    position: 'bottom'
  },
  {
    id: 'calendar',
    title: 'Vue Calendrier',
    description: 'Le bouton "Calendrier" vous permet de visualiser toutes vos réservations dans une vue calendrier. Vous pouvez voir les dates d\'arrivée et de départ de chaque réservation.',
    target: '[data-tutorial="calendar"]',
    position: 'bottom'
  },
  {
    id: 'add-reservation',
    title: 'Ajouter une nouvelle réservation',
    description: 'Cliquez sur "Créer une réservation" pour ajouter manuellement une réservation. Remplissez les informations de vos clients (nom, dates, nombre de personnes).',
    target: '[data-tutorial="add-booking"]',
    position: 'bottom'
  },
  {
    id: 'calendar-view',
    title: 'Consulter le calendrier',
    description: 'Dans cette vue calendrier, vous pouvez voir toutes vos réservations organisées par mois. Cliquez sur une réservation pour la modifier ou générer les documents.',
    target: '[data-tutorial="calendar-view"]',
    position: 'top'
  },
  {
    id: 'sync-airbnb',
    title: 'Synchroniser avec Airbnb',
    description: 'Cliquez sur "Synchronisation" pour connecter votre calendrier Airbnb. Vos réservations Airbnb seront automatiquement importées et affichées dans ce tableau de bord.',
    target: '[data-tutorial="sync-airbnb"]',
    position: 'bottom'
  },
  {
    id: 'tutorial-button',
    title: 'Accéder au tutoriel',
    description: 'Vous pouvez revoir ce tutoriel à tout moment en cliquant sur le bouton "Tutoriel" dans la barre d\'outils en haut de la page.',
    target: '[data-tutorial="tutorial-button"]',
    position: 'bottom'
  }
];

// Étapes de tutoriel pour version Mobile
const mobileTutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue dans votre tableau de bord !',
    description: 'Découvrez comment gérer votre propriété depuis votre mobile. Faites défiler pour voir toutes les fonctionnalités disponibles.',
    target: '',
    position: 'bottom'
  },
  {
    id: 'generate-link',
    title: 'Copier le lien client',
    description: 'Appuyez sur "Copier le lien" pour générer un lien unique. Partagez ce lien avec vos clients par SMS, email ou WhatsApp. Ils pourront ainsi soumettre leurs documents directement depuis leur téléphone.',
    target: '[data-tutorial="generate-link"]',
    position: 'bottom'
  },
  {
    id: 'calendar',
    title: 'Vue Calendrier',
    description: 'Le bouton "Calendrier" affiche toutes vos réservations dans une vue mensuelle optimisée pour mobile. Balayez pour naviguer entre les mois.',
    target: '[data-tutorial="calendar"]',
    position: 'bottom'
  },
  {
    id: 'add-reservation',
    title: 'Créer une réservation',
    description: 'Appuyez sur "Créer une réservation" pour ajouter une nouvelle réservation. Le formulaire s\'ouvrira en plein écran pour une saisie facile sur mobile.',
    target: '[data-tutorial="add-booking"]',
    position: 'bottom'
  },
  {
    id: 'calendar-view',
    title: 'Vue calendrier mobile',
    description: 'Dans cette vue, vous pouvez voir toutes vos réservations. Appuyez sur une réservation pour la modifier ou générer les documents. Balayez vers le haut ou le bas pour voir plus de dates.',
    target: '[data-tutorial="calendar-view"]',
    position: 'top'
  },
  {
    id: 'sync-airbnb',
    title: 'Synchroniser avec Airbnb',
    description: 'Appuyez sur "Synchronisation" pour connecter votre calendrier Airbnb. Vos réservations seront automatiquement importées. Vous recevrez une notification une fois la synchronisation terminée.',
    target: '[data-tutorial="sync-airbnb"]',
    position: 'bottom'
  },
  {
    id: 'tutorial-button',
    title: 'Revoir le tutoriel',
    description: 'Vous pouvez revoir ce tutoriel à tout moment en appuyant sur le bouton "Tutoriel" dans la barre d\'outils en haut de l\'écran.',
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
  const deviceType = useDeviceType();
  
  // Sélectionner les étapes selon le type d'appareil
  const isMobile = deviceType === 'mobile';
  const tutorialSteps = isMobile ? mobileTutorialSteps : desktopTutorialSteps;

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

  // Avoid early return before hooks; render conditionally in JSX instead

  const getTooltipPosition = (): CSSProperties => {
    // On mobile, always center the tooltip for better visibility
    if (isMobile) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1002,
        maxWidth: '90vw',
        width: 'auto'
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
      case 'bottom': {
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
      }

      case 'top': {
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
      }

      case 'right': {
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
      }

      case 'left': {
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
        // Scroll to element first - adapté pour mobile et desktop
        const scrollOptions: ScrollIntoViewOptions = isMobile
          ? {
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            }
          : {
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            };
        
        element.scrollIntoView(scrollOptions);
        
        // Add highlight after a small delay to ensure scroll is complete
        setTimeout(() => {
          (element as HTMLElement).style.position = 'relative';
          (element as HTMLElement).style.zIndex = '1001';
          (element as HTMLElement).style.boxShadow = isMobile
            ? '0 0 0 3px rgba(59, 130, 246, 0.6), 0 0 0 1px white'
            : '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 2px white';
          (element as HTMLElement).style.borderRadius = '8px';
          (element as HTMLElement).style.transition = 'box-shadow 0.2s ease-in-out';
        }, isMobile ? 500 : 300);
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
          (element as HTMLElement).style.transition = '';
        }
      }
    };
  }, [currentStep, currentStepData.target, isMobile]);

  return (
    <>
      {/* Render nothing when hidden to keep hooks order stable */}
      {!isVisible ? null : (
      <>
      {/* Overlay with blur */}
      <div className="fixed inset-0 w-full h-full backdrop-blur-sm bg-black/30 z-[1000]" />
      
      {/* Tutorial Card - Responsive size */}
      <Card 
        className={`fixed z-[1002] shadow-2xl border-2 border-primary/20 ${
          isMobile 
            ? 'w-[90vw] max-w-sm mx-4' 
            : 'w-[90vw] max-w-80 mx-4 sm:w-80'
        }`}
        style={getTooltipPosition()}
      >
        <CardHeader className={`pb-3 ${isMobile ? 'px-4 pt-4' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
              <Badge variant="secondary" className={`${isMobile ? 'text-[10px] px-1.5 py-0' : 'text-xs'}`}>
                {currentStep + 1}/{tutorialSteps.length}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSkip}
              className={`${isMobile ? 'h-7 w-7' : 'h-6 w-6'} p-0`}
            >
              <X className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
            </Button>
          </div>
          <CardTitle className={isMobile ? 'text-base mt-2' : 'text-lg'}>{currentStepData.title}</CardTitle>
        </CardHeader>
        <CardContent className={`pt-0 ${isMobile ? 'px-4 pb-4' : ''}`}>
          <CardDescription className={`${isMobile ? 'text-xs' : 'text-sm'} mb-4 leading-relaxed`}>
            {currentStepData.description}
          </CardDescription>
          
          <div className={`flex items-center ${isMobile ? 'gap-2' : 'justify-between'}`}>
            <Button 
              variant="secondary" 
              size={isMobile ? 'sm' : 'sm'}
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`gap-2 bg-muted/50 hover:bg-muted text-muted-foreground ${isMobile ? 'text-xs px-3 py-1.5 h-8 flex-1' : ''}`}
            >
              <ChevronLeft className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className={isMobile ? 'text-xs' : ''}>Précédent</span>
            </Button>
            <Button 
              onClick={handleNext}
              size={isMobile ? 'sm' : 'sm'}
              className={`gap-2 ${isMobile ? 'text-xs px-3 py-1.5 h-8 flex-1' : ''}`}
            >
              <span className={isMobile ? 'text-xs' : ''}>
                {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
              </span>
              {currentStep === tutorialSteps.length - 1 ? null : (
                <ChevronRight className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </>
  );
};