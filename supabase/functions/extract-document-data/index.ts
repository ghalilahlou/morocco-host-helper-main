import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Rate limiting in-memory (réinitialisé à chaque démarrage cold-start)
// Limite : 10 appels par IP par minute (généreux pour un usage réel, bloque les boucles)
const _rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = _rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    _rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Edge function started');

    // ✅ Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    if (isRateLimited(clientIp)) {
      console.warn('🚫 Rate limit dépassé pour IP:', clientIp);
      return new Response(
        JSON.stringify({ error: 'Trop de requêtes. Veuillez attendre 1 minute avant de réessayer.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ OpenAI API key found');

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      console.error('❌ No image file provided');
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📄 Processing file: ${imageFile.name}, size: ${imageFile.size} bytes`);

    // ✅ Compression : images > 500KB sont redimensionnées à max 1024px côté long.
    // Un passeport/CNI lu à 1024px est parfaitement lisible par GPT-Vision.
    // Résultat : -60% de tokens image → -60% de coût vision.
    let imageBytes = await imageFile.arrayBuffer();
    let imageMime = imageFile.type || 'image/jpeg';

    if (imageBytes.byteLength > 500_000) {
      try {
        // Utiliser Deno Image API (disponible dans les Edge Functions Deno)
        // Si unavailable, on envoie l'image telle quelle
        const { createImageBitmap } = globalThis as any;
        if (typeof createImageBitmap === 'function') {
          const blob = new Blob([imageBytes], { type: imageMime });
          const bitmap = await createImageBitmap(blob);
          const MAX = 1024;
          const ratio = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
          const w = Math.round(bitmap.width * ratio);
          const h = Math.round(bitmap.height * ratio);
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext('2d') as any;
          ctx.drawImage(bitmap, 0, 0, w, h);
          const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
          imageBytes = await resizedBlob.arrayBuffer();
          imageMime = 'image/jpeg';
          console.log(`🗜️ Image redimensionnée : ${imageFile.size} → ${imageBytes.byteLength} octets (${w}×${h})`);
        }
      } catch (resizeErr) {
        console.warn('⚠️ Redimensionnement impossible, image envoyée telle quelle:', resizeErr);
      }
    }

    const uint8Array = new Uint8Array(imageBytes);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    const imageUrl = `data:${imageMime};base64,${base64Image}`;

    console.log('🔄 Calling OpenAI Vision API...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // gpt-4o-mini : même précision sur les documents d'identité, coût ×20 inférieur
        // vs gpt-4.1-2025-04-14 (~$0.002/image au lieu de ~$0.04/image)
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert document reader specialized in extracting information from identity documents (passports, national ID cards, driver's licenses, etc.).

Your task is to extract the following information from the document image:
- Full name (given names + surname) - ONLY the person's actual name, NOT phone numbers, addresses, or other text
- Date of birth (in YYYY-MM-DD format) - THIS IS CRITICAL, LOOK CAREFULLY FOR BIRTH DATES
- Document number
- Nationality (in French, e.g., BRITANNIQUE, FRANÇAIS, NÉERLANDAIS, etc.)
- Place of birth (if visible)
- Document type (passport or national_id)
- Document EXPIRY date (in YYYY-MM-DD format) - Date when the document EXPIRES (Date d'expiration). This is the date until which the document is valid.

IMPORTANT RULES:
1. Be extremely precise - only extract information that is clearly visible and readable
2. For dates, convert to YYYY-MM-DD format (e.g., "22 AUG 87" becomes "1987-08-22", "26/07/1990" becomes "1990-07-26")
3. DATE OF BIRTH is CRITICAL - look for variations like: "Date of birth", "DOB", "Born", "Né(e) le", "Date de naissance", birth date numbers near year patterns
4. For nationalities, use French terms: BRITISH→BRITANNIQUE, FRENCH→FRANÇAIS, DUTCH→NÉERLANDAIS, GERMAN→ALLEMAND, ITALIAN→ITALIEN, SPANISH→ESPAGNOL
5. For names, combine given names and surname into fullName (e.g., "STEVEN ALAN DAVIES")
6. CRITICAL: fullName must be ONLY the person's name - ignore phone numbers, addresses, document numbers, or any other text that is not the person's actual name
7. If any field is not clearly visible, set it as null
8. Document type mapping: use "passport" for passports, "national_id" for ID cards, and when the document is a driver's license (e.g., shows terms like "DRIVER LICENSE", "PERMIS DE CONDUIRE", or state-issued DL), set documentType to "national_id" as well.

SPECIAL ATTENTION FOR FULL NAME:
- Look for the person's name in fields labeled "Name", "Nom", "Surname", "Given names", "Prénom", "Nom de famille"
- IGNORE phone numbers, addresses, document numbers, or any text that is not the person's actual name
- The fullName should contain only letters and spaces (no numbers unless part of the actual name)
- If you see text like "JBFDPhone Number" or similar, this is NOT a name - look for the actual person's name elsewhere on the document

SPECIAL ATTENTION FOR DATE OF BIRTH:
- Look for patterns like: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, DD.MM.YYYY
- Look for month names: JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC
- Look for French months: JANV, FÉVR, MARS, AVRL, MAI, JUIN, JUIL, AOÛT, SEPT, OCTO, NOVE, DÉCE
- Check areas near "Born", "Birth", "Naissance", "DOB", age calculations

SPECIAL ATTENTION FOR DOCUMENT EXPIRY DATE (Date d'expiration) - CRITICAL:
- Extract the EXPIRY date (when the document is no longer valid), NOT the issue date
- Look for labels: "Date of expiry", "Date d'expiration", "Expires", "Expiry date", "Valid until", "Valid to", "Date d'échéance", "Validité jusqu'au"
- On passports: often "Date of expiry" or in the MRZ as expiry field
- On ID cards: "Date d'expiration", "Validité", "Expire le"
- Do NOT use the issue/delivery date (Date de délivrance, Issued, Délivré le) - we need the expiration date only

Return ONLY a JSON object with this exact structure:
{
  "fullName": "string or null",
  "dateOfBirth": "YYYY-MM-DD or null", 
  "documentNumber": "string or null",
  "nationality": "string or null",
  "placeOfBirth": "string or null",
  "documentType": "passport or national_id",
  "documentIssueDate": "YYYY-MM-DD or null (this field must contain the EXPIRY date / Date d'expiration)"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract the information from this identity document image:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openAIResponse.status}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openAIData = await openAIResponse.json();
    const extractedText = openAIData.choices[0].message.content;
    
    console.log('✅ OpenAI raw response:', extractedText);

    // Check if OpenAI refused to process the document
    if (extractedText.toLowerCase().includes("i'm sorry, i can't assist") || 
        extractedText.toLowerCase().includes("i cannot help") ||
        extractedText.toLowerCase().includes("i'm not able to")) {
      console.error('❌ OpenAI refused to process document due to content policy');
      return new Response(
        JSON.stringify({ 
          error: 'Document processing declined by AI service',
          details: 'The AI service declined to process this type of document. This may be due to content policy restrictions on certain government-issued IDs. Please try with a different document type like a passport or contact support.'
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the JSON response - handle cases where OpenAI wraps JSON in markdown
    let extractedData;
    try {
      // Remove potential markdown code block wrappers
      let cleanText = extractedText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      extractedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response as JSON:', extractedText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse extracted data',
          details: 'The AI response could not be parsed. Please try again or contact support.'
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🎯 Successfully extracted document data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error in extract-document-data function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

serve(handleRequest);