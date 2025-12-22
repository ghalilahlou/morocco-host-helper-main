import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Crown, MessageCircle, Check } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { ContactModal } from '@/components/ContactModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      {/* Header selon modèle Figma */}
      <header className="bg-[#F9F7F2] border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo CHECKY */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => navigate('/dashboard')} 
                className="focus:outline-none transition-transform hover:scale-105 flex items-center space-x-2"
                aria-label="Retour au tableau de bord"
              >
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 md:w-6 md:h-6 text-[#0BD9D0]" />
                  <span className="text-xl md:text-2xl font-bold text-black">CHECKY</span>
                </div>
              </button>
            </div>

            {/* Navigation droite - Desktop: texte complet, Mobile: icônes seulement */}
            <div className="flex items-center space-x-2 md:space-x-4">
              {isMobile ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSubscriptionModalOpen(true)}
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full border-gray-300 hover:bg-gray-50"
                  >
                    <Crown className="w-4 h-4 text-gray-700" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setContactModalOpen(true)}
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full border-gray-300 hover:bg-gray-50"
                  >
                    <MessageCircle className="w-4 h-4 text-gray-700" />
                  </Button>
                  
                  <UserMenu onSignOut={handleSignOut} />
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSubscriptionModalOpen(true)}
                    size="sm"
                    className="flex items-center space-x-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                  >
                    <Crown className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-medium">Mon forfait</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setContactModalOpen(true)}
                    size="sm"
                    className="flex items-center space-x-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                  >
                    <MessageCircle className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-medium">Contact</span>
                  </Button>
                  
                  <UserMenu onSignOut={handleSignOut} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 bg-[#F9F7F2] min-h-screen">
        {children || <Outlet />}
      </main>

      {/* Footer selon modèle Figma */}
      <footer className="bg-[#F9F7F2] border-t border-gray-200/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <span>© 2025 Checky — Tous droits réservés</span>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-gray-700">Mentions légales</a>
              <span>•</span>
              <a href="#" className="hover:text-gray-700">Politique de confidentialité</a>
              <span>•</span>
              <a href="#" className="hover:text-gray-700">CGV</a>
            </div>
            <Select defaultValue="fr">
              <SelectTrigger className="w-[140px] h-8 text-sm border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français (FR)</SelectItem>
                <SelectItem value="en">English (EN)</SelectItem>
                <SelectItem value="ar">العربية (AR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </footer>

      <SubscriptionModal 
        open={subscriptionModalOpen} 
        onOpenChange={setSubscriptionModalOpen} 
      />
      
      <ContactModal 
        open={contactModalOpen} 
        onOpenChange={setContactModalOpen} 
      />
    </div>
  );
};