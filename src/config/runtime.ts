/**
 * Configuration runtime - Source unique de vérité pour toutes les URLs
 * Centralise la configuration des services externes et internes
 */

// Variables d'environnement avec fallbacks sécurisés
const env = {
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Application - ✅ FORCÉ : Utiliser cheki.ma en production
  APP_URL: import.meta.env.PROD 
    ? 'https://cheki.ma' 
    : (import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:3000'),
  MODE: import.meta.env.MODE || 'development',
  DEV: import.meta.env.DEV || false,
  PROD: import.meta.env.PROD || false,
  
  // MCP (local uniquement)
  SUPABASE_MCP_PORT: '3001',
  CLAUDE_MCP_PORT: '3002',
} as const;

// Configuration des URL de base
export const urls = {
  // Application
  app: {
    base: env.APP_URL,
    auth: `${env.APP_URL}/auth`,
    dashboard: `${env.APP_URL}/dashboard`,
    guest: `${env.APP_URL}/guest`,
  },
  
  // Supabase
  supabase: {
    base: env.SUPABASE_URL,
    auth: `${env.SUPABASE_URL}/auth/v1`,
    rest: `${env.SUPABASE_URL}/rest/v1`,
    realtime: `${env.SUPABASE_URL}/realtime/v1`,
    storage: `${env.SUPABASE_URL}/storage/v1`,
    functions: `${env.SUPABASE_URL}/functions/v1`,
  },
  
  // Edge Functions (production)
  edge: {
    base: `${env.SUPABASE_URL}/functions/v1`,
    
    // Fonctions spécifiques
    validateGuestLink: `${env.SUPABASE_URL}/functions/v1/validate-guest-link`,
    issueGuestLink: `${env.SUPABASE_URL}/functions/v1/issue-guest-link`,
    resolveGuestLink: `${env.SUPABASE_URL}/functions/v1/resolve-guest-link`,
    generateContract: `${env.SUPABASE_URL}/functions/v1/generate-contract`,
    generateIdDocuments: `${env.SUPABASE_URL}/functions/v1/generate-id-documents`,
    generatePoliceForms: `${env.SUPABASE_URL}/functions/v1/generate-police-forms`,
    saveContractSignature: `${env.SUPABASE_URL}/functions/v1/save-contract-signature`,
    submitGuestInfo: `${env.SUPABASE_URL}/functions/v1/submit-guest-info`,
    submitGuestInfoUnified: `${env.SUPABASE_URL}/functions/v1/submit-guest-info-unified`,
    validateBookingPassword: `${env.SUPABASE_URL}/functions/v1/validate-booking-password`,
    extractDocumentData: `${env.SUPABASE_URL}/functions/v1/extract-document-data`,
    syncAirbnbUnified: `${env.SUPABASE_URL}/functions/v1/sync-airbnb-unified`,
    getAirbnbReservation: `${env.SUPABASE_URL}/functions/v1/get-airbnb-reservation`,
    syncDocuments: `${env.SUPABASE_URL}/functions/v1/sync-documents`,
    getGuestDocumentsUnified: `${env.SUPABASE_URL}/functions/v1/get-guest-documents-unified`,
    sendGuestContract: `${env.SUPABASE_URL}/functions/v1/send-guest-contract`,
    sendOwnerNotification: `${env.SUPABASE_URL}/functions/v1/send-owner-notification`,
    storageSignUrl: `${env.SUPABASE_URL}/functions/v1/storage-sign-url`,
    addAdminUser: `${env.SUPABASE_URL}/functions/v1/add-admin-user`,
  },
  
  // Edge Functions (local development)
  edgeLocal: {
    base: 'http://localhost:54321/functions/v1',
    validateGuestLink: 'http://localhost:54321/functions/v1/validate-guest-link',
    issueGuestLink: 'http://localhost:54321/functions/v1/issue-guest-link',
    resolveGuestLink: 'http://localhost:54321/functions/v1/resolve-guest-link',
    generateContract: 'http://localhost:54321/functions/v1/generate-contract',
    generateIdDocuments: 'http://localhost:54321/functions/v1/generate-id-documents',
    generatePoliceForms: 'http://localhost:54321/functions/v1/generate-police-forms',
    saveContractSignature: 'http://localhost:54321/functions/v1/save-contract-signature',
    submitGuestInfo: 'http://localhost:54321/functions/v1/submit-guest-info',
    submitGuestInfoUnified: 'http://localhost:54321/functions/v1/submit-guest-info-unified',
    validateBookingPassword: 'http://localhost:54321/functions/v1/validate-booking-password',
    extractDocumentData: 'http://localhost:54321/functions/v1/extract-document-data',
    syncAirbnbUnified: 'http://localhost:54321/functions/v1/sync-airbnb-unified',
    getAirbnbReservation: 'http://localhost:54321/functions/v1/get-airbnb-reservation',
    syncDocuments: 'http://localhost:54321/functions/v1/sync-documents',
    getGuestDocumentsUnified: 'http://localhost:54321/functions/v1/get-guest-documents-unified',
    sendGuestContract: 'http://localhost:54321/functions/v1/send-guest-contract',
    sendOwnerNotification: 'http://localhost:54321/functions/v1/send-owner-notification',
    storageSignUrl: 'http://localhost:54321/functions/v1/storage-sign-url',
    addAdminUser: 'http://localhost:54321/functions/v1/add-admin-user',
  },
  
  // MCP Servers (développement local uniquement)
  mcp: {
    supabase: {
      base: `http://localhost:${env.SUPABASE_MCP_PORT}`,
      health: `http://localhost:${env.SUPABASE_MCP_PORT}/health`,
      users: `http://localhost:${env.SUPABASE_MCP_PORT}/users`,
    },
    claude: {
      base: `http://localhost:${env.CLAUDE_MCP_PORT}`,
      health: `http://localhost:${env.CLAUDE_MCP_PORT}/health`,
      ask: `http://localhost:${env.CLAUDE_MCP_PORT}/ask`,
      models: `http://localhost:${env.CLAUDE_MCP_PORT}/models`,
    },
  },
} as const;

// Helper pour obtenir les URLs d'Edge Functions selon l'environnement
export function getEdgeUrls() {
  return env.DEV ? urls.edgeLocal : urls.edge;
}

// Helper pour obtenir une URL d'Edge Function spécifique
export function getEdgeUrl(functionName: keyof typeof urls.edge): string {
  const edgeUrls = getEdgeUrls();
  const url = edgeUrls[functionName];
  
  if (!url) {
    throw new Error(`Edge function "${functionName}" not configured`);
  }
  
  return url;
}

// Configuration des timeouts et retry
export const networkConfig = {
  // Timeouts par type de requête (ms)
  timeouts: {
    auth: 10000,       // Authentification
    database: 15000,   // Requêtes DB standard
    edge: 30000,       // Edge Functions
    upload: 120000,    // Upload de fichiers
    download: 60000,   // Téléchargement
  },
  
  // Configuration retry
  retry: {
    attempts: 3,
    backoffMs: 1000,
    backoffFactor: 2,
  },
  
  // Headers par défaut
  headers: {
    common: {
      'Content-Type': 'application/json',
      'X-Client-Info': 'morocco-host-helper@1.0.0',
    },
    upload: {
      'X-Client-Info': 'morocco-host-helper@1.0.0',
      // Content-Type sera défini automatiquement pour les uploads
    },
  },
} as const;

// Configuration CORS pour différents environnements
export const corsConfig = {
  development: [
    'http://localhost:3000',
    'http://localhost:5173', // Vite default
    'http://localhost:54321', // Supabase local
  ],
  production: [
    'https://cheki.ma',           // ✅ Domaine principal
    'https://www.cheki.ma',       // ✅ Sous-domaine www
    'https://*.vercel.app',       // Fallback Vercel (preview deployments)
  ],
} as const;

// Validation de la configuration au chargement
function validateConfig() {
  const errors: string[] = [];
  
  if (!env.SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  
  if (!env.SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }
  
  if (env.SUPABASE_URL && !env.SUPABASE_URL.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must be HTTPS');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    if (env.PROD) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
}

// Valider la configuration au chargement du module
validateConfig();

// Logging de la configuration (développement uniquement)
if (env.DEV) {
  console.log('🔧 Runtime configuration loaded:', {
    mode: env.MODE,
    supabaseUrl: env.SUPABASE_URL,
    appUrl: env.APP_URL,
    edgeUrls: env.DEV ? 'local' : 'production',
  });
}

// Export par défaut
export default {
  env,
  urls,
  networkConfig,
  corsConfig,
  getEdgeUrls,
  getEdgeUrl,
};
