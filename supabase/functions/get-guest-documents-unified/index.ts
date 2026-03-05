import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface DocumentInfo {
  id: string;
  type: 'identity' | 'contract' | 'police';
  fileName: string;
  url: string | null; // ✅ Peut être null si le document n'est pas accessible
  guestName?: string;
  createdAt: string;
  isSigned?: boolean;
  signedAt?: string;
}

interface GuestDocumentSummary {
  bookingId: string;
  guestCount: number;
  documents: {
    identity: DocumentInfo[];
    contract: DocumentInfo[];
    police: DocumentInfo[];
  };
  summary: {
    totalDocuments: number;
    hasAllRequired: boolean;
    missingTypes: string[];
  };
}

// Helper function to check if a file exists in storage
async function checkFileExists(supabase: any, bucket: string, path: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: path.split('/').pop()
      });
    
    return !error && data && data.length > 0;
  } catch {
    return false;
  }
}

// ✅ CORRECTION : Helper pour récupérer l'URL publique d'un document depuis le Storage
async function getDocumentUrlFromStorage(
  supabase: any,
  documentType: 'contract' | 'police' | 'identity',
  bookingId: string,
  fileName?: string
): Promise<string | null> {
  try {
    // ✅ CORRECTION : Chemins spécifiques par type de document
    let prefix = '';
    let fallbackPrefixes: string[] = [];

    switch (documentType) {
      case 'identity':
        prefix = `identity/${bookingId}`;
        // Fallback historique optionnel
        fallbackPrefixes = [`identities/${bookingId}`];
        break;
      
      case 'contract':
        prefix = `contract/${bookingId}`;
        fallbackPrefixes = [`contracts/${bookingId}`];
        break;
      
      case 'police':
        prefix = `police/${bookingId}`;
        fallbackPrefixes = [`police-forms/${bookingId}`];
        break;
    }

    console.log(`🔍 Searching for ${documentType} document in storage: ${prefix}`);
    
    // ✅ CORRECTION : Utiliser updated_at au lieu de created_at
    const { data: files, error: listError } = await supabase.storage
      .from('guest-documents')
      .list(prefix, {
        sortBy: { column: 'updated_at', order: 'desc' }
      });
    
    if (listError) {
      console.error(`❌ Error listing files for ${prefix}:`, listError);
      return null;
    }
    
    if (!files || files.length === 0) {
      console.log(`ℹ️ No files found in ${prefix}`);
      
      // ✅ CORRECTION : Essayer les préfixes de fallback
      for (const fallbackPrefix of fallbackPrefixes) {
        console.log(`🔄 Trying fallback prefix: ${fallbackPrefix}`);
        
        const { data: fallbackFiles, error: fallbackError } = await supabase.storage
          .from('guest-documents')
          .list(fallbackPrefix, {
            sortBy: { column: 'updated_at', order: 'desc' }
          });
        
        if (!fallbackError && fallbackFiles && fallbackFiles.length > 0) {
          console.log(`✅ Found files in fallback prefix: ${fallbackPrefix}`);
          const targetFile = fallbackFiles[0];
          const fullPath = `${fallbackPrefix}/${targetFile.name}`;
          
          const { data: signedData, error: signedError } = await supabase.storage
            .from('guest-documents')
            .createSignedUrl(fullPath, 3600);
          
          if (!signedError && signedData?.signedUrl) {
            console.log(`✅ Generated signed URL for ${documentType}: ${signedData.signedUrl.substring(0, 50)}...`);
            return signedData.signedUrl;
          }
        }
      }
      
      return null;
    }
    
    // Chercher le fichier correspondant
    let targetFile = null;
    if (fileName) {
      // Chercher par nom exact
      targetFile = files.find(f => f.name === fileName);
    }
    
    // Si pas trouvé par nom, prendre le premier PDF
    if (!targetFile) {
      targetFile = files.find(f => f.name.endsWith('.pdf'));
    }
    
    if (!targetFile) {
      console.log(`ℹ️ No PDF file found in ${prefix}`);
      return null;
    }
    
    const fullPath = `${prefix}/${targetFile.name}`;
    console.log(`📄 Found document: ${fullPath}`);
    
    // Générer une URL signée
    const { data: signedData, error: signedError } = await supabase.storage
      .from('guest-documents')
      .createSignedUrl(fullPath, 3600); // 1 heure
    
    if (signedError || !signedData?.signedUrl) {
      console.error(`❌ Error generating signed URL for ${fullPath}:`, signedError);
      return null;
    }
    
    console.log(`✅ Generated signed URL for ${documentType}: ${signedData.signedUrl.substring(0, 50)}...`);
    return signedData.signedUrl;
  } catch (error) {
    console.error(`❌ Error in getDocumentUrlFromStorage for ${documentType}:`, error);
    return null;
  }
}

// ✅ NOUVEAU : Helper résilient pour charger les bookings avec gestion des colonnes legacy
let legacyColsMissingLogged = false;

async function safeSelectBooking(server: any, bookingId: string) {
  const baseCols = 'id, property_id, check_in_date, check_out_date, number_of_guests, status, documents_generated';
  const legacyCols = 'contract_url, police_url, identity_url';
  const tryLegacy = `${baseCols}, ${legacyCols}`;

  // 1) On tente avec colonnes legacy
  let { data, error } = await server
    .from('bookings')
    .select(tryLegacy)
    .eq('id', bookingId)
    .maybeSingle();

  if (error?.code === '42703') {
    // 2) Fallback sans colonnes legacy
    if (!legacyColsMissingLogged) {
      console.warn('ℹ️ Legacy booking columns not present (contract_url/police_url/identity_url). Falling back.');
      legacyColsMissingLogged = true; // éviter le spam de logs
    }
    const fallback = await server
      .from('bookings')
      .select(baseCols)
      .eq('id', bookingId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;

    // Normaliser les champs legacy à null pour le reste du pipeline
    return { ...fallback.data, contract_url: null, police_url: null, identity_url: null };
  }

  if (error) throw error;

  // Data OK (schéma avec legacy présent)
  return data;
}

// ✅ CORRECTION : Helper pour choisir la meilleure URL selon la priorité
// ⚠️ RÈGLE : NE JAMAIS retourner de data: URLs (blob URLs non supportées pour l'affichage)
function pickUrl(kind: 'contract' | 'police' | 'identity', fromDocs: string | null, fromStorage: string | null, fromDataUri: string | null, fromLegacy: string | null) {
  // 1) URL déjà normalisée depuis la table de documents (priorité absolue)
  if (fromDocs && fromDocs.startsWith('http')) return fromDocs;
  
  // 2) URL signée depuis Storage si disponible
  if (fromStorage && fromStorage.startsWith('http')) return fromStorage;
  
  // 3) legacy - seulement si pas d'URL HTTP disponible
  if (fromLegacy && fromLegacy.startsWith('http')) return fromLegacy;
  
  // ❌ NE JAMAIS retourner de data: URLs - elles créent des blob: URLs qui ne peuvent pas être ouvertes
  // Si on n'a que des data: URLs, retourner null et forcer la récupération depuis le Storage
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-guest-documents-unified function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ 
        error: 'Missing environment variables' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { persistSession: false } 
    });

    // Parse request body
    let requestBody = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse request body, using defaults:', parseError);
    }

    const { bookingId, propertyId } = requestBody as any;
    
    if (!bookingId && !propertyId) {
      return new Response(JSON.stringify({ 
        error: 'Either bookingId or propertyId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📋 Request params:', { bookingId, propertyId });

    // Get booking information
    let bookingQuery = supabase
      .from('bookings')
      .select(`
        id,
        property_id,
        check_in_date,
        check_out_date,
        number_of_guests,
        status,
        guests(id, full_name, document_number, nationality, document_type)
      `);

    // ✅ PHASE 1 - Limite de résultats pour éviter la surcharge (ANALYSE_PERFORMANCE_STORAGE_GUEST_DOCUMENTS.md)
    const MAX_BOOKINGS_BY_PROPERTY = 100;

    if (bookingId) {
      bookingQuery = bookingQuery.eq('id', bookingId);
    } else if (propertyId) {
      bookingQuery = bookingQuery
        .eq('property_id', propertyId)
        .order('check_in_date', { ascending: false })
        .limit(MAX_BOOKINGS_BY_PROPERTY);
    }

    const { data: bookings, error: bookingError } = await bookingQuery;

    if (bookingError) {
      console.error('❌ Database error fetching bookings:', bookingError);
      return new Response(JSON.stringify({ 
        error: 'Database query failed' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ 
        bookings: [],
        message: 'No bookings found' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${bookings.length} booking(s)`);

    // Process each booking
    const results = await Promise.all(
      bookings.map(async (booking) => {
        console.log(`📋 Processing booking: ${booking.id}`);

        // ✅ CORRECTION : Récupérer les documents depuis TOUTES les sources avec helper résilient
        const [uploadedDocsResult, generatedDocsResult] = await Promise.all([
          supabase
            .from('uploaded_documents')
            .select(`
              id,
              file_name,
              document_url,
              file_path,
              document_type,
              is_signed,
              signed_at,
              created_at,
              guests(full_name)
            `)
            .eq('booking_id', booking.id),
          supabase
            .from('generated_documents')
            .select(`
              id,
              file_name,
              document_url,
              document_type,
              is_signed,
              created_at
            `)
            .eq('booking_id', booking.id)
        ]);

        const { data: uploadedDocs, error: uploadedError } = uploadedDocsResult;
        const { data: generatedDocs, error: generatedError } = generatedDocsResult;

        if (uploadedError) {
          console.error(`❌ Error fetching uploaded documents for booking ${booking.id}:`, uploadedError);
        }
        if (generatedError) {
          console.error(`❌ Error fetching generated documents for booking ${booking.id}:`, generatedError);
        }

        // ✅ NOUVEAU : Utiliser le helper résilient pour récupérer les données de booking
        let bookingData;
        try {
          bookingData = await safeSelectBooking(supabase, booking.id);
        } catch (bookingError) {
          console.error(`❌ Error fetching booking data for booking ${booking.id}:`, bookingError);
          bookingData = null;
        }

        // ✅ CORRECTION : Combiner TOUTES les sources de documents avec priorité
        const allDocuments = [
          ...(generatedDocs || []).map(doc => ({ ...doc, source: 'generated' })),  // Priorité aux documents générés
          ...(uploadedDocs || []).map(doc => ({ ...doc, source: 'uploaded' }))   // Puis les documents uploadés
        ];

        // ✅ NOUVEAU : Ajouter les documents depuis la table bookings avec helper pickUrl
        if (bookingData) {
          // Ajouter le contrat depuis contract_url (legacy) ou documents_generated
          const contractFromLegacy = bookingData.contract_url ?? null;
          const contractFromDocs = bookingData.documents_generated?.contract?.url ?? null;
          const contractUrl = pickUrl('contract', contractFromDocs, null, null, contractFromLegacy);
          
          if (contractUrl) {
            allDocuments.push({
              id: `booking-contract-${booking.id}`,
              file_name: `contract-${booking.id}.pdf`,
              document_url: contractUrl,
              document_type: 'contract',
              is_signed: bookingData.documents_generated?.contract?.isSigned || false,
              created_at: bookingData.documents_generated?.contract?.createdAt || new Date().toISOString(),
              source: contractFromDocs ? 'booking-docs' : 'booking-legacy'
            });
          }

          // Ajouter la fiche de police depuis police_url (legacy) ou documents_generated
          const policeFromLegacy = bookingData.police_url ?? null;
          const policeFromDocs = bookingData.documents_generated?.police?.url ?? null;
          const policeUrl = pickUrl('police', policeFromDocs, null, null, policeFromLegacy);
          
          if (policeUrl) {
            allDocuments.push({
              id: `booking-police-${booking.id}`,
              file_name: `police-${booking.id}.pdf`,
              document_url: policeUrl,
              document_type: 'police',
              is_signed: bookingData.documents_generated?.police?.isSigned || false,
              created_at: bookingData.documents_generated?.police?.createdAt || new Date().toISOString(),
              source: policeFromDocs ? 'booking-docs' : 'booking-legacy'
            });
          }

          // Ajouter les documents d'identité depuis identity_url (legacy) ou documents_generated
          const identityFromLegacy = bookingData.identity_url ?? null;
          const identityFromDocs = bookingData.documents_generated?.identity?.url ?? null;
          const identityUrl = pickUrl('identity', identityFromDocs, null, null, identityFromLegacy);
          
          if (identityUrl) {
            allDocuments.push({
              id: `booking-identity-${booking.id}`,
              file_name: `identity-${booking.id}.pdf`,
              document_url: identityUrl,
              document_type: 'identity',
              is_signed: bookingData.documents_generated?.identity?.isSigned || false,
              created_at: bookingData.documents_generated?.identity?.createdAt || new Date().toISOString(),
              source: identityFromDocs ? 'booking-docs' : 'booking-legacy'
            });
          }
        }

        // ✅ CORRECTION : Déduplication des documents par URL pour éviter les doublons
        const uniqueDocuments = allDocuments.reduce((acc, doc) => {
          const existingIndex = acc.findIndex(existing => 
            existing.document_url === doc.document_url && 
            existing.document_type === doc.document_type
          );
          
          if (existingIndex === -1) {
            acc.push(doc);
          } else {
            // Garder le plus récent
            if (new Date(doc.created_at) > new Date(acc[existingIndex].created_at)) {
              acc[existingIndex] = doc;
            }
          }
          return acc;
        }, [] as typeof allDocuments);

        // Trier par date de création (plus récent en premier)
        uniqueDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Categorize documents
        const categorizedDocs = {
          identity: [] as DocumentInfo[],
          contract: [] as DocumentInfo[],
          police: [] as DocumentInfo[]
        };

        for (const doc of uniqueDocuments) {
          const docInfo: DocumentInfo = {
            id: doc.id,
            type: doc.document_type as 'identity' | 'contract' | 'police',
            fileName: doc.file_name,
            url: doc.document_url,
            guestName: (doc.guests as any)?.full_name,
            createdAt: doc.created_at,
            isSigned: doc.is_signed,
            signedAt: doc.signed_at
          };

          // ✅ CORRECTION : Générer les URLs signées pour tous les types de documents
          if (doc.document_url) {
            try {
              // Check if it's already a valid HTTP URL (not data:)
              if (doc.document_url.startsWith('http')) {
                // Already a valid HTTP URL, use as is
                docInfo.url = doc.document_url;
                console.log(`✅ Using existing HTTP URL for ${doc.document_type}: ${doc.document_url.substring(0, 50)}...`);
              } else if (doc.document_url.startsWith('data:')) {
                // ❌ data: URLs ne sont pas supportées - chercher le fichier dans Storage
                console.warn(`⚠️ Skipping data: URL for ${doc.document_type}, will attempt to retrieve from storage`);
                
                // Essayer de récupérer l'URL depuis le Storage
                const documentPath = `${doc.document_type}/${booking.id}/${doc.file_name}`;
                console.log(`🔍 Attempting to retrieve document from storage: ${documentPath}`);
                
                const { data: signedData, error: signedError } = await supabase.storage
                  .from('guest-documents')
                  .createSignedUrl(documentPath, 3600);
                
                if (signedError || !signedData?.signedUrl) {
                  console.error(`❌ Failed to retrieve signed URL for ${documentPath}:`, signedError);
                  docInfo.url = null; // Pas d'URL disponible
                } else {
                  docInfo.url = signedData.signedUrl;
                  console.log(`✅ Retrieved signed URL for ${doc.document_type}: ${signedData.signedUrl.substring(0, 50)}...`);
                }
              } else {
                // It's a storage path, generate signed URL
                let bucket = '';
                let path = doc.document_url;
                
                // ✅ CORRECTION : Logique améliorée pour déterminer le bucket
                if (doc.document_type === 'contract' || doc.document_url.includes('contract')) {
                  bucket = 'guest-documents'; // Utiliser guest-documents pour les contrats
                } else if (doc.document_type === 'police' || doc.document_url.includes('police')) {
                  bucket = 'guest-documents'; // Utiliser guest-documents pour les fiches de police
                } else if (doc.document_type === 'identity' || doc.document_url.includes('identity')) {
                  bucket = 'guest-documents'; // Utiliser guest-documents pour les pièces d'identité
                } else if (doc.document_url.startsWith('guest-documents/')) {
                  bucket = 'guest-documents';
                  path = doc.document_url;
                } else if (doc.document_url.startsWith('documents/')) {
                  bucket = 'guest-documents'; // Rediriger vers guest-documents
                  path = doc.document_url.replace('documents/', 'guest-documents/');
                } else {
                  // Default to guest-documents for all cases
                  bucket = 'guest-documents';
                }
                
                console.log(`🔗 Generating signed URL for ${doc.document_type}: bucket=${bucket}, path=${path}`);
                
                const { data: signedData, error: signedError } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(path, 3600);
                
                if (signedError) {
                  console.error(`❌ Error generating signed URL for ${bucket}/${path}:`, signedError);
                  // Try with the original path if it's different
                  if (path !== doc.document_url) {
                    console.log(`🔄 Retrying with original path: ${doc.document_url}`);
                    const { data: altSignedData } = await supabase.storage
                      .from(bucket)
                      .createSignedUrl(doc.document_url, 3600);
                    
                    if (altSignedData?.signedUrl) {
                      docInfo.url = altSignedData.signedUrl;
                      console.log(`✅ Alternative signed URL generated for ${doc.document_type}`);
                    }
                  }
                } else if (signedData?.signedUrl) {
                  docInfo.url = signedData.signedUrl;
                  console.log(`✅ Signed URL generated for ${doc.document_type}: ${signedData.signedUrl.substring(0, 50)}...`);
                  
                  // ✅ DEBUG : Vérifier la validité de l'URL générée
                  if (!signedData.signedUrl.startsWith('http')) {
                    console.warn(`⚠️ Generated URL doesn't start with http: ${signedData.signedUrl}`);
                  }
                } else {
                  console.warn(`⚠️ No signed URL generated for ${doc.document_type}, keeping original: ${doc.document_url}`);
                }
              }
            } catch (urlError) {
              console.error(`❌ Error generating signed URL for ${doc.document_type}:`, urlError);
            }
          }

          // ✅ Ne catégoriser que les documents avec une URL valide
          if (!docInfo.url) {
            console.warn(`⚠️ Skipping document ${docInfo.id} - no valid URL available`);
            continue;
          }

          // Categorize by type with better type mapping
          const docType = docInfo.type?.toLowerCase();
          if (docType === 'identity' || docType === 'id-cards' || docType === 'passport' || docType === 'id' || docType === 'national_id') {
            categorizedDocs.identity.push(docInfo);
          } else if (docType === 'contract' || docType === 'contrat') {
            categorizedDocs.contract.push(docInfo);
          } else if (docType === 'police' || docType === 'police-form' || docType === 'fiche-police') {
            categorizedDocs.police.push(docInfo);
          } else {
            // Log unknown document type for debugging
            console.log(`⚠️ Unknown document type: ${docInfo.type}, categorizing as identity`);
            categorizedDocs.identity.push(docInfo);
          }
        }

        // ✅ PHASE 1 - DÉSACTIVÉ : Fallback storage.list (ANALYSE_PERFORMANCE_STORAGE_GUEST_DOCUMENTS.md)
        // Les appels à getDocumentUrlFromStorage() provoquaient 50 000+ requêtes /storage/v1/object/list/guest-documents
        // et saturaient la table objects (CPU 100%). La DB est désormais la seule source de vérité.
        // Si un document manque en DB, il sera indiqué dans missingTypes. La génération se fait via l'UI.
        if (categorizedDocs.contract.length === 0) {
          console.log(`ℹ️ No contract in DB for booking ${booking.id} (storage fallback disabled)`);
        }
        if (categorizedDocs.police.length === 0) {
          console.log(`ℹ️ No police form in DB for booking ${booking.id} (storage fallback disabled)`);
        }
        if (categorizedDocs.identity.length === 0) {
          console.log(`ℹ️ No identity doc in DB for booking ${booking.id} (storage fallback disabled)`);
        }

        // ✅ Mettre à jour documents_generated dans la table bookings
        const hasContract = categorizedDocs.contract.length > 0;
        const hasPolice = categorizedDocs.police.length > 0;
        const hasIdentity = categorizedDocs.identity.length > 0;
        
        if (hasContract || hasPolice || hasIdentity) {
          try {
            // Récupérer l'état actuel de documents_generated
            const { data: currentBooking } = await supabase
              .from('bookings')
              .select('documents_generated')
              .eq('id', booking.id)
              .single();
            
            const currentDocs = currentBooking?.documents_generated || {};
            const contractUrl = categorizedDocs.contract[0]?.url || currentDocs.contractUrl || null;
            const policeUrl = categorizedDocs.police[0]?.url || currentDocs.policeUrl || null;
            const identityUrl = categorizedDocs.identity[0]?.url || currentDocs.identityUrl || null;
            
            const updatedDocs = {
              ...currentDocs,
              contract: hasContract,
              policeForm: hasPolice,
              identity: hasIdentity,
              contractUrl: contractUrl || currentDocs.contractUrl,
              policeUrl: policeUrl || currentDocs.policeUrl,
              identityUrl: identityUrl || currentDocs.identityUrl,
              updatedAt: new Date().toISOString()
            };
            
            const { error: updateError } = await supabase
              .from('bookings')
              .update({
                documents_generated: updatedDocs,
                updated_at: new Date().toISOString()
              })
              .eq('id', booking.id);
            
            if (updateError) {
              console.error(`❌ Error updating documents_generated:`, updateError);
            } else {
              console.log(`✅ documents_generated updated successfully`, {
                contract: hasContract,
                policeForm: hasPolice,
                identity: hasIdentity
              });
            }
          } catch (updateError) {
            console.error(`❌ Error updating documents_generated:`, updateError);
          }
        }

        // Calculate summary
        const totalDocuments = categorizedDocs.identity.length + 
                              categorizedDocs.contract.length + 
                              categorizedDocs.police.length;

        const missingTypes: string[] = [];
        if (categorizedDocs.identity.length === 0) missingTypes.push('identity');
        if (categorizedDocs.contract.length === 0) missingTypes.push('contract');
        if (categorizedDocs.police.length === 0) missingTypes.push('police');

        const summary: GuestDocumentSummary = {
          bookingId: booking.id,
          guestCount: booking.guests?.length || 0,
          documents: categorizedDocs,
          summary: {
            totalDocuments,
            hasAllRequired: missingTypes.length === 0,
            missingTypes
          }
        };

        console.log(`✅ Processed booking ${booking.id}: ${totalDocuments} documents`);
        console.log(`📊 Document breakdown:`, {
          identity: categorizedDocs.identity.length,
          contract: categorizedDocs.contract.length,
          police: categorizedDocs.police.length,
          missingTypes: missingTypes
        });
        return summary;
      })
    );

    console.log(`✅ Returning ${results.length} processed bookings`);
    
    return new Response(JSON.stringify({
      success: true,
      bookings: results,
      totalBookings: results.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in get-guest-documents-unified:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ✅ TEST D'INTÉGRATION (optionnel - pour vérifier le fonctionnement)
// Pour tester localement avec une base sans colonnes legacy :
// curl -X POST http://localhost:54321/functions/v1/get-guest-documents-unified \
//   -H "Content-Type: application/json" \
//   -d '{"propertyId": "your-property-id"}'
//
// Résultat attendu : 200 OK avec bookings et documents, sans erreur 42703
