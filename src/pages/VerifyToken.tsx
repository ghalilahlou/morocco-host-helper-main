/**
 * ✅ SIMPLIFIÉ : Page de redirection automatique vers GuestVerification
 * Route: /verify/:token ou /v/:token (URL courte)
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
        
        // ✅ Récupérer le propertyId et les métadonnées directement depuis la base de données
        // Note: La colonne metadata peut ne pas exister dans tous les environnements
        const { data: tokenData, error: tokenError } = await supabase
          .from('property_verification_tokens')
          .select('property_id')
          .eq('token', token)
          .eq('is_active', true)
          .maybeSingle();

        if (tokenError || !tokenData) {
          console.error('❌ [VerifyToken] Erreur lors de la récupération du token:', tokenError);
          toast({
            title: "Erreur",
            description: "Impossible de résoudre le lien de vérification",
            variant: "destructive",
          });
          setIsRedirecting(false);
          return;
        }

        const propertyId = tokenData.property_id;

        // ✅ Essayer de récupérer les métadonnées via l'Edge Function qui les retourne
        let reservationData: any = null;
        try {
          const { data: resolveData, error: resolveError } = await supabase.functions.invoke('resolve-guest-link', {
            body: { token }
          });
          
          if (!resolveError && resolveData?.success) {
            // Les métadonnées sont stockées dans le token mais pas toujours accessibles via RLS
            // Pour l'instant, on redirige sans les paramètres - ils seront récupérés côté serveur
            console.log('✅ [VerifyToken] Token résolu via Edge Function');
          }
        } catch (e) {
          console.warn('⚠️ [VerifyToken] Impossible de récupérer les métadonnées via Edge Function:', e);
        }

        console.log('✅ [VerifyToken] Token résolu, redirection vers GuestVerification:', propertyId);
        
        // ✅ URL COURTE : Rediriger vers GuestVerification
        // Les métadonnées seront récupérées côté serveur lors de la soumission
        const redirectUrl = `/guest-verification/${propertyId}/${token}`;
        navigate(redirectUrl, { replace: true });
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
