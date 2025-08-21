import { supabase } from '@/integrations/supabase/client';
import type { Booking } from '@/types/booking';

export class UnifiedDocumentService {

  /**
   * Generate police forms for all guests with standardized format
   */
  static async generatePoliceFormsForAllGuests(booking: Booking): Promise<string[]> {
    try {
      console.log('🚨 Generating police forms for booking:', booking.id);

      const { data, error } = await supabase.functions.invoke('generate-documents', {
        body: {
          booking: {
            ...booking,
            source: booking.source ?? 'host' // Default to host if not specified
          },
          documentType: 'police'
        }
      });

      if (error) {
        console.error('Error generating police forms:', error);
        throw new Error('Failed to generate police forms');
      }

      console.log('✅ Police forms generated successfully');
      return data.documentUrls ?? [];
    } catch (error) {
      console.error('Error in generatePoliceFormsForAllGuests:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use ContractService.generateAndDownloadContract() instead
   * This method is kept for backward compatibility only
   */
  static async generateContract(booking: Booking, _isSignedContract: boolean = false, _signatureData?: string, _signedAt?: string): Promise<string> {
    console.warn('⚠️ UnifiedDocumentService.generateContract is deprecated. Use ContractService.generateAndDownloadContract() instead.');

    const { ContractService } = await import('./contractService');
    const result = await ContractService.generateAndDownloadContract(booking);

    if (!result.success) {
      throw new Error(result.message);
    }

    return '';
  }

  /**
   * @deprecated Use ContractService.generateAndDownloadContract() instead
   * This method is kept for backward compatibility only
   */
  static async generateSignedContract(
    booking: Booking,
    signatureData: string,
    signedAt: string
  ): Promise<string> {
    console.warn('⚠️ UnifiedDocumentService.generateSignedContract: generating server-side without auto-download.');
    try {
      const body: any = { documentType: 'contract', signatureData, signedAt };
      if ((booking as any)?.id) {
        body.bookingId = (booking as any).id;
      } else {
        body.booking = booking;
      }
      const { error } = await supabase.functions.invoke('generate-documents', { body });
      if (error) throw error;
    } catch (e: any) {
      console.error('Error generating signed contract without download:', e);
      throw new Error(e?.message || 'Failed to generate signed contract');
    }

    return '';
  }

  /**
   * @deprecated Use ContractService.generateAndDownloadContract() instead
   * This method is kept for backward compatibility only
   */
  static async downloadContract(booking: Booking): Promise<void> {
    console.warn('⚠️ UnifiedDocumentService.downloadContract is deprecated. Use ContractService.generateAndDownloadContract() instead.');

    const { ContractService } = await import('./contractService');
    const result = await ContractService.generateAndDownloadContract(booking);

    if (!result.success) {
      throw new Error(result.message);
    }
  }

  static async downloadPoliceFormsForAllGuests(booking: Booking): Promise<void> {
    try {
      console.log('📥 Downloading police forms for booking:', booking.id);

      const urls = await this.generatePoliceFormsForAllGuests(booking);

      // Download each police form as a proper PDF file (staggered + Blob URLs to avoid browser blocking)
      urls.forEach((dataUrl, index) => {
        const guest = booking.guests[index];
        const guestName = guest?.fullName?.replace(/[^a-zA-Z0-9]/g, '_') || `guest_${index + 1}`;
        const fileName = `fiche_police_${guestName}_${Date.now()}.pdf`;

        setTimeout(async () => {
          try {
            // Convert data URL to Blob for more reliable downloads
            let href = dataUrl;
            if (dataUrl.startsWith('data:')) {
              const res = await fetch(dataUrl);
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              href = blobUrl;

              // Create a download link and trigger download
              const link = document.createElement('a');
              link.href = href;
              link.download = fileName;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              // Cleanup
              setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            } else {
              // Fallback if it's already a regular URL
              const link = document.createElement('a');
              link.href = href;
              link.download = fileName;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          } catch (e) {
            console.error('❌ Failed to download police form index', index, e);
          }
        }, index * 500); // stagger to avoid popup/download blocking
      });
    } catch (error) {
      console.error('Error downloading police forms:', error);
      throw error;
    }
  }

  /**
   * Get document generation status
   */
  static getDocumentStatus(booking: Booking): {
    hasPoliceForm: boolean;
    hasContract: boolean;
    hasGuests: boolean;
  } {
    return {
      hasPoliceForm: booking.documentsGenerated?.policeForm || false,
      hasContract: booking.documentsGenerated?.contract || false,
      hasGuests: booking.guests && booking.guests.length > 0
    };
  }
}
