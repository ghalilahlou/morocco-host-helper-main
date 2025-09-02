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

      // ✅ NOUVEAU : Utiliser directement la vue v_guest_submissions au lieu de l'Edge Function
      try {
        console.log('📋 Récupération directe depuis v_guest_submissions pour booking_id:', booking.id);
        
        const { data: submissions, error: viewError } = await supabase
          .from('v_guest_submissions')
          .select('*')
          .eq('resolved_booking_id', booking.id)
          .not('guest_data', 'is', null);
        
        if (viewError) {
          console.warn('⚠️ Erreur vue v_guest_submissions:', viewError);
        } else if (submissions && Array.isArray(submissions)) {
          console.log(`📋 Found ${submissions.length} guest submissions via vue directe`);
          
          let successfulFiles = 0;
          let failedFiles = 0;
          
          // Traiter chaque soumission d'invité
          for (const submission of submissions) {
            console.log('📋 Processing submission:', submission.id);
            
            if (submission.guest_data?.guests) {
              for (const guest of submission.guest_data.guests) {
                console.log('📋 Processing guest:', guest.fullName || guest.full_name);
                
                // Créer un document d'identité pour chaque invité
                const guestName = guest.fullName || guest.full_name || 'Nom non spécifié';
                const documentType = guest.documentType || guest.document_type || 'Document d\'identité';
                const documentNumber = guest.documentNumber || guest.document_number || 'Non spécifié';
                
                // Ajouter le document d'identité (informations textuelles)
                documents.push({
                  id: `id-${submission.id}-${guestName}`,
                  fileName: `ID_${guestName}`,
                  url: '#', // Pas de fichier physique, juste les informations
                  guestName: guestName,
                  bookingId: booking.id,
                  createdAt: submission.created_at,
                  // ✅ Ajouter les métadonnées du document d'identité
                  metadata: {
                    documentType,
                    documentNumber,
                    nationality: guest.nationality || 'Non spécifiée',
                    dateOfBirth: guest.dateOfBirth || guest.date_of_birth || 'Non spécifiée',
                    placeOfBirth: guest.placeOfBirth || guest.place_of_birth || 'Non spécifié'
                  }
                });
                successfulFiles++;
                
                // Ajouter les fichiers physiques s'ils existent
                if (submission.document_urls && Array.isArray(submission.document_urls)) {
                  for (const fileUrl of submission.document_urls) {
                    if (fileUrl && fileUrl !== 'URL_GENERATION_FAILED') {
                      documents.push({
                        id: `file-${submission.id}-${guestName}-${fileUrl.split('/').pop()}`,
                        fileName: `Document_${guestName}_${fileUrl.split('/').pop()}`,
                        url: fileUrl,
                        guestName: guestName,
                        bookingId: booking.id,
                        createdAt: submission.created_at
                      });
                      successfulFiles++;
                    } else {
                      failedFiles++;
                    }
                  }
                }
              }
            }
          }
          console.log(`✅ Processed ${successfulFiles} successful and ${failedFiles} failed guest documents for this booking`);
        }
      } catch (viewErr) {
        console.warn('⚠️ Error calling v_guest_submissions view:', viewErr);
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