import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ContractSignature } from '@/components/ContractSignature';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/i18n/GuestLocaleProvider';

export const ContractSigning: React.FC = () => {
  const { propertyId, token, airbnbBookingId } = useParams<{ propertyId: string; token: string; airbnbBookingId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const t = useT();
  
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [isContractSigned, setIsContractSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContractData = async () => {
      if (!propertyId || !token) {
        setError(t('guest.invalidLink.desc'));
        setIsLoading(false);
        return;
      }

      try {
        // Verify token and get submission data using edge function
        const { data: tokenVerification, error: tokenError } = await supabase.functions.invoke('resolve-guest-link', {
          body: { 
            propertyId, 
            token,
            airbnbCode: airbnbBookingId 
          }
        });

        if (tokenError || !tokenVerification) {
          setError(t('guest.invalidLink.desc'));
          setIsLoading(false);
          return;
        }

        // Convert response to match expected structure
        const tokenData = {
          id: tokenVerification.tokenId,
          property_id: propertyId,
          token: token,
          is_active: true
        };
        const propertyData = tokenVerification.property;

        setTokenData(tokenData);
        setPropertyData(propertyData);

        // If data passed via navigation state (to avoid RLS reads), use it directly
        const navState = (location as any)?.state || {};
        if (navState?.bookingData) {
          setSubmissionData({
            id: navState.bookingId || 'temp',
            token_id: tokenVerification.id,
            booking_data: navState.bookingData,
            guest_data: navState.guestData,
            document_urls: navState.guestData?.documentUrls ?? [],
            status: 'completed',
          });
          setIsLoading(false);
          return;
        }

        // Get the guest submission data using edge function (safer with RLS)
        const { data: guestDocs, error: submissionError } = await supabase.functions.invoke('list-guest-docs', {
          body: { propertyId: propertyId }
        });

        console.log('📍 Guest docs query result:', { guestDocs, submissionError });
        console.log('🔍 TOKEN VERIFICATION ID:', tokenData.id);

        // Find the most recent submission for this property
        const latestSubmission = guestDocs && Array.isArray(guestDocs) && guestDocs.length > 0 
          ? guestDocs[0] // Already sorted by created_at desc in edge function
          : null;

        console.log('📍 Submission query result:', { latestSubmission, submissionError });
        console.log('🔍 TOKEN VERIFICATION ID:', tokenData.id);
        console.log('🔍 SUBMISSION DATA:', latestSubmission);

        if (latestSubmission) {
          // Transform edge function response to expected format
          const transformedSubmission = {
            id: latestSubmission.id,
            token_id: tokenData.id,
            booking_data: {
              guests: [{
                fullName: latestSubmission.fullName,
                documentType: latestSubmission.documentType,
                documentNumber: latestSubmission.documentNumber
              }]
            },
            guest_data: {
              guests: [{
                fullName: latestSubmission.fullName,
                documentType: latestSubmission.documentType,
                documentNumber: latestSubmission.documentNumber
              }]
            },
            document_urls: latestSubmission.files?.map((f: any) => f.url) || [],
            status: 'completed'
          };
          
          setSubmissionData(transformedSubmission);
          
          // Check if contract is already signed using RPC
          const { data: signature, error: signatureError } = await (supabase as any).rpc('check_contract_signature', {
            p_submission_id: latestSubmission.id
          });

          console.log('📍 Signature check result:', { signature, signatureError });

          if (signature) {
            setIsContractSigned(true);
          }
        } else {
          // No submission found - create minimal booking data structure from token verification
          console.log('📍 No submission found, using token verification data for contract signing');
          
          // Create minimal structure needed for contract signing
          const mockSubmissionData = {
            id: 'temp-contract-signing',
            token_id: tokenData.id,
            booking_data: {
              id: tokenVerification.bookingId || `temp-${propertyId}`,
              checkInDate: new Date().toISOString().split('T')[0], // Fallback date
              checkOutDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
              numberOfGuests: 1,
              guests: [{
                fullName: 'Guest User',
                documentType: 'passport',
                documentNumber: 'TBD'
              }]
            },
            guest_data: {
              guests: [{
                fullName: 'Guest User',
                documentType: 'passport',
                documentNumber: 'TBD'
              }]
            },
            status: 'completed'
          };
          
          console.log('📍 Using minimal mock submission data for contract signing:', mockSubmissionData);
          setSubmissionData(mockSubmissionData);
        }

      } catch (error) {
        console.error('Error loading contract data:', error);
        setError(t('guest.contract.errorGeneric'));
      } finally {
        setIsLoading(false);
      }
    };

    loadContractData();
  }, [propertyId, token]);

  const handleSignatureComplete = async (signatureData: string) => {
    try {
      // The signature is already linked during creation

      setIsContractSigned(true);
      toast({
        title: t('guest.contract.signed.title'),
        description: t('guest.contract.signed.desc'),
      });
    } catch (error) {
      console.error('Error completing signature:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="p-8">
          <CardContent className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>{t('guest.contract.loading')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive">{t('guest.contract.errorTitle')}</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              <Home className="w-4 h-4 mr-2" />
              {t('guest.contract.backHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isContractSigned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md bg-[hsl(var(--surface-white))]">
          <CardContent className="text-center space-y-4">
            <img src="/lovable-uploads/4288912e-fd68-4284-b900-7ee68839a115.png" alt="Icône de validation" className="w-16 h-16 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">{t('guest.contract.signed.title')}</h2>
            <p className="text-muted-foreground">
              {t('guest.contract.signed.desc')}
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                {t('guest.contract.signed.thanks')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!submissionData || !submissionData.booking_data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">{t('guest.contract.missingData.title')}</h2>
            <p className="text-muted-foreground">
              {t('guest.contract.missingData.desc')}
            </p>
            <Button 
              onClick={() => navigate(`/guest-verification/${propertyId}/${token}`)}
              className="w-full"
            >
              {t('guest.contract.missingData.cta')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ContractSignature
      bookingData={submissionData.booking_data}
      propertyData={propertyData}
      guestData={submissionData.guest_data}
      documentUrls={submissionData.document_urls}
      onBack={() => navigate(`/guest-verification/${propertyId}/${token}`)}
      onSignatureComplete={handleSignatureComplete}
    />
  );
};