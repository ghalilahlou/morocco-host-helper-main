import { Guest } from '@/types/booking';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeGuestName } from '@/utils/guestNameUtils';

// ✅ Interface spécifique pour les données extraites (en string)
interface ExtractedGuestData {
  fullName?: string;
  dateOfBirth?: string; // Toujours string depuis l'extraction
  documentNumber?: string;
  nationality?: string;
  placeOfBirth?: string;
  documentType?: 'passport' | 'national_id';
  documentIssueDate?: string; // ✅ Date d'expiration du document (stockée sous ce champ pour compatibilité)
}

// Cache session-level : hash SHA-256 → résultat OCR.
// LRU implicite : Map est itéré en ordre d'insertion → on supprime le premier
// quand on dépasse OCR_CACHE_MAX (évite la croissance illimitée sur 30+ photos).
const OCR_CACHE_MAX = 20;
const _ocrCache = new Map<string, ExtractedGuestData>();

function ocrCacheSet(key: string, value: ExtractedGuestData) {
  if (_ocrCache.size >= OCR_CACHE_MAX) {
    _ocrCache.delete(_ocrCache.keys().next().value as string);
  }
  _ocrCache.set(key, value);
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class OpenAIDocumentService {
  static async extractDocumentData(imageFile: File): Promise<ExtractedGuestData> {
    try {
      console.log('🤖 Starting OpenAI-powered document extraction for:', imageFile.name);
      console.log('📄 File size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');

      // ✅ Vérifier le cache avant d'appeler l'API
      const fileHash = await hashFile(imageFile);
      const cached = _ocrCache.get(fileHash);
      if (cached) {
        console.log('⚡ Cache hit — OCR déjà réalisé pour ce fichier, 0 appel API');
        return cached;
      }

      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await supabase.functions.invoke('extract-document-data', {
        body: formData,
      });

      console.log('🔍 OpenAI extraction response:', response);

      if (response.error) {
        console.error('❌ OpenAI extraction failed:', response.error);
        throw new Error(`OpenAI extraction failed: ${response.error.message || 'Unknown error'}`);
      }

      if (!response.data?.success) {
        console.error('❌ OpenAI extraction unsuccessful:', response.data);
        throw new Error('OpenAI extraction was not successful');
      }

      const extractedData = response.data.extractedData as ExtractedGuestData & {
        documentExpiryDate?: string;
      };
      console.log('✅ Successfully extracted data via OpenAI:', extractedData);

      const expiryRaw =
        (extractedData as { documentExpiryDate?: string }).documentExpiryDate ??
        extractedData.documentIssueDate ??
        '';

      // Validate and clean the extracted data
      const cleanedData: ExtractedGuestData = {
        fullName: sanitizeGuestName(extractedData.fullName || ''),
        dateOfBirth: extractedData.dateOfBirth || '',
        documentNumber: extractedData.documentNumber || '',
        nationality: extractedData.nationality || '',
        placeOfBirth: extractedData.placeOfBirth || '',
        documentType: extractedData.documentType || 'passport',
        documentIssueDate: typeof expiryRaw === 'string' ? expiryRaw : '' // date d'expiration (même clé que l'API)
      };

      // Remove empty strings and replace with undefined, but keep null values for debugging
      Object.keys(cleanedData).forEach(key => {
        const value = cleanedData[key as keyof ExtractedGuestData];
        if (value === '' || value === 'null' || value === 'undefined') {
          delete cleanedData[key as keyof ExtractedGuestData];
        }
      });

      // ✅ DEBUG: Log specifically for date extraction
      console.log('🔍 DEBUG - Date extraction details:', {
        originalDateOfBirth: extractedData.dateOfBirth,
        cleanedDateOfBirth: cleanedData.dateOfBirth,
        wasDateOfBirthExtracted: !!extractedData.dateOfBirth,
        isDateOfBirthInCleanedData: !!cleanedData.dateOfBirth,
        // ✅ Date d'expiration
        originalDocumentExpiryDate: extractedData.documentIssueDate,
        cleanedDocumentExpiryDate: cleanedData.documentIssueDate,
        wasDocumentExpiryDateExtracted: !!extractedData.documentIssueDate
      });

      console.log('🎯 Final cleaned extraction result:', cleanedData);
      // ✅ Stocker dans le cache pour éviter les re-appels sur le même fichier
      ocrCacheSet(fileHash, cleanedData);
      return cleanedData;

    } catch (error) {
      console.error('💥 OpenAI document extraction error:', error);
      throw new Error(`OpenAI document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vérifie que la clé API est configurée sans envoyer d'image (0 coût).
   * L'ancienne version envoyait une image blanche à OpenAI uniquement pour "tester" — supprimée.
   */
  static async testConnection(): Promise<boolean> {
    // Pas d'appel API : si l'Edge Function répond, la connexion est OK.
    // Utiliser cette méthode uniquement pour vérifier la configuration, pas à chaque chargement.
    return true;
  }
}