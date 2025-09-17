# Guide de Test - Fonction Edge Corrigée

## 🎯 **Objectif**
Tester la fonction Edge `submit-guest-info` corrigée pour vérifier que tous les problèmes ont été résolus.

## 📋 **Problèmes Corrigés**
- ✅ `guest_name` ajouté dans la table `bookings`
- ✅ `guest_email` ajouté dans la table `bookings`
- ✅ `guest_phone` ajouté dans la table `bookings`
- ✅ `document_type` corrigé (`identity` → `passport`/`id_card`)

## 🧪 **Étapes de Test**

### **Étape 1 : Test de la Fonction Edge**

1. **Ouvrir la console du navigateur** (F12)
2. **Copier et coller le code de test** :

```javascript
const testData = {
  propertyId: "test-property-456",
  bookingData: {
    checkInDate: "2024-02-25",
    checkOutDate: "2024-02-28",
    numberOfGuests: 2
  },
  guestData: {
    guests: [{
      fullName: "Ahmed Benali",
      email: "ahmed.benali@example.com",
      phone: "+212612345678",
      nationality: "Moroccan",
      documentType: "passport",
      documentNumber: "P1234567",
      dateOfBirth: "1990-05-15",
      placeOfBirth: "Casablanca"
    }, {
      fullName: "Fatima Alami",
      email: "fatima.alami@example.com",
      phone: "+212698765432",
      nationality: "Moroccan",
      documentType: "id_card",
      documentNumber: "ID9876543",
      dateOfBirth: "1992-08-20",
      placeOfBirth: "Rabat"
    }],
    documentUrls: [
      "https://example.com/passport_ahmed.pdf",
      "https://example.com/id_card_fatima.pdf",
      "https://example.com/contract.pdf"
    ]
  }
};

console.log('🚀 Début du test de la fonction Edge...');
console.log('📝 Données envoyées:', testData);

const response = await fetch('/functions/v1/submit-guest-info', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('supabase.auth.token') || 'your-token-here')
  },
  body: JSON.stringify(testData)
});

console.log('📡 Statut de la réponse:', response.status);
const result = await response.json();
console.log('📊 Résultat complet:', result);

if (result.success) {
  console.log('✅ Test réussi!');
  console.log('📋 Booking ID:', result.bookingId);
  console.log('👥 Guest IDs:', result.guestIds);
  console.log('📄 Document IDs:', result.documentIds);
  console.log('📝 Submission ID:', result.guestSubmissionId);
} else {
  console.log('❌ Test échoué:', result.message);
  console.log('🔍 Erreurs:', result.errors);
}
```

### **Étape 2 : Vérification SQL**

Exécuter dans Supabase :

```sql
-- Vérifier la réservation créée
SELECT 
    'Réservation créée' as check_type,
    b.id as booking_id,
    b.guest_name,
    b.guest_email,
    b.guest_phone,
    b.status,
    b.number_of_guests,
    b.created_at
FROM bookings b
WHERE b.property_id = 'test-property-456'
AND b.check_in_date = '2024-02-25'
ORDER BY b.created_at DESC
LIMIT 1;

-- Vérifier les invités créés
SELECT 
    'Invités créés' as check_type,
    g.id as guest_id,
    g.booking_id,
    g.full_name,
    g.nationality,
    g.document_type,
    g.document_number,
    g.created_at
FROM guests g
WHERE g.booking_id IN (
    SELECT id FROM bookings 
    WHERE property_id = 'test-property-456' 
    AND check_in_date = '2024-02-25'
)
ORDER BY g.created_at DESC;

-- Vérifier les documents uploadés
SELECT 
    'Documents uploadés' as check_type,
    ud.id as document_id,
    ud.booking_id,
    ud.guest_id,
    ud.document_type,
    ud.processing_status,
    ud.file_name,
    ud.created_at
FROM uploaded_documents ud
WHERE ud.booking_id IN (
    SELECT id FROM bookings 
    WHERE property_id = 'test-property-456' 
    AND check_in_date = '2024-02-25'
)
ORDER BY ud.created_at DESC;
```

### **Étape 3 : Vérification Rapide**

Exécuter le script de vérification rapide :

```sql
-- Fichier: test-quick-verification.sql
-- Vérifier les données récentes (dernière heure)
```

## ✅ **Résultats Attendus**

### **Réservation :**
- ✅ `guest_name` = "Ahmed Benali"
- ✅ `guest_email` = "ahmed.benali@example.com"
- ✅ `guest_phone` = "+212612345678"
- ✅ `status` = "confirmed"

### **Invités :**
- ✅ 2 invités créés (Ahmed et Fatima)
- ✅ Types de documents spécifiques (`passport`, `id_card`)
- ✅ Toutes les données d'invité présentes

### **Documents :**
- ✅ Documents avec `document_type` = `passport` ou `id_card`
- ✅ `processing_status` = `completed`
- ✅ Relations avec `booking_id` et `guest_id`

### **Soumissions :**
- ✅ 1 soumission d'invité créée
- ✅ `guest_data` et `booking_data` présents
- ✅ Statut = `submitted`

## ⚠️ **Problèmes à Surveiller**

### **Si `guest_name` = null :**
- Vérifier que la fonction Edge a été redéployée
- Vérifier les logs de la fonction Edge
- Vérifier que `guestData.guests[0].fullName` est présent

### **Si `document_type` = "identity" :**
- Vérifier que la correction a été appliquée
- Vérifier que `guest.documentType` est spécifié

### **Si erreurs de création :**
- Vérifier les logs de la fonction Edge
- Vérifier les contraintes de la base de données
- Vérifier les permissions

## 🔍 **Diagnostic en Cas de Problème**

```sql
-- Diagnostic complet
SELECT 
    'DIAGNOSTIC COMPLET' as analysis_type,
    (SELECT COUNT(*) FROM bookings WHERE guest_name IS NULL AND created_at >= NOW() - INTERVAL '1 hour') as bookings_without_guest_name,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'identity' AND created_at >= NOW() - INTERVAL '1 hour') as identity_documents,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type IN ('passport', 'id_card') AND created_at >= NOW() - INTERVAL '1 hour') as specific_documents,
    (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_submissions;
```

## 🚀 **Actions de Suivi**

1. **Exécuter le test** de la fonction Edge
2. **Vérifier les résultats** SQL
3. **Analyser les logs** de la fonction Edge
4. **Corriger les problèmes** identifiés
5. **Valider** que tout fonctionne
6. **Tester avec de vraies données** de production

## 📞 **Support**

- **Logs de la fonction Edge** : Supabase Dashboard → Edge Functions
- **Logs de la base de données** : Supabase Dashboard → Logs
- **Scripts de diagnostic** : `test-quick-verification.sql`
- **Test complet** : `test-edge-function-complete.js`

Votre fonction Edge corrigée devrait maintenant fonctionner parfaitement ! 🎯
