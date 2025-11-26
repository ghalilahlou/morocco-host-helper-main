#!/usr/bin/env node

/**
 * Script de vérification du workflow de création de réservation
 * Vérifie que tous les fichiers nécessaires sont présents et correctement configurés
 */

const fs = require('fs');
const path = require('path');

const checks = [];

// Vérifier que DocumentUploadStep.tsx utilise bien les Dialogs conditionnels
const documentUploadStepPath = path.join(__dirname, '../src/components/wizard/DocumentUploadStep.tsx');
if (fs.existsSync(documentUploadStepPath)) {
  const content = fs.readFileSync(documentUploadStepPath, 'utf8');
  
  // Vérifier le rendu conditionnel des Dialogs
  if (content.includes('{editingGuest &&') && content.includes('{showPreview &&')) {
    checks.push({ name: 'Dialogs conditionnels dans DocumentUploadStep', status: '✅' });
  } else {
    checks.push({ name: 'Dialogs conditionnels dans DocumentUploadStep', status: '❌' });
  }
  
  // Vérifier les keys sur les Dialogs
  if (content.includes('key={`preview-') && content.includes('key={`guest-edit-')) {
    checks.push({ name: 'Keys sur les Dialogs', status: '✅' });
  } else {
    checks.push({ name: 'Keys sur les Dialogs', status: '❌' });
  }
} else {
  checks.push({ name: 'DocumentUploadStep.tsx existe', status: '❌' });
}

// Vérifier que BookingWizard.tsx contient les logs pour l'Edge Function
const bookingWizardPath = path.join(__dirname, '../src/components/BookingWizard.tsx');
if (fs.existsSync(bookingWizardPath)) {
  const content = fs.readFileSync(bookingWizardPath, 'utf8');
  
  if (content.includes('🚀 [HOST WORKFLOW] Invocation Edge Function')) {
    checks.push({ name: 'Logs Edge Function dans BookingWizard', status: '✅' });
  } else {
    checks.push({ name: 'Logs Edge Function dans BookingWizard', status: '❌' });
  }
  
  if (content.includes('action: \'host_direct\'')) {
    checks.push({ name: 'Action host_direct dans BookingWizard', status: '✅' });
  } else {
    checks.push({ name: 'Action host_direct dans BookingWizard', status: '❌' });
  }
} else {
  checks.push({ name: 'BookingWizard.tsx existe', status: '❌' });
}

// Vérifier que l'Edge Function gère bien host_direct
const edgeFunctionPath = path.join(__dirname, '../supabase/functions/submit-guest-info-unified/index.ts');
if (fs.existsSync(edgeFunctionPath)) {
  const content = fs.readFileSync(edgeFunctionPath, 'utf8');
  
  if (content.includes('requestBody.action === \'host_direct\'')) {
    checks.push({ name: 'Gestion host_direct dans Edge Function', status: '✅' });
  } else {
    checks.push({ name: 'Gestion host_direct dans Edge Function', status: '❌' });
  }
  
  if (content.includes('[HOST_DIRECT] Skipping saveGuestDataInternal')) {
    checks.push({ name: 'Skip saveGuestDataInternal pour host_direct', status: '✅' });
  } else {
    checks.push({ name: 'Skip saveGuestDataInternal pour host_direct', status: '❌' });
  }
} else {
  checks.push({ name: 'Edge Function existe', status: '❌' });
}

// Afficher les résultats
console.log('\n🔍 Vérification du workflow de création de réservation\n');
console.log('='.repeat(60));

checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
});

console.log('='.repeat(60));

const failedChecks = checks.filter(c => c.status === '❌');
if (failedChecks.length === 0) {
  console.log('\n✅ Tous les checks sont passés !');
  console.log('\n📝 Prochaines étapes :');
  console.log('1. Vider le cache Vite : Remove-Item -Recurse -Force node_modules\.vite');
  console.log('2. Redémarrer le serveur : npm run dev');
  console.log('3. Vider le cache du navigateur (Ctrl+Shift+Delete)');
  console.log('4. Tester la création d\'une nouvelle réservation');
  console.log('5. Vérifier les logs dans la console du navigateur');
  console.log('6. Vérifier les logs dans Supabase Edge Functions');
} else {
  console.log(`\n❌ ${failedChecks.length} check(s) ont échoué :`);
  failedChecks.forEach(check => {
    console.log(`   - ${check.name}`);
  });
  console.log('\n⚠️  Veuillez vérifier que toutes les modifications ont été appliquées.');
}

console.log('\n');


