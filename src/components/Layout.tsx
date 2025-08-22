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
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate('/dashboard')} 
                className="focus:outline-none transition-transform hover:scale-105"
                aria-label="Retour au tableau de bord"
              >
                <img 
                  src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png" 
                  alt="Checky Logo" 
                  className="w-32 h-32 md:w-48 md:h-48 object-contain cursor-pointer" 
                />
              </button>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
            </nav>

            <div className="flex items-center space-x-2 md:space-x-4">
              {/* Mobile: Only icons, Desktop: Full text */}
              <Button 
                variant="outline" 
                onClick={() => setSubscriptionModalOpen(true)}
                size="sm"
                className="flex items-center space-x-1 md:space-x-2 text-primary border-primary hover:bg-primary hover:text-white"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Mon Abonnement</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setContactModalOpen(true)}
                size="sm"
                className="flex items-center space-x-1 md:space-x-2 text-foreground border-primary/50 hover:bg-[hsl(var(--brand-2))] hover:text-white"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Contact</span>
              </Button>
              
              <UserMenu onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 bg-white min-h-screen">
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