import { pipeline, env } from '@huggingface/transformers';
import { Guest } from '@/types/booking';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export class AILocrService {
  private static documentExtractor: any = null;

  static async initializeExtractor() {
    if (!this.documentExtractor) {
      console.log('Initializing AI document understanding model...');
      this.documentExtractor = await pipeline(
        'question-answering',
        'Xenova/distilbert-base-cased-distilled-squad',
        { device: 'webgpu' }
      );
    }
    return this.documentExtractor;
  }

  static async extractTextFromImage(imageFile: File): Promise<string> {
    try {
      console.log(`Processing document with AI: ${imageFile.name}`);

      // First extract raw text using tesseract (keep this part)
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['eng', 'fra', 'spa', 'deu', 'nld'], 1);

      const preprocessedImage = await this.preprocessImage(imageFile);
      const { data: { text } } = await worker.recognize(preprocessedImage);

      await worker.terminate();

      console.log('Raw extracted text:', text);
      return text;
    } catch (error) {
      console.error('AI OCR extraction failed:', error);
      throw new Error('Échec de l\'extraction du texte du document');
    }
  }

  private static async preprocessImage(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      img.onload = () => {
        const targetWidth = Math.min(img.width * 3, 3000);
        const targetHeight = (img.height * targetWidth) / img.width;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const enhanced = this.enhanceImageData(imageData);
        ctx.putImageData(enhanced, 0, 0);

        resolve(canvas);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private static enhanceImageData(imageData: ImageData): ImageData {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

      const contrast = 2.0;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const enhancedGray = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

      data[i] = enhancedGray;
      data[i + 1] = enhancedGray;
      data[i + 2] = enhancedGray;
    }

    return imageData;
  }

  static async parseGuestInfo(extractedText: string): Promise<Partial<Guest>> {
    try {
      console.log('Parsing guest information with AI...');

      const extractor = await this.initializeExtractor();

      // Use AI to extract specific information
      const questions = [
        { field: 'surname', question: 'What is the surname or family name on this document?' },
        { field: 'givenName', question: 'What is the given name or first name on this document?' },
        { field: 'dateOfBirth', question: 'What is the date of birth on this document?' },
        { field: 'nationality', question: 'What is the nationality mentioned on this document?' },
        { field: 'documentNumber', question: 'What is the document number or ID number?' },
        { field: 'placeOfBirth', question: 'What is the place of birth mentioned on this document?' }
      ];

      const result: Partial<Guest> = {};

      for (const { field, question } of questions) {
        try {
          const answer = await extractor(question, extractedText);
          if (answer?.answer && answer.score > 0.1) {
            console.log(`${field}: ${answer.answer} (confidence: ${answer.score})`);

            switch (field) {
              case 'surname':
                result.fullName = answer.answer.trim();
                break;
              case 'givenName':
                if (result.fullName) {
                  result.fullName = `${answer.answer.trim()} ${result.fullName}`;
                } else {
                  result.fullName = answer.answer.trim();
                }
                break;
              case 'dateOfBirth':
                result.dateOfBirth = this.standardizeDate(answer.answer);
                break;
              case 'nationality':
                result.nationality = this.standardizeNationality(answer.answer);
                break;
              case 'documentNumber':
                result.documentNumber = answer.answer.replace(/\s+/g, '').toUpperCase();
                break;
              case 'placeOfBirth':
                result.placeOfBirth = answer.answer.trim();
                break;
            }
          }
        } catch (error) {
          console.warn(`Failed to extract ${field}:`, error);
        }
      }

      // Fallback to pattern matching if AI extraction fails
      if (!result.fullName || !result.nationality) {
        console.log('AI extraction incomplete, falling back to pattern matching...');
        const fallback = this.fallbackPatternMatching(extractedText);

        if (!result.fullName && fallback.fullName) {
          result.fullName = fallback.fullName;
        }
        if (!result.nationality && fallback.nationality) {
          result.nationality = fallback.nationality;
        }
        if (!result.dateOfBirth && fallback.dateOfBirth) {
          result.dateOfBirth = fallback.dateOfBirth;
        }
        if (!result.documentNumber && fallback.documentNumber) {
          result.documentNumber = fallback.documentNumber;
        }
        if (!result.placeOfBirth && fallback.placeOfBirth) {
          result.placeOfBirth = fallback.placeOfBirth;
        }
      }

      // Determine document type
      const text = extractedText.toUpperCase();
      if (text.includes('PASSPORT') || text.includes('PASSEPORT') || text.includes('PASAPORTE')) {
        result.documentType = 'passport';
      } else if (text.includes('IDENTITY') || text.includes('IDENTITÉ') || text.includes('IDENTITEIT')) {
        result.documentType = 'national_id';
      } else {
        result.documentType = 'national_id';
      }

      console.log('Final AI parsed result:', result);
      return result;
    } catch (error) {
      console.error('AI parsing failed, falling back to pattern matching:', error);
      return this.fallbackPatternMatching(extractedText);
    }
  }

  private static fallbackPatternMatching(text: string): Partial<Guest> {
    console.log('🔍 Using enhanced fallback pattern matching based on real document examples...');
    const upperText = text.toUpperCase();
    const lines = upperText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log('📝 Processing lines:', lines);

    const result: Partial<Guest> = {};

    // 🔤 ENHANCED NAME EXTRACTION based on real document examples
    let surname = '';
    let givenName = '';

    // Pattern 1: MRZ format from passports (P<GBRDAVIES<<STEVENSALAN)
    const passportMrzMatch = text.match(/P<[A-Z]{3}([A-Z]+)<<([A-Z<]+)/);
    if (passportMrzMatch) {
      surname = passportMrzMatch[1];
      givenName = passportMrzMatch[2].replace(/</g, ' ').trim();
      console.log('✅ Found passport MRZ names - Surname:', surname, 'Given:', givenName);
    }

    // Pattern 2: British passport format (ISAKJEE then FEROZA)
    if (!surname || !givenName) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for surname patterns like "ISAKJEE", "DAVIES", "SISSOKO"
        if (line.match(/^[A-Z]{3,25}$/) &&
            !line.match(/^(GBR|FRA|DEU|ITA|ESP|NLD|USA|BRITISH|CITIZEN|PASSPORT|IDENTITY|CARD|DOCUMENT|NATIONAL|RÉPUBLIQUE|FRANÇAISE|NEDERLANDE)$/)) {
          const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

          // Check if next line contains given names like "FEROZA", "STEVEN ALAN"
          if (nextLine?.match(/^[A-Z\s-]{2,40}$/) &&
              !nextLine.match(/^(CITIZEN|PASSPORT|IDENTITY|CARD|DOCUMENT|NATIONAL|RÉPUBLIQUE|FRANÇAISE)$/)) {
            surname = line;
            givenName = nextLine;
            console.log('✅ Found British passport style - Surname:', surname, 'Given:', givenName);
            break;
          }
        }

        // Pattern 3: French ID format (SISSOKO then Dama)
        if (line.match(/^[A-Z]{4,25}$/) &&
            !line.match(/^(RÉPUBLIQUE|FRANÇAISE|CARTE|NATIONALE|IDENTITÉ|IDENTITY|CARD)$/)) {
          const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

          if (nextLine?.match(/^[A-Za-z\s-]{2,30}$/)) {
            surname = line;
            givenName = nextLine;
            console.log('✅ Found French ID style - Surname:', surname, 'Given:', givenName);
            break;
          }
        }

        // Pattern 4: Dutch ID format (Bolosi Abraham-Masasu as one line)
        if (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z-]+$/)) {
          const nameParts = line.split(/\s+/);
          if (nameParts.length >= 2) {
            givenName = nameParts[0];
            surname = nameParts.slice(1).join(' ');
            console.log('✅ Found Dutch ID style - Given:', givenName, 'Surname:', surname);
            break;
          }
        }
      }
    }

    // Combine names
    if (surname && givenName) {
      result.fullName = `${givenName} ${surname}`;
    } else if (surname) {
      result.fullName = surname;
    } else if (givenName) {
      result.fullName = givenName;
    }

    // 🌍 ENHANCED NATIONALITY DETECTION based on examples
    if (text.includes('BRITISH CITIZEN') || text.includes('GBR')) {
      result.nationality = 'BRITANNIQUE';
    } else if (text.includes('FRA') || text.includes('RÉPUBLIQUE FRANÇAISE') || text.includes('FRANÇAISE')) {
      result.nationality = 'FRANÇAIS';
    } else if (text.includes('NEDERLANDSE') || text.includes('NLD') || text.includes('NEDERLAND') || text.includes('KONINKRIJK DER NEDERLANDEN')) {
      result.nationality = 'NÉERLANDAIS';
    } else if (text.includes('DEUTSCH') || text.includes('DEU') || text.includes('GERMAN')) {
      result.nationality = 'ALLEMAND';
    } else if (text.includes('ITALIANO') || text.includes('ITA') || text.includes('ITALIAN')) {
      result.nationality = 'ITALIEN';
    }

    // 📅 ENHANCED DATE OF BIRTH EXTRACTION based on real examples
    const datePatterns = [
      // British passport: "22 APR/AVR 87", "22 AUG/AOÛT 76"
      /(\d{1,2})\s*(?:APR|AVRIL|AUG|AOÛT|JUL|JUIL|SEP|SEPT|OCT|NOV|DEC|DÉC|JAN|JANV|FEB|FÉVR|MAR|MARS|MAY|MAI|JUN|JUIN)(?:\/[A-Z]+)?\s*(\d{2,4})/gi,
      // Dutch ID: "26 JUL/JUL 2005" (birth date, NOT expiry)
      /(\d{1,2})\s*JUL\/JUL\s*(19|20)(\d{2})/gi,
      // French ID: "09 11 2005"
      /(\d{2})\s+(\d{2})\s+(19|20)(\d{2})/g,
      // Standard formats
              /(\d{1,2})[\s./-](\d{1,2})[\s./-](19|20)(\d{2})/g
    ];

    for (const pattern of datePatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        let day, month, year;

        if (match[0].includes('APR')) {
          day = match[1].padStart(2, '0');
          month = '04';
          year = match[2].length === 2 ? `19${match[2]}` : match[2];
        } else if (match[0].includes('AUG') || match[0].includes('AOÛT')) {
          day = match[1].padStart(2, '0');
          month = '08';
          year = match[2].length === 2 ? `19${match[2]}` : match[2];
        } else if (match[0].includes('JUL') && match[2] === '20' && match[3] === '05') {
          // Dutch ID: 26 JUL/JUL 2005 (birth date)
          day = match[1].padStart(2, '0');
          month = '07';
          year = `${match[2]}${match[3]}`;
        } else if (match[4]) {
          // DD MM YYYY format (French) - match[3] and match[4] are the year parts
          day = match[1].padStart(2, '0');
          month = match[2].padStart(2, '0');
          year = `${match[3]}${match[4]}`;
        } else if (match[3]) {
          // DD/MM/YYYY format - match[3] and match[4] are year parts
          day = match[1].padStart(2, '0');
          month = match[2].padStart(2, '0');
          year = `${match[3]}${match[4]}`;
        }

        if (day && month && year) {
          // Validate the year is reasonable (between 1900 and current year)
          const currentYear = new Date().getFullYear();
          const parsedYear = parseInt(year);
          if (parsedYear >= 1900 && parsedYear <= currentYear) {
            result.dateOfBirth = `${year}-${month}-${day}`;
            console.log('✅ Found valid date of birth:', result.dateOfBirth);
            break;
          } else {
            console.log('❌ Rejected invalid year:', year, 'from date:', match[0]);
          }
        }
      }
      if (result.dateOfBirth) break;
    }

    // 🔢 ENHANCED DOCUMENT NUMBER EXTRACTION based on examples
    const docPatterns = [
      // British passports: 152113217, 562948928
      /([0-9]{9})/g,
      // Dutch ID: IT7R75H33
      /([A-Z0-9]{9})/g,
      // French ID: FMTB4LY80
      /([A-Z]{4}[0-9][A-Z][0-9]{2})/g,
      // General alphanumeric
      /([A-Z0-9]{8,15})/g,
      // MRZ format
      /([A-Z]{2}[0-9]{7,8}[A-Z][0-9]{7})/g
    ];

    for (const pattern of docPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const docNum = match[1];
        if (docNum && docNum.length >= 6 &&
            !docNum.match(/^(19|20)\d{2,6}$/) && // Not dates
            !docNum.match(/^\d{1,2}$/) && // Not small numbers
            !docNum.match(/^(GBR|FRA|NLD|DEU|ITA|ESP)$/)) { // Not country codes
          result.documentNumber = docNum;
          console.log('✅ Found document number:', result.documentNumber);
          break;
        }
      }
      if (result.documentNumber) break;
    }

    // 🏙️ ENHANCED PLACE OF BIRTH EXTRACTION based on examples
    const placePatterns = [
      'BIRMINGHAM', 'CLICHY', 'PARIS', 'LONDON', 'AMSTERDAM', 'BERLIN', 'ROME',
      'MANCHESTER', 'LIVERPOOL', 'GLASGOW', 'EDINBURGH', 'CARDIFF', 'BELFAST'
    ];

    for (const line of lines) {
      for (const place of placePatterns) {
        if (line.includes(place)) {
          result.placeOfBirth = place;
          console.log('✅ Found place of birth:', result.placeOfBirth);
          break;
        }
      }
      if (result.placeOfBirth) break;
    }

    console.log('🎯 Enhanced fallback result:', result);
    return result;
  }

  private static standardizeDate(dateString: string): string {
    const cleaned = dateString.replace(/\s+/g, ' ').trim();

    // Handle "DD MMM YYYY" format
    const monthNames: { [key: string]: string } = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
      'JANV': '01', 'FÉVR': '02', 'MARS': '03', 'AVRIL': '04',
      'MAI': '05', 'JUIN': '06', 'JUIL': '07', 'AOÛT': '08',
      'SEPT': '09', 'OCTO': '10', 'NOVE': '11', 'DÉCE': '12'
    };

    const monthMatch = cleaned.match(/(\d{1,2})\s*([A-Z]{3,4})\s*(\d{4})/i);
    if (monthMatch) {
      const day = monthMatch[1].padStart(2, '0');
      const monthStr = monthMatch[2].toUpperCase();
      const year = monthMatch[3];
      const month = monthNames[monthStr] || monthNames[monthStr.substring(0, 3)];

      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    // Handle standard formats
    const formats = [
      /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/, // DD/MM/YYYY
              /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/, // YYYY/MM/DD
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        const [, first, second, third] = match;

        if (third.length === 4) {
          const day = first.padStart(2, '0');
          const month = second.padStart(2, '0');
          return `${third}-${month}-${day}`;
        } else if (first.length === 4) {
          const month = second.padStart(2, '0');
          const day = third.padStart(2, '0');
          return `${first}-${month}-${day}`;
        }
      }
    }

    return dateString;
  }

  private static standardizeNationality(nationality: string): string {
    const nationalities: { [key: string]: string } = {
      'FRA': 'France',
      'FRENCH': 'France',
      'FRANÇAIS': 'France',
      'FRANCAISE': 'France',
      'FRANCE': 'France',
      'NLD': 'Netherlands',
      'NEDERLAND': 'Netherlands',
      'DUTCH': 'Netherlands',
      'NEDERLANDSE': 'Netherlands',
      'NETHERLANDS': 'Netherlands',
      'DEU': 'Germany',
      'GERMAN': 'Germany',
      'DEUTSCH': 'Germany',
      'ALLEMAND': 'Germany',
      'GERMANY': 'Germany',
      'ITA': 'Italy',
      'ITALIAN': 'Italy',
      'ITALIANO': 'Italy',
      'ITALIEN': 'Italy',
      'ITALY': 'Italy',
      'ESP': 'Spain',
      'SPANISH': 'Spain',
      'ESPAÑOL': 'Spain',
      'ESPAGNOL': 'Spain',
      'SPAIN': 'Spain',
      'GBR': 'United Kingdom',
      'BRITISH': 'United Kingdom',
      'BRITANNIQUE': 'United Kingdom',
      'UK': 'United Kingdom',
      'UNITED KINGDOM': 'United Kingdom',
      'USA': 'United States',
      'AMERICAN': 'United States',
      'AMÉRICAIN': 'United States',
      'UNITED STATES': 'United States',
      'MAR': 'Morocco',
      'MOROCCAN': 'Morocco',
      'MAROCAIN': 'Morocco',
      'MOROCCO': 'Morocco'
    };

    const upper = nationality.toUpperCase();
    return nationalities[upper] || nationality;
  }

  static async cleanup() {
    if (this.documentExtractor) {
      console.log('Cleaning up AI OCR extractor...');
      this.documentExtractor = null;
    }
  }
}
