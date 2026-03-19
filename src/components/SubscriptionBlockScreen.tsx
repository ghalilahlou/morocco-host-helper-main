import React from 'react';
import { Shield, CreditCard, MessageCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface SubscriptionBlockScreenProps {
  reason?: 'consumption_exhausted' | 'admin_blocked';
  onContactSupport?: () => void;
}

export const SubscriptionBlockScreen: React.FC<SubscriptionBlockScreenProps> = ({
  reason = 'consumption_exhausted',
  onContactSupport,
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isAdminBlocked = reason === 'admin_blocked';

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <Shield className="h-8 w-8 text-amber-600" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {isAdminBlocked ? 'Compte suspendu' : 'Consommation épuisée'}
        </h1>

        <p className="text-gray-600 mb-6">
          {isAdminBlocked
            ? "Votre compte a été mis en pause par l'équipe Checky. Pour réactiver votre accès, veuillez contacter le support."
            : "Vous avez atteint la limite de vérifications de votre plan. Pour continuer à utiliser Checky, veuillez régler votre abonnement ou contacter le support."}
        </p>

        <div className="space-y-3">
          <Button
            className="w-full bg-[#55BA9F] hover:bg-[#4aa88e] text-white"
            onClick={() => {
              if (onContactSupport) {
                onContactSupport();
              } else {
                window.location.href = 'mailto:support@checky.ma?subject=Réactivation compte Checky';
              }
            }}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Contacter le support
          </Button>

          {!isAdminBlocked && (
            <Button
              variant="outline"
              className="w-full border-[#55BA9F] text-[#55BA9F] hover:bg-[#55BA9F]/10"
              onClick={() => {
                // Ouvrir la modal Mon forfait - on passe par le parent
                window.dispatchEvent(new CustomEvent('open-subscription-modal'));
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Gérer mon abonnement
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-gray-500 hover:text-gray-700"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Besoin d'aide ? support@checky.ma
        </p>
      </div>
    </div>
  );
};
