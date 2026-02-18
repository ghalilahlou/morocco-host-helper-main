import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ChevronRight, ChevronLeft, Lightbulb } from 'lucide-react';
import { CSSProperties } from 'react';
import { useDeviceType } from '@/hooks/use-mobile';
import { useT } from '@/i18n/GuestLocaleProvider';
import { cn } from '@/lib/utils';

interface TutorialStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Desktop tutorial steps (text via i18n keys)
const desktopTutorialSteps: TutorialStep[] = [
  { id: 'welcome', titleKey: 'tutorial.desktop.welcome.title', descriptionKey: 'tutorial.desktop.welcome.desc', target: '', position: 'bottom' },
  { id: 'generate-link', titleKey: 'tutorial.desktop.generateLink.title', descriptionKey: 'tutorial.desktop.generateLink.desc', target: '[data-tutorial="generate-link"]', position: 'bottom' },
  { id: 'calendar', titleKey: 'tutorial.desktop.calendar.title', descriptionKey: 'tutorial.desktop.calendar.desc', target: '[data-tutorial="calendar"]', position: 'bottom' },
  { id: 'add-reservation', titleKey: 'tutorial.desktop.addReservation.title', descriptionKey: 'tutorial.desktop.addReservation.desc', target: '[data-tutorial="add-booking"]', position: 'bottom' },
  { id: 'calendar-view', titleKey: 'tutorial.desktop.calendarView.title', descriptionKey: 'tutorial.desktop.calendarView.desc', target: '[data-tutorial="calendar-view"]', position: 'top' },
  { id: 'sync-airbnb', titleKey: 'tutorial.desktop.syncAirbnb.title', descriptionKey: 'tutorial.desktop.syncAirbnb.desc', target: '[data-tutorial="sync-airbnb"]', position: 'bottom' },
  { id: 'tutorial-button', titleKey: 'tutorial.desktop.tutorialButton.title', descriptionKey: 'tutorial.desktop.tutorialButton.desc', target: '[data-tutorial="tutorial-button"]', position: 'bottom' }
];

// Mobile tutorial steps (text via i18n keys)
const mobileTutorialSteps: TutorialStep[] = [
  { id: 'welcome', titleKey: 'tutorial.mobile.welcome.title', descriptionKey: 'tutorial.mobile.welcome.desc', target: '', position: 'bottom' },
  { id: 'generate-link', titleKey: 'tutorial.mobile.generateLink.title', descriptionKey: 'tutorial.mobile.generateLink.desc', target: '[data-tutorial="generate-link"]', position: 'bottom' },
  { id: 'calendar', titleKey: 'tutorial.mobile.calendar.title', descriptionKey: 'tutorial.mobile.calendar.desc', target: '[data-tutorial="calendar"]', position: 'bottom' },
  { id: 'add-reservation', titleKey: 'tutorial.mobile.addReservation.title', descriptionKey: 'tutorial.mobile.addReservation.desc', target: '[data-tutorial="add-booking"]', position: 'bottom' },
  { id: 'calendar-view', titleKey: 'tutorial.mobile.calendarView.title', descriptionKey: 'tutorial.mobile.calendarView.desc', target: '[data-tutorial="calendar-view"]', position: 'top' },
  { id: 'sync-airbnb', titleKey: 'tutorial.mobile.syncAirbnb.title', descriptionKey: 'tutorial.mobile.syncAirbnb.desc', target: '[data-tutorial="sync-airbnb"]', position: 'bottom' },
  { id: 'tutorial-button', titleKey: 'tutorial.mobile.tutorialButton.title', descriptionKey: 'tutorial.mobile.tutorialButton.desc', target: '[data-tutorial="tutorial-button"]', position: 'bottom' }
];

interface PropertyTutorialProps {
  onComplete: () => void;
}

export const PropertyTutorial = ({ onComplete }: PropertyTutorialProps) => {
  const t = useT();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const deviceType = useDeviceType();

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
    // On mobile: centré, largeur adaptée, hauteur max pour petit écran, défilement + safe-area
    if (isMobile) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1002,
        maxWidth: 'min(90vw, 400px)',
        minWidth: '280px',
        width: 'calc(100vw - 2rem)',
        maxHeight: 'min(85vh, calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem))',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
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
        // Scroll to element: on mobile keep it in the visible area above the bottom sheet
        const scrollOptions: ScrollIntoViewOptions = isMobile
          ? {
              behavior: 'smooth',
              block: 'start',
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
      {!isVisible ? null : (
        <>
          {/* Overlay : léger sur mobile pour garder l’élément mis en évidence visible au-dessus du sheet */}
          <div
            className={cn(
              'fixed inset-0 z-[1000]',
              isMobile ? 'bg-black/20' : 'bg-black/30 backdrop-blur-sm'
            )}
            aria-hidden
          />

          {isMobile ? (
            /* ——— Mobile : bottom sheet (n’obstrue pas les boutons, contenu en bas) ——— */
            <div
              className="fixed inset-x-0 bottom-0 z-[1002] flex flex-col rounded-t-2xl border-t-2 border-primary/20 bg-white shadow-2xl max-h-[58vh]"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {/* Poignée */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1 rounded-full bg-muted" aria-hidden />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                    <Badge variant="secondary" className="text-xs px-2 py-0.5 shrink-0">
                      {currentStep + 1}/{tutorialSteps.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSkip}
                    className="shrink-0 min-h-[44px] min-w-[44px] h-11 w-11 rounded-full"
                    aria-label={t('tutorial.close') ?? 'Fermer'}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <h3 className="text-lg font-semibold mt-2 text-foreground">
                  {t(currentStepData.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                  {t(currentStepData.descriptionKey)}
                </p>
                {currentStepData.target && (
                  <p className="text-xs text-primary font-medium mt-3 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    {t('tutorial.mobile.lookAbove')}
                  </p>
                )}
                <div className="flex gap-3 mt-5">
                  <Button
                    variant="secondary"
                    size="default"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className="min-h-[48px] flex-1 gap-2 text-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('tutorial.previous')}
                  </Button>
                  <Button
                    onClick={handleNext}
                    size="default"
                    className="min-h-[48px] flex-1 gap-2 text-sm"
                  >
                    {currentStep === tutorialSteps.length - 1
                      ? t('tutorial.finish')
                      : t('tutorial.next')}
                    {currentStep < tutorialSteps.length - 1 && (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full mt-3 py-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {t('tutorial.skip')}
                </button>
              </div>
            </div>
          ) : (
            /* ——— Desktop : carte flottante positionnée près de l’élément ——— */
            <Card
              className="fixed z-[1002] w-[90vw] max-w-80 mx-4 sm:w-80 shadow-2xl border-2 border-primary/20"
              style={getTooltipPosition()}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                    <Badge variant="secondary" className="text-xs">
                      {currentStep + 1}/{tutorialSteps.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="shrink-0 h-6 w-6 p-0"
                    aria-label={t('tutorial.close') ?? 'Fermer'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg">{t(currentStepData.titleKey)}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm mb-4">
                  {t(currentStepData.descriptionKey)}
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
                    <span>{t('tutorial.previous')}</span>
                  </Button>
                  <Button onClick={handleNext} size="sm" className="gap-2">
                    <span>
                      {currentStep === tutorialSteps.length - 1
                        ? t('tutorial.finish')
                        : t('tutorial.next')}
                    </span>
                    {currentStep < tutorialSteps.length - 1 && (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
};