import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

/**
 * Centralized Contract Service
 * Handles all contract generation and download operations consistently
 */
export class ContractService {
  /**
   * Check if a booking has a signed contract
   */
  static async getSignedContract(bookingId: string) {
    try {
      const { data: signedContracts } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('booking_id', bookingId)
        .limit(1);

      return signedContracts && signedContracts.length > 0 ? signedContracts[0] : null;
    } catch (error) {
      console.error('Error checking for signed contract:', error);
      return null;
    }
  }

  /**
   * Generate and download contract (signed or unsigned)
   * This is the SINGLE source of truth for all contract operations
   */
  static async generateAndDownloadContract(booking: Booking): Promise<{ success: boolean; message: string; variant?: 'default' | 'destructive' }> {
    const bookingId = booking.id;
    const bookingShortId = bookingId.slice(-6);
    
    try {
      console.log(`🔍 ContractService - Starting contract generation for booking: ${bookingId} (#${bookingShortId})`);
      console.log(`🔍 ContractService - Booking data:`, {
        id: booking.id,
        guests: booking.guests?.length || 0,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        source: booking.source,
        reference: booking.bookingReference
      });
      
      // Check if there's a signed contract
      const signedContract = await this.getSignedContract(bookingId);
      console.log(`🔍 ContractService - Signed contract found for #${bookingShortId}:`, !!signedContract);

      if (signedContract) {
        // Generate signed contract via edge function
        console.log(`🔍 ContractService - Generating SIGNED contract via edge function for #${bookingShortId}...`);
        console.log(`🔍 ContractService - Signed contract details:`, {
          signedAt: signedContract.signed_at,
          hasSignature: !!signedContract.signature_data
        });
        
        const { data, error } = await supabase.functions.invoke('generate-documents', {
          body: {
            booking: {
              ...booking,
              // Remove source to ensure consistent processing
            },
            documentType: 'contract',
            signatureData: signedContract.signature_data,
            signedAt: signedContract.signed_at
          }
        });

        console.log(`🔍 ContractService - Edge function response (SIGNED) for #${bookingShortId}:`, { data, error });

        if (error) {
          console.error(`🔍 ContractService - Edge function error (SIGNED) for #${bookingShortId}:`, error);
          throw new Error('Failed to generate signed contract');
        }

        // DOWNLOAD THE SIGNED CONTRACT PDF
        if (data?.documentUrls && data.documentUrls.length > 0) {
          const contractDataUrl = data.documentUrls[0];
          console.log(`🔍 ContractService - SIGNED PDF generated for #${bookingShortId}, downloading...`);
          console.log(`🔍 ContractService - SIGNED PDF URL length for #${bookingShortId}:`, contractDataUrl.length);
          
          try {
            // Download PDF directly
            const link = document.createElement('a');
            link.href = contractDataUrl;
            link.download = `contrat-signé-${booking.bookingReference || booking.id.slice(-6)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ ContractService - SIGNED PDF downloaded successfully for #${bookingShortId}`);
          } catch (downloadError) {
            console.error(`ContractService - Error downloading SIGNED PDF for #${bookingShortId}:`, downloadError);
            throw new Error('Impossible de télécharger le PDF signé');
          }
        } else {
          console.warn(`⚠️ ContractService - No SIGNED PDF URLs returned for #${bookingShortId}`);
          console.warn(`⚠️ ContractService - Full SIGNED response data for #${bookingShortId}:`, data);
        }

        return {
          success: true,
          message: "Contrat signé téléchargé avec format unifié"
        };
      } else {
        // Generate unsigned contract via edge function
        console.log(`🔍 ContractService - Generating UNSIGNED contract via edge function for #${bookingShortId}...`);
        console.log(`🔍 ContractService - Request body for #${bookingShortId}:`, {
          bookingId: booking.id,
          documentType: 'contract'
        });
        
        const { data, error } = await supabase.functions.invoke('generate-documents', {
          body: {
            booking: {
              ...booking,
              // Remove source to ensure consistent processing
            },
            documentType: 'contract'
          }
        });

        console.log(`🔍 ContractService - Edge function response (UNSIGNED) for #${bookingShortId}:`, { data, error });

        if (error) {
          console.error(`🔍 ContractService - Edge function error (UNSIGNED) for #${bookingShortId}:`, error);
          throw new Error('Failed to generate contract');
        }

        // Download the generated PDF if available
        if (data?.documentUrls && data.documentUrls.length > 0) {
          const contractDataUrl = data.documentUrls[0];
          console.log(`🔍 ContractService - PDF generated for #${bookingShortId}, downloading...`);
          console.log(`🔍 ContractService - PDF URL length for #${bookingShortId}:`, contractDataUrl.length);
          
          try {
            // Download PDF directly
            const link = document.createElement('a');
            link.href = contractDataUrl;
            link.download = `contrat-${booking.bookingReference || booking.id.slice(-6)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ ContractService - PDF downloaded successfully for #${bookingShortId}`);
          } catch (downloadError) {
            console.error(`ContractService - Error downloading PDF for #${bookingShortId}:`, downloadError);
            throw new Error('Impossible de télécharger le PDF');
          }
        } else {
          console.warn(`⚠️ ContractService - No PDF URLs returned for #${bookingShortId}`);
          console.warn(`⚠️ ContractService - Full response data for #${bookingShortId}:`, data);
        }
        return {
          success: true,
          message: "Contrat de location téléchargé avec format unifié"
        };
      }
    } catch (error) {
      console.error(`🔍 ContractService - Error generating contract for #${bookingShortId}:`, error);
      return {
        success: false,
        message: "Erreur lors de la génération du contrat",
        variant: 'destructive'
      };
    }
  }

  /**
   * Get all signed contracts for a user
   */
  static async getSignedContractsForUser(userId: string) {
    try {
      const { data, error } = await (supabase as any).rpc('get_signed_contracts_for_user', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Error fetching signed contracts:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error checking for signed contracts:', error);
      return [];
    }
  }

  /**
   * Download signed contract PDF for a specific signed contract
   */
  static async downloadSignedContractPdf(signedContract: any, booking: any): Promise<{ success: boolean; message: string; variant?: 'default' | 'destructive' }> {
    try {
      console.log('🔍 ContractService - Downloading signed contract PDF...');
      
      const { data, error } = await supabase.functions.invoke('generate-documents', {
        body: {
          booking,
          documentType: 'contract',
          signatureData: signedContract.signature_data,
          signedAt: signedContract.signed_at
        }
      });

      if (error) {
        console.error('🔍 ContractService - Edge function error:', error);
        throw new Error('Failed to generate signed contract PDF');
      }

      return {
        success: true,
        message: "Contrat signé téléchargé avec succès"
      };
    } catch (error) {
      console.error('🔍 ContractService - Error downloading signed contract PDF:', error);
      return {
        success: false,
        message: "Erreur lors du téléchargement du contrat signé",
        variant: 'destructive'
      };
    }
  }
}

// Shared helper to get contract PDF URL for previews and signing flows
export async function getContractPdfUrl(params: {
  supabase: typeof import('@/integrations/supabase/client').supabase;
  bookingId?: string | null;
  bookingLike?: any;
  isPreview?: boolean;
}): Promise<string> {
  const { supabase, bookingId, bookingLike, isPreview = false } = params;

  let body: any = { documentType: 'contract', isPreview: !!isPreview };

  if (bookingId) {
    body.bookingId = bookingId;
  } else if (bookingLike) {
    const normalizeGuest = (g: any) => g ? ({
      ...g,
      full_name: g.full_name ?? g.fullName,
      date_of_birth: g.date_of_birth ?? g.dateOfBirth,
      document_number: g.document_number ?? g.documentNumber,
      nationality: g.nationality,
    }) : null;

    const normalized = {
      ...bookingLike,
      check_in_date: bookingLike.check_in_date ?? bookingLike.checkInDate,
      check_out_date: bookingLike.check_out_date ?? bookingLike.checkOutDate,
      guests: Array.isArray(bookingLike.guests) ? bookingLike.guests.map(normalizeGuest) : [],
    };

    body.booking = normalized;
  } else {
    throw new Error('Missing bookingId or bookingLike');
  }

  const { data, error } = await supabase.functions.invoke('generate-documents', { body });
  if (error) throw error;

  const url: string = (data?.documentUrls?.[0] || data?.documents?.[0]?.url || '') as string;

  if (
    typeof url === 'string' && (
      url.startsWith('data:application/pdf') ||
      url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith('blob:')
    )
  ) {
    return url;
  }

  throw new Error('No contract URL returned');
}