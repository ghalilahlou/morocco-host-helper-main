/**
 * Polices PDF Unicode (Noto Sans + Noto Sans Arabic) pour pdf-lib.
 * Évite les erreurs WinAnsi (ex. caractère turc İ U+0130) avec StandardFonts.Helvetica.
 */
import { PDFDocument, StandardFonts, type PDFFont } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1';

const NOTO_SANS_REGULAR_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Regular.ttf',
];
const NOTO_SANS_BOLD_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Bold.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Bold.ttf',
];
const NOTO_SANS_ARABIC_URLS = [
  'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.ttf',
];

const fontCache: {
  regular?: ArrayBuffer;
  bold?: ArrayBuffer;
  arabic?: ArrayBuffer;
} = {};

async function fetchFirstOk(urls: string[]): Promise<ArrayBuffer> {
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = new Error(`${url} → HTTP ${res.status}`);
        continue;
      }
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('Aucune URL de police accessible');
}

export type PdfUnicodeFonts = {
  fontRegular: PDFFont;
  fontBold: PDFFont;
  arabicFont: PDFFont;
  usesUnicode: boolean;
};

/**
 * Embarque Noto Sans (latin étendu, turc, etc.) + Noto Sans Arabic.
 * Repli Helvetica uniquement si le chargement échoue (avec usesUnicode = false).
 */
export async function embedPdfUnicodeFonts(pdfDoc: PDFDocument): Promise<PdfUnicodeFonts> {
  pdfDoc.registerFontkit(fontkit);

  try {
    if (!fontCache.regular) {
      fontCache.regular = await fetchFirstOk(NOTO_SANS_REGULAR_URLS);
    }
    if (!fontCache.bold) {
      fontCache.bold = await fetchFirstOk(NOTO_SANS_BOLD_URLS);
    }
    if (!fontCache.arabic) {
      try {
        fontCache.arabic = await fetchFirstOk(NOTO_SANS_ARABIC_URLS);
      } catch {
        fontCache.arabic = fontCache.regular;
      }
    }

    const fontRegular = await pdfDoc.embedFont(fontCache.regular);
    const fontBold = await pdfDoc.embedFont(fontCache.bold);
    const arabicFont = await pdfDoc.embedFont(fontCache.arabic);

    return { fontRegular, fontBold, arabicFont, usesUnicode: true };
  } catch (e) {
    console.warn('[pdfUnicodeFonts] Noto Sans indisponible, repli Helvetica:', e);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { fontRegular, fontBold, arabicFont: fontRegular, usesUnicode: false };
  }
}

/** Repli WinAnsi : translittère les caractères hors Latin-1 avant drawText avec Helvetica. */
export function textForPdfDraw(text: string, usesUnicode: boolean): string {
  if (!text || usesUnicode) return text ?? '';

  return text
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'i')
    .replace(/\u011E/g, 'G')
    .replace(/\u011F/g, 'g')
    .replace(/\u015E/g, 'S')
    .replace(/\u015F/g, 's')
    .replace(/\u0152/g, 'OE')
    .replace(/\u0153/g, 'oe')
    .replace(/[\u0100-\uFFFF]/g, (ch) => {
      const n = ch.normalize('NFD');
      const stripped = n.replace(/[\u0300-\u036f]/g, '');
      if (stripped && /^[\x00-\xFF]$/.test(stripped)) return stripped;
      return '?';
    });
}

export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function pickPdfFont(
  text: string,
  fonts: PdfUnicodeFonts
): PDFFont {
  return hasArabicScript(text) ? fonts.arabicFont : fonts.fontRegular;
}
