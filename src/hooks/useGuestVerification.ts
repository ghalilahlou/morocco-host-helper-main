
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

  // Generate or get existing token for a property using the edge function
  const generatePropertyVerificationUrl = async (propertyId: string, airbnbBookingId?: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      
      console.log('🔗 Generating verification URL via direct database access:', { propertyId, airbnbBookingId });
      
      // Temporary workaround: Create token directly in database
      // Generate a new token
      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      
      const tokenData: any = {
        property_id: propertyId,
        token: token,
        is_active: true
      };

      // Add booking_id if provided
      if (airbnbBookingId) {
        tokenData.booking_id = airbnbBookingId;
      }

      const { data: newToken, error: createError } = await supabase
        .from('property_verification_tokens')
        .insert(tokenData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating token directly:', createError);
        toast({
          title: "Erreur",
          description: "Impossible de créer le lien de vérification",
          variant: "destructive"
        });
        return null;
      }

      // Generate the full URL
      const origin = window.location.origin;
      const link = airbnbBookingId 
        ? `${origin}/welcome/${propertyId}/${token}/${airbnbBookingId}`
        : `${origin}/welcome/${propertyId}/${token}`;

      console.log('✅ Generated verification URL directly:', link);
      toast({
        title: "Lien généré",
        description: "Lien de vérification créé avec succès"
      });

      return link;
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
          const { data, error } = await supabase.functions.invoke('list-guest-docs', {
            body: { propertyId: property.id }
          });

          if (error) {
            console.error('Error loading guest submissions for property:', property.id, error);
            continue;
          }

          // Transform the edge function response to match our types
          const propertySubmissions: GuestSubmission[] = (data || []).map((item: any) => ({
            id: item.id,
            token_id: '', // Not returned by edge function, but not needed for display
            booking_data: null, // Not returned by edge function
            guest_data: {
              guests: [{
                fullName: item.fullName,
                documentType: item.documentType,
                documentNumber: item.documentNumber
              }]
            },
            document_urls: item.files?.map((f: any) => f.url) || [],
            signature_data: undefined,
            submitted_at: item.createdAt,
            status: 'completed' as const, // Default status since edge function doesn't return this
            reviewed_by: undefined,
            reviewed_at: undefined,
            created_at: item.createdAt,
            updated_at: item.createdAt
          }));

          allSubmissions.push(...propertySubmissions);
        } catch (edgeError) {
          console.error('Error calling list-guest-docs for property:', property.id, edgeError);
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
    loadVerificationTokens,
    loadGuestSubmissions,
    deactivateToken,
    updateSubmissionStatus
  };
};
