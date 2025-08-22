#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase - Projet csopyblkfyofwkeqqegd
const SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM";

console.log('🔍 Test de connexion Supabase - Morocco Host Helper');
console.log('==================================================');
console.log(`📡 URL: ${SUPABASE_URL}`);
console.log(`🔑 Project ID: csopyblkfyofwkeqqegd`);
console.log('');

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSupabaseConnection() {
  try {
    console.log('🔄 Test de connexion...');
    
    // Test 1: Vérifier la connexion de base
    const { data: healthData, error: healthError } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(1);
    
    if (healthError) {
      console.log('⚠️  Erreur de connexion de base:', healthError.message);
    } else {
      console.log('✅ Connexion de base réussie');
    }

    // Test 2: Vérifier les tables principales
    console.log('\n📊 Test des tables principales...');
    
    const tablesToTest = [
      'properties',
      'bookings', 
      'users',
      'guest_verifications',
      'contracts'
    ];

    for (const table of tablesToTest) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: Accessible`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }

    // Test 3: Vérifier les Edge Functions
    console.log('\n⚡ Test des Edge Functions...');
    
    const functionsToTest = [
      'sync-airbnb-reservations',
      'get-airbnb-reservation',
      'generate-documents',
      'submit-guest-info',
      'issue-guest-link'
    ];

    for (const func of functionsToTest) {
      try {
        const { data, error } = await supabase.functions.invoke(func, {
          body: { test: true }
        });
        
        if (error) {
          console.log(`❌ Function ${func}: ${error.message}`);
        } else {
          console.log(`✅ Function ${func}: Accessible`);
        }
      } catch (err) {
        console.log(`❌ Function ${func}: ${err.message}`);
      }
    }

    // Test 4: Vérifier l'authentification
    console.log('\n🔐 Test de l\'authentification...');
    
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.log(`❌ Auth: ${authError.message}`);
    } else {
      console.log('✅ Auth: Configuré correctement');
      console.log(`   Session: ${authData.session ? 'Active' : 'Aucune session'}`);
    }

    // Test 5: Vérifier le stockage
    console.log('\n💾 Test du stockage...');
    
    try {
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .list('', { limit: 1 });
      
      if (storageError) {
        console.log(`❌ Storage: ${storageError.message}`);
      } else {
        console.log('✅ Storage: Accessible');
      }
    } catch (err) {
      console.log(`❌ Storage: ${err.message}`);
    }

    console.log('\n🎉 Test de connexion terminé !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Exécuter le test
testSupabaseConnection();
