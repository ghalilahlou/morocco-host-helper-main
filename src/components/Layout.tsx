import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Home, Crown, MessageCircle } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { ContactModal } from '@/components/ContactModal';
interface LayoutProps {
  children?: React.ReactNode;
}
export const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  return <div className="min-h-screen bg-white">
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 md:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button 
                onClick={() => navigate('/dashboard')} 
                className="focus:outline-none transition-transform hover:scale-105"
                aria-label="Retour au tableau de bord"
              >
                <img 
                  src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png" 
                  alt="Checky Logo" 
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 object-contain cursor-pointer" 
                />
              </button>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
            </nav>

            <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-4">
              {/* Mobile: Only icons, Desktop: Full text */}
              <Button 
                variant="outline" 
                onClick={() => setSubscriptionModalOpen(true)}
                size="sm"
                className="flex items-center space-x-1 md:space-x-2 text-primary border-primary hover:bg-primary hover:text-white h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
              >
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline text-xs sm:text-sm md:text-base">Mon Abonnement</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setContactModalOpen(true)}
                size="sm"
                className="flex items-center space-x-1 md:space-x-2 text-foreground border-primary/50 hover:bg-[hsl(var(--brand-2))] hover:text-white h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
              >
                <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline text-xs sm:text-sm md:text-base">Contact</span>
              </Button>
              
              <UserMenu onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8 bg-white min-h-screen">
        <div className="bg-white">
          {children || <Outlet />}
        </div>
      </main>

      <SubscriptionModal 
        open={subscriptionModalOpen} 
        onOpenChange={setSubscriptionModalOpen} 
      />
      
      <ContactModal 
        open={contactModalOpen} 
        onOpenChange={setContactModalOpen} 
      />
    </div>;
};