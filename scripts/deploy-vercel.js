#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Déploiement Vercel - Morocco Host Helper');
console.log('==========================================');

// Vérifier que nous sommes dans le bon répertoire
if (!fs.existsSync('package.json')) {
  console.error('❌ Erreur: package.json non trouvé. Assurez-vous d\'être dans le répertoire du projet.');
  process.exit(1);
}

// Vérifier que Vercel CLI est installé
try {
  execSync('vercel --version', { stdio: 'pipe' });
} catch (error) {
  console.log('📦 Installation de Vercel CLI...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
}

// Vérifier la configuration
console.log('🔍 Vérification de la configuration...');

// Vérifier que le fichier vercel.json existe
if (!fs.existsSync('vercel.json')) {
  console.error('❌ Erreur: vercel.json non trouvé');
  process.exit(1);
}

// Vérifier que le fichier .env.example existe
if (!fs.existsSync('env.example')) {
  console.error('❌ Erreur: env.example non trouvé');
  process.exit(1);
}

console.log('✅ Configuration vérifiée');

// Build de production
console.log('🔨 Build de production...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build réussi');
} catch (error) {
  console.error('❌ Erreur lors du build');
  process.exit(1);
}

// Vérifier que le dossier dist existe
if (!fs.existsSync('dist')) {
  console.error('❌ Erreur: dossier dist non trouvé après le build');
  process.exit(1);
}

// Déploiement Vercel
console.log('🚀 Déploiement sur Vercel...');
try {
  execSync('vercel --prod --yes', { stdio: 'inherit' });
  console.log('✅ Déploiement réussi!');
} catch (error) {
  console.error('❌ Erreur lors du déploiement');
  process.exit(1);
}

console.log('🎉 Déploiement terminé avec succès!');
console.log('📝 N\'oubliez pas de configurer les variables d\'environnement dans Vercel Dashboard');
