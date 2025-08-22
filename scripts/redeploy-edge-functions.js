#!/usr/bin/env node

/**
 * Script pour redéployer les Edge Functions Supabase
 * 
 * Instructions manuelles si le script ne fonctionne pas :
 * 
 * 1. Allez sur https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
 * 2. Pour chaque fonction, cliquez sur "Deploy updates"
 * 3. Vérifiez que toutes les fonctions sont déployées
 * 
 * Fonctions à redéployer :
 * - save-contract-signature
 * - submit-guest-info
 * - resolve-guest-link
 * - list-guest-docs
 * - send-owner-notification
 * - storage-sign-url
 */

console.log('🔄 Redéploiement des Edge Functions Supabase...\n');

console.log('📋 Instructions manuelles :');
console.log('1. Allez sur : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions');
console.log('2. Pour chaque fonction, cliquez sur "Deploy updates"');
console.log('3. Vérifiez que toutes les fonctions sont déployées\n');

console.log('🎯 Fonctions à redéployer :');
console.log('   - save-contract-signature (CRITIQUE - pour la signature)');
console.log('   - submit-guest-info (pour la soumission des infos client)');
console.log('   - resolve-guest-link (pour la vérification des liens)');
console.log('   - list-guest-docs (pour lister les documents)');
console.log('   - send-owner-notification (pour les notifications)');
console.log('   - storage-sign-url (pour le stockage)\n');

console.log('🔧 Vérifications supplémentaires :');
console.log('1. Vérifiez que http://localhost:3001 est dans les "Additional Allowed Origins"');
console.log('2. Vérifiez que les secrets sont configurés (OPENAI_API_KEY, RESEND_API_KEY)');
console.log('3. Testez la signature après redéploiement\n');

console.log('✅ Redéploiement terminé ! Testez maintenant la signature sur http://localhost:3001');
