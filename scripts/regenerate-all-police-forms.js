// =====================================================
// SCRIPT DE RÉGÉNÉRATION EN MASSE DES FICHES DE POLICE
// Pour ajouter les signatures guests aux documents existants
// =====================================================

const SUPABASE_URL = 'https://csopyblkfyofwkeqqegd.supabase.co';
const SUPABASE_ANON_KEY = 'REMPLACER_PAR_VOTRE_ANON_KEY';

// =====================================================
// CONFIGURATION
// =====================================================

// Liste des booking IDs à régénérer
// OBTENUE depuis la requête SQL : scripts/identify_police_forms_to_regenerate.sql
const bookingIds = [
  // 'booking-id-1',
  // 'booking-id-2',
  // 'booking-id-3',
  // ... ajoutez vos booking IDs ici
];

// Délai entre chaque appel (en millisecondes)
const DELAY_MS = 500; // 500ms recommandé pour ne pas surcharger

// =====================================================
// FONCTIONS
// =====================================================

/**
 * Régénère la fiche de police pour un booking donné
 */
async function regeneratePoliceForm(bookingId) {
  console.log(`\n🔄 Régénération pour booking: ${bookingId}`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-guest-info-unified`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'regenerate_police_with_signature',
        bookingId: bookingId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${bookingId}: ${result.message}`);
      console.log(`   Signature guest: ${result.hasGuestSignature ? 'OUI ✓' : 'NON ✗'}`);
      return { bookingId, success: true, hasSignature: result.hasGuestSignature };
    } else {
      console.log(`❌ ${bookingId}: ${result.error}`);
      return { bookingId, success: false, error: result.error };
    }
    
  } catch (error) {
    console.error(`❌ ${bookingId}: Erreur réseau - ${error.message}`);
    return { bookingId, success: false, error: error.message };
  }
}

/**
 * Pause pour un nombre de millisecondes donné
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fonction principale de régénération
 */
async function regenerateAll() {
  console.log('========================================');
  console.log('  RÉGÉNÉRATION EN MASSE DES FICHES');
  console.log('========================================');
  console.log('');
  console.log(`📊 Total à régénérer: ${bookingIds.length}`);
  console.log(`⏱️  Délai entre appels: ${DELAY_MS}ms`);
  console.log(`⏰ Temps estimé: ~${Math.ceil(bookingIds.length * DELAY_MS / 1000)}s`);
  console.log('');
  
  // Vérification configuration
  if (SUPABASE_ANON_KEY === 'REMPLACER_PAR_VOTRE_ANON_KEY') {
    console.error('❌ ERREUR: Veuillez configurer SUPABASE_ANON_KEY');
    return;
  }
  
  if (bookingIds.length === 0) {
    console.error('❌ ERREUR: Aucun booking ID fourni');
    console.log('');
    console.log('💡 Pour obtenir la liste:');
    console.log('   1. Exécutez scripts/identify_police_forms_to_regenerate.sql');
    console.log('   2. Copiez les booking_id dans ce script');
    return;
  }
  
  // Statistiques
  const stats = {
    total: bookingIds.length,
    success: 0,
    failed: 0,
    withSignature: 0,
    withoutSignature: 0
  };
  
  const results = [];
  
  // Régénération
  const startTime = Date.now();
  
  for (let i = 0; i < bookingIds.length; i++) {
    const bookingId = bookingIds[i];
    console.log(`\n[${i + 1}/${bookingIds.length}]`);
    
    const result = await regeneratePoliceForm(bookingId);
    results.push(result);
    
    if (result.success) {
      stats.success++;
      if (result.hasSignature) {
        stats.withSignature++;
      } else {
        stats.withoutSignature++;
      }
    } else {
      stats.failed++;
    }
    
    // Pause avant le prochain (sauf pour le dernier)
    if (i < bookingIds.length - 1) {
      await sleep(DELAY_MS);
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  // Afficher les résultats
  console.log('\n');
  console.log('========================================');
  console.log('  RÉSULTATS DE LA RÉGÉNÉRATION');
  console.log('========================================');
  console.log('');
  console.log(`📊 Total traité:          ${stats.total}`);
  console.log(`✅ Succès:                ${stats.success}`);
  console.log(`❌ Échecs:                ${stats.failed}`);
  console.log(`📝 Avec signature guest:  ${stats.withSignature}`);
  console.log(`⚠️  Sans signature guest: ${stats.withoutSignature}`);
  console.log(`⏱️  Durée totale:         ${duration}s`);
  console.log('');
  
  // Afficher les échecs s'il y en a
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('❌ ÉCHECS DÉTAILLÉS:');
    console.log('');
    failures.forEach(f => {
      console.log(`   ${f.bookingId}: ${f.error}`);
    });
    console.log('');
  }
  
  // Afficher les booking sans signature
  const withoutSig = results.filter(r => r.success && !r.hasSignature);
  if (withoutSig.length > 0) {
    console.log('⚠️  BOOKINGS SANS SIGNATURE GUEST:');
    console.log('');
    withoutSig.forEach(r => {
      console.log(`   ${r.bookingId}`);
    });
    console.log('');
    console.log('💡 Ces bookings n\'ont pas de signature guest en base.');
    console.log('   La fiche a été régénérée mais sans signature guest.');
    console.log('');
  }
  
  if (stats.success === stats.total) {
    console.log('🎉 RÉGÉNÉRATION TERMINÉE AVEC SUCCÈS!');
  } else {
    console.log('⚠️  RÉGÉNÉRATION TERMINÉE AVEC DES ERREURS');
  }
  console.log('');
}

// =====================================================
// EXÉCUTION
// =====================================================

regenerateAll().catch(error => {
  console.error('❌ ERREUR FATALE:', error);
  process.exit(1);
});
