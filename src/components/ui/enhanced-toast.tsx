/**
 * Enhanced Toast Component avec animations améliorées
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedToastProps {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  duration?: number;
}

export const EnhancedToast: React.FC<EnhancedToastProps> = ({
  title,
  description,
  variant = 'info',
  onClose,
  duration = 5000
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const variantConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      descColor: 'text-green-700',
      gradient: 'from-green-500 to-emerald-500'
    },
    error: {
      icon: AlertTriangle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      descColor: 'text-red-700',
      gradient: 'from-red-500 to-pink-500'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      descColor: 'text-yellow-700',
      gradient: 'from-yellow-500 to-orange-500'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      descColor: 'text-blue-700',
      gradient: 'from-blue-500 to-indigo-500'
    }
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
      className={cn(
        "fixed top-4 right-4 z-50 max-w-md",
        "shadow-xl rounded-lg border-2 backdrop-blur-sm",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icône avec animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={cn(
              "p-2 rounded-full bg-gradient-to-r",
              config.gradient
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </motion.div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={cn("font-semibold text-sm", config.titleColor)}
            >
              {title}
            </motion.h3>
            {description && (
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className={cn("text-xs mt-1", config.descColor)}
              >
                {description}
              </motion.p>
            )}
          </div>

          {/* Bouton fermer */}
          {onClose && (
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(), 300);
              }}
              className="p-1 rounded-full hover:bg-white/50 transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" />
            </motion.button>
          )}
        </div>

        {/* Barre de progression */}
        {duration > 0 && (
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: duration / 1000, ease: "linear" }}
            className={cn(
              "h-1 mt-3 rounded-full bg-gradient-to-r",
              config.gradient
            )}
          />
        )}
      </div>
    </motion.div>
  );
};
