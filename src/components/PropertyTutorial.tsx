import { useState, useEffect, useCallback, CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Link2,
  CalendarDays,
  PlusCircle,
  Eye,
  RefreshCw,
  GraduationCap,
  Sparkles,
  Hand,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useDeviceType } from '@/hooks/use-mobile';
import { useT } from '@/i18n/GuestLocaleProvider';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TutorialStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  tipKey?: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  icon: React.ElementType;
  accentColor: string;
}

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */
const desktopTutorialSteps: TutorialStep[] = [
  { id: 'welcome', titleKey: 'tutorial.desktop.welcome.title', descriptionKey: 'tutorial.desktop.welcome.desc', target: '', position: 'bottom', icon: Sparkles, accentColor: '#55BA9F' },
  { id: 'generate-link', titleKey: 'tutorial.desktop.generateLink.title', descriptionKey: 'tutorial.desktop.generateLink.desc', tipKey: 'tutorial.tip.generateLink', target: '[data-tutorial="generate-link"]', position: 'bottom', icon: Link2, accentColor: '#3B82F6' },
  { id: 'calendar', titleKey: 'tutorial.desktop.calendar.title', descriptionKey: 'tutorial.desktop.calendar.desc', target: '[data-tutorial="calendar"]', position: 'bottom', icon: CalendarDays, accentColor: '#8B5CF6' },
  { id: 'add-reservation', titleKey: 'tutorial.desktop.addReservation.title', descriptionKey: 'tutorial.desktop.addReservation.desc', tipKey: 'tutorial.tip.addReservation', target: '[data-tutorial="add-booking"]', position: 'bottom', icon: PlusCircle, accentColor: '#F59E0B' },
  { id: 'calendar-view', titleKey: 'tutorial.desktop.calendarView.title', descriptionKey: 'tutorial.desktop.calendarView.desc', target: '[data-tutorial="calendar-view"]', position: 'top', icon: Eye, accentColor: '#10B981' },
  { id: 'sync-airbnb', titleKey: 'tutorial.desktop.syncAirbnb.title', descriptionKey: 'tutorial.desktop.syncAirbnb.desc', tipKey: 'tutorial.tip.syncAirbnb', target: '[data-tutorial="sync-airbnb"]', position: 'bottom', icon: RefreshCw, accentColor: '#EC4899' },
  { id: 'tutorial-button', titleKey: 'tutorial.desktop.tutorialButton.title', descriptionKey: 'tutorial.desktop.tutorialButton.desc', target: '[data-tutorial="tutorial-button"]', position: 'bottom', icon: GraduationCap, accentColor: '#6366F1' },
];

const mobileTutorialSteps: TutorialStep[] = [
  { id: 'welcome', titleKey: 'tutorial.mobile.welcome.title', descriptionKey: 'tutorial.mobile.welcome.desc', target: '', position: 'bottom', icon: Sparkles, accentColor: '#55BA9F' },
  { id: 'generate-link', titleKey: 'tutorial.mobile.generateLink.title', descriptionKey: 'tutorial.mobile.generateLink.desc', tipKey: 'tutorial.tip.generateLink', target: '[data-tutorial="generate-link"]', position: 'bottom', icon: Link2, accentColor: '#3B82F6' },
  { id: 'calendar', titleKey: 'tutorial.mobile.calendar.title', descriptionKey: 'tutorial.mobile.calendar.desc', target: '[data-tutorial="calendar"]', position: 'bottom', icon: CalendarDays, accentColor: '#8B5CF6' },
  { id: 'add-reservation', titleKey: 'tutorial.mobile.addReservation.title', descriptionKey: 'tutorial.mobile.addReservation.desc', tipKey: 'tutorial.tip.addReservation', target: '[data-tutorial="add-booking"]', position: 'bottom', icon: PlusCircle, accentColor: '#F59E0B' },
  { id: 'calendar-view', titleKey: 'tutorial.mobile.calendarView.title', descriptionKey: 'tutorial.mobile.calendarView.desc', target: '[data-tutorial="calendar-view"]', position: 'top', icon: Eye, accentColor: '#10B981' },
  { id: 'sync-airbnb', titleKey: 'tutorial.mobile.syncAirbnb.title', descriptionKey: 'tutorial.mobile.syncAirbnb.desc', tipKey: 'tutorial.tip.syncAirbnb', target: '[data-tutorial="sync-airbnb"]', position: 'bottom', icon: RefreshCw, accentColor: '#EC4899' },
  { id: 'tutorial-button', titleKey: 'tutorial.mobile.tutorialButton.title', descriptionKey: 'tutorial.mobile.tutorialButton.desc', target: '[data-tutorial="tutorial-button"]', position: 'bottom', icon: GraduationCap, accentColor: '#6366F1' },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const sheetVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 30 } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.22 } },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const SWIPE_THRESHOLD = 50;
const SLIDE_DIR = { next: 1, prev: -1 } as const;

/* ------------------------------------------------------------------ */
/*  Step content (animated slide)                                      */
/* ------------------------------------------------------------------ */
function StepContent({
  step,
  stepIndex,
  total,
  direction,
  tipText,
  isMobile,
  t,
}: {
  step: TutorialStep;
  stepIndex: number;
  total: number;
  direction: number;
  tipText: string | null;
  isMobile: boolean;
  t: (k: string) => string;
}) {
  const Icon = step.icon;
  const isLast = stepIndex === total - 1;

  return (
    <motion.div
      key={step.id}
      custom={direction}
      initial={{ opacity: 0, x: direction * 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -direction * 60 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col gap-3"
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-3">
        <motion.div
          className="flex items-center justify-center rounded-xl w-10 h-10"
          style={{ backgroundColor: `${step.accentColor}18` }}
          initial={{ scale: 0.6, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
        >
          <Icon className="w-5 h-5" style={{ color: step.accentColor }} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold text-gray-900 leading-tight">
            {t(step.titleKey)}
          </h3>
        </div>
      </div>

      {/* Description */}
      <motion.p
        className="text-[14px] text-gray-600 leading-relaxed"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        {t(step.descriptionKey)}
      </motion.p>

      {/* Pro tip */}
      {tipText && (
        <motion.div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200/60"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-[13px] text-amber-800 leading-snug">{tipText}</span>
        </motion.div>
      )}

      {/* Swipe hint on mobile (only first step) */}
      {isMobile && stepIndex === 0 && (
        <motion.div
          className="flex items-center justify-center gap-1.5 text-gray-400 text-xs pt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Hand className="w-3.5 h-3.5" />
          <span>{t('tutorial.mobile.swipeHint')}</span>
        </motion.div>
      )}

      {/* Target hint */}
      {step.target && isMobile && (
        <motion.p
          className="flex items-center gap-1.5 text-xs font-medium mt-1"
          style={{ color: step.accentColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: step.accentColor }}
          />
          {t('tutorial.mobile.lookAbove')}
        </motion.p>
      )}

      {/* Completion celebration on last step */}
      {isLast && (
        <motion.div
          className="flex items-center gap-2 text-emerald-600 font-medium text-sm pt-1"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('tutorial.mobile.readyText')}</span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress bar                                                       */
/* ------------------------------------------------------------------ */
function ProgressBar({ current, total, accentColor }: { current: number; total: number; accentColor: string }) {
  return (
    <div className="flex gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[3px] rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: i <= current ? accentColor : 'transparent' }}
            initial={false}
            animate={{ width: i < current ? '100%' : i === current ? '100%' : '0%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
interface PropertyTutorialProps {
  onComplete: () => void;
}

export const PropertyTutorial = ({ onComplete }: PropertyTutorialProps) => {
  const t = useT();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [direction, setDirection] = useState(0);
  const deviceType = useDeviceType();
  const isMobile = deviceType === 'mobile';
  const tutorialSteps = isMobile ? mobileTutorialSteps : desktopTutorialSteps;
  const currentStepData = tutorialSteps[currentStep];

  useEffect(() => () => { document.body.style.overflow = 'unset'; }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= tutorialSteps.length) return;
      setDirection(next > currentStep ? SLIDE_DIR.next : SLIDE_DIR.prev);
      setCurrentStep(next);
    },
    [currentStep, tutorialSteps.length],
  );

  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) goTo(currentStep + 1);
    else { setIsVisible(false); onComplete(); }
  }, [currentStep, tutorialSteps.length, goTo, onComplete]);

  const handlePrevious = useCallback(() => { goTo(currentStep - 1); }, [currentStep, goTo]);

  const handleSkip = useCallback(() => { setIsVisible(false); onComplete(); }, [onComplete]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD) handleNext();
      else if (info.offset.x > SWIPE_THRESHOLD) handlePrevious();
    },
    [handleNext, handlePrevious],
  );

  const tipText = currentStepData.tipKey ? t(currentStepData.tipKey) : null;
  const showTip = tipText && tipText !== currentStepData.tipKey;

  /* ---------- Highlight target element ---------- */
  useEffect(() => {
    if (!currentStepData.target) return;
    const el = document.querySelector(currentStepData.target) as HTMLElement | null;
    if (!el) return;

    const scrollOpts: ScrollIntoViewOptions = isMobile
      ? { behavior: 'smooth', block: 'start', inline: 'nearest' }
      : { behavior: 'smooth', block: 'center', inline: 'center' };
    el.scrollIntoView(scrollOpts);

    const id = setTimeout(() => {
      el.style.position = 'relative';
      el.style.zIndex = '1001';
      el.style.boxShadow = `0 0 0 3px ${currentStepData.accentColor}88, 0 0 0 1px white`;
      el.style.borderRadius = '10px';
      el.style.transition = 'box-shadow 0.3s ease, border-radius 0.3s ease';
    }, isMobile ? 400 : 250);

    return () => {
      clearTimeout(id);
      el.style.position = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.borderRadius = '';
      el.style.transition = '';
    };
  }, [currentStep, currentStepData.target, currentStepData.accentColor, isMobile]);

  /* ---------- Desktop tooltip positioning (unchanged logic) ---------- */
  const getTooltipPosition = (): CSSProperties => {
    if (!currentStepData.target) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1002 };
    }
    const element = document.querySelector(currentStepData.target);
    if (!element) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1002 };
    }

    const rect = element.getBoundingClientRect();
    const tw = 340; const th = 280; const m = 16;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const spaces = { top: rect.top, bottom: vh - rect.bottom, left: rect.left, right: vw - rect.right };
    let best: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let max = spaces.bottom;
    if (spaces.top > max && spaces.top >= th + m) { best = 'top'; max = spaces.top; }
    if (spaces.right > max && spaces.right >= tw + m) { best = 'right'; max = spaces.right; }
    if (spaces.left > max && spaces.left >= tw + m) { best = 'left'; }

    let top: number; let left: number; let transform = '';
    switch (best) {
      case 'bottom': top = rect.bottom + m; left = rect.left + rect.width / 2; transform = 'translateX(-50%)'; break;
      case 'top': top = rect.top - th - m; left = rect.left + rect.width / 2; transform = 'translateX(-50%)'; break;
      case 'right': top = rect.top + rect.height / 2; left = rect.right + m; transform = 'translateY(-50%)'; break;
      case 'left': top = rect.top + rect.height / 2; left = rect.left - tw - m; transform = 'translateY(-50%)'; break;
    }
    if (top! < m) top = m;
    if (top! + th > vh - m) top = vh - th - m;
    if (left! < m) left = m;
    if (left! + tw > vw - m) left = vw - tw - m;

    return { position: 'fixed', top: `${top}px`, left: `${left}px`, transform, zIndex: 1002 };
  };

  if (!isVisible) return null;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay */}
          <motion.div
            className={cn('fixed inset-0 z-[1000]', isMobile ? 'bg-black/25' : 'bg-black/30 backdrop-blur-sm')}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden
          />

          {isMobile ? (
            /* ================ MOBILE : Animated bottom sheet ================ */
            <motion.div
              className="fixed inset-x-0 bottom-0 z-[1002] flex flex-col rounded-t-3xl bg-white shadow-2xl"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Handle + progress */}
              <div className="px-5 pt-3 pb-1 space-y-3">
                <div className="flex justify-center">
                  <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar
                    current={currentStep}
                    total={tutorialSteps.length}
                    accentColor={currentStepData.accentColor}
                  />
                  <span className="text-xs font-semibold text-gray-400 tabular-nums whitespace-nowrap">
                    {currentStep + 1}/{tutorialSteps.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                    aria-label={t('tutorial.close') ?? 'Fermer'}
                  >
                    <X className="h-4.5 w-4.5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Swipeable content */}
              <motion.div
                className="flex-1 overflow-hidden px-5 pb-2 min-h-[180px]"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                style={{ touchAction: 'pan-y' }}
              >
                <AnimatePresence mode="wait" custom={direction}>
                  <StepContent
                    step={currentStepData}
                    stepIndex={currentStep}
                    total={tutorialSteps.length}
                    direction={direction}
                    tipText={showTip ? tipText : null}
                    isMobile
                    t={t}
                  />
                </AnimatePresence>
              </motion.div>

              {/* Navigation buttons */}
              <div className="px-5 pt-1 pb-1 space-y-2">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className="min-h-[48px] flex-1 gap-1.5 text-sm rounded-xl border-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('tutorial.previous')}
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="min-h-[48px] flex-1 gap-1.5 text-sm rounded-xl text-white"
                    style={{ backgroundColor: currentStepData.accentColor }}
                  >
                    {currentStep === tutorialSteps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}
                    {currentStep < tutorialSteps.length - 1 && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {t('tutorial.skip')}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ================ DESKTOP : Floating card ================ */
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            >
              <Card
                className="fixed z-[1002] w-[90vw] max-w-[340px] mx-4 sm:w-[340px] shadow-2xl border-2"
                style={{
                  ...getTooltipPosition(),
                  borderColor: `${currentStepData.accentColor}40`,
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <ProgressBar
                      current={currentStep}
                      total={tutorialSteps.length}
                      accentColor={currentStepData.accentColor}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      className="shrink-0 h-7 w-7 p-0 rounded-full"
                      aria-label={t('tutorial.close') ?? 'Fermer'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1">
                    <div
                      className="flex items-center justify-center rounded-lg w-8 h-8"
                      style={{ backgroundColor: `${currentStepData.accentColor}15` }}
                    >
                      <currentStepData.icon className="w-4 h-4" style={{ color: currentStepData.accentColor }} />
                    </div>
                    <CardTitle className="text-[17px]">{t(currentStepData.titleKey)}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <CardDescription className="text-sm">
                    {t(currentStepData.descriptionKey)}
                  </CardDescription>
                  {showTip && (
                    <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 border border-amber-200/50">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-amber-800 leading-snug">{tipText}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                      className="gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('tutorial.previous')}
                    </Button>
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {currentStep + 1}/{tutorialSteps.length}
                    </Badge>
                    <Button
                      onClick={handleNext}
                      size="sm"
                      className="gap-1.5 text-white"
                      style={{ backgroundColor: currentStepData.accentColor }}
                    >
                      {currentStep === tutorialSteps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}
                      {currentStep < tutorialSteps.length - 1 && <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
