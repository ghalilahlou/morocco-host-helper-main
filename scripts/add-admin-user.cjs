#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Clés Supabase fournies par l'utilisateur
const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk5OTA1NCwiZXhwIjoyMDY5NTc1MDU0fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addAdminUser() {
  console.log('🔧 Ajout de l\'utilisateur administrateur...');

  try {
    // 1. Trouver l'ID de l'utilisateur par son email
    console.log('📧 Recherche de l\'utilisateur ghalilahlou26@gmail.com...');
    
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', 'ghalilahlou26@gmail.com')
      .single();

    if (userError) {
      console.error('❌ Erreur lors de la recherche de l\'utilisateur:', userError);
      return;
    }

    if (!user) {
      console.error('❌ Utilisateur ghalilahlou26@gmail.com non trouvé');
      return;
    }

    console.log('✅ Utilisateur trouvé avec l\'ID:', user.id);

    // 2. Insérer l'utilisateur comme super admin
    console.log('👑 Promotion en tant que super administrateur...');
    
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .upsert({
        user_id: user.id,
        role: 'super_admin',
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (adminError) {
      console.error('❌ Erreur lors de l\'ajout de l\'administrateur:', adminError);
      return;
    }

    console.log('✅ Super administrateur ajouté avec succès!');
    console.log('📋 Détails:', adminUser);

    // 3. Vérifier que l'insertion a réussi
    console.log('🔍 Vérification de l\'insertion...');
    
    const { data: verification, error: verifyError } = await supabase
      .from('admin_users')
      .select(`
        id,
        user_id,
        role,
        is_active,
        created_at,
        auth.users!inner(email)
      `)
      .eq('user_id', user.id)
      .single();

    if (verifyError) {
      console.error('❌ Erreur lors de la vérification:', verifyError);
      return;
    }

    console.log('✅ Vérification réussie!');
    console.log('👤 Email:', verification.users.email);
    console.log('🔑 Rôle:', verification.role);
    console.log('📅 Créé le:', verification.created_at);

    // 4. Allouer des tokens de test (optionnel)
    console.log('🎫 Allocation de tokens de test...');
    
    const { data: tokens, error: tokensError } = await supabase
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
      .single();

    if (tokensError) {
      console.error('⚠️ Erreur lors de l\'allocation de tokens:', tokensError);
    } else {
      console.log('✅ 100 tokens alloués avec succès!');
    }

    console.log('\n🎉 Configuration administrateur terminée!');
    console.log('🔗 L\'utilisateur peut maintenant accéder à l\'interface administrateur via le menu profil.');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

addAdminUser();
