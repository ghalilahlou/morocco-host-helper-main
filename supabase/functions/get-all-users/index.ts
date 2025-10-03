import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Create a Supabase client with service role key
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify user is authenticated and admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication failed'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ✅ Vérifier que l'utilisateur est admin
    const { data: adminUser, error: adminError } = await supabaseClient.from('admin_users').select('role').eq('user_id', user.id).single();
    if (adminError || !adminUser) {
      console.error('❌ Utilisateur non autorisé:', user.email);
      return new Response(JSON.stringify({
        error: 'Access denied - Admin required'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('✅ Admin autorisé:', user.email, 'Role:', adminUser.role);
    // ✅ Charger les utilisateurs avec le service role
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Erreur chargement utilisateurs:', usersError);
      return new Response(JSON.stringify({
        error: 'Failed to load users',
        details: usersError
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ✅ Formatter les données utilisateur (seulement les infos nécessaires)
    const formattedUsers = users?.users?.map((user)=>({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at
      })) || [];
    console.log(`✅ ${formattedUsers.length} utilisateurs chargés avec succès`);
    return new Response(JSON.stringify({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
