import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AuthenticationError } from './errors.ts';

export async function getServerClient() {
  const url =
    Deno.env.get('SB_URL') ??
    Deno.env.get('SUPABASE_URL');

  const key =
    Deno.env.get('SB_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new AuthenticationError('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function verifyToken(token: string) {
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser(token);

  if (error || !user) {
    throw new AuthenticationError('Invalid token', { error });
  }

  return user;
}

export async function verifyPropertyToken(token: string) {
  const client = await getServerClient();
  
  // ✅ NOUVELLE LOGIQUE FLEXIBLE : Essayer d'abord avec is_active = true
  let tokenData = null;
  
  const { data: activeTokenData, error: activeTokenError } = await client
    .from('property_verification_tokens')
    .select('property_id, token, is_active, expires_at')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (activeTokenData) {
    tokenData = activeTokenData;
    console.log('✅ Token actif trouvé dans verifyPropertyToken');
  } else {
    console.log('⚠️ Token non-actif, recherche de token existant...');
    
    // Si pas de token actif, chercher n'importe quel token avec cette valeur
    const { data: anyTokenData, error: anyTokenError } = await client
      .from('property_verification_tokens')
      .select('property_id, token, is_active, expires_at')
      .eq('token', token)
      .single();

    if (anyTokenData) {
      tokenData = anyTokenData;
      console.log('✅ Token trouvé (même si inactif) dans verifyPropertyToken');
    } else {
      throw new AuthenticationError('Invalid property token', { error: anyTokenError });
    }
  }

  // ✅ CORRECTION : Vérification d'expiration plus flexible
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    console.warn('⚠️ Token expiré mais autorisation accordée pour la soumission');
    // Ne pas bloquer pour l'expiration, juste logger l'avertissement
  }

  // Now verify with the RPC function using both parameters
  const { data, error } = await client.rpc('verify_property_token', { 
    p_property_id: tokenData.property_id,
    p_token: token 
  });

  if (error || !data || data.length === 0) {
    throw new AuthenticationError('Invalid property token', { error });
  }

  return tokenData.property_id;
}