/**
 * Client Supabase sécurisé - point d'entrée unique
 * ⚠️ Ne jamais exposer de clés service role côté frontend
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Validation des variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    '❌ VITE_SUPABASE_URL is required. Check your environment variables.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '❌ VITE_SUPABASE_ANON_KEY is required. Check your environment variables.'
  );
}

// Validation du format des URLs et clés
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.warn('⚠️ VITE_SUPABASE_URL format might be incorrect:', supabaseUrl);
}

if (!supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.length < 100) {
  console.warn('⚠️ VITE_SUPABASE_ANON_KEY format might be incorrect');
}

// Configuration du client Supabase
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Stockage persistant des sessions
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      
      // Configuration sécurisée
      flowType: 'pkce', // Plus sécurisé que implicit
      debug: import.meta.env.DEV
    },
    
    // Configuration réseaux
    global: {
      headers: {
        'X-Client-Info': 'morocco-host-helper@1.0.0',
      },
    },
    
    // Configuration de la base de données
    db: {
      schema: 'public',
    },
    
    // Configuration en temps réel (optionnel)
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Types utilitaires pour le client
export type SupabaseUser = Database['public']['Tables']['users']['Row'];
export type SupabaseSession = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>;

// Helper pour vérification de l'authentification
export async function getAuthenticatedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('❌ Auth error:', error);
    throw error;
  }
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return user;
}

// Helper pour obtenir la session actuelle
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('❌ Session error:', error);
    throw error;
  }
  
  return session;
}

// Helper pour refresh token manuel
export async function refreshAuthToken() {
  const { data, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('❌ Token refresh error:', error);
    throw error;
  }
  
  return data.session;
}

// Gestion des erreurs d'authentification
export function isAuthError(error: any): boolean {
  return error?.status === 401 || 
         error?.code === 'PGRST301' || 
         error?.message?.includes('JWT');
}

// Log de configuration (mode développement uniquement)
if (import.meta.env.DEV) {
  console.log('🔧 Supabase client configured:', {
    url: supabaseUrl,
    anonKey: `${supabaseAnonKey.substring(0, 10)}...`,
    environment: import.meta.env.MODE,
  });
}

// Export par défaut
export default supabase;
