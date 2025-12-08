# Version corrigée de issue-guest-link avec CORS sécurisé

## ✅ Modifications à apporter

Remplacez les lignes **41-45** de votre Edge Function par :

```typescript
// ✅ IMPORT CORS SÉCURISÉ depuis le fichier partagé
import { getCorsHeaders, corsHeaders, handleOptions } from '../_shared/cors.ts';

// Supprimez les lignes 41-45 (corsHeaders inline)
```

Puis remplacez toutes les utilisations de `corsHeaders` par :

1. **Pour les requêtes OPTIONS** (ligne 75) :
```typescript
if (req.method === 'OPTIONS') {
  return handleOptions(req);
}
```

2. **Pour toutes les réponses** (remplacez `corsHeaders` par `getCorsHeaders(req)`) :
```typescript
// AVANT :
headers: { ...corsHeaders, 'Content-Type': 'application/json' }

// APRÈS :
headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
```

## 🔄 Alternative : Headers inline sécurisés

Si vous préférez garder le code inline (sans import), remplacez les lignes 41-45 par :

```typescript
// ✅ CORS SÉCURISÉ avec checky.ma
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:54321',
  'https://checky.ma',
  'https://www.checky.ma',
  'https://*.vercel.app',
  'https://morocco-host-helper.vercel.app',
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && (
    ALLOWED_ORIGINS.includes(origin) || 
    origin.includes('vercel.app')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://checky.ma',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://checky.ma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
};
```

Puis remplacez la ligne 75 :
```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: getCorsHeaders(req) });
}
```

Et toutes les autres occurrences de `corsHeaders` par `getCorsHeaders(req)` dans les réponses.

## ✅ Vérifications

Votre code utilise déjà correctement :
- ✅ `checky.ma` comme fallback (lignes 276 et 653)
- ✅ Route `/v/` pour les liens (lignes 277 et 654)

Il ne reste qu'à sécuriser les headers CORS.

