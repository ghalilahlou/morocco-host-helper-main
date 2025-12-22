// Configuration CORS sécurisée - Domaines autorisés uniquement
const ALLOWED_ORIGINS = [
  // Développement local
  'http://localhost:3000',
  'http://localhost:5173', // Vite default port
  'http://localhost:54321', // Supabase local
  
  // Développement réseau local (adresses IP locales)
  'http://192.168.11.195:3000',
  'http://192.168.1.1:3000',
  'http://127.0.0.1:3000',
  
  // Production - ✅ DOMAINE PRINCIPAL
  'https://checky.ma',
  'https://www.checky.ma',
  // Fallback Vercel (preview deployments uniquement)
  'https://*.vercel.app',
  'https://morocco-host-helper.vercel.app',
];

// Headers CORS dynamiques basés sur l'origine
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  
  // Vérifier si l'origine est dans la liste autorisée
  let isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  
  // Si pas trouvé exactement, vérifier si c'est une adresse IP locale (développement)
  if (!isAllowedOrigin && origin) {
    // Accepter les adresses IP locales pour le développement (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1)
    const localIpPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1|localhost)(:\d+)?$/;
    if (localIpPattern.test(origin)) {
      isAllowedOrigin = true;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://checky.ma',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24h
  };
}

// Headers CORS statiques pour compatibilité (⚠️ moins sécurisé)
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://checky.ma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
};

export function handleOptions(request: Request): Response {
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(request);
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response('Method not allowed', { status: 405 });
}

export function addCorsHeaders(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  const dynamicCorsHeaders = request ? getCorsHeaders(request) : corsHeaders;
  
  Object.entries(dynamicCorsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Helper pour vérifier si une origine est autorisée
export function isOriginAllowed(origin: string | null): boolean {
  return origin ? ALLOWED_ORIGINS.includes(origin) : false;
}

// Helper pour créer une réponse avec CORS approprié
export function createCorsResponse(
  body: any, 
  options: ResponseInit & { request?: Request } = {}
): Response {
  const { request, ...responseOptions } = options;
  const responseCorsHeaders = request ? getCorsHeaders(request) : corsHeaders;
  
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      ...responseOptions,
      headers: {
        'Content-Type': 'application/json',
        ...responseCorsHeaders,
        ...responseOptions.headers,
      }
    }
  );
}