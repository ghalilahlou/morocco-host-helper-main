import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X, 
  Home, 
  Calendar, 
  Users, 
  Settings, 
  Plus,
  Bell,
  Search
} from 'lucide-react';

interface MobileNavigationProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onNewBooking?: () => void;
}

export const MobileNavigation = ({ 
  currentPage = 'dashboard', 
  onNavigate,
  onNewBooking 
}: MobileNavigationProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Accueil', color: 'text-blue-600' },
    { id: 'calendar', icon: Calendar, label: 'Calendrier', color: 'text-green-600' },
    { id: 'guests', icon: Users, label: 'Clients', color: 'text-purple-600' },
    { id: 'settings', icon: Settings, label: 'Paramètres', color: 'text-gray-600' },
  ];

  const handleNavigate = (pageId: string) => {
    onNavigate?.(pageId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Header Mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMenuOpen(true)}
            className="h-10 w-10"
          >
            <Menu className="w-6 h-6" />
          </Button>
          
          <h1 className="text-lg font-semibold text-gray-900">
            Morocco Host Helper
          </h1>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Menu Hamburger Full Screen */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Menu Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Menu</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMenuOpen(false)}
                  className="h-10 w-10"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Menu Items */}
              <div className="p-4 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center space-x-4 p-4 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600' : item.color}`} />
                      <span className={`text-left font-medium ${
                        isActive ? 'text-blue-900' : 'text-gray-700'
                      }`}>
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="absolute bottom-6 left-4 right-4">
                <Button 
                  onClick={() => {
                    onNewBooking?.();
                    setIsMenuOpen(false);
                  }}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nouvelle Réservation
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around py-2">
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate(item.id)}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className={`text-xs font-medium ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* FAB (Floating Action Button) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onNewBooking}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-30"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </>
  );
};
