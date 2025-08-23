import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Erreur d'authentification",
            description: "Une erreur s'est produite lors de la confirmation de votre email",
            variant: "destructive"
          });
          navigate('/auth');
          return;
        }

        if (session) {
          toast({
            title: "Email confirmé !",
            description: "Votre compte a été confirmé avec succès",
            variant: "default"
          });
          navigate('/dashboard');
        } else {
          // No session, redirect to auth
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Confirmation en cours...
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Veuillez patienter pendant que nous confirmons votre email.
          </p>
        </div>
      </div>
    </div>
  );
};
