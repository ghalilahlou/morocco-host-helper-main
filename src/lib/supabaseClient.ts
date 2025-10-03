/**
 * Client Supabase sécurisé - point d'entrée unique
 * ⚠️ Ne jamais exposer de clés service role côté frontend
 */

import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from '@/config/runtime';
import { Database } from './types'; // Assurez-vous d'avoir ce type défini, généré par Supabase CLI

// Récupération des clés Supabase depuis les variables d'environnement
const supabaseUrl = runtimeConfig.SUPABASE_URL;
const supabaseAnonKey = runtimeConfig.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL ou Anon Key manquant. Assurez-vous que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définis.'
  );
  // Fallback pour éviter les erreurs de build, mais l'app ne fonctionnera pas correctement sans clés.
  // En production, Vercel devrait toujours fournir ces variables.
  // Pour les tests locaux, utilisez un fichier .env.local
}

export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321', // Fallback pour le client, mais doit être configuré
  supabaseAnonKey || 'dummy-key'
);

// Exemples d'utilisation (peut être supprimé si non nécessaire)
/*
const { data: users, error } = await supabase
  .from('users')
  .select('*');
*/

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
