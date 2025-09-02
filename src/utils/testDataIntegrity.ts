// ✅ SCRIPT DE TEST POUR VALIDATION DES CORRECTIONS
// Utilitaire pour tester l'intégrité des données après les corrections

import { validateBookingData, validatePropertyData, getErrorReport } from './errorMonitoring';

// Test data samples
const validBooking = {
  id: 'test-booking-1',
  propertyId: 'test-property-1',
  checkInDate: '2025-01-30',
  checkOutDate: '2025-02-01',
  numberOfGuests: 2,
  status: 'pending',
  createdAt: new Date().toISOString(),
  guests: [],
  documentsGenerated: { policeForm: false, contract: false }
};

const invalidBooking = {
  id: 'test-booking-2',
  // propertyId manquant !
  checkInDate: '2025-02-01',
  checkOutDate: '2025-01-30', // Dates inversées !
  numberOfGuests: 0,
  status: 'pending',
  createdAt: new Date().toISOString(),
  guests: [],
  documentsGenerated: { policeForm: false, contract: false }
};

const validProperty = {
  id: 'test-property-1',
  name: 'Appartement Test',
  user_id: 'test-user-1',
  property_type: 'apartment',
  max_occupancy: 4,
  house_rules: [],
  contract_template: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const invalidProperty = {
  id: 'test-property-2',
  // name manquant !
  // user_id manquant !
  property_type: 'apartment',
  max_occupancy: 4
};

export function runDataIntegrityTests(): boolean {
  console.log('🧪 Tests d\'intégrité des données - DÉBUT');
  
  let allTestsPassed = true;

  // Test 1: Booking valide
  console.log('📋 Test 1: Validation booking valide');
  const test1 = validateBookingData(validBooking, 'test');
  if (test1) {
    console.log('✅ Test 1 réussi');
  } else {
    console.log('❌ Test 1 échoué');
    allTestsPassed = false;
  }

  // Test 2: Booking invalide
  console.log('📋 Test 2: Détection booking invalide');
  const test2 = validateBookingData(invalidBooking, 'test');
  if (!test2) {
    console.log('✅ Test 2 réussi (invalide détecté)');
  } else {
    console.log('❌ Test 2 échoué (invalide non détecté)');
    allTestsPassed = false;
  }

  // Test 3: Property valide
  console.log('🏠 Test 3: Validation property valide');
  const test3 = validatePropertyData(validProperty, 'test');
  if (test3) {
    console.log('✅ Test 3 réussi');
  } else {
    console.log('❌ Test 3 échoué');
    allTestsPassed = false;
  }

  // Test 4: Property invalide
  console.log('🏠 Test 4: Détection property invalide');
  const test4 = validatePropertyData(invalidProperty, 'test');
  if (!test4) {
    console.log('✅ Test 4 réussi (invalide détecté)');
  } else {
    console.log('❌ Test 4 échoué (invalide non détecté)');
    allTestsPassed = false;
  }

  // Test 5: Rapport d'erreurs
  console.log('📊 Test 5: Génération rapport d\'erreurs');
  const errorReport = getErrorReport();
  if (errorReport && typeof errorReport.totalErrors === 'number') {
    console.log('✅ Test 5 réussi');
    console.log(`📈 Rapport: ${errorReport.totalErrors} erreurs détectées`);
  } else {
    console.log('❌ Test 5 échoué');
    allTestsPassed = false;
  }

  console.log('🧪 Tests d\'intégrité des données - FIN');
  
  if (allTestsPassed) {
    console.log('🎉 TOUS LES TESTS SONT RÉUSSIS !');
  } else {
    console.log('⚠️ Certains tests ont échoué');
  }

  return allTestsPassed;
}

// Test de cohérence des interfaces
export function testInterfaceConsistency() {
  console.log('🔧 Test de cohérence des interfaces');
  
  // Simuler une transformation DB → Frontend
  const dbBooking = {
    id: 'test-db-booking',
    property_id: 'test-property', // DB: snake_case
    check_in_date: '2025-01-30',
    check_out_date: '2025-02-01',
    number_of_guests: 2,
    booking_reference: 'REF123',
    submission_id: 'test-submission',
    status: 'pending',
    created_at: new Date().toISOString(),
    documents_generated: { policeForm: false, contract: false }
  };

  // Transformation (comme dans useBookings.ts)
  const frontendBooking = {
    id: dbBooking.id,
    propertyId: dbBooking.property_id, // ✅ Conversion snake → camel
    submissionId: dbBooking.submission_id, // ✅ Conversion snake → camel
    checkInDate: dbBooking.check_in_date,
    checkOutDate: dbBooking.check_out_date,
    numberOfGuests: dbBooking.number_of_guests,
    bookingReference: dbBooking.booking_reference,
    status: dbBooking.status,
    createdAt: dbBooking.created_at,
    documentsGenerated: dbBooking.documents_generated,
    guests: []
  };

  // Vérifier que la transformation est cohérente
  const isValid = validateBookingData(frontendBooking, 'interface-test');
  
  if (isValid) {
    console.log('✅ Interface cohérente: DB → Frontend');
  } else {
    console.log('❌ Incohérence détectée dans la transformation');
  }

  return isValid;
}

// Fonction utilitaire pour tests en développement
export function runAllTests() {
  console.log('🚀 LANCEMENT DE TOUS LES TESTS DE VALIDATION');
  
  const test1 = runDataIntegrityTests();
  const test2 = testInterfaceConsistency();
  
  const allPassed = test1 && test2;
  
  if (allPassed) {
    console.log('🎉 TOUS LES TESTS SONT RÉUSSIS - APPLICATION PRÊTE !');
  } else {
    console.log('⚠️ Certains tests ont échoué - Vérifiez les corrections');
  }
  
  return allPassed;
}
