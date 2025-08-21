import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Edge function started');
    
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

    // Convert image to base64 - use safe method for large images
    const imageBytes = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(imageBytes);
    
    // Safe base64 conversion that works with large images
    let binary = '';
    const chunkSize = 8192; // Process in chunks to avoid stack overflow
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    const imageUrl = `data:${imageFile.type};base64,${base64Image}`;

    console.log('🔄 Calling OpenAI Vision API...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert document reader specialized in extracting information from identity documents (passports, national ID cards, driver's licenses, etc.).

Your task is to extract the following information from the document image:
- Full name (given names + surname)
- Date of birth (in YYYY-MM-DD format)
- Document number
- Nationality (in French, e.g., BRITANNIQUE, FRANÇAIS, NÉERLANDAIS, etc.)
- Place of birth (if visible)
- Document type (passport or national_id)

IMPORTANT RULES:
1. Be extremely precise - only extract information that is clearly visible and readable
2. For dates, convert to YYYY-MM-DD format (e.g., "22 AUG 87" becomes "1987-08-22")
3. For nationalities, use French terms: BRITISH→BRITANNIQUE, FRENCH→FRANÇAIS, DUTCH→NÉERLANDAIS, GERMAN→ALLEMAND, ITALIAN→ITALIEN, SPANISH→ESPAGNOL
4. For names, combine given names and surname into fullName (e.g., "STEVEN ALAN DAVIES")
5. If any field is not clearly visible, set it as null
6. Document type mapping: use "passport" for passports, "national_id" for ID cards, and when the document is a driver's license (e.g., shows terms like "DRIVER LICENSE", "PERMIS DE CONDUIRE", or state-issued DL), set documentType to "national_id" as well.

Return ONLY a JSON object with this exact structure:
{
  "fullName": "string or null",
  "dateOfBirth": "YYYY-MM-DD or null", 
  "documentNumber": "string or null",
  "nationality": "string or null",
  "placeOfBirth": "string or null",
  "documentType": "passport or national_id"
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