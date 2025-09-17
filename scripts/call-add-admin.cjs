#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iJvuckTVJyKo6wDd3AMEeakM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addAdminUser() {
  console.log('🔧 Appel de l\'Edge Function pour ajouter l\'administrateur...');

  try {
    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke('add-admin-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      console.error('❌ Erreur lors de l\'appel de l\'Edge Function:', error);
      return;
    }

    console.log('✅ Réponse de l\'Edge Function:', data);

    if (data.success) {
      console.log('🎉 Utilisateur promu administrateur avec succès!');
      console.log('👤 Détails de l\'administrateur:', data.adminUser);
      console.log('🎫 Tokens alloués:', data.tokens);
      console.log('\n🔗 L\'utilisateur peut maintenant accéder à l\'interface administrateur via le menu profil.');
    } else {
      console.error('❌ Échec de la promotion:', data.error);
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

addAdminUser();
