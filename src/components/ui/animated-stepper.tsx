import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'current' | 'completed' | 'error';
}

interface AnimatedStepperProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  showConnectors?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AnimatedStepper: React.FC<AnimatedStepperProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  showConnectors = true,
  size = 'md',
  className
}) => {
  const sizeConfig = {
    sm: { circle: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-sm' },
    md: { circle: 'w-12 h-12', icon: 'w-5 h-5', text: 'text-base' },
    lg: { circle: 'w-16 h-16', icon: 'w-6 h-6', text: 'text-lg' }
  };

  const config = sizeConfig[size];

  const getStepStatus = (index: number): Step['status'] => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const getStatusColors = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-500',
          border: 'border-green-500',
          text: 'text-green-600',
          glow: 'shadow-green-500/25'
        };
      case 'current':
        return {
          bg: 'bg-blue-500',
          border: 'border-blue-500',
          text: 'text-blue-600',
          glow: 'shadow-blue-500/25'
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          border: 'border-red-500',
          text: 'text-red-600',
          glow: 'shadow-red-500/25'
        };
      default:
        return {
          bg: 'bg-gray-300',
          border: 'border-gray-300',
          text: 'text-gray-500',
          glow: 'shadow-gray-500/10'
        };
    }
  };

  const getStatusIcon = (status: Step['status'], step: Step) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className={cn(config.icon, "text-white")} />;
      case 'current':
        return step.icon ? (
          <step.icon className={cn(config.icon, "text-white")} />
        ) : (
          <Clock className={cn(config.icon, "text-white")} />
        );
      case 'error':
        return <AlertCircle className={cn(config.icon, "text-white")} />;
      default:
        return step.icon ? (
          <step.icon className={cn(config.icon, "text-gray-600")} />
        ) : (
          <div className={cn(config.icon, "bg-gray-600 rounded-full")} />
        );
    }
  };

  const StepConnector = ({ isActive }: { isActive: boolean }) => (
    <motion.div
      className={cn(
        "transition-colors duration-300",
        orientation === 'horizontal' ? 'flex-1 h-0.5' : 'w-0.5 flex-1',
        isActive ? 'bg-blue-500' : 'bg-gray-300'
      )}
      initial={{ scaleX: orientation === 'horizontal' ? 0 : 1, scaleY: orientation === 'vertical' ? 0 : 1 }}
      animate={{ scaleX: 1, scaleY: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{
        transformOrigin: orientation === 'horizontal' ? 'left' : 'top'
      }}
    />
  );

  return (
    <div className={cn(
      "flex items-center",
      orientation === 'horizontal' ? 'flex-row space-x-4' : 'flex-col space-y-4',
      className
    )}>
      {steps.map((step, index) => {
        const status = step.status || getStepStatus(index);
        const colors = getStatusColors(status);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 300 
              }}
              className={cn(
                "flex items-center",
                orientation === 'horizontal' ? 'flex-col text-center space-y-2' : 'flex-row space-x-3'
              )}
            >
              {/* Step Circle */}
              <motion.div
                animate={status === 'current' ? {
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    `0 0 0 0 ${colors.bg.replace('bg-', '')}20`,
                    `0 0 0 8px ${colors.bg.replace('bg-', '')}10`,
                    `0 0 0 0 ${colors.bg.replace('bg-', '')}20`
                  ]
                } : {}}
                transition={{ duration: 2, repeat: status === 'current' ? Infinity : 0 }}
                className={cn(
                  "relative flex items-center justify-center rounded-full border-2 shadow-lg transition-all duration-300",
                  config.circle,
                  colors.bg,
                  colors.border,
                  colors.glow,
                  status === 'pending' && 'bg-white'
                )}
              >
                {/* Animated Background for Current Step */}
                {status === 'current' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/30"
                  />
                )}
                
                {getStatusIcon(status, step)}
              </motion.div>

              {/* Step Content */}
              <div className={cn(
                orientation === 'horizontal' ? 'text-center' : 'text-left'
              )}>
                <motion.h4
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className={cn(
                    "font-semibold transition-colors duration-300",
                    config.text,
                    colors.text
                  )}
                >
                  {step.title}
                </motion.h4>
                
                {step.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    className="text-sm text-gray-500 mt-1 max-w-32"
                  >
                    {step.description}
                  </motion.p>
                )}
              </div>
            </motion.div>

            {/* Connector */}
            {showConnectors && !isLast && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.4 }}
                className={cn(
                  "flex items-center justify-center",
                  orientation === 'horizontal' ? 'flex-1 px-2' : 'py-2'
                )}
              >
                <StepConnector isActive={index < currentStep} />
              </motion.div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
