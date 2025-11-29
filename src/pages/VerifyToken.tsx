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

        // ✅ RÉCUPÉRATION MÉTADONNÉES : Essayer de récupérer les dates depuis les métadonnées
        let urlParams = '';
        try {
          // Récupérer les métadonnées directement depuis la table
          const { data: metadataResult, error: metadataError } = await supabase
            .from('property_verification_tokens')
            .select('metadata')
            .eq('token', token)
            .eq('is_active', true)
            .maybeSingle();

          if (!metadataError && metadataResult?.metadata) {
            const metadata = metadataResult.metadata as any;
            console.log('📦 [VerifyToken] Métadonnées récupérées:', metadata);

            // Extraire reservationData depuis metadata
            const reservationData = metadata.reservationData || metadata;
            
            if (reservationData?.startDate && reservationData?.endDate) {
              // ✅ CORRECTION : Passer les dates en paramètres d'URL pour pré-remplir le formulaire
              const startDate = typeof reservationData.startDate === 'string' 
                ? reservationData.startDate 
                : new Date(reservationData.startDate).toISOString().split('T')[0];
              const endDate = typeof reservationData.endDate === 'string' 
                ? reservationData.endDate 
                : new Date(reservationData.endDate).toISOString().split('T')[0];
              
              const guests = reservationData.numberOfGuests || 1;
              const airbnbCode = reservationData.airbnbCode || 'INDEPENDENT_BOOKING';
              const guestName = reservationData.guestName || '';

              // Construire les paramètres d'URL
              urlParams = `?startDate=${startDate}&endDate=${endDate}&guests=${guests}&airbnbCode=${airbnbCode}`;
              
              if (guestName && guestName.trim() !== '') {
                urlParams += `&guestName=${encodeURIComponent(guestName)}`;
              }

              console.log('✅ [VerifyToken] Dates extraites pour pré-remplissage:', {
                startDate,
                endDate,
                guests,
                airbnbCode,
                guestName: guestName ? '✓' : '✗'
              });
            } else {
              console.warn('⚠️ [VerifyToken] Pas de dates dans les métadonnées');
            }
        } else {
            console.warn('⚠️ [VerifyToken] Impossible de récupérer les métadonnées:', metadataError);
          }
        } catch (e) {
          console.warn('⚠️ [VerifyToken] Erreur lors de la récupération des métadonnées:', e);
        }

        console.log('✅ [VerifyToken] Token résolu, redirection vers GuestVerification:', propertyId);
        
        // ✅ REDIRECTION AVEC DATES : Rediriger vers GuestVerification avec les dates en paramètres
        const redirectUrl = `/guest-verification/${propertyId}/${token}${urlParams}`;
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
