#!/usr/bin/env tsx

/**
 * Script de diagnostic pour l'erreur 404
 * Vérifie les Edge Functions et leurs dépendances
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

console.log('🔍 Diagnostic Erreur 404 - Edge Functions\n');
console.log('═'.repeat(60));

// Vérifier les variables d'environnement
console.log('\n📋 1. Vérification des variables d\'environnement');
console.log('─'.repeat(60));

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_URL manquante');
  process.exit(1);
} else {
  console.log('✅ SUPABASE_URL:', SUPABASE_URL);
}

if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️  VITE_SUPABASE_ANON_KEY ou SUPABASE_ANON_KEY manquante');
} else {
  console.log('✅ SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
}

if (!SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY manquante (nécessaire pour certains tests)');
} else {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY?.substring(0, 20) + '...');
}

// Vérifier les fonctions locales
console.log('\n📁 2. Vérification des fonctions locales');
console.log('─'.repeat(60));

const functionsDir = join(__dirname, '..', 'supabase', 'functions');
const functionsToCheck = [
  'get-guest-documents-unified',
  'submit-guest-info-unified',
  'issue-guest-link',
  'sync-airbnb-unified'
];

const localFunctions: Record<string, boolean> = {};
for (const funcName of functionsToCheck) {
  const indexPath = join(functionsDir, funcName, 'index.ts');
  if (existsSync(indexPath)) {
    localFunctions[funcName] = true;
    console.log(`✅ ${funcName} - Fichier local trouvé`);
  } else {
    localFunctions[funcName] = false;
    console.log(`❌ ${funcName} - Fichier local manquant`);
  }
}

// Tester les fonctions déployées
console.log('\n🌐 3. Test des fonctions déployées');
console.log('─'.repeat(60));

if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️  Impossible de tester les fonctions sans SUPABASE_ANON_KEY');
} else {
  for (const funcName of functionsToCheck) {
    try {
      // Test avec une requête OPTIONS (CORS)
      const functionsUrl = `${SUPABASE_URL}/functions/v1/${funcName}`;
      
      const response = await fetch(functionsUrl, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Origin': 'http://localhost:3000'
        }
      });

      if (response.status === 200 || response.status === 204) {
        console.log(`✅ ${funcName} - Fonction déployée et accessible`);
      } else if (response.status === 404) {
        console.log(`❌ ${funcName} - Fonction NON déployée (404)`);
      } else {
        console.log(`⚠️  ${funcName} - Statut inattendu: ${response.status}`);
      }
    } catch (error) {
      const err = error as Error;
      console.log(`❌ ${funcName} - Erreur lors du test:`, err.message);
    }
  }
}

// Vérifier les dépendances
console.log('\n🔗 4. Vérification des dépendances entre fonctions');
console.log('─'.repeat(60));

if (localFunctions['get-guest-documents-unified']) {
  const indexPath = join(functionsDir, 'get-guest-documents-unified', 'index.ts');
  const content = readFileSync(indexPath, 'utf-8');
  
  // Chercher les appels à supabase.functions.invoke
  const invokeRegex = /supabase\.functions\.invoke\(['"]([^'"]+)['"]/g;
  const dependencies = new Set<string>();
  let match;
  
  while ((match = invokeRegex.exec(content)) !== null) {
    dependencies.add(match[1]);
  }
  
  if (dependencies.size > 0) {
    console.log('Dépendances trouvées dans get-guest-documents-unified:');
    for (const dep of dependencies) {
      const exists = localFunctions[dep] !== undefined;
      if (exists && localFunctions[dep]) {
        console.log(`  ✅ ${dep} - Dépendance trouvée localement`);
      } else if (exists && !localFunctions[dep]) {
        console.log(`  ❌ ${dep} - Dépendance manquante localement`);
      } else {
        console.log(`  ⚠️  ${dep} - Dépendance non vérifiée`);
      }
    }
  } else {
    console.log('ℹ️  Aucune dépendance trouvée');
  }
}

// Vérifier la configuration Storage
console.log('\n📦 5. Vérification de la configuration Storage');
console.log('─'.repeat(60));

if (SUPABASE_SERVICE_KEY) {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Vérifier si le bucket existe
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.log(`⚠️  Erreur lors de la vérification des buckets: ${bucketsError.message}`);
    } else {
      const guestDocumentsBucket = buckets?.find(b => b.name === 'guest-documents');
      if (guestDocumentsBucket) {
        console.log('✅ Bucket "guest-documents" existe');
      } else {
        console.log('❌ Bucket "guest-documents" n\'existe pas');
      }
    }
  } catch (error) {
    const err = error as Error;
    console.log(`⚠️  Impossible de vérifier Storage: ${err.message}`);
  }
} else {
  console.log('⚠️  Impossible de vérifier Storage sans SUPABASE_SERVICE_ROLE_KEY');
}

// Résumé et recommandations
console.log('\n📊 6. Résumé et Recommandations');
console.log('─'.repeat(60));

const missingLocal = Object.entries(localFunctions).filter(([_, exists]) => !exists);
if (missingLocal.length > 0) {
  console.log('\n❌ Fonctions manquantes localement:');
  missingLocal.forEach(([name]) => console.log(`   - ${name}`));
  console.log('\n💡 Action: Vérifier que ces fonctions existent dans supabase/functions/');
}

console.log('\n💡 Actions recommandées:');
console.log('   1. Vérifier que toutes les fonctions sont déployées:');
console.log('      supabase functions deploy get-guest-documents-unified');
console.log('      supabase functions deploy submit-guest-info-unified');
console.log('   2. Vérifier les logs dans Supabase Dashboard → Edge Functions → Logs');
console.log('   3. Vérifier la console du navigateur (F12) → Network pour voir l\'URL exacte qui retourne 404');
console.log('   4. Consulter GUIDE_DIAGNOSTIC_ERREUR_404.md pour plus de détails');

console.log('\n✅ Diagnostic terminé\n');

