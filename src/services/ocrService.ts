
import { createWorker } from 'tesseract.js';
import { Guest } from '@/types/booking';

export class OCRService {
  private static worker: any = null;
  private static supportedLanguages = [
    'eng', 'fra', 'spa', 'deu', 'ita', 'por', 'ara', 'rus', 'chi_sim', 'chi_tra',
    'jpn', 'kor', 'tur', 'pol', 'nld', 'swe', 'nor', 'dan', 'fin', 'ces', 'hun'
  ];

  static async initializeWorker() {
    if (!this.worker) {
      console.log('Initializing enhanced OCR worker with multi-language support...');
      this.worker = await createWorker(['eng', 'fra', 'spa', 'deu', 'nld'], 1, {
        logger: m => console.log('OCR:', m.status, m.progress)
      });
      
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,/-:()[]{}àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1'
      });
    }
    return this.worker;
  }

  static async extractTextFromImage(imageFile: File): Promise<string> {
    try {
      console.log(`Processing document: ${imageFile.name}`);
      
      const preprocessedImage = await this.preprocessImage(imageFile);
      const worker = await this.initializeWorker();
      const { data: { text, confidence } } = await worker.recognize(preprocessedImage);
      
      console.log(`OCR completed with ${confidence}% confidence`);
      console.log('Raw extracted text:', text);
      
      return text;
    } catch (error) {
      console.error('OCR extraction failed:', error);
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

  static parseGuestInfo(extractedText: string): Partial<Guest> {
    console.log('Parsing guest information from text...');
    const text = extractedText.toUpperCase();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('Text lines:', lines);
    
    const result: Partial<Guest> = {};

    // Enhanced patterns for different ID formats with more comprehensive matching
    const patterns = {
      // Names - Handle various formats including multiple lines and different structures
      surname: [
        /(?:NOM|SURNAME|ACHTERNAAM|FAMILY\s*NAME|APELLIDO)[\/\s:]*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-\s]+?)(?:\n|$|PRÉNOM|GIVEN|VOORNAAM)/i,
        /(?:^|\n)([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-]{3,25})(?:\s*$|\n)/gm, // Single capitalized word on its own line
        /(?:^|\n)([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-\s]{3,30}?)(?:\s*$|\n)/gm // Multi-word surname
      ],
      
      givenName: [
        /(?:PRÉNOM|GIVEN\s*NAME|VOORNAAM|PRÉNOMS|FIRST\s*NAME|NOMBRE)[S]*[\/\s:]*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-\s]+?)(?:\n|$|SEXE|SEX|M\/M|F\/F|NATIONALITÉ|DATE)/i,
        /(?:PRÉNOM|GIVEN\s*NAME|VOORNAAM|PRÉNOMS)[S]*[\/\s:]*([A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-\s]+?)(?:\n|DATE|SEXE|SEX|BIRTH)/i,
        // For documents where names appear on consecutive lines - more specific
        /(?:^|\n)([A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-\s]{2,25})(?:\s*$|\n)/gm
      ],

      // Date of birth - Enhanced with more formats and separators
      dateOfBirth: [
        /(?:DATE\s*DE\s*NAISS|DATE\s*OF\s*BIRTH|GEBOREN|BIRTH\s*DATE|GEB|FECHA\s*DE\s*NAC)[A-Z]*[\/\s:]*(\d{1,2}[\s\.\/-]\d{1,2}[\s\.\/-]\d{4})/i,
        /(?:DATE\s*DE\s*NAISS|DATE\s*OF\s*BIRTH|GEBOREN|BIRTH\s*DATE|GEB)[A-Z]*[\/\s:]*(\d{1,2}\s*[A-Z]{3}[A-Z]*[\s\.\/-]*\d{4})/i,
        /(\d{1,2}\s*[A-Z]{3}[A-Z]*[\s\.\/-]*\d{4})/gi, // 26 JUL 2005 format
        /(\d{1,2}[\s\.\/-]\d{1,2}[\s\.\/-]\d{4})/g, // DD/MM/YYYY or MM/DD/YYYY
        /(\d{4}[\s\.\/-]\d{1,2}[\s\.\/-]\d{1,2})/g, // YYYY-MM-DD format
        /(\d{2}[\s\.\/-]\d{2}[\s\.\/-]\d{4})/g // DD-MM-YYYY or MM-DD-YYYY
      ],

      // Document number - More comprehensive patterns
      documentNumber: [
        /(?:N°\s*DU\s*DOCUMENT|DOCUMENT\s*NO|DOCUMENTNR|DOC\s*NO|NUMERO)[\/\s:]*([A-Z0-9]{6,15})/i,
        /(?:ID\s*NO|IDENTITY\s*NO|AUSWEIS)[\/\s:]*([A-Z0-9]{6,15})/i,
        /([A-Z]{2,4}[0-9]{2}[A-Z0-9]{3,8})/g, // Pattern like FMTB4LY80, IT7R75H33
        /([A-Z]{1,3}[0-9]{6,12}[A-Z]*)/g, // Pattern with letters + numbers
        /([0-9A-Z]{8,15})/g, // Generic alphanumeric patterns
        /([0-9]{6,12})/g // Pure numeric patterns
      ],

      // Nationality - Much more comprehensive patterns
      nationality: [
        /(?:NATIONALITÉ|NATIONALITY|NAT|STAATSANGEHÖRIGKEIT)[\/\s:]*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ]{2,20})/i,
        /(?:FRANÇAIS|FRANÇAISE|FRENCH|FRA|FRANCE)/gi,
        /(?:NEDERLAND|NETHERLANDS|DUTCH|NLD|NÉERLANDAIS|NÉERLANDAISE)/gi,
        /(?:GERMAN|DEUTSCH|DEU|GERMANY|ALLEMAND|ALLEMANDE)/gi,
        /(?:ITALIAN|ITALIANO|ITA|ITALY|ITALIEN|ITALIENNE)/gi,
        /(?:SPANISH|ESPAÑOL|ESP|SPAIN|ESPAGNOL|ESPAGNOLE)/gi,
        /(?:BRITISH|ENGLISH|GBR|UK|BRITANNIQUE)/gi,
        /(?:AMERICAN|USA|US|AMÉRICAIN|AMÉRICAINE)/gi,
        /(?:BELGIAN|BELGE|BEL|BELGIUM)/gi,
        /(?:PORTUGUESE|PORTUGUÊS|POR|PORTUGAL|PORTUGAIS|PORTUGAISE)/gi,
        // Enhanced pattern for 3-letter country codes
        /\b([A-Z]{3})\b(?=\s|$)/g
      ],

      // Place of birth
      placeOfBirth: [
        /(?:LIEU\s*DE\s*NAISSANCE|PLACE\s*OF\s*BIRTH|GEBOORTEPLAATS|BIRTH\s*PLACE|LUGAR\s*DE\s*NAC)[A-Z]*[\/\s:]*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-\s,]+?)(?:\n|$)/i
      ]
    };

    let surname = '';
    let givenName = '';

    // Extract surname
    for (const pattern of patterns.surname) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        surname = match[1].trim();
        console.log('Found surname:', surname);
        break;
      }
    }

    // Extract given name
    for (const pattern of patterns.givenName) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        givenName = match[1].trim();
        console.log('Found given name:', givenName);
        break;
      }
    }

    // Try to extract names from specific lines for various ID formats
    if (!surname || !givenName) {
      console.log('Attempting to extract names from consecutive lines...');
      
      // Strategy 1: Look for surname followed by given name
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();
        
        // Check if current line looks like a surname (all caps, reasonable length)
        if (line.match(/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-]{3,25}$/) && 
            !line.match(/^(CARTE|IDENTITY|RÉPUBLIQUE|FRANÇAISE|NEDERLANDS|PASSPORT|ID|CARD|DOCUMENT|NATIONAL|FRANCE|NEDERLAND)$/) &&
            nextLine && nextLine.match(/^[A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-\s]{2,30}$/)) {
          surname = line;
          givenName = nextLine;
          console.log('Found names from consecutive lines - Surname:', surname, 'Given:', givenName);
          break;
        }
      }
      
      // Strategy 2: Try reverse order (given name first, then surname)
      if (!surname || !givenName) {
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          const nextLine = lines[i + 1].trim();
          
          if (line.match(/^[A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-\s]{2,30}$/) &&
              nextLine.match(/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-]{3,25}$/) &&
              !nextLine.match(/^(CARTE|IDENTITY|RÉPUBLIQUE|FRANÇAISE|NEDERLANDS|PASSPORT|ID|CARD|DOCUMENT|NATIONAL|FRANCE|NEDERLAND)$/)) {
            givenName = line;
            surname = nextLine;
            console.log('Found names in reverse order - Given:', givenName, 'Surname:', surname);
            break;
          }
        }
      }
      
      // Strategy 3: Look for names on the same line separated by space
      if (!surname || !givenName) {
        for (const line of lines) {
          // Pattern: SURNAME Given Names
          const nameMatch1 = line.match(/^([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-]+)\s+([A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-\s]+)$/);
          if (nameMatch1 && !surname && !givenName) {
            surname = nameMatch1[1];
            givenName = nameMatch1[2];
            console.log('Found names on same line (SURNAME Given) - Surname:', surname, 'Given:', givenName);
            break;
          }
          
          // Pattern: Given SURNAME (less common but possible)
          const nameMatch2 = line.match(/^([A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\-]+)\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\-]+)$/);
          if (nameMatch2 && !surname && !givenName && nameMatch2[2].length > 2) {
            givenName = nameMatch2[1];
            surname = nameMatch2[2];
            console.log('Found names on same line (Given SURNAME) - Given:', givenName, 'Surname:', surname);
            break;
          }
        }
      }
    }

    // Construct full name
    if (surname && givenName) {
      result.fullName = `${givenName} ${surname}`;
    } else if (surname) {
      result.fullName = surname;
    } else if (givenName) {
      result.fullName = givenName;
    }

    // Extract date of birth
    for (const pattern of patterns.dateOfBirth) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.dateOfBirth = this.standardizeDate(match[1].trim());
        console.log('Found date of birth:', result.dateOfBirth);
        break;
      }
    }

    // Extract document number
    for (const patternGroup of patterns.documentNumber) {
      const matches = text.match(patternGroup);
      if (matches) {
        const validNumbers = matches.filter(num => 
          !num.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/) && 
          num.length >= 6 && 
          num.length <= 15
        );
        if (validNumbers.length > 0) {
          result.documentNumber = validNumbers[0];
          console.log('Found document number:', result.documentNumber);
          break;
        }
      }
    }

    // Extract nationality with enhanced detection
    for (const pattern of patterns.nationality) {
      const matches = text.match(pattern);
      if (matches) {
        // For global patterns, filter for valid country codes/names
        const validMatches = matches.filter(match => 
          match.length >= 2 && 
          match.length <= 15 &&
          !match.match(/^\d+$/) && // Not just numbers
          !match.match(/^(ID|CARD|DOCUMENT|PASS|SEX|DATE)$/) // Not common document words
        );
        
        if (validMatches.length > 0) {
          result.nationality = this.standardizeNationality(validMatches[0].trim());
          console.log('Found nationality:', result.nationality);
          break;
        }
      }
    }
    
    // If no nationality found, try to infer from document patterns or text
    if (!result.nationality) {
      if (text.includes('FRANÇAIS') || text.includes('FRANÇAISE') || text.includes('FRANCE')) {
        result.nationality = 'FRANÇAIS';
      } else if (text.includes('NEDERLAND') || text.includes('DUTCH') || text.includes('NLD')) {
        result.nationality = 'NÉERLANDAIS';
      } else if (text.includes('GERMAN') || text.includes('DEUTSCH') || text.includes('DEU')) {
        result.nationality = 'ALLEMAND';
      } else if (text.includes('ITALIAN') || text.includes('ITALIANO') || text.includes('ITA')) {
        result.nationality = 'ITALIEN';
      }
      
      if (result.nationality) {
        console.log('Inferred nationality from document text:', result.nationality);
      }
    }

    // Extract place of birth
    for (const pattern of patterns.placeOfBirth) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.placeOfBirth = match[1].trim();
        console.log('Found place of birth:', result.placeOfBirth);
        break;
      }
    }

    // Determine document type
    if (text.includes('PASSPORT') || text.includes('PASSEPORT') || text.includes('PASAPORTE')) {
      result.documentType = 'passport';
    } else if (text.includes('IDENTITY') || text.includes('IDENTITÉ') || text.includes('IDENTITEIT')) {
      result.documentType = 'national_id';
    } else {
      result.documentType = 'national_id';
    }

    console.log('Final parsed result:', result);
    return result;
  }

  private static standardizeDate(dateString: string): string {
    const cleaned = dateString.replace(/\s+/g, ' ').trim();
    
    // Handle "DD MMM YYYY" format (e.g., "26 JUL 2005")
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
      /(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/, // DD/MM/YYYY
      /(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/, // YYYY/MM/DD
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
    if (this.worker) {
      console.log('Cleaning up OCR worker...');
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
