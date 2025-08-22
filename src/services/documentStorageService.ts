import { supabase } from '@/integrations/supabase/client';
import { DocumentStorageResult, DocumentMetadata, UnifiedDocument } from '@/types/document';
import { Booking } from '@/types/booking';

/**
 * Unified document storage service that handles both host and guest documents
 * Eliminates duplication between uploaded_documents and guest_submissions
 */
/**
 * Normalize guest names to handle different formats and encoding
 */
function normName(s?: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[^\p{L}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract guest name from various possible formats
 */
function extractGuestName(guest: any): string {
  // Try fullName first
  if (guest.fullName) return guest.fullName;
  if (guest.full_name) return guest.full_name;
  
  // Try firstName + lastName combination
  if (guest.firstName && guest.lastName) {
    return `${guest.firstName} ${guest.lastName}`;
  }
  
  // Try given_names + surname for submissions
  if (guest.given_names && guest.surname) {
    return `${guest.given_names} ${guest.surname}`;
  }
  
  return '';
}

export class DocumentStorageService {
  
  /**
   * Store a document file and create a unified record
   */
  static async storeDocument(
    file: File, 
    metadata: DocumentMetadata
  ): Promise<DocumentStorageResult> {
    try {
      console.log('📄 DocumentStorageService - Storing document:', {
        fileName: file.name,
        bookingId: metadata.bookingId,
        size: file.size
      });

      // Generate unique file name
      const timestamp = Date.now();
      const fileName = `${metadata.bookingId}/${timestamp}_${file.name}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('guest-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        return { success: false, error: uploadError.message };
      }

      console.log('✅ File uploaded successfully:', { fileName });

      // Create unified document record in uploaded_documents - store only file path, no public URL
      const documentRecord = {
        booking_id: metadata.bookingId,
        guest_id: metadata.guestId || null,
        file_name: file.name,
        file_path: fileName,
        document_url: null, // No longer store public URLs
        extracted_data: metadata.extractedData || null,
        processing_status: 'completed'
      };

      const { data: dbData, error: dbError } = await supabase
        .from('uploaded_documents')
        .insert(documentRecord)
        .select();

      if (dbError) {
        console.error('❌ DB insert failed:', dbError);
        return { success: false, error: dbError.message };
      }

      console.log('✅ Document record saved successfully:', dbData);
      
      return { 
        success: true, 
        filePath: fileName // Return file path instead of public URL
      };

    } catch (error) {
      console.error('❌ Document storage error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all documents for a booking (unified from all sources)
   */
  static async getDocumentsForBooking(booking: Booking): Promise<UnifiedDocument[]> {
    try {
      console.log('📋 DocumentStorageService - Getting documents for booking:', {
        id: booking.id,
        bookingReference: booking.bookingReference,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        propertyId: booking.property?.id,
        guestCount: booking.guests?.length || 0,
        createdAt: booking.createdAt
      });

      const documents: UnifiedDocument[] = [];

      // Get from uploaded_documents table (primary source)
      const { data: uploadedDocs, error: uploadError } = await supabase
        .from('uploaded_documents')
        .select(`
          id,
          file_name,
          document_url,
          file_path,
          created_at,
          guest_id,
          guests(full_name),
          extracted_data
        `)
        .eq('booking_id', booking.id);

      if (uploadError) {
        console.error('❌ Error loading uploaded documents:', uploadError);
      } else if (uploadedDocs && uploadedDocs.length > 0) {
        for (const doc of uploadedDocs) {
          let documentUrl = doc.document_url;

          // If no document_url but we have file_path, create signed URL
          if (!documentUrl && doc.file_path) {
            try {
              const { data: signedUrlData } = await supabase.functions.invoke('storage-sign-url', {
                body: { bucket: 'guest-documents', path: doc.file_path, expiresIn: 3600 }
              });
              
              if (signedUrlData?.signedUrl) {
                documentUrl = signedUrlData.signedUrl;
              }
            } catch (error) {
              console.error('❌ Error creating signed URL:', error);
            }
          }

          if (documentUrl) {
            // Try to get guest name from multiple sources
            let guestName = (doc as any).guests?.full_name;
            
            // If no guest associated, try to get from extracted data
            if (!guestName && doc.extracted_data && typeof doc.extracted_data === 'object') {
              const extractedData = doc.extracted_data as any;
              guestName = extractedData.fullName || 
                         extractedData.full_name ||
                         extractedData.name;
            }

            documents.push({
              id: String(doc.id),
              fileName: doc.file_name,
              url: documentUrl,
              guestName: guestName || undefined,
              bookingId: booking.id,
              createdAt: doc.created_at
            });
          }
        }
      }

      // Fallback: If no DB records found, list storage files directly for this booking
      if (documents.length === 0) {
        try {
          const { data: files, error: listErr } = await supabase.storage
            .from('guest-documents')
            .list(booking.id, { limit: 100 });
          if (!listErr && files && files.length > 0) {
            for (const f of files) {
              const path = `${booking.id}/${f.name}`;
              const { data: signed } = await supabase.functions.invoke('storage-sign-url', {
                body: { bucket: 'guest-documents', path: path, expiresIn: 3600 }
              });
              if (signed?.signedUrl) {
                documents.push({
                  id: path,
                  fileName: f.name,
                  url: signed.signedUrl,
                  bookingId: booking.id,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('⚠️ Fallback storage listing failed:', fallbackErr);
        }
      }

      // Extract and normalize guest names from booking before calling edge function
      const bookingGuests = (booking as any).guests || [];
      const fromBookingGuests: string[] = [];
      
      console.log('📋 Raw booking guests data:', bookingGuests);
      
      // Extract names from booking guests using multiple formats
      bookingGuests.forEach((guest: any, index: number) => {
        console.log(`📋 Processing guest ${index}:`, guest);
        const extractedName = extractGuestName(guest);
        if (extractedName) {
          fromBookingGuests.push(extractedName);
          console.log(`📋 Extracted booking guest name: "${extractedName}"`);
        }
      });
      
      // Build normalized candidate names from booking guests
      const uniqueNames = Array.from(new Set(
        fromBookingGuests.map(normName).filter(Boolean)
      ));
      
      console.log('📋 Final booking guest names for filtering:', uniqueNames);

      // Use the improved edge function to get guest documents scoped to this booking
      try {
        console.log('📋 Calling get-guest-docs with booking_id:', booking.id);
        const { data: guestDocs, error: edgeError } = await supabase.functions.invoke('get-guest-docs', {
          body: { 
            bookingId: booking.id
          }
        });

        if (edgeError) {
          console.warn('⚠️ Edge function error:', edgeError);
        } else if (guestDocs && Array.isArray(guestDocs)) {
          console.log(`📋 Found ${guestDocs.length} guest submissions via edge function`);
          
          // IMPORTANT: Ne pas filtrer par nom car booking.guests peut être vide
          // La fonction edge get-guest-docs filtre déjà par booking_id
          // Tous les documents retournés sont légitimes pour cette réservation
          const shouldFilter = false; // Désactiver le filtrage par nom
          
          let successfulFiles = 0;
          let failedFiles = 0;
          
          // Transform edge function response to UnifiedDocument format
          for (const guestDoc of guestDocs) {
            console.log('📋 Processing guest document:', guestDoc.fullName);
            
            if (guestDoc.files && Array.isArray(guestDoc.files)) {
              for (const file of guestDoc.files) {
                if (file.url && file.url !== 'URL_GENERATION_FAILED') {
                  documents.push({
                    id: `guest-${guestDoc.id}-${file.name}`,
                    fileName: file.name,
                    url: file.url, // Already signed URL from edge function
                    guestName: guestDoc.fullName,
                    bookingId: booking.id,
                    createdAt: guestDoc.createdAt,
                  });
                  successfulFiles++;
                } else {
                  console.warn(`⚠️ Failed to get URL for file: ${file.name} (guest: ${guestDoc.fullName})`);
                  failedFiles++;
                }
              }
            }
          }
          console.log(`✅ Processed ${successfulFiles} successful and ${failedFiles} failed guest documents for this booking`);
        }
      } catch (edgeErr) {
        console.warn('⚠️ Error calling list-guest-docs edge function:', edgeErr);
      }

      console.log(`✅ Found ${documents.length} documents for booking`);
      return documents;

    } catch (error) {
      console.error('❌ Error getting documents:', error);
      return [];
    }
  }
  
  /**
   * Delete all uploaded_documents records for a booking (keeps storage files for safety)
   */
  static async deleteDocumentsForBooking(bookingId: string): Promise<void> {
    try {
      console.log('🧹 Deleting uploaded_documents for booking:', bookingId);
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('booking_id', bookingId);
      if (error) {
        console.error('❌ Error deleting uploaded documents:', error);
      } else {
        console.log('✅ Uploaded documents removed for booking');
      }
    } catch (error) {
      console.error('❌ Exception while deleting uploaded documents:', error);
    }
  }

  /**
   * Remove guest_submissions duplication (cleanup method)
   */
  static async cleanupDuplicateSubmissions(booking: Booking): Promise<void> {
    try {
      // Skip cleanup for now since we're using edge function for secure guest document access
      console.log('🧹 Cleanup skipped - using edge function for secure guest document access');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}