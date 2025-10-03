/**
 * Enhanced Loader Component avec différents styles d'animation
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedLoaderProps {
  type?: 'spinner' | 'dots' | 'pulse' | 'security';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export const EnhancedLoader: React.FC<EnhancedLoaderProps> = ({
  type = 'spinner',
  size = 'md',
  message,
  className
}) => {
  const sizeConfig = {
    sm: { loader: 'h-4 w-4', text: 'text-xs', container: 'gap-2' },
    md: { loader: 'h-6 w-6', text: 'text-sm', container: 'gap-3' },
    lg: { loader: 'h-8 w-8', text: 'text-base', container: 'gap-4' }
  };

  const config = sizeConfig[size];

  const renderLoader = () => {
    switch (type) {
      case 'spinner':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className={cn(config.loader, "text-blue-600")} />
          </motion.div>
        );

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: "easeInOut"
                }}
                className={cn(
                  "rounded-full bg-gradient-to-r from-blue-500 to-teal-500",
                  size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4'
                )}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={cn(
              config.loader,
              "rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            )}
          />
        );

      case 'security':
        return (
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            <Shield className={cn(config.loader, "text-green-600")} />
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0, 0.5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={cn(
                "absolute inset-0 rounded-full border-2 border-green-400",
                config.loader
              )}
            />
          </motion.div>
        );

      default:
        return (
          <Loader2 className={cn(config.loader, "animate-spin text-blue-600")} />
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex flex-col items-center justify-center",
        config.container,
        className
      )}
    >
      {renderLoader()}
      
      {message && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "font-medium text-gray-600 text-center",
            config.text
          )}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
};

// Composant de loading en plein écran
export const FullScreenLoader: React.FC<{
  message?: string;
  type?: EnhancedLoaderProps['type'];
}> = ({ message = "Chargement...", type = 'security' }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div className="text-center">
        <EnhancedLoader 
          type={type} 
          size="lg" 
          message={message} 
          className="mb-4" 
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-1 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full"
        />
      </div>
    </motion.div>
  );
};
