import { supabase } from '@/integrations/supabase/client';
import { invokeSubmitGuestInfoUnified } from '@/lib/invokeSubmitGuestInfoUnified';
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
  /** options.locale: langue du contrat (fr, en, es). Par défaut: fr. */
  static async generateAndDownloadContract(booking: Booking, options?: { locale?: 'fr' | 'en' | 'es' }): Promise<{ success: boolean; message: string; variant?: 'default' | 'destructive' }> {
    const bookingId = booking.id;
    const bookingShortId = bookingId.slice(-6);
    const locale = options?.locale && ['fr', 'en', 'es'].includes(options.locale) ? options.locale : undefined;
    
    try {
      console.log(`🔍 ContractService - Starting contract generation for booking: ${bookingId} (#${bookingShortId})`, { locale });
      console.log(`🔍 ContractService - Booking data:`, {
        id: booking.id,
        guests: booking.guests?.length || 0,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        source: (booking as any).source || undefined, // Optionnel, peut ne pas exister dans le type Booking
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
        
        const { data, error } = await invokeSubmitGuestInfoUnified({
          body: {
            bookingId: booking.id,
            action: 'generate_contract_only',
            ...(locale ? { locale } : {}),
            signature: {
              data: signedContract.signature_data,
              timestamp: signedContract.signed_at
            }
          }
        });

        console.log(`🔍 ContractService - Edge function response (SIGNED) for #${bookingShortId}:`, { data, error });

        if (error) {
          console.error(`🔍 ContractService - Edge function error (SIGNED) for #${bookingShortId}:`, error);
          throw new Error('Failed to generate signed contract');
        }

        // DOWNLOAD THE SIGNED CONTRACT PDF
        const contractDataUrl = data?.contractUrl || data?.documentUrl || (data?.documentUrls && data.documentUrls.length > 0 ? data.documentUrls[0] : null);
        if (contractDataUrl) {
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
        
        const { data, error } = await invokeSubmitGuestInfoUnified({
          body: {
            bookingId: booking.id,
            action: 'generate_contract_only',
            ...(locale ? { locale } : {})
          }
        });

        console.log(`🔍 ContractService - Edge function response (UNSIGNED) for #${bookingShortId}:`, { data, error });

        if (error) {
          console.error(`🔍 ContractService - Edge function error (UNSIGNED) for #${bookingShortId}:`, error);
          throw new Error('Failed to generate contract');
        }

        const contractUrl = data?.contractUrl || data?.documentUrl || (data?.documentUrls && data.documentUrls.length > 0 ? data.documentUrls[0] : null);
        if (!contractUrl) {
          console.warn(`⚠️ ContractService - No contract URL returned for #${bookingShortId}`);
          console.warn(`⚠️ ContractService - Full response data for #${bookingShortId}:`, JSON.stringify(data, null, 2));
          throw new Error('Aucun PDF généré - vérifiez les données de réservation et les logs de l\'Edge Function');
        }

        console.log(`🔍 ContractService - PDF generated for #${bookingShortId}, downloading...`);
        console.log(`🔍 ContractService - PDF URL for #${bookingShortId}:`, contractUrl.substring(0, 100) + '...');
        
        try {
          // Download PDF directly
          const link = document.createElement('a');
          link.href = contractUrl;
          link.download = `contrat-${booking.bookingReference || booking.id.slice(-6)}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          console.log(`✅ ContractService - PDF downloaded successfully for #${bookingShortId}`);
        } catch (downloadError) {
          console.error(`ContractService - Error downloading PDF for #${bookingShortId}:`, downloadError);
          throw new Error('Impossible de télécharger le PDF');
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
      
      const { data, error } = await invokeSubmitGuestInfoUnified({
        body: {
          bookingId: booking.id,
          action: 'generate_contract_only',
          signature: {
            data: signedContract.signature_data,
            timestamp: signedContract.signed_at
          }
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
// locale: 'fr' | 'en' | 'es' — utilisé par l'edge function pour générer le PDF dans la langue choisie (si supporté)
export async function getContractPdfUrl(params: {
  supabase: typeof import('@/integrations/supabase/client').supabase;
  bookingId?: string | null;
  bookingLike?: any;
  isPreview?: boolean;
  /** Langue du contrat (fr, en, es). Si fourni, l'edge function peut générer le PDF dans cette langue. */
  locale?: 'fr' | 'en' | 'es';
}): Promise<string> {
  const { supabase, bookingId, bookingLike, isPreview = false, locale } = params;

  let body: any = { documentType: 'contract', isPreview: !!isPreview };
  if (locale) body.locale = locale;

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

  const { data, error } = await invokeSubmitGuestInfoUnified({
    body: {
      ...body,
      action: 'generate_contract_only',
      bookingId: bookingId || bookingLike?.id,
    }
  });
  if (error) throw error;

  const url: string = (data?.contractUrl || data?.documentUrl || data?.documentUrls?.[0] || data?.documents?.[0]?.url || '') as string;

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