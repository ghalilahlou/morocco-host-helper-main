#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iJvuckTVJyKo6wDd3AMEeakM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAdminStatus() {
  console.log('🔍 Vérification du statut administrateur...');
  console.log('📧 Email à vérifier: ghalilahlou26@gmail.com');

  try {
    // 1. Vérifier si l'utilisateur existe dans auth.users
    console.log('\n1️⃣ Vérification de l\'existence de l\'utilisateur...');
    
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .eq('email', 'ghalilahlou26@gmail.com')
      .single();

    if (userError) {
      console.error('❌ Erreur lors de la recherche de l\'utilisateur:', userError);
      return;
    }

    if (!user) {
      console.error('❌ Utilisateur ghalilahlou26@gmail.com non trouvé dans auth.users');
      return;
    }

    console.log('✅ Utilisateur trouvé:');
    console.log('   - ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Créé le:', user.created_at);

    // 2. Vérifier si l'utilisateur est dans admin_users
    console.log('\n2️⃣ Vérification du statut administrateur...');
    
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      console.error('❌ Erreur lors de la vérification admin:', adminError);
      return;
    }

    if (!adminUser) {
      console.log('❌ L\'utilisateur n\'est PAS administrateur');
      console.log('💡 Il faut l\'ajouter comme administrateur');
      return;
    }

    console.log('✅ L\'utilisateur EST administrateur:');
    console.log('   - Rôle:', adminUser.role);
    console.log('   - Actif:', adminUser.is_active);
    console.log('   - Créé le:', adminUser.created_at);

    // 3. Vérifier les tokens alloués
    console.log('\n3️⃣ Vérification des tokens alloués...');
    
    const { data: tokens, error: tokensError } = await supabase
      .from('token_allocations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokensError && tokensError.code !== 'PGRST116') {
      console.error('❌ Erreur lors de la vérification des tokens:', tokensError);
      return;
    }

    if (!tokens) {
      console.log('⚠️ Aucun token alloué à cet utilisateur');
    } else {
      console.log('✅ Tokens alloués:');
      console.log('   - Tokens alloués:', tokens.tokens_allocated);
      console.log('   - Tokens utilisés:', tokens.tokens_used);
      console.log('   - Tokens restants:', tokens.tokens_remaining);
      console.log('   - Actif:', tokens.is_active);
    }

    // 4. Résumé final
    console.log('\n📋 RÉSUMÉ:');
    if (adminUser) {
      console.log('✅ L\'utilisateur ghalilahlou26@gmail.com est administrateur');
      console.log('🔗 Il peut accéder à l\'interface administrateur via le menu profil');
      if (tokens) {
        console.log('🎫 Il a des tokens alloués pour générer des liens');
      }
    } else {
      console.log('❌ L\'utilisateur ghalilahlou26@gmail.com n\'est PAS administrateur');
      console.log('💡 Il faut l\'ajouter comme administrateur');
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkAdminStatus();
