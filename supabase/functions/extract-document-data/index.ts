import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// S18 -- CORS restrictif (aligné sur issue-guest-link)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:54321',
  'https://checky.ma',
  'https://www.checky.ma',
  'https://morocco-host-helper.vercel.app',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const isLocal = /^https?:\/\/((192\.168|10|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+|127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isLocal || origin.includes('vercel.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://checky.ma',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Rate limiting in-memory (par IP, per-worker -- acceptable pour usage réel)
const _rl = new Map<string, { n: number; reset: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const e = _rl.get(ip);
  if (!e || now >= e.reset) { _rl.set(ip, { n: 1, reset: now + 60_000 }); return false; }
  if (e.n >= 10) return true;
  e.n++;
  return false;
}

// Prompt OCR -- priorité MRZ pour les dates, distinction claire émission/expiration
const SYSTEM_PROMPT = `Extrait les données de ce document d'identité (passeport, CNI, permis).
Réponds UNIQUEMENT en JSON valide avec ces champs (null si non visible) :
{
  "fullName": "Prénom(s) Nom -- uniquement le nom, pas les numéros ni adresses",
  "dateOfBirth": "YYYY-MM-DD -- date de NAISSANCE uniquement",
  "documentNumber": "numéro du document",
  "nationality": "en français majuscules (FRANÇAIS, AMÉRICAIN, MAROCAIN...)",
  "placeOfBirth": "lieu de naissance si visible",
  "documentType": "passport | national_id",
  "documentExpiryDate": "YYYY-MM-DD -- date D'EXPIRATION uniquement (pas la date de délivrance/issue/émission)",
  "mrzLine2": "ligne MRZ du bas (2e ligne) recopiée EXACTEMENT si visible, sans espaces ajoutés"
}
RÈGLES CRITIQUES :
1. MRZ (zone texte en bas) → PRIORITÉ absolue pour les dates : sur la 2e ligne, caractères 14-19 = naissance YYMMDD, caractères 22-27 = expiration YYMMDD (index 1-based).
2. documentExpiryDate = la date la PLUS FUTURE visible (ex: 2027-03-12, jamais 2017-03-13 pour un passeport encore valide).
3. dateOfBirth = date de naissance (ex: 1999-09-22), JAMAIS la date d'émission (Date of Issue).
4. Ne confonds pas le jour du mois visuel avec un autre champ : vérifie la MRZ si présente.
5. fullName = noms concaténés (ex: "RAB SAIMA RADYAH"), jamais de chiffres.
6. Convertir JAN/FEB/MAR/APR/MAY/JUN/JUL/AUG/SEP/OCT/NOV/DEC → YYYY-MM-DD.`;

function yymmddMrzToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  const dd = parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy >= 40 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** 2e ligne MRZ TD3 (passeport) : naissance positions 13-18, expiration 21-26 (index 0). */
function parseTd3MrzLine2Dates(mrzLine2: string): { dateOfBirth?: string; documentExpiryDate?: string } {
  const s = mrzLine2.replace(/\s/g, '').toUpperCase().replace(/</g, '');
  if (s.length < 27) return {};
  const dob = yymmddMrzToIso(s.substring(13, 19));
  const exp = yymmddMrzToIso(s.substring(21, 27));
  return {
    ...(dob ? { dateOfBirth: dob } : {}),
    ...(exp ? { documentExpiryDate: exp } : {}),
  };
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Fusionne les dates MRZ (prioritaires) avec la vision OpenAI. */
function mergeExtractedWithMrz(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  const mrzRaw = String(out.mrzLine2 ?? out.mrz_line2 ?? '').trim();
  const candidates = [mrzRaw];
  for (const v of Object.values(data)) {
    if (typeof v === 'string' && v.length >= 27 && /[A-Z]{3}\d{6}/.test(v)) {
      candidates.push(v.replace(/\s/g, '').toUpperCase());
    }
  }
  for (const line of candidates) {
    const fromMrz = parseTd3MrzLine2Dates(line);
    if (fromMrz.dateOfBirth) out.dateOfBirth = fromMrz.dateOfBirth;
    if (fromMrz.documentExpiryDate) out.documentExpiryDate = fromMrz.documentExpiryDate;
    if (fromMrz.dateOfBirth && fromMrz.documentExpiryDate) break;
  }
  return out;
}

// Resize image si > 512 KB
async function resizeIfNeeded(bytes: ArrayBuffer, mime: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  if (bytes.byteLength <= 512_000) return { bytes, mime };
  try {
    const { createImageBitmap } = globalThis as any;
    if (typeof createImageBitmap !== 'function') return { bytes, mime };
    const blob = new Blob([bytes], { type: mime });
    const bmp = await createImageBitmap(blob);
    const ratio = Math.min(1024 / bmp.width, 1024 / bmp.height, 1);
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = new OffscreenCanvas(w, h);
    (canvas.getContext('2d') as any).drawImage(bmp, 0, 0, w, h);
    const resized = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const resizedBytes = await resized.arrayBuffer();
    console.log(`Resize: ${Math.round(bytes.byteLength / 1024)}KB -> ${Math.round(resizedBytes.byteLength / 1024)}KB (${w}x${h})`);
    return { bytes: resizedBytes, mime: 'image/jpeg' };
  } catch {
    return { bytes, mime };
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const u8 = new Uint8Array(buffer);
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode(...u8.slice(i, i + chunk));
  return btoa(bin);
}

// S16 -- Appel OpenAI avec retry exponentiel sur 429 et 5xx
async function callOpenAI(
  apiKey: string,
  imageUrl: string,
  detail: 'low' | 'high',
  maxRetries = 3
): Promise<{ data: Record<string, unknown>; usage: Record<string, number> | null }> {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrais les données de ce document :' },
              { type: 'image_url', image_url: { url: imageUrl, detail } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    // Retry uniquement sur erreurs transitoires
    if (!res.ok) {
      const isRetryable = res.status === 429 || res.status >= 500;
      if (isRetryable && attempt < maxRetries) {
        const wait = delays[attempt] ?? 4000;
        console.warn(`OpenAI ${res.status} -- retry ${attempt + 1}/${maxRetries} dans ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText}`);
    }

    const json = await res.json() as any;
    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed: Record<string, unknown> = JSON.parse(content);
    return { data: parsed, usage: json.usage ?? null };
  }

  throw new Error('OpenAI: max retries reached');
}

// Vérifie si les champs critiques sont présents ET cohérents
function hasCriticalFields(data: Record<string, unknown>): boolean {
  if (!data.documentNumber || !data.dateOfBirth) return false;

  const expiry = String(data.documentExpiryDate || '');
  const dob = String(data.dateOfBirth || '');
  if (expiry && dob) {
    const expiryDate = parseYmdLocal(expiry);
    const dobDate = parseYmdLocal(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (
      expiryDate &&
      dobDate &&
      (expiryDate < today || expiryDate <= dobDate)
    ) {
      console.warn('Dates incohérentes — retry high:', { expiry, dob });
      return false;
    }
  }

  return true;
}

async function handleRequest(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Trop de requêtes. Veuillez attendre 1 minute.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY non configurée');

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'Aucune image fournie' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    console.log(`Image: ${imageFile.name} -- ${Math.round(imageFile.size / 1024)}KB`);

    const raw = await imageFile.arrayBuffer();
    const { bytes, mime } = await resizeIfNeeded(raw, imageFile.type || 'image/jpeg');
    const imageUrl = `data:${mime};base64,${toBase64(bytes)}`;

    // S15 -- Première passe en detail:low (coût minimal)
    const { data: firstPass, usage } = await callOpenAI(apiKey, imageUrl, 'low');

    let extractedData = mergeExtractedWithMrz(firstPass);

    // S15 -- Retry en detail:high si champs critiques manquants (ex : CIN petits caractères)
    if (!hasCriticalFields(extractedData)) {
      console.log('Champs critiques manquants (low) -- retry en detail:high');
      const { data: highPass } = await callOpenAI(apiKey, imageUrl, 'high', 2);
      extractedData = mergeExtractedWithMrz(highPass);
      console.log('Retry high -- résultat:', JSON.stringify(extractedData));
    }

    // Log usage tokens
    if (usage) {
      const cost = ((usage.prompt_tokens * 0.00000015) + (usage.completion_tokens * 0.0000006)).toFixed(6);
      console.log(`Tokens: ${usage.total_tokens} (~$${cost})`);
    }

    // S17 -- Validation basique du schéma retourné (types attendus)
    // Gérer les deux noms possibles : documentExpiryDate (nouveau) ou documentIssueDate (legacy)
    const EXPECTED_STRING_FIELDS = ['fullName', 'dateOfBirth', 'documentNumber', 'nationality', 'placeOfBirth', 'documentExpiryDate', 'documentIssueDate'];
    const VALID_DOC_TYPES = ['passport', 'national_id'];
    for (const field of EXPECTED_STRING_FIELDS) {
      if (field in extractedData && typeof extractedData[field] !== 'string') {
        extractedData[field] = String(extractedData[field]);
      }
    }
    // Normaliser : si le modèle a renvoyé documentIssueDate, le migrer en documentExpiryDate
    if (extractedData.documentIssueDate && !extractedData.documentExpiryDate) {
      extractedData.documentExpiryDate = extractedData.documentIssueDate;
      delete extractedData.documentIssueDate;
    }
    if ('documentType' in extractedData && !VALID_DOC_TYPES.includes(String(extractedData.documentType))) {
      delete extractedData.documentType;
    }

    // Nettoyer les null/vides (mrzLine2 = métadonnée interne, non exposée au client)
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extractedData)) {
      if (k === 'mrzLine2' || k === 'mrz_line2') continue;
      if (v !== null && v !== '' && v !== 'null' && v !== undefined) clean[k] = v;
    }

    if (clean.documentExpiryDate && clean.dateOfBirth) {
      const exp = parseYmdLocal(String(clean.documentExpiryDate));
      const dob = parseYmdLocal(String(clean.dateOfBirth));
      if (exp && dob && exp <= dob) {
        delete clean.documentExpiryDate;
      }
    }

    console.log('OCR final (MRZ fusionné):', JSON.stringify(clean));

    return new Response(
      JSON.stringify({ success: true, extractedData: clean }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur extract-document-data:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}

serve(handleRequest);
