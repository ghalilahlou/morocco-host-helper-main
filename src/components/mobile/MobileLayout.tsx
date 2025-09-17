import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  fullScreen?: boolean;
  className?: string;
}

export const MobileLayout = ({ 
  children, 
  title,
  showHeader = true,
  showBottomNav = true,
  fullScreen = false,
  className = ""
}: MobileLayoutProps) => {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Mobile Header Space */}
      {showHeader && !fullScreen && (
        <div className="md:hidden h-16" />
      )}

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          ${fullScreen ? 'h-screen' : 'min-h-screen'}
          ${showHeader && !fullScreen ? 'pt-0' : ''}
          ${showBottomNav && !fullScreen ? 'pb-20' : ''}
          ${!fullScreen ? 'px-4 py-6' : ''}
        `}
      >
        {title && !fullScreen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {title}
            </h1>
          </motion.div>
        )}
        
        {children}
      </motion.main>

      {/* Bottom Navigation Space */}
      {showBottomNav && !fullScreen && (
        <div className="md:hidden h-16" />
      )}
    </div>
  );
};
