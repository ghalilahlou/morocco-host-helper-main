
import { useState, useEffect } from 'react';
import runtime from '@/config/runtime';
import { supabase } from '@/integrations/supabase/client';
import { PropertyVerificationToken, GuestSubmission } from '@/types/guestVerification';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/utils/dateUtils';
import { useT } from '@/i18n/GuestLocaleProvider';

// ✅ NOUVEAU : Fonction pour nettoyer le nom du guest avant de l'inclure dans l'URL
function cleanGuestNameForUrl(guestName: string): string {
  if (!guestName || guestName.trim() === '') return '';
  
  // Nettoyer le nom des éléments indésirables
  let cleanedName = guestName.trim();
  
  // Supprimer les patterns communs qui ne sont pas des noms
  const unwantedPatterns = [
    /phone\s*number/i,
    /phone/i,
    /address/i,
    /adresse/i,
    /email/i,
    /tel/i,
    /mobile/i,
    /fax/i,
    /^[A-Z0-9]{6,}$/, // Codes alphanumériques longs
    /^\d+$/, // Que des chiffres
    /^[A-Z]{2,}\d+$/, // Combinaisons lettres+chiffres comme "JBFDPhone"
    /\n/, // Retours à la ligne
    /\r/, // Retours chariot
  ];
  
  for (const pattern of unwantedPatterns) {
    if (pattern.test(cleanedName)) {
      // Log masqué en production
      return ''; // Retourner vide si le nom contient des éléments indésirables
    }
  }
  
  // Vérifier que le nom contient au moins des lettres
  if (!/[a-zA-Z]/.test(cleanedName)) {
    // Log masqué en production
    return '';
  }
  
  // Nettoyer les espaces multiples et les retours à la ligne
  cleanedName = cleanedName.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Log masqué en production
  return cleanedName;
}

export const useGuestVerification = () => {
  const { user } = useAuth();
  const { toast } = useToast(); // ✅ Utiliser le hook au lieu de l'import direct
  const t = useT();
  const [tokens, setTokens] = useState<PropertyVerificationToken[]>([]);
  const [submissions, setSubmissions] = useState<GuestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ NOUVEAU : Valider un code de réservation Airbnb avec le token
  const validateBookingPassword = async (propertyId: string, password: string, token?: string): Promise<{ valid: boolean; token?: string; error?: string }> => {
    if (!user) return { valid: false, error: 'User not authenticated' };

    try {
      // Log masqué en production
      
      // Utiliser issue-guest-link avec action 'resolve'
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: { 
          action: 'resolve',
          propertyId, 
          token: token || '', // Token requis pour resolve
          airbnbCode: password 
        }
      });

      if (error) {
        // Erreur masquée en production
        return { valid: false, error: error.message || "Erreur de validation" };
      }

      if (!data || !data.success) {
        // Erreur masquée en production
        
        // Gestion des erreurs spécifiques
        if (data?.error === 'code_required') {
          return { valid: false, error: "Code de réservation Airbnb requis" };
        } else if (data?.error === 'invalid_code') {
          return { valid: false, error: "Code de réservation invalide" };
        } else if (data?.error === 'expired') {
          return { valid: false, error: "Lien expiré" };
        }
        
        return { valid: false, error: data?.error || "Réponse invalide du serveur" };
      }

      // Log masqué en production
      return { 
        valid: true, 
        token: token, // Retourner le token original
        error: undefined 
      };
    } catch (error) {
      // Erreur masquée en production
      return { valid: false, error: "Erreur lors de la validation" };
    }
  };

  // ✅ NOUVEAU : Valider un token avec résolution (pour GuestVerification.tsx)
  const validateTokenWithResolution = async (propertyId: string, token: string, airbnbCode?: string) => {
    try {
      // Log masqué en production
      
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: {
          action: 'resolve',
          propertyId,
          token,
          airbnbCode // Optionnel au début
        }
      });

      if (error) {
        // Erreur masquée en production
        return { isValid: false, error: error.message };
      }

      if (!data || !data.success) {
        // Gérer les erreurs spécifiques
        if (data?.error === 'code_required') {
          return { 
            isValid: false, 
            requiresCode: true, 
            error: 'Code de réservation Airbnb requis' 
          };
        } else if (data?.error === 'invalid_code') {
          return { 
            isValid: false, 
            requiresCode: true,
            error: 'Code de réservation invalide' 
          };
        } else if (data?.error === 'expired') {
          return { 
            isValid: false, 
            error: 'Lien expiré' 
          };
        } else {
          return { 
            isValid: false, 
            error: data?.error || 'Token invalide' 
          };
        }
      }

      // Log masqué en production
      return { 
        isValid: true, 
        requiresCode: data.requiresCode,
        propertyId: data.propertyId,
        bookingId: data.bookingId
      };

    } catch (error) {
      // Erreur masquée en production
      return { isValid: false, error: 'Erreur de validation' };
    }
  };

  // Generate or get existing token for a property using the edge function
  const generatePropertyVerificationUrl = async (
    propertyId: string, 
    airbnbBookingId?: string, 
    options?: {
      linkType?: 'ics_direct'; // ✅ UNIFIÉ : Seule la logique ics_direct est utilisée (dates pré-remplies)
      reservationData?: {
        airbnbCode: string;
        startDate: Date;
        endDate: Date;
        guestName?: string;
        numberOfGuests?: number;
      };
      userEvent?: Event | React.SyntheticEvent; // ✅ MOBILE-OPTIMIZED : Préserver l'événement utilisateur pour iOS/Android
      skipCopy?: boolean; // ✅ Si true, retourne l'URL sans copier (pour préchargement + copie synchrone au clic)
    }
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      
      // Log masqué en production (sauf le lien final)
      
      // ✅ MODIFIÉ : Ne pas créer de dates par défaut pour les réservations indépendantes
      // Le guest choisira ses propres dates dans le formulaire
      let finalReservationData = options?.reservationData;
      
      // ✅ SUPPRIMÉ : Ne plus créer de dates par défaut automatiquement
      // Les réservations indépendantes n'auront pas de dates pré-remplies
      // Seules les réservations ICS/Airbnb auront des dates dans l'URL
      
      // ✅ CORRIGÉ : Normaliser les dates avant l'envoi pour éviter les problèmes de sérialisation JSON
      // Les objets Date sont sérialisés en ISO avec timezone, donc on les convertit en chaînes YYYY-MM-DD
      if (finalReservationData) {
        const { formatLocalDate } = await import('@/utils/dateUtils');
        finalReservationData = {
          ...finalReservationData,
          // Convertir les Date objects en chaînes YYYY-MM-DD pour éviter le décalage timezone lors de la sérialisation JSON
          startDate: finalReservationData.startDate instanceof Date 
            ? formatLocalDate(finalReservationData.startDate) as any
            : finalReservationData.startDate,
          endDate: finalReservationData.endDate instanceof Date
            ? formatLocalDate(finalReservationData.endDate) as any
            : finalReservationData.endDate
        };
        
        console.log('📅 [useGuestVerification] Dates normalisées avant envoi:', {
          startDate: finalReservationData.startDate,
          endDate: finalReservationData.endDate,
          airbnbCode: finalReservationData.airbnbCode
        });
      }

      // Use the Edge Function instead of direct database access
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: { 
          action: 'issue', // Explicite
          propertyId, 
          airbnbCode: airbnbBookingId, // Utiliser airbnbCode au lieu de bookingId
          linkType: 'ics_direct', // ✅ FORCÉ : Toujours utiliser ics_direct avec dates pré-remplies
          reservationData: finalReservationData // Données de réservation pour liens directs (dates au format YYYY-MM-DD)
        }
      });

      if (error) {
        // Erreur masquée en production
        toast({
          title: "Erreur",
          description: error.message || "Impossible de créer le lien de vérification",
          variant: "destructive"
        });
        return null;
      }

      if (!data || !data.success) {
        // Erreur masquée en production
        const errorMessage = data?.error || "Réponse invalide du serveur";
        const errorDetails = data?.details ? ` (${JSON.stringify(data.details)})` : '';
        toast({
          title: "Erreur",
          description: `${errorMessage}${errorDetails}`,
          variant: "destructive"
        });
        return null;
      }

      if (!data.token) {
        toast({
          title: "Erreur",
          description: "Aucun token généré",
          variant: "destructive"
        });
        return null;
      }

      // ✅ Utiliser l'URL retournée par l'API (format court /v/token ou /v/token/code pour synced)
      const guestUrl = data.url || `${runtime.urls.app.base}/v/${data.token}`;
      console.log('🔗 [LIEN DE RÉSERVATION]:', guestUrl, data.isSynced ? '(synchronisé)' : '(non synchronisé)');

      if (!options?.skipCopy) {
        try {
          const { copyToClipboardSimple } = await import('@/lib/clipboardSimple');
          const userEvent = options?.userEvent as Event | React.SyntheticEvent | undefined;
          const result = await copyToClipboardSimple(guestUrl, userEvent);
          if (result.success) {
            toast({
              title: t('toast.linkCopied'),
              description: t('toast.linkCopiedDesc'),
            });
          } else {
            toast({
              title: t('toast.linkGenerated'),
              description: result.error || t('toast.linkGeneratedDesc'),
              duration: 10000,
            });
          }
        } catch (copyError: any) {
          console.error('❌ [GUEST VERIFICATION] Erreur copie:', copyError);
          toast({
            title: t('toast.linkGenerated'),
            description: (copyError as Error)?.message || t('toast.linkGeneratedDesc'),
            duration: 10000,
          });
        }
      }
      return guestUrl;
    } catch (error) {
      // Erreur masquée en production (utiliser le toast pour l'utilisateur)
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du lien",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Load verification tokens for user's properties
  // ✅ OPTIMISATION : Cette fonction n'est PAS appelée automatiquement au montage
  // Elle est disponible mais doit être appelée explicitement si nécessaire
  const loadVerificationTokens = async () => {
    if (!user) return;

    try {
      // ✅ OPTIMISATION : Ne pas bloquer le chargement avec setIsLoading
      // setIsLoading(true); // ❌ Supprimé pour ne pas bloquer l'UI
      
      // ✅ OPTIMISATION : Requête simplifiée sans jointure pour éviter les erreurs 500
      // ✅ CORRECTION : Ajouter un timeout court pour éviter les blocages
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification tokens timeout')), 3000)
      );
      
      const queryPromise = supabase
        .from('property_verification_tokens')
        .select('id, property_id, token, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      let result;
      try {
        result = await Promise.race([queryPromise, timeoutPromise]);
      } catch (timeoutErr) {
        console.warn('⏱️ [useGuestVerification] Timeout loading verification tokens (non-bloquant)');
        return; // Continuer sans bloquer
      }

      const { data, error } = result as any;

      if (error) {
        console.warn('⚠️ [useGuestVerification] Erreur chargement tokens (non-bloquant):', error.message);
        return;
      }

      setTokens(data || []);
    } catch (error) {
      // Erreur masquée en production
    }
    // ✅ OPTIMISATION : Pas de finally avec setIsLoading(false) car on n'a pas mis true
  };

  // Load guest submissions for user's properties
  // ✅ OPTIMISATION : Cette fonction est LENTE car elle appelle une edge function pour chaque propriété
  // Elle n'est PAS appelée automatiquement au montage pour ne pas bloquer le dashboard
  const loadGuestSubmissions = async () => {
    if (!user) return;

    try {
      // ✅ OPTIMISATION : Timeout global de 10 secondes pour éviter les blocages
      const GLOBAL_TIMEOUT = 10000;
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Guest submissions global timeout')), GLOBAL_TIMEOUT)
      );

      const loadPromise = (async () => {
        // Get all properties for this user first
        const { data: userProperties, error: propsError } = await supabase
          .from('properties')
          .select('id')
          .eq('user_id', user.id);

        if (propsError || !userProperties?.length) {
          setSubmissions([]);
          return;
        }

        // ✅ OPTIMISATION : Limiter à 3 propriétés max pour éviter les appels multiples
        const limitedProperties = userProperties.slice(0, 3);
        
        // ✅ OPTIMISATION : Appeler en parallèle au lieu de séquentiellement
        const allSubmissions: GuestSubmission[] = [];
        
        const promises = limitedProperties.map(async (property) => {
          try {
            // Timeout individuel de 5 secondes par propriété
            const individualTimeout = new Promise<null>((resolve) => 
              setTimeout(() => resolve(null), 5000)
            );
            
            const fetchPromise = supabase.functions.invoke('get-guest-documents-unified', {
              body: { propertyId: property.id }
            });

            const result = await Promise.race([fetchPromise, individualTimeout]);
            
            if (!result || (result as any).error) {
              return [];
            }

            const data = (result as any).data;
            const bookings = data?.bookings || [];
            return bookings.map((booking: any) => ({
              id: booking.bookingId || `booking-${Date.now()}-${Math.random()}`,
              token_id: '',
              booking_data: null,
              guest_data: {
                guests: [{
                  fullName: 'Guest',
                  documentType: 'identity',
                  documentNumber: 'N/A'
                }]
              },
              document_urls: [
                ...(booking.documents?.identity || []).map((doc: any) => doc.url),
                ...(booking.documents?.contract || []).map((doc: any) => doc.url),
                ...(booking.documents?.police || []).map((doc: any) => doc.url)
              ],
              signature_data: undefined,
              submitted_at: new Date().toISOString(),
              status: 'completed' as const,
              reviewed_by: undefined,
              reviewed_at: undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach(submissions => allSubmissions.push(...submissions));
        
        setSubmissions(allSubmissions);
      })();

      // Attendre avec timeout global
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error: any) {
      // ✅ OPTIMISATION : Log uniquement si ce n'est pas un timeout (cas attendu)
      if (!error?.message?.includes('timeout')) {
        console.warn('⚠️ [useGuestVerification] Erreur chargement submissions (non-bloquant)');
      }
    }
  };

  // Deactivate a verification token
  const deactivateToken = async (tokenId: string): Promise<boolean> => {
    try {
      // Use direct database access since no Edge Function exists for this
      const { error } = await supabase
        .from('property_verification_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) {
        // Erreur masquée en production
        toast({
          title: "Error",
          description: "Failed to deactivate verification link",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Verification link deactivated"
      });

      await loadVerificationTokens();
      return true;
    } catch (error) {
      // Erreur masquée en production
      return false;
    }
  };

  // Update submission status
  const updateSubmissionStatus = async (
    submissionId: string, 
    status: 'pending' | 'completed' | 'reviewed' | 'rejected'
  ): Promise<boolean> => {
    try {
      // Use direct database access since no Edge Function exists for this
      const { error } = await supabase
        .from('guest_submissions')
        .update({ 
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) {
        // Erreur masquée en production
        toast({
          title: "Error",
          description: "Failed to update submission status",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Submission status updated"
      });

      await loadGuestSubmissions();
      return true;
    } catch (error) {
      // Erreur masquée en production
      return false;
    }
  };

  // ✅ OPTIMISATION : Ne PAS charger automatiquement les tokens et submissions au montage
  // Ces données ne sont pas nécessaires immédiatement pour le dashboard
  // Elles seront chargées à la demande (lazy loading) quand l'utilisateur en a besoin
  // Cela accélère significativement le chargement initial du dashboard
  useEffect(() => {
    // ✅ DÉSACTIVÉ : Ces appels bloquaient le chargement initial du dashboard
    // loadVerificationTokens(); // ❌ Retourne souvent une erreur 500
    // loadGuestSubmissions();   // ❌ Fait plusieurs appels lents à l'edge function
    
    // ✅ OPTIONNEL : Charger en arrière-plan après un délai (non-bloquant)
    if (user) {
      const timer = setTimeout(() => {
        // Charger les tokens silencieusement en arrière-plan
        loadVerificationTokens().catch(() => {});
      }, 3000); // Attendre 3 secondes après le chargement initial
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  return {
    tokens,
    submissions,
    isLoading,
    generatePropertyVerificationUrl,
    validateBookingPassword, // ✅ NOUVEAU : Exposer la fonction de validation
    validateTokenWithResolution, // ✅ NOUVEAU : Exposer la nouvelle fonction
    loadVerificationTokens,
    loadGuestSubmissions,
    deactivateToken,
    updateSubmissionStatus
  };
};
