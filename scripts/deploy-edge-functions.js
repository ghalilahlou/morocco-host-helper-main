#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('⚡ Redéploiement des Edge Functions Supabase - Morocco Host Helper');
console.log('================================================================');
console.log('📡 URL: https://csopyblkfyofwkeqqegd.supabase.co');
console.log('');

async function deployEdgeFunctions() {
  try {
    // Vérifier que Supabase CLI est installé
    console.log('🔍 Vérification de Supabase CLI...');
    try {
      execSync('supabase --version', { stdio: 'pipe' });
      console.log('✅ Supabase CLI installé');
    } catch (error) {
      console.log('📦 Installation de Supabase CLI...');
      execSync('npm install -g supabase', { stdio: 'inherit' });
    }

    // Vérifier la connexion
    console.log('\n🔐 Vérification de la connexion...');
    try {
      execSync('supabase status', { stdio: 'pipe' });
      console.log('✅ Projet Supabase connecté');
    } catch (error) {
      console.log('🔗 Connexion au projet Supabase...');
      execSync('supabase link --project-ref csopyblkfyofwkeqqegd', { stdio: 'inherit' });
    }

    // Lister les fonctions disponibles
    console.log('\n📋 Fonctions disponibles:');
    const functionsDir = path.join(process.cwd(), 'supabase', 'functions');
    const functions = fs.readdirSync(functionsDir)
      .filter(item => {
        const itemPath = path.join(functionsDir, item);
        return fs.statSync(itemPath).isDirectory() && item !== '_shared';
      });

    functions.forEach(func => {
      console.log(`   - ${func}`);
    });

    console.log(`\n🚀 Déploiement de ${functions.length} fonctions...`);

    // Déployer toutes les fonctions
    for (const func of functions) {
      try {
        console.log(`\n🔄 Déploiement de: ${func}`);
        execSync(`supabase functions deploy ${func}`, { stdio: 'inherit' });
        console.log(`✅ ${func} déployée avec succès`);
      } catch (error) {
        console.log(`❌ Erreur lors du déploiement de ${func}: ${error.message}`);
      }
    }

    console.log('\n🎉 Déploiement des Edge Functions terminé !');
    
    // Tester les fonctions après déploiement
    console.log('\n🧪 Test des fonctions après déploiement...');
    await testFunctions();

  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error.message);
  }
}

async function testFunctions() {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    "https://csopyblkfyofwkeqqegd.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"
  );

  const functionsToTest = [
    'get-airbnb-reservation',
    'generate-documents',
    'submit-guest-info',
    'issue-guest-link'
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
        console.log(`      ✅ ${func}: Fonctionnelle`);
      }
    } catch (err) {
      console.log(`      ❌ ${func}: ${err.message}`);
    }
  }
}

// Exécuter le déploiement
deployEdgeFunctions();
