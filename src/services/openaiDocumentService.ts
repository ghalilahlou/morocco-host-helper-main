import { Guest } from '@/types/booking';
import { supabase } from '@/integrations/supabase/client';

// ✅ Interface spécifique pour les données extraites (en string)
interface ExtractedGuestData {
  fullName?: string;
  dateOfBirth?: string; // Toujours string depuis l'extraction
  documentNumber?: string;
  nationality?: string;
  placeOfBirth?: string;
  documentType?: 'passport' | 'national_id';
}

// ✅ NOUVEAU : Fonction pour nettoyer le nom extrait
function cleanExtractedName(name: string): string {
  if (!name || name.trim() === '') return '';
  
  // Nettoyer le nom des éléments indésirables
  let cleanedName = name.trim();
  
  // Supprimer les patterns communs qui ne sont pas des noms
  const unwantedPatterns = [
    /phone\s*number/i,
    /phone/i,
    /address/i,
    /adresse/i,
    /email/i,
    /tel/i,
    /mobile/i,
    /fax/i,
    /^[A-Z0-9]{6,}$/, // Codes alphanumériques longs
    /^\d+$/, // Que des chiffres
    /^[A-Z]{2,}\d+$/, // Combinaisons lettres+chiffres comme "JBFDPhone"
  ];
  
  for (const pattern of unwantedPatterns) {
    if (pattern.test(cleanedName)) {
      console.log('🧹 Nom nettoyé - pattern indésirable détecté:', cleanedName);
      return ''; // Retourner vide si le nom contient des éléments indésirables
    }
  }
  
  // Vérifier que le nom contient au moins des lettres
  if (!/[a-zA-Z]/.test(cleanedName)) {
    console.log('🧹 Nom nettoyé - pas de lettres détectées:', cleanedName);
    return '';
  }
  
  // Nettoyer les espaces multiples
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();
  
  console.log('✅ Nom nettoyé avec succès:', cleanedName);
  return cleanedName;
}

export class OpenAIDocumentService {
  static async extractDocumentData(imageFile: File): Promise<ExtractedGuestData> {
    try {
      console.log('🤖 Starting OpenAI-powered document extraction for:', imageFile.name);
      console.log('📄 File size:', (imageFile.size / 1024 / 1024).toFixed(2), 'MB');

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

      const extractedData = response.data.extractedData;
      console.log('✅ Successfully extracted data via OpenAI:', extractedData);

      // Validate and clean the extracted data
      const cleanedData: ExtractedGuestData = {
        fullName: cleanExtractedName(extractedData.fullName || ''),
        dateOfBirth: extractedData.dateOfBirth || '',
        documentNumber: extractedData.documentNumber || '',
        nationality: extractedData.nationality || '',
        placeOfBirth: extractedData.placeOfBirth || '',
        documentType: extractedData.documentType || 'passport'
      };

      // Remove empty strings and replace with undefined, but keep null values for debugging
      Object.keys(cleanedData).forEach(key => {
        const value = cleanedData[key as keyof ExtractedGuestData];
        if (value === '' || value === 'null' || value === 'undefined') {
          delete cleanedData[key as keyof ExtractedGuestData];
        }
      });

      // ✅ DEBUG: Log specifically for dateOfBirth extraction
      console.log('🔍 DEBUG - Date extraction details:', {
        originalDateOfBirth: extractedData.dateOfBirth,
        cleanedDateOfBirth: cleanedData.dateOfBirth,
        wasDateOfBirthExtracted: !!extractedData.dateOfBirth,
        isDateOfBirthInCleanedData: !!cleanedData.dateOfBirth
      });

      console.log('🎯 Final cleaned extraction result:', cleanedData);
      return cleanedData;

    } catch (error) {
      console.error('💥 OpenAI document extraction error:', error);
      throw new Error(`OpenAI document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async testConnection(): Promise<boolean> {
    try {
      // Create a small test image to verify the service is working
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText('TEST', 30, 50);
      }

      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }

          try {
            const testFile = new File([blob], 'test.png', { type: 'image/png' });
            await this.extractDocumentData(testFile);
            resolve(true);
          } catch (error) {
            console.error('OpenAI service test failed:', error);
            resolve(false);
          }
        }, 'image/png');
      });
    } catch (error) {
      console.error('OpenAI service test error:', error);
      return false;
    }
  }
}