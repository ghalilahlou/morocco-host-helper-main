/**
 * ✅ SIMPLIFIÉ : Page de redirection automatique vers GuestVerification
 * Route: /verify/:token
 * Workflow: Redirection automatique vers GuestVerification avec dates pré-remplies
 * 
 * Cette page ne fait que résoudre le token et rediriger vers GuestVerification
 * où les dates sont déjà pré-remplies dans le lien (logique ICS direct)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EnhancedLoader } from '@/components/ui/enhanced-loader';
import { supabase } from '@/integrations/supabase/client';

export function VerifyToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(true);

  // ✅ Redirection automatique vers GuestVerification avec dates pré-remplies
  useEffect(() => {
    if (!token) {
      toast({
        title: "Lien invalide",
        description: "Le lien de vérification est invalide ou malformé",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    // Résoudre le token pour obtenir le propertyId et rediriger
    const resolveAndRedirect = async () => {
      setIsRedirecting(true);
      try {
        console.log('🔄 [VerifyToken] Résolution automatique du token et redirection vers GuestVerification...');
        
        // Appeler resolve-guest-link pour obtenir le propertyId
        const { data, error } = await supabase.functions.invoke('resolve-guest-link', {
          body: { token }
        });

        if (error) {
          console.error('❌ [VerifyToken] Erreur lors de la résolution du token:', error);
          toast({
            title: "Erreur",
            description: "Impossible de résoudre le lien de vérification",
            variant: "destructive",
          });
          setIsRedirecting(false);
          return;
        }

        if (data && data.success && data.propertyId) {
          console.log('✅ [VerifyToken] Token résolu, redirection vers GuestVerification:', data.propertyId);
          // ✅ Rediriger vers GuestVerification avec le propertyId et le token
          // Les dates sont déjà pré-remplies dans le lien (logique ICS direct)
          navigate(`/guest-verification/${data.propertyId}/${token}`, { replace: true });
        } else {
          console.error('❌ [VerifyToken] Réponse invalide de resolve-guest-link:', data);
          toast({
            title: "Erreur",
            description: "Impossible de résoudre le lien de vérification",
            variant: "destructive",
          });
          setIsRedirecting(false);
        }
      } catch (error) {
        console.error('❌ [VerifyToken] Erreur lors de la résolution automatique:', error);
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors de la redirection",
          variant: "destructive",
        });
        setIsRedirecting(false);
      }
    };

    resolveAndRedirect();
  }, [token, navigate, toast]);

  // ✅ Afficher un loader pendant la redirection
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <EnhancedLoader />
        <p className="mt-4 text-slate-600">Redirection en cours...</p>
      </div>
    </div>
  );
}
