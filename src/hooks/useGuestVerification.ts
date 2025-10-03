
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PropertyVerificationToken, GuestSubmission } from '@/types/guestVerification';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export const useGuestVerification = () => {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<PropertyVerificationToken[]>([]);
  const [submissions, setSubmissions] = useState<GuestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ NOUVEAU : Valider un code de réservation Airbnb avec le token
  const validateBookingPassword = async (propertyId: string, password: string, token?: string): Promise<{ valid: boolean; token?: string; error?: string }> => {
    if (!user) return { valid: false, error: 'User not authenticated' };

    try {
      console.log('🔐 Validating Airbnb code:', { propertyId, codeLength: password.length });
      
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
        console.error('❌ Error calling issue-guest-link (resolve):', error);
        return { valid: false, error: error.message || "Erreur de validation" };
      }

      if (!data || !data.success) {
        console.error('❌ Function returned error:', data);
        
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

      console.log('✅ Airbnb code validation successful');
      return { 
        valid: true, 
        token: token, // Retourner le token original
        error: undefined 
      };
    } catch (error) {
      console.error('❌ Error validating Airbnb code:', error);
      return { valid: false, error: "Erreur lors de la validation" };
    }
  };

  // ✅ NOUVEAU : Valider un token avec résolution (pour GuestVerification.tsx)
  const validateTokenWithResolution = async (propertyId: string, token: string, airbnbCode?: string) => {
    try {
      console.log('🔍 Validating token with resolution:', { propertyId, hasCode: !!airbnbCode });
      
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: {
          action: 'resolve',
          propertyId,
          token,
          airbnbCode // Optionnel au début
        }
      });

      if (error) {
        console.error('❌ Token resolution error:', error);
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

      console.log('✅ Token validated successfully');
      return { 
        isValid: true, 
        requiresCode: data.requiresCode,
        propertyId: data.propertyId,
        bookingId: data.bookingId
      };

    } catch (error) {
      console.error('❌ Validation error:', error);
      return { isValid: false, error: 'Erreur de validation' };
    }
  };

  // Generate or get existing token for a property using the edge function
  const generatePropertyVerificationUrl = async (propertyId: string, airbnbBookingId?: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      
      console.log('🔗 Generating verification URL via Edge Function:', { propertyId, airbnbBookingId });
      
      // Use the Edge Function instead of direct database access
      const { data, error } = await supabase.functions.invoke('issue-guest-link', {
        body: { 
          action: 'issue', // Explicite
          propertyId, 
          airbnbCode: airbnbBookingId // Utiliser airbnbCode au lieu de bookingId
        }
      });

      if (error) {
        console.error('❌ Error calling issue-guest-link function:', error);
        toast({
          title: "Erreur",
          description: error.message || "Impossible de créer le lien de vérification",
          variant: "destructive"
        });
        return null;
      }

      if (!data || !data.success) {
        console.error('❌ Function returned error:', data);
        const errorMessage = data?.error || "Réponse invalide du serveur";
        const errorDetails = data?.details ? ` (${JSON.stringify(data.details)})` : '';
        toast({
          title: "Erreur",
          description: `${errorMessage}${errorDetails}`,
          variant: "destructive"
        });
        return null;
      }

      if (!data.url) {
        console.error('❌ No URL returned from Edge Function:', data);
        toast({
          title: "Erreur",
          description: "Aucune URL générée",
          variant: "destructive"
        });
        return null;
      }

      console.log('✅ Generated verification URL via Edge Function:', data.url);
      
      // ✅ NOUVEAU : Informer sur le type de lien
      const linkType = data.requiresCode ? "sécurisé" : "standard";
      const linkDescription = data.requiresCode 
        ? "Ce lien nécessitera le code de réservation Airbnb pour l'accès" 
        : "Lien de vérification standard créé";
      
      // Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(data.url);
        toast({
          title: `Lien ${linkType} généré et copié`,
          description: linkDescription
        });
      } catch (clipboardError) {
        console.warn('⚠️ Failed to copy to clipboard:', clipboardError);
        toast({
          title: `Lien ${linkType} généré`,
          description: linkDescription
        });
      }

      return data.url;
    } catch (error) {
      console.error('❌ Error generating verification URL:', error);
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
        console.error('Error loading verification tokens:', error);
        return;
      }

      setTokens(data || []);
    } catch (error) {
      console.error('Error loading verification tokens:', error);
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
        console.error('Error loading user properties:', propsError);
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
            console.error('Error loading guest submissions for property:', property.id, error);
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
          console.error('Error calling get-guest-documents-unified for property:', property.id, edgeError);
        }
      }
      
      setSubmissions(allSubmissions);
    } catch (error) {
      console.error('Error loading guest submissions:', error);
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
        console.error('Error deactivating token:', error);
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
      console.error('Error deactivating token:', error);
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
        console.error('Error updating submission status:', error);
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
      console.error('Error updating submission status:', error);
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
