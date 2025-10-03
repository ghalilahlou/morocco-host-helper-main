import { PDFDocument, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib@1.17.1?dts';
import fontkit from 'https://cdn.skypack.dev/@pdf-lib/fontkit@1.1.1?dts';
import { reshape } from 'https://esm.sh/arabic-persian-reshaper@1.0.1';

// Fonction utilitaire pour le texte arabe
function hasArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function processArabicText(text: string): string {
  if (!hasArabicText(text)) return text;
  return reshape(text);
}

// Génération du contrat
export async function generateContract(
  client: any,
  booking: any,
  guestInfo: any,
  signature?: any
): Promise<string | null> {
  try {
    console.log('📄 Generating contract for booking:', booking.id);

    // Créer le PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Charger les polices
    const arabicFontUrl = 'https://your-cdn/NotoNaskhArabic-Regular.ttf';
    const arabicFontBytes = await fetch(arabicFontUrl).then(r => r.arrayBuffer());
    const arabicFont = await pdfDoc.embedFont(arabicFontBytes);
    const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Créer la page
    const page = pdfDoc.addPage();

    // Ajouter le contenu (exemple simplifié)
    const { width, height } = page.getSize();
    let currentY = height - 50;

    // Fonction helper pour écrire du texte avec support arabe
    const writeText = (text: string, y: number) => {
      if (hasArabicText(text)) {
        page.drawText(processArabicText(text), {
          x: 50,
          y,
          font: arabicFont,
          size: 12
        });
      } else {
        page.drawText(text, {
          x: 50,
          y,
          font: latinFont,
          size: 12
        });
      }
    };

    // Ajouter les informations
    writeText(`Booking ID: ${booking.id}`, currentY);
    currentY -= 20;
    writeText(`Guest: ${guestInfo.firstName} ${guestInfo.lastName}`, currentY);
    currentY -= 20;
    
    if (guestInfo.arabicName) {
      writeText(`الاسم: ${guestInfo.arabicName}`, currentY);
      currentY -= 20;
    }

    // Ajouter la signature si présente
    if (signature?.data) {
      const signatureImage = await pdfDoc.embedPng(signature.data);
      page.drawImage(signatureImage, {
        x: 50,
        y: 100,
        width: 200,
        height: 100
      });
    }

    // Sauvegarder le PDF
    const pdfBytes = await pdfDoc.save();
    const timestamp = Date.now();
    const filePath = `contracts/${booking.id}/contract-${timestamp}.pdf`;

    // Upload vers Storage
    const { data: uploadData, error: uploadError } = await client.storage
      .from('guest-documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = await client.storage
      .from('guest-documents')
      .getPublicUrl(filePath);

    console.log('✅ Contract generated successfully:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('❌ Error generating contract:', error);
    return null;
  }
}

// Génération de la fiche de police
export async function generatePoliceForm(
  client: any,
  booking: any,
  guestInfo: any
): Promise<string | null> {
  try {
    console.log('📄 Generating police form for booking:', booking.id);

    // Même logique que generateContract mais avec template fiche de police
    // ... (à implémenter selon vos besoins)

    return null;
  } catch (error) {
    console.error('❌ Error generating police form:', error);
    return null;
  }
}

// Génération du document d'identité
export async function generateIdentityDocument(
  client: any,
  booking: any,
  guestInfo: any
): Promise<string | null> {
  try {
    console.log('📄 Generating identity document for booking:', booking.id);

    // Même logique que generateContract mais pour les documents d'identité
    // ... (à implémenter selon vos besoins)

    return null;
  } catch (error) {
    console.error('❌ Error generating identity document:', error);
    return null;
  }
}
