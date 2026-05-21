import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Rate limiting in-memory ────────────────────────────────────────────────
// Max 10 appels par IP par minute (bloque les boucles, pas les usages réels)
const _rl = new Map<string, { n: number; reset: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const e = _rl.get(ip);
  if (!e || now >= e.reset) { _rl.set(ip, { n: 1, reset: now + 60_000 }); return false; }
  if (e.n >= 10) return true;
  e.n++;
  return false;
}

// ─── Prompt ultra-compact (~130 tokens vs ~800 avant) ────────────────────────
// Instruction précise sans répétitions → meilleure précision ET coût ÷6
const SYSTEM_PROMPT = `Extrait les données de ce document d'identité (passeport, CNI, permis).
Réponds UNIQUEMENT en JSON valide avec ces champs (null si non visible) :
{
  "fullName": "Prénom(s) Nom — uniquement le nom de la personne, pas les numéros ni adresses",
  "dateOfBirth": "YYYY-MM-DD",
  "documentNumber": "numéro du document",
  "nationality": "en français majuscules (FRANÇAIS, BRITANNIQUE, MAROCAIN, PHILIPPIN…)",
  "placeOfBirth": "lieu de naissance si visible",
  "documentType": "passport | national_id",
  "documentIssueDate": "YYYY-MM-DD — date D'EXPIRATION uniquement (pas la date de délivrance)"
}
Règles dates : convertir JAN/FEV/MARS etc. → YYYY-MM-DD. MRZ : 6 chiffres AAMMJJ.
fullName = noms + prénoms concaténés (ex: "STEVEN ALAN DAVIES"), jamais de chiffres.`;

// ─── Resize image si > 512KB (réduit les tokens vision) ─────────────────────
async function resizeIfNeeded(bytes: ArrayBuffer, mime: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  if (bytes.byteLength <= 512_000) return { bytes, mime };
  try {
    const { createImageBitmap } = globalThis as any;
    if (typeof createImageBitmap !== 'function') return { bytes, mime };
    const blob = new Blob([bytes], { type: mime });
    const bmp = await createImageBitmap(blob);
    // Max 1024px côté long → lisible par vision, moins de tiles
    const ratio = Math.min(1024 / bmp.width, 1024 / bmp.height, 1);
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = new OffscreenCanvas(w, h);
    (canvas.getContext('2d') as any).drawImage(bmp, 0, 0, w, h);
    const resized = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const resizedBytes = await resized.arrayBuffer();
    console.log(`🗜️ Resize: ${Math.round(bytes.byteLength/1024)}KB → ${Math.round(resizedBytes.byteLength/1024)}KB (${w}×${h})`);
    return { bytes: resizedBytes, mime: 'image/jpeg' };
  } catch {
    return { bytes, mime };
  }
}

// ─── Conversion ArrayBuffer → base64 (par chunks pour éviter stack overflow) ─
function toBase64(buffer: ArrayBuffer): string {
  const u8 = new Uint8Array(buffer);
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode(...u8.slice(i, i + chunk));
  return btoa(bin);
}

// ─── Handler principal ───────────────────────────────────────────────────────
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Trop de requêtes. Veuillez attendre 1 minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY non configurée');

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'Aucune image fournie' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📄 Image reçue: ${imageFile.name} — ${Math.round(imageFile.size / 1024)}KB`);

    // Resize si nécessaire
    const raw = await imageFile.arrayBuffer();
    const { bytes, mime } = await resizeIfNeeded(raw, imageFile.type || 'image/jpeg');
    const imageUrl = `data:${mime};base64,${toBase64(bytes)}`;

    // ─── Appel OpenAI ──────────────────────────────────────────────────────
    // Optimisations coût :
    //   • model: gpt-4o-mini        (÷20 vs gpt-4.1 sur le prix/token)
    //   • detail: "low"             (65 tokens fixes vs 765+ tokens en high)
    //   • response_format json_obj  (JSON garanti, pas de markdown wrapper)
    //   • prompt court ~130 tokens  (vs ~800 avant)
    //   • max_tokens: 250           (réponse JSON petite, pas besoin de 500)
    // Total: ~295 tokens/call vs ~1665 avant → coût ÷5.6 supplémentaire
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' }, // ← JSON garanti, 0 erreur de parsing
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrais les données de ce document :' },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low', // ← 65 tokens fixes (vs 765+ en high/auto)
                }
              }
            ]
          }
        ],
        temperature: 0,      // Déterministe → toujours le même résultat pour le même document
        max_tokens: 250,     // JSON ~200 chars = ~60 tokens, 250 est largement suffisant
      }),
    });

    if (!openAIResponse.ok) {
      const err = await openAIResponse.text();
      console.error('❌ OpenAI error:', err);
      return new Response(JSON.stringify({ error: `OpenAI erreur ${openAIResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openAIData = await openAIResponse.json();
    const rawContent = openAIData.choices?.[0]?.message?.content ?? '';
    console.log('✅ OpenAI réponse:', rawContent);

    // ─── Parsing — response_format json_object garantit du JSON valide ─────
    let extractedData: Record<string, unknown>;
    try {
      extractedData = JSON.parse(rawContent);
    } catch {
      console.error('❌ JSON invalide malgré response_format:', rawContent);
      return new Response(
        JSON.stringify({ error: 'Impossible de parser la réponse de l\'IA', details: rawContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normaliser les champs null/vides
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extractedData)) {
      if (v !== null && v !== '' && v !== 'null' && v !== undefined) clean[k] = v;
    }

    // Log tokens utilisés (pour monitoring coût)
    const usage = openAIData.usage;
    if (usage) {
      console.log(`📊 Tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`);
      console.log(`💰 Coût estimé: ~$${((usage.prompt_tokens * 0.00000015) + (usage.completion_tokens * 0.0000006)).toFixed(6)}`);
    }

    return new Response(
      JSON.stringify({ success: true, extractedData: clean }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erreur extract-document-data:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(handleRequest);
