/**
 * Script de nettoyage avant déploiement
 * Supprime les fichiers temporaires et de test
 */

import fs from 'fs';
import path from 'path';

console.log('🧹 Nettoyage du projet avant déploiement...');

// Fichiers et dossiers à supprimer
const filesToRemove = [
  // Fichiers de test
  'test-*.js',
  'debug-*.js',
  'fix-*.js',
  'deploy-*.js',
  '*-test.js',
  '*-debug.js',
  
  // Fichiers temporaires
  'generate-contract-*.ts',
  'submit-guest-info-*.ts',
  '*-FIXED.ts',
  '*-IMPROVED.ts',
  '*-LAYOUT-FIXED.ts',
  '*-UNICODE-SAFE.ts',
  
  // Fichiers de déploiement
  'deploy-*.ps1',
  'deploy-report.json',
  'fixes-report.json',
  'test-results.json',
  
  // Dossiers de backup
  'backup-*',
  'downloaded-functions/',
  'edge-functions-backup/',
  
  // Fichiers spécifiques
  'apply-all-fixes.js',
  'backup-local-functions.js',
  'check-current-token.js',
  'check-database-schema.js',
  'check-guests-table.js',
  'cleanup-duplicate-functions.js',
  'debug-bookings-table.js',
  'debug-submit-guest-info.js',
  'deploy-clean-duplicates.ps1',
  'deploy-fixes.js',
  'deploy-fixes.ps1',
  'deploy-functions.ps1',
  'deploy-generate-contract.js',
  'deploy-via-api.js',
  'diagnostic-system.js',
  'download-all-functions.js',
  'download-edge-functions.js',
  'download-edge-functions.ps1',
  'download-with-cli.js',
  'fix-booking-registration.js',
  'fix-contract-generation.js',
  'fix-document-synchronization.js',
  'fix-signature-system.js',
  'insert-test-guest.js',
  'migrate-to-standardized-api.js',
  'organize-downloaded-functions.js',
  'organize-simple.js',
  'show-summary.js',
  'test-compatibility-e2e.js',
  'test-connection.js',
  'test-corrections.js',
  'test-edge-function-simple.js',
  'test-edge-function.ps1',
  'test-edge-functions-complete.js',
  'test-edge-functions.js',
  'test-fixes-simple.js',
  'test-fixes.js',
  'test-frontend-updates.js',
  'test-functions-deployed.js',
  'test-generate-contract-debug.js',
  'test-generate-contract-simple.js',
  'test-generate-contract-test.js',
  'test-generate-contract.js',
  'test-generate-documents-restructured.js',
  'test-generate-id-documents.js',
  'test-modular-functions.js',
  'test-production-deployment.js',
  'test-refactored-edge-functions.js',
  'test-save-contract-signature.js',
  'test-submit-guest-info-final.js',
  'test-submit-guest-info-fixed.js',
  'test-submit-guest-info.js',
  'test-sync-documents.js',
  'test-token-system-fixed.js',
  'verify-edge-functions.js'
];

// Fonction pour supprimer un fichier
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`✅ Dossier supprimé: ${filePath}`);
      } else {
        fs.unlinkSync(filePath);
        console.log(`✅ Fichier supprimé: ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erreur suppression ${filePath}:`, error.message);
  }
}

// Fonction pour supprimer les fichiers avec pattern
function removeFilesWithPattern(pattern) {
  const files = fs.readdirSync('.');
  files.forEach(file => {
    if (file.match(pattern.replace('*', '.*'))) {
      removeFile(file);
    }
  });
}

// Supprimer les fichiers
filesToRemove.forEach(item => {
  if (item.includes('*')) {
    removeFilesWithPattern(item);
  } else {
    removeFile(item);
  }
});

// Supprimer les dossiers de backup avec pattern
const backupDirs = fs.readdirSync('.').filter(item => {
  const stat = fs.statSync(item);
  return stat.isDirectory() && item.startsWith('backup-');
});

backupDirs.forEach(dir => {
  removeFile(dir);
});

console.log('🎉 Nettoyage terminé !');
console.log('📋 Fichiers conservés pour le déploiement :');
console.log('   ✅ src/ - Code source');
console.log('   ✅ supabase/ - Configuration Supabase');
console.log('   ✅ public/ - Assets publics');
console.log('   ✅ package.json - Dépendances');
console.log('   ✅ vercel.json - Configuration Vercel');
console.log('   ✅ vite.config.*.ts - Configuration Vite');
console.log('   ✅ .gitignore - Fichiers ignorés');
console.log('   ✅ README.md - Documentation');
