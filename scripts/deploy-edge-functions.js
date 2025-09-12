/**
 * Script de déploiement des Edge Functions sur Supabase
 * Utilise l'API Supabase pour déployer les fonctions
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   VITE_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

// Extraire le project ref de l'URL
const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
console.log('🔧 Project Ref:', projectRef);

// Fonctions à déployer
const functionsToDeploy = [
  'submit-guest-info',
  'generate-contract',
  'generate-police-forms',
  'generate-id-documents',
  'save-contract-signature',
  'storage-sign-url'
];

async function deployFunction(functionName) {
  try {
    console.log(`🚀 Déploiement de ${functionName}...`);
    
    const functionPath = path.join('supabase', 'functions', functionName);
    const indexPath = path.join(functionPath, 'index.ts');
    
    if (!fs.existsSync(indexPath)) {
      console.error(`❌ Fichier non trouvé: ${indexPath}`);
      return false;
    }
    
    const functionCode = fs.readFileSync(indexPath, 'utf8');
    
    // Créer le payload pour l'API
    const payload = {
      name: functionName,
      code: functionCode,
      verify_jwt: false
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log(`✅ ${functionName} déployé avec succès`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Erreur déploiement ${functionName}:`, response.status, errorText);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Erreur critique ${functionName}:`, error.message);
    return false;
  }
}

async function deployAllFunctions() {
  console.log('🎯 Déploiement de toutes les Edge Functions...');
  console.log('📋 Fonctions à déployer:', functionsToDeploy.join(', '));
  
  const results = [];
  
  for (const functionName of functionsToDeploy) {
    const success = await deployFunction(functionName);
    results.push({ function: functionName, success });
    
    // Pause entre les déploiements
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Résultats du déploiement:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.function}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎉 Déploiement terminé: ${successCount}/${totalCount} fonctions déployées`);
  
  if (successCount === totalCount) {
    console.log('🎊 Toutes les fonctions sont déployées avec succès !');
  } else {
    console.log('⚠️ Certaines fonctions ont échoué. Vérifiez les logs ci-dessus.');
  }
}

// Exécuter le déploiement
deployAllFunctions().catch(error => {
  console.error('❌ Erreur critique:', error);
  process.exit(1);
});
