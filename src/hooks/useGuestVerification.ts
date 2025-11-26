
import { useState, useEffect } from 'react';
import runtime from '@/config/runtime';
import { supabase } from '@/integrations/supabase/client';
import { PropertyVerificationToken, GuestSubmission } from '@/types/guestVerification';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/utils/dateUtils';

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
      userEvent?: Event; // ✅ NOUVEAU : Préserver le contexte utilisateur
    }
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      
      // Log masqué en production (sauf le lien final)
      
      // ✅ UNIFIÉ : Toujours utiliser ics_direct avec dates pré-remplies
      // Si pas de reservationData, créer un objet minimal avec les dates disponibles
      const finalReservationData = options?.reservationData || (airbnbBookingId ? {
        airbnbCode: airbnbBookingId,
        startDate: new Date(), // Date par défaut si non fournie
        endDate: new Date(),
        numberOfGuests: 1
      } : undefined);

      // Use the Edge Function instead of direct database access
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: { 
          action: 'issue', // Explicite
          propertyId, 
          airbnbCode: airbnbBookingId, // Utiliser airbnbCode au lieu de bookingId
          linkType: 'ics_direct', // ✅ FORCÉ : Toujours utiliser ics_direct avec dates pré-remplies
          reservationData: finalReservationData // Données de réservation pour liens directs
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
        // Erreur masquée en production
        toast({
          title: "Erreur",
          description: "Aucun token généré",
          variant: "destructive"
        });
        return null;
      }

      // ✅ UNIFIÉ : Toujours utiliser la logique ics_direct avec dates pré-remplies
      // Tous les liens redirigent directement vers GuestVerification avec les dates dans l'URL
      const reservationData = options?.reservationData || finalReservationData;
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (reservationData) {
        // ✅ CORRIGÉ : Inclure les dates dans l'URL en utilisant formatLocalDate pour éviter décalage timezone
        // ⚠️ IMPORTANT : DTEND dans ICS est exclusif, donc endDate est déjà la date de départ réelle
        const startDateObj = reservationData.startDate instanceof Date 
          ? reservationData.startDate 
          : new Date(reservationData.startDate);
        const endDateObj = reservationData.endDate instanceof Date 
          ? reservationData.endDate 
          : new Date(reservationData.endDate);
        
        // Utiliser formatLocalDate pour éviter le décalage timezone (format YYYY-MM-DD en heure locale)
        startDate = formatLocalDate(startDateObj);
        endDate = formatLocalDate(endDateObj);
        
        // ✅ NOUVEAU : Nettoyer le nom du guest avant de l'inclure dans l'URL
        // ⚠️ IMPORTANT : Ne pas inclure guestName dans l'URL si vide pour éviter le double formulaire
        const cleanGuestName = cleanGuestNameForUrl(reservationData.guestName || '');
        const numberOfGuests = reservationData.numberOfGuests || 1;
        const airbnbCode = reservationData.airbnbCode || airbnbBookingId || 'INDEPENDENT_BOOKING';
        
        // Construire l'URL avec ou sans guestName selon s'il est valide
        let urlParams = `startDate=${startDate}&endDate=${endDate}&guests=${numberOfGuests}&airbnbCode=${airbnbCode}`;
        
        // ✅ CORRIGÉ : Ne pas ajouter guestName si vide pour éviter les problèmes de double formulaire
        if (cleanGuestName && cleanGuestName.trim() !== '') {
          const guestName = encodeURIComponent(cleanGuestName);
          urlParams += `&guestName=${guestName}`;
        }
        
        const clientUrl = `${runtime.urls.app.base}/guest-verification/${propertyId}/${data.token}?${urlParams}`;
        
        // ✅ SEUL LOG VISIBLE EN PRODUCTION : Le lien de réservation
        // Ce log est toujours visible car il est nécessaire pour copier le lien
        console.log('🔗 [LIEN DE RÉSERVATION]:', clientUrl);
        
        // ✅ COPIE ROBUSTE : Utiliser copyToClipboard avec fallback
        let copySuccess = false;
        try {
          const { copyToClipboard } = await import('@/lib/clipboardUtils');
          copySuccess = await copyToClipboard(clientUrl);
          
          if (copySuccess) {
            // Log masqué en production
            toast({
              title: "Lien copié !",
              description: "Le lien de vérification a été copié dans le presse-papiers",
            });
          } else {
            // Log masqué en production
            toast({
              title: "Lien généré",
              description: `Le lien a été généré. Copiez-le manuellement : ${clientUrl}`,
              duration: 10000,
            });
          }
        } catch (copyError) {
          // Erreur masquée en production
          // Le lien est déjà affiché dans le toast
          toast({
            title: "Lien généré",
            description: `Le lien a été généré mais n'a pas pu être copié automatiquement. Lien: ${clientUrl}`,
            duration: 10000,
          });
        }
        
        return clientUrl;
      } else {
        // Fallback : Si pas de dates, rediriger vers GuestVerification sans dates (l'utilisateur devra les saisir)
        const clientUrl = `${runtime.urls.app.base}/guest-verification/${propertyId}/${data.token}`;
        // ✅ SEUL LOG VISIBLE EN PRODUCTION : Le lien de réservation (fallback)
        console.log('🔗 [LIEN DE RÉSERVATION]:', clientUrl);
        
        // ✅ COPIE ROBUSTE : Utiliser copyToClipboard avec fallback
        let copySuccess = false;
        try {
          const { copyToClipboard } = await import('@/lib/clipboardUtils');
          copySuccess = await copyToClipboard(clientUrl);
          
          if (copySuccess) {
            // Log masqué en production
            toast({
              title: "Lien copié !",
              description: "Le lien de vérification a été copié dans le presse-papiers",
            });
          } else {
            // Log masqué en production
            toast({
              title: "Lien généré",
              description: `Le lien a été généré. Copiez-le manuellement : ${clientUrl}`,
              duration: 10000,
            });
          }
        } catch (copyError) {
          // Erreur masquée en production
          // Le lien est déjà affiché dans le toast
          toast({
            title: "Lien généré",
            description: `Le lien a été généré mais n'a pas pu être copié automatiquement. Lien: ${clientUrl}`,
            duration: 10000,
          });
        }
        
        return clientUrl;
      }
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
  const loadVerificationTokens = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Use direct database access since no Edge Function exists for this
      const { data, error } = await supabase
        .from('property_verification_tokens')
        .select(`
          *,
          properties (
            id,
            name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Erreur masquée en production
        return;
      }

      setTokens(data || []);
    } catch (error) {
      // Erreur masquée en production
    } finally {
      setIsLoading(false);
    }
  };

  // Load guest submissions for user's properties
  const loadGuestSubmissions = async () => {
    if (!user) return;

    try {
      // Get all properties for this user first
      const { data: userProperties, error: propsError } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user.id);

      if (propsError || !userProperties?.length) {
        // Erreur masquée en production
        setSubmissions([]);
        return;
      }

      // Use the new edge function to get guest submissions for all user properties
      const allSubmissions: GuestSubmission[] = [];
      
      for (const property of userProperties) {
        try {
          const { data, error } = await supabase.functions.invoke('get-guest-documents-unified', {
            body: { propertyId: property.id }
          });

          if (error) {
            // Erreur masquée en production
            continue;
          }

          // Transform the edge function response to match our types
          // The function returns { success, bookings, totalBookings }
          const bookings = data?.bookings || [];
          const propertySubmissions: GuestSubmission[] = bookings.map((booking: any) => ({
            id: booking.bookingId || `booking-${Date.now()}-${Math.random()}`,
            token_id: '', // Not returned by edge function, but not needed for display
            booking_data: null, // Not returned by edge function
            guest_data: {
              guests: [{
                fullName: 'Guest', // Default name since the function doesn't return guest names
                documentType: 'identity', // Default type
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

          allSubmissions.push(...propertySubmissions);
        } catch (edgeError) {
          // Erreur masquée en production
        }
      }
      
      setSubmissions(allSubmissions);
    } catch (error) {
      // Erreur masquée en production
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

  useEffect(() => {
    if (user) {
      loadVerificationTokens();
      loadGuestSubmissions();
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
