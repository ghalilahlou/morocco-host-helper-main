/**
 * DIAGNOSTIC DÉTAILLÉ - Contrat Vide
 * Analyse complète pour identifier pourquoi le contrat PDF est vide
 */

console.log('🔍 DIAGNOSTIC DÉTAILLÉ - CONTRAT VIDE');
console.log('====================================');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'supabase', 'functions', 'generate-contract', 'index.ts');

try {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  console.log('\n🧪 ANALYSE 1: Structure du template de contrat');
  console.log('===============================================');
  
  // Vérifier si le template de contrat est présent
  const contractTemplateRegex = /const contractContent = `[\s\S]*?`;/;
  const contractTemplateMatch = fileContent.match(contractTemplateRegex);
  
  if (contractTemplateMatch) {
    console.log('✅ Template de contrat trouvé');
    const templateContent = contractTemplateMatch[0];
    console.log(`📊 Longueur du template: ${templateContent.length} caractères`);
    
    // Vérifier les éléments clés du template
    const keyElements = [
      '📑 Contrat de location saisonnière',
      'Entre les soussignés :',
      'Le Bailleur (Propriétaire/Host)',
      'Le Locataire (Voyageur/Guest)',
      '1. Objet du contrat',
      '2. Désignation du bien',
      '3. Durée de la location',
      '10. Loi applicable et juridiction'
    ];
    
    let missingElements = [];
    for (const element of keyElements) {
      if (templateContent.includes(element)) {
        console.log(`✅ Élément trouvé: ${element}`);
      } else {
        console.log(`❌ Élément manquant: ${element}`);
        missingElements.push(element);
      }
    }
    
    if (missingElements.length > 0) {
      console.log(`⚠️ ${missingElements.length} éléments manquants dans le template`);
    } else {
      console.log('✅ Tous les éléments clés du template sont présents');
    }
  } else {
    console.log('❌ PROBLÈME MAJEUR: Template de contrat non trouvé!');
  }
  
  console.log('\n🧪 ANALYSE 2: Variables dynamiques dans le template');
  console.log('==================================================');
  
  // Vérifier les variables dynamiques
  const dynamicVariables = [
    '${property.contact_info?.name',
    '${property.address',
    '${guest.full_name',
    '${guest.nationality',
    '${guest.document_number',
    '${property.property_type',
    '${booking.check_in_date',
    '${booking.check_out_date',
    '${property.city'
  ];
  
  let missingVariables = [];
  for (const variable of dynamicVariables) {
    if (fileContent.includes(variable)) {
      console.log(`✅ Variable trouvée: ${variable}`);
    } else {
      console.log(`❌ Variable manquante: ${variable}`);
      missingVariables.push(variable);
    }
  }
  
  if (missingVariables.length > 0) {
    console.log(`⚠️ ${missingVariables.length} variables dynamiques manquantes`);
  } else {
    console.log('✅ Toutes les variables dynamiques sont présentes');
  }
  
  console.log('\n🧪 ANALYSE 3: Fonction createSimplePDF');
  console.log('=====================================');
  
  // Vérifier la fonction createSimplePDF
  const createPdfRegex = /function createSimplePDF\(content: string\): string \{[\s\S]*?\n\}/;
  const createPdfMatch = fileContent.match(createPdfRegex);
  
  if (createPdfMatch) {
    console.log('✅ Fonction createSimplePDF trouvée');
    const pdfFunction = createPdfMatch[0];
    
    // Vérifier les éléments critiques de la fonction PDF
    const pdfElements = [
      'const lines = content.split',
      'let yPosition = 750',
      'const lineHeight = 14',
      'let pdfInstructions = \'BT\\n/F1 10 Tf\\n\'',
      'for (let i = 0; i < lines.length; i++)',
      'const currentY = yPosition - (i * lineHeight)',
      'pdfInstructions += `50 ${currentY} Td\\n(${line}) Tj\\n`',
      'pdfInstructions += \'ET\'',
      '%PDF-1.4'
    ];
    
    let missingPdfElements = [];
    for (const element of pdfElements) {
      if (pdfFunction.includes(element)) {
        console.log(`✅ Élément PDF trouvé: ${element}`);
      } else {
        console.log(`❌ Élément PDF manquant: ${element}`);
        missingPdfElements.push(element);
      }
    }
    
    if (missingPdfElements.length > 0) {
      console.log(`⚠️ ${missingPdfElements.length} éléments PDF critiques manquants`);
    } else {
      console.log('✅ Tous les éléments PDF critiques sont présents');
    }
  } else {
    console.log('❌ PROBLÈME MAJEUR: Fonction createSimplePDF non trouvée!');
  }
  
  console.log('\n🧪 ANALYSE 4: Gestion de l\'encodage');
  console.log('===================================');
  
  // Vérifier l'encodage base64
  if (fileContent.includes('btoa(unescape(encodeURIComponent(pdfContent)))')) {
    console.log('✅ Encodage UTF-8 correct trouvé');
  } else if (fileContent.includes('btoa(pdfContent)')) {
    console.log('⚠️ Encodage simple trouvé (peut causer des problèmes avec les accents)');
  } else {
    console.log('❌ PROBLÈME: Aucun encodage base64 trouvé!');
  }
  
  console.log('\n🧪 ANALYSE 5: Erreurs potentielles dans le code');
  console.log('===============================================');
  
  // Rechercher des erreurs de syntaxe potentielles
  const potentialErrors = [
    { pattern: /`;[\s\n]*;/, description: 'Double point-virgule détecté' },
    { pattern: /\$\{[^}]*\$\{/, description: 'Variables imbriquées détectées' },
    { pattern: /`[^`]*\n[^`]*`;/, description: 'Template literal mal fermé' },
    { pattern: /\.trim\(\)\s*;[\s\n]*const/, description: 'Point-virgule après trim()' }
  ];
  
  let errorsFound = [];
  for (const error of potentialErrors) {
    const matches = fileContent.match(error.pattern);
    if (matches) {
      console.log(`❌ ERREUR DÉTECTÉE: ${error.description}`);
      console.log(`   Match: "${matches[0].replace(/\n/g, '\\n')}"`);
      errorsFound.push(error.description);
    } else {
      console.log(`✅ Pas d'erreur: ${error.description}`);
    }
  }
  
  console.log('\n🧪 ANALYSE 6: Test de génération de contenu');
  console.log('==========================================');
  
  // Simuler la génération de contenu
  const mockBooking = {
    check_in_date: '2025-09-24',
    check_out_date: '2025-09-26',
    property: {
      contact_info: { name: 'Propriétaire Test' },
      address: 'Adresse Test, Casablanca, Maroc',
      property_type: 'apartment',
      city: 'Casablanca'
    },
    guests: [{
      full_name: 'Test Guest',
      nationality: 'FRANÇAIS',
      document_number: 'TEST123'
    }]
  };
  
  // Simuler le template
  const testTemplate = `📑 Contrat de location saisonnière (courte durée)

Entre les soussignés :

Le Bailleur (Propriétaire/Host)
Nom et prénom : ${mockBooking.property.contact_info?.name || 'Non spécifié'}
Adresse : ${mockBooking.property.address || 'Non spécifiée'}

Et

Le Locataire (Voyageur/Guest)
Nom et prénom : ${mockBooking.guests[0]?.full_name || 'Non spécifié'}
Nationalité : ${mockBooking.guests[0]?.nationality || 'Non spécifiée'}
N° de pièce d'identité (CIN ou passeport) : ${mockBooking.guests[0]?.document_number || 'Non spécifié'}

1. Objet du contrat

Le présent contrat a pour objet la location saisonnière, meublée et équipée, du bien ci-après désigné, à usage exclusif d'habitation.

Fait à ${mockBooking.property.city || 'Casablanca'}, le ${new Date().toLocaleDateString('fr-FR')}`;
  
  console.log('📝 Test de génération de contenu:');
  console.log(`✅ Longueur du contenu généré: ${testTemplate.length} caractères`);
  console.log('📄 Aperçu du contenu:');
  console.log(testTemplate.substring(0, 200) + '...');
  
  // Test de division en lignes
  const lines = testTemplate.split('\n');
  console.log(`✅ Nombre de lignes: ${lines.length}`);
  console.log(`✅ Première ligne: "${lines[0]}"`);
  console.log(`✅ Dernière ligne: "${lines[lines.length - 1]}"`);
  
  console.log('\n📊 RÉSUMÉ DU DIAGNOSTIC');
  console.log('=======================');
  
  const totalIssues = missingElements.length + missingVariables.length + errorsFound.length;
  
  if (totalIssues === 0) {
    console.log('✅ AUCUN PROBLÈME DÉTECTÉ dans le code');
    console.log('🔍 Le problème pourrait venir de:');
    console.log('   1. Les données de booking sont vides ou incorrectes');
    console.log('   2. La fonction n\'est pas appelée correctement');
    console.log('   3. Un problème dans la génération PDF elle-même');
    console.log('   4. Un problème d\'encodage ou de transmission');
  } else {
    console.log(`❌ ${totalIssues} PROBLÈMES DÉTECTÉS:`);
    if (missingElements.length > 0) {
      console.log(`   - ${missingElements.length} éléments manquants dans le template`);
    }
    if (missingVariables.length > 0) {
      console.log(`   - ${missingVariables.length} variables dynamiques manquantes`);
    }
    if (errorsFound.length > 0) {
      console.log(`   - ${errorsFound.length} erreurs de syntaxe détectées`);
    }
  }
  
  console.log('\n🚀 ACTIONS RECOMMANDÉES:');
  console.log('1. Vérifier les logs de la fonction Edge pour voir les données reçues');
  console.log('2. Ajouter des logs de debug dans generateContractPDF');
  console.log('3. Tester avec des données de booking simples');
  console.log('4. Vérifier que la fonction createSimplePDF reçoit bien le contenu');
  
  console.log('\n📋 COMMANDE DE TEST RECOMMANDÉE:');
  console.log('curl -X POST \'https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/generate-contract\' \\');
  console.log('  -H \'Authorization: Bearer YOUR_ANON_KEY\' \\');
  console.log('  -H \'Content-Type: application/json\' \\');
  console.log('  -d \'{"bookingId": "cdd5a70f-38c4-4bf3-82a5-58c58a41000b", "action": "generate"}\'');
  
} catch (error) {
  console.error('❌ Erreur lors du diagnostic:', error.message);
}
