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
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractDateOnly } from '@/utils/dateUtils';

export function VerifyToken() {
  const { token, reservationCode } = useParams<{ token: string; reservationCode?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // ✅ Debug : Log au chargement
  useEffect(() => {
    console.log('🔍 [VerifyToken] Composant monté', { token, url: window.location.href });
    setDebugInfo(`Token: ${token || 'N/A'}, URL: ${window.location.href}`);
  }, [token]);

  // ✅ Redirection automatique vers GuestVerification avec dates pré-remplies
  useEffect(() => {
    console.log('🔄 [VerifyToken] useEffect déclenché', { token, retryCount });
    
    if (!token) {
      console.error('❌ [VerifyToken] Token manquant');
      setError("Le lien de vérification est invalide ou malformé");
      setIsRedirecting(false);
      return;
    }

    // Résoudre le token pour obtenir le propertyId et rediriger
    const resolveAndRedirect = async () => {
      setIsRedirecting(true);
      setError(null);
      
      try {
        console.log('🔄 [VerifyToken] Résolution automatique du token et redirection vers GuestVerification...');
        console.log('🔗 [VerifyToken] Token reçu:', token);
        
        // ✅ Récupérer property_id via RPC (anon n'a pas accès direct à property_verification_tokens)
        const { data: tokenRows, error: tokenError } = await (supabase as any)
          .rpc('resolve_guest_token', { p_token: token });
        const tokenData = Array.isArray(tokenRows) && tokenRows.length > 0 ? tokenRows[0] : null;

        console.log('📦 [VerifyToken] Résultat requête token:', { tokenData, tokenError });

        if (tokenError) {
          console.error('❌ [VerifyToken] Erreur base de données:', tokenError);
          setError("Erreur de connexion. Vérifiez votre connexion internet et réessayez.");
          setIsRedirecting(false);
          return;
        }

        if (!tokenData) {
          console.error('❌ [VerifyToken] Token non trouvé dans la base de données');
          setError("Ce lien de vérification n'existe pas ou a été supprimé.");
          setIsRedirecting(false);
          return;
        }

        // Vérifier si le token est actif
        if (!tokenData.is_active) {
          console.error('❌ [VerifyToken] Token désactivé');
          setError("Ce lien a été désactivé. Demandez un nouveau lien à votre hôte.");
          setIsRedirecting(false);
          return;
        }

        // Vérifier si le token n'est pas expiré
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          console.error('❌ [VerifyToken] Token expiré');
          setError("Ce lien a expiré. Demandez un nouveau lien à votre hôte.");
          setIsRedirecting(false);
          return;
        }

        const propertyId = tokenData.property_id;

        // ✅ RÉCUPÉRATION DATES : priorité 1) booking par code résa, 2) métadonnées du token
        let urlParams = '';
        try {
          // Si code de réservation dans l'URL → chercher la réservation pour pré-remplir les dates
          if (reservationCode && reservationCode.trim()) {
            const decodedCode = decodeURIComponent(reservationCode.trim());
            const { data: bookingRows, error: bookingError } = await (supabase as any)
              .rpc('get_booking_dates_for_guest', {
                p_property_id: propertyId,
                p_booking_reference: decodedCode,
              });
            const bookingData = Array.isArray(bookingRows) && bookingRows.length > 0 ? bookingRows[0] : null;

            if (!bookingError && bookingData) {
              const startDate = extractDateOnly(bookingData.check_in_date);
              const endDate = extractDateOnly(bookingData.check_out_date);
              const guests = bookingData.number_of_guests || 1;
              const guestName = bookingData.guest_name || '';

              urlParams = `?startDate=${startDate}&endDate=${endDate}&guests=${guests}&airbnbCode=${encodeURIComponent(decodedCode)}`;
              if (guestName && guestName.trim() !== '') {
                urlParams += `&guestName=${encodeURIComponent(guestName)}`;
              }
              console.log('✅ [VerifyToken] Dates extraites du booking (code résa):', { startDate, endDate, guests });
            }
          }

          // Fallback : métadonnées du token (déjà incluses dans tokenData via RPC)
          if (!urlParams && tokenData?.metadata) {
            const metadata = tokenData.metadata as any;
            console.log('📦 [VerifyToken] Métadonnées récupérées:', metadata);

            const reservationData = metadata.reservationData || metadata;

            if (reservationData?.startDate && reservationData?.endDate) {
              const startDate = extractDateOnly(reservationData.startDate);
              const endDate = extractDateOnly(reservationData.endDate);
              const guests = reservationData.numberOfGuests || 1;
              const airbnbCode = reservationData.airbnbCode || 'INDEPENDENT_BOOKING';
              const guestName = reservationData.guestName || '';

              urlParams = `?startDate=${startDate}&endDate=${endDate}&guests=${guests}&airbnbCode=${airbnbCode}`;
              if (guestName && guestName.trim() !== '') {
                urlParams += `&guestName=${encodeURIComponent(guestName)}`;
              }
              console.log('✅ [VerifyToken] Dates extraites des métadonnées:', { startDate, endDate, guests });
            }
          }
        } catch (e) {
          console.warn('⚠️ [VerifyToken] Erreur récupération dates (non bloquante):', e);
        }

        console.log('✅ [VerifyToken] Token résolu, redirection vers GuestVerification:', propertyId);
        
        // ✅ REDIRECTION AVEC DATES
        const redirectUrl = `/guest-verification/${propertyId}/${token}${urlParams}`;
        navigate(redirectUrl, { replace: true });
      } catch (error) {
        console.error('❌ [VerifyToken] Erreur inattendue:', error);
        setError("Une erreur inattendue s'est produite. Veuillez réessayer.");
        setIsRedirecting(false);
      }
    };

    resolveAndRedirect();
  }, [token, reservationCode, navigate, retryCount]);

  // ✅ Fonction de réessai
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // ✅ Afficher une page d'erreur si le token est invalide
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Lien invalide
          </h1>
          
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.location.href = 'https://checky.ma'}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </div>
          
          <p className="mt-6 text-xs text-gray-400">
            Si le problème persiste, contactez votre hôte pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Afficher un loader pendant la redirection avec info de debug
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="text-center max-w-md">
        <EnhancedLoader />
        <p className="mt-4 text-slate-600 font-medium">Chargement en cours...</p>
        <p className="mt-2 text-sm text-slate-400">Vérification de votre lien de réservation</p>
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <p className="mt-4 text-xs text-slate-300 font-mono break-all">{debugInfo}</p>
        )}
        <p className="mt-6 text-xs text-slate-400">
          Si cette page reste affichée, vérifiez votre connexion internet.
        </p>
      </div>
    </div>
  );
}
