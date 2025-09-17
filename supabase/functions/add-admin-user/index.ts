import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Email configurable via variable d'environnement ou body
    const { email: requestEmail } = await req.json().catch(() => ({}))
    const targetEmail = requestEmail || Deno.env.get('ADMIN_EMAIL') || 'ghalilahlou26@gmail.com'

    console.log('🔧 Ajout de l\'utilisateur administrateur...')
    console.log('📧 Recherche de l\'utilisateur:', targetEmail)

    // 1. Trouver l'ID de l'utilisateur par son email
    const { data: user, error: userError } = await supabaseClient
      .from('auth.users')
      .select('id')
      .eq('email', targetEmail)
      .single()

    if (userError) {
      console.error('❌ Erreur lors de la recherche de l\'utilisateur:', userError)
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé', details: userError }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!user) {
      console.error('❌ Utilisateur non trouvé:', targetEmail)
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Utilisateur trouvé avec l\'ID:', user.id)

    // 2. Insérer l'utilisateur comme super admin
    console.log('👑 Promotion en tant que super administrateur...')
    
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .upsert({
        user_id: user.id,
        role: 'super_admin',
        created_by: user.id,
        is_active: true
      })
      .select()
      .single()

    if (adminError) {
      console.error('❌ Erreur lors de l\'ajout de l\'administrateur:', adminError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'ajout de l\'administrateur', details: adminError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Super administrateur ajouté avec succès!')

    // 3. Allouer des tokens de test
    console.log('🎫 Allocation de tokens de test...')
    
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('token_allocations')
      .upsert({
        user_id: user.id,
        tokens_allocated: 100,
        tokens_used: 0,
        tokens_remaining: 100,
        is_active: true,
        allocated_by: user.id,
        notes: 'Tokens de test pour l\'administrateur'
      })
      .select()
      .single()

    if (tokensError) {
      console.error('⚠️ Erreur lors de l\'allocation de tokens:', tokensError)
    } else {
      console.log('✅ 100 tokens alloués avec succès!')
    }

    console.log('🎉 Configuration administrateur terminée!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Utilisateur promu administrateur avec succès',
        adminUser,
        tokens
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erreur générale:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
