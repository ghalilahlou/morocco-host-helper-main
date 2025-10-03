/**
 * Utilitaires pour la gestion des signatures
 */

/**
 * Convertit une signature SVG en image PNG pour l'embedding dans PDF
 */
export async function convertSvgToPng(svgData: string): Promise<string | null> {
  try {
    // Créer un canvas temporaire
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Créer une image à partir du SVG
    const img = new Image();
    
    return new Promise((resolve) => {
      img.onload = () => {
        // Définir la taille du canvas
        canvas.width = img.width || 400;
        canvas.height = img.height || 200;
        
        // Dessiner l'image sur le canvas
        ctx.drawImage(img, 0, 0);
        
        // Convertir en PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      };
      
      img.onerror = () => {
        console.warn('Failed to load SVG image');
        resolve(null);
      };
      
      // Charger le SVG
      img.src = svgData;
    });
  } catch (error) {
    console.error('Error converting SVG to PNG:', error);
    return null;
  }
}

/**
 * Valide et normalise une signature pour l'embedding dans PDF
 */
export async function normalizeSignatureForPdf(signature: string | null | undefined): Promise<string | null> {
  if (!signature) return null;

  // Si c'est déjà une image PNG/JPEG, on peut l'utiliser directement
  if (signature.startsWith('data:image/png') || signature.startsWith('data:image/jpeg')) {
    return signature;
  }

  // Si c'est un SVG, on le convertit en PNG
  if (signature.startsWith('data:image/svg') || signature.includes('<svg')) {
    console.log('🔄 Converting SVG signature to PNG for PDF embedding...');
    const pngSignature = await convertSvgToPng(signature);
    if (pngSignature) {
      console.log('✅ SVG signature converted to PNG successfully');
      return pngSignature;
    } else {
      console.warn('⚠️ Failed to convert SVG signature to PNG');
      return null;
    }
  }

  // Si c'est une URL, on la retourne telle quelle (l'Edge Function s'en occupera)
  if (signature.startsWith('http')) {
    return signature;
  }

  // Autres formats non supportés
  console.warn('⚠️ Unsupported signature format:', signature.substring(0, 50) + '...');
  return null;
}

/**
 * Récupère la signature d'hôte depuis les données de profil
 */
export function extractHostSignature(hostData: any): string | null {
  if (!hostData) return null;

  // Priorité des champs de signature
  const signatureFields = [
    'signature_url',
    'signature_image_url', 
    'signature_svg',
    'signature'
  ];

  for (const field of signatureFields) {
    if (hostData[field]) {
      console.log(`🔍 Found host signature in field: ${field}`);
      return hostData[field];
    }
  }

  return null;
}

/**
 * Construit le nom d'affichage de l'hôte
 */
export function buildHostDisplayName(hostData: any, propertyData?: any): string {
  if (!hostData) {
    // Fallback sur les données de propriété
    if (propertyData?.contact_info?.name) {
      return propertyData.contact_info.name;
    }
    if (propertyData?.name) {
      return propertyData.name;
    }
    return '';
  }

  // Priorité: full_name
  if (hostData.full_name) {
    return hostData.full_name;
  }

  // Fallback: first_name + last_name
  if (hostData.first_name && hostData.last_name) {
    return `${hostData.first_name} ${hostData.last_name}`;
  }

  // Fallback: first_name seul
  if (hostData.first_name) {
    return hostData.first_name;
  }

  // Fallback: last_name seul
  if (hostData.last_name) {
    return hostData.last_name;
  }

  // Dernier fallback: données de propriété
  if (propertyData?.contact_info?.name) {
    return propertyData.contact_info.name;
  }
  if (propertyData?.name) {
    return propertyData.name;
  }

  return '';
}

/**
 * Construit les variables de contrat avec les données d'hôte
 */
export function buildContractVariables(
  hostData: any,
  propertyData: any,
  bookingData: any
): Record<string, any> {
  const hostName = buildHostDisplayName(hostData, propertyData);
  const hostSignature = extractHostSignature(hostData);

  const variables: Record<string, any> = {
    // Données hôte
    HOST_NAME: hostName,
    HOST_FULL_NAME: hostName,
    HOST_FIRST_NAME: hostData?.first_name || '',
    HOST_LAST_NAME: hostData?.last_name || '',
    HOST_PHONE: hostData?.phone || propertyData?.contact_info?.phone || '',
    
    // Données propriété
    PROPERTY_NAME: propertyData?.name || '',
    PROPERTY_ADDRESS: propertyData?.address || '',
    PROPERTY_CITY: propertyData?.city || '',
    PROPERTY_TYPE: propertyData?.property_type || '',
    PROPERTY_MAX_GUESTS: propertyData?.max_guests || '',
    
    // Données réservation
    BOOKING_ID: bookingData?.id || '',
    CHECK_IN_DATE: bookingData?.check_in_date || '',
    CHECK_OUT_DATE: bookingData?.check_out_date || '',
    NUMBER_OF_GUESTS: bookingData?.number_of_guests || bookingData?.guests?.length || 0,
    
    // Signatures
    HOST_SIGNATURE_URL: hostSignature || '',
    HOST_SIGNATURE_IMAGE: hostSignature || '',
    HOST_SIGNATURE_SVG: hostData?.signature_svg || '',
    
    // Invités
    GUEST_NAMES: bookingData?.guests?.map((g: any) => g.full_name).join(', ') || '',
    FIRST_GUEST_NAME: bookingData?.guests?.[0]?.full_name || '',
    FIRST_GUEST_DOCUMENT: bookingData?.guests?.[0]?.document_number || '',
    FIRST_GUEST_NATIONALITY: bookingData?.guests?.[0]?.nationality || '',
  };

  // Log des variables construites
  console.log('🔍 Contract variables built:', {
    HOST_NAME: variables.HOST_NAME,
    PROPERTY_ADDRESS: variables.PROPERTY_ADDRESS,
    hasHostSignature: !!variables.HOST_SIGNATURE_URL,
    signatureType: hostSignature?.startsWith('data:image/svg') ? 'SVG' : 
                  hostSignature?.startsWith('data:image/') ? 'DataURL' :
                  hostSignature?.startsWith('http') ? 'URL' : 'None'
  });

  return variables;
}
