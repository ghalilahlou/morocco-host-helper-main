#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('⚡ Redéploiement Alternatif des Edge Functions - Morocco Host Helper');
console.log('==================================================================');
console.log('📡 URL: https://csopyblkfyofwkeqqegd.supabase.co');
console.log('');

// Configuration Supabase
const SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM";

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deployEdgeFunctionsAlternative() {
  try {
    console.log('📋 Analyse des Edge Functions disponibles...');
    
    // Lister les fonctions disponibles
    const functionsDir = path.join(process.cwd(), 'supabase', 'functions');
    const functions = fs.readdirSync(functionsDir)
      .filter(item => {
        const itemPath = path.join(functionsDir, item);
        return fs.statSync(itemPath).isDirectory() && item !== '_shared';
      });

    console.log(`📁 ${functions.length} fonctions trouvées:`);
    functions.forEach(func => {
      console.log(`   - ${func}`);
    });

    console.log('\n🔍 Test de l\'état actuel des Edge Functions...');
    await testCurrentFunctions();

    console.log('\n📝 Instructions pour redéployer les Edge Functions:');
    console.log('==================================================');
    console.log('');
    console.log('1. 📦 Installer Supabase CLI via les méthodes officielles:');
    console.log('   - Windows (PowerShell):');
    console.log('     winget install Supabase.CLI');
    console.log('   - Ou via Scoop:');
    console.log('     scoop bucket add supabase https://github.com/supabase/scoop-bucket.git');
    console.log('     scoop install supabase');
    console.log('   - Ou via Chocolatey:');
    console.log('     choco install supabase');
    console.log('');
    console.log('2. 🔐 Se connecter à Supabase:');
    console.log('   supabase login');
    console.log('');
    console.log('3. 🔗 Lier le projet:');
    console.log('   supabase link --project-ref csopyblkfyofwkeqqegd');
    console.log('');
    console.log('4. 🚀 Redéployer toutes les fonctions:');
    console.log('   supabase functions deploy');
    console.log('');
    console.log('5. 🧪 Tester les fonctions après déploiement:');
    console.log('   node scripts/test-supabase-connection.js');
    console.log('');

    // Vérifier les logs d'erreur possibles
    console.log('🔍 Diagnostic des problèmes potentiels:');
    await diagnosePotentialIssues();

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);
  }
}

async function testCurrentFunctions() {
  const functionsToTest = [
    'get-airbnb-reservation',
    'generate-documents',
    'submit-guest-info',
    'issue-guest-link',
    'sync-airbnb-reservations'
  ];

  for (const func of functionsToTest) {
    try {
      console.log(`   🔍 Test de ${func}...`);
      const { data, error } = await supabase.functions.invoke(func, {
        body: { test: true }
      });
      
      if (error) {
        console.log(`      ❌ ${func}: ${error.message}`);
      } else {
        console.log(`      ✅ ${func}: Répond correctement`);
      }
    } catch (err) {
      console.log(`      ❌ ${func}: ${err.message}`);
    }
  }
}

async function diagnosePotentialIssues() {
  console.log('\n🔍 Vérification des problèmes courants:');
  
  // Vérifier la configuration du projet
  try {
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf8');
      console.log('   ✅ Fichier config.toml présent');
      
      // Vérifier les configurations des fonctions
      const functions = [
        'sync-airbnb-reservations',
        'get-airbnb-reservation',
        'generate-documents',
        'send-owner-notification',
        'submit-guest-info',
        'storage-sign-url',
        'issue-guest-link',
        'resolve-guest-link',
        'list-guest-docs'
      ];
      
      functions.forEach(func => {
        if (config.includes(`[functions.${func}]`)) {
          console.log(`   ✅ Configuration pour ${func} présente`);
        } else {
          console.log(`   ⚠️  Configuration pour ${func} manquante`);
        }
      });
    } else {
      console.log('   ❌ Fichier config.toml manquant');
    }
  } catch (error) {
    console.log(`   ❌ Erreur lors de la vérification de la config: ${error.message}`);
  }

  // Vérifier les variables d'environnement
  console.log('\n🔧 Vérification des variables d\'environnement:');
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_OPENAI_API_KEY',
    'VITE_RESEND_API_KEY'
  ];

  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar} configurée`);
    } else {
      console.log(`   ⚠️  ${envVar} non configurée`);
    }
  });
}

// Exécuter le diagnostic
deployEdgeFunctionsAlternative();
