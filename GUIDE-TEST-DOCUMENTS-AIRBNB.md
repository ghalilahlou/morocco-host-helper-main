# Guide de Test - Enregistrement des Documents et Synchronisation Airbnb

## 📋 Résumé des Tests

Ce guide vous permet de tester complètement l'enregistrement des documents et la synchronisation Airbnb dans votre application Morocco Host Helper.

## 🧪 1. Test de l'Enregistrement des Documents

### Données de Test
```json
{
  "propertyId": "test-property-123",
  "token": "test-token-456",
  "bookingData": {
    "checkInDate": "2024-02-15",
    "checkOutDate": "2024-02-20",
    "numberOfGuests": 2
  },
  "guestData": {
    "guests": [
      {
        "fullName": "Jean Dupont",
        "dateOfBirth": "1990-05-15",
        "nationality": "Française",
        "documentNumber": "AB123456",
        "documentType": "passport",
        "profession": "Ingénieur",
        "motifSejour": "TOURISME",
        "adressePersonnelle": "123 Rue de la Paix, Paris"
      },
      {
        "fullName": "Marie Dupont",
        "dateOfBirth": "1992-08-22",
        "nationality": "Française",
        "documentNumber": "CD789012",
        "documentType": "passport",
        "profession": "Médecin",
        "motifSejour": "TOURISME",
        "adressePersonnelle": "123 Rue de la Paix, Paris"
      }
    ],
    "documentUrls": [
      "https://example.com/passport-jean.pdf",
      "https://example.com/passport-marie.pdf"
    ]
  }
}
```

### Méthode 1: Test via Console du Navigateur

1. **Ouvrir votre application** dans le navigateur
2. **Ouvrir la console** (F12 → Console)
3. **Exécuter le code suivant** :

```javascript
const testData = {
  propertyId: "test-property-123",
  token: "test-token-456",
  bookingData: {
    checkInDate: "2024-02-15",
    checkOutDate: "2024-02-20",
    numberOfGuests: 2
  },
  guestData: {
    guests: [
      {
        fullName: "Jean Dupont",
        dateOfBirth: "1990-05-15",
        nationality: "Française",
        documentNumber: "AB123456",
        documentType: "passport",
        profession: "Ingénieur",
        motifSejour: "TOURISME",
        adressePersonnelle: "123 Rue de la Paix, Paris"
      },
      {
        fullName: "Marie Dupont",
        dateOfBirth: "1992-08-22",
        nationality: "Française",
        documentNumber: "CD789012",
        documentType: "passport",
        profession: "Médecin",
        motifSejour: "TOURISME",
        adressePersonnelle: "123 Rue de la Paix, Paris"
      }
    ],
    documentUrls: [
      "https://example.com/passport-jean.pdf",
      "https://example.com/passport-marie.pdf"
    ]
  }
};

// Appeler la fonction submit-guest-info
const response = await fetch('/functions/v1/submit-guest-info', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ANON_KEY' // Remplacer par votre clé
  },
  body: JSON.stringify(testData)
});

const result = await response.json();
console.log('Résultat:', result);
```

### Méthode 2: Test via cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/submit-guest-info \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "test-property-123",
    "token": "test-token-456",
    "bookingData": {
      "checkInDate": "2024-02-15",
      "checkOutDate": "2024-02-20",
      "numberOfGuests": 2
    },
    "guestData": {
      "guests": [
        {
          "fullName": "Jean Dupont",
          "dateOfBirth": "1990-05-15",
          "nationality": "Française",
          "documentNumber": "AB123456",
          "documentType": "passport",
          "profession": "Ingénieur",
          "motifSejour": "TOURISME",
          "adressePersonnelle": "123 Rue de la Paix, Paris"
        }
      ],
      "documentUrls": [
        "https://example.com/passport-jean.pdf"
      ]
    }
  }'
```

## 🏠 2. Test de la Synchronisation Airbnb

### Méthode 1: Via l'Interface Utilisateur

1. **Aller sur la page de synchronisation Airbnb** de votre application
2. **Saisir une URL ICS** (ex: `https://www.airbnb.com/calendar/ical/123456.ics?key=abc123`)
3. **Cliquer sur "Synchroniser"**
4. **Vérifier les résultats** dans la console ou les logs

### Méthode 2: Via Console du Navigateur

```javascript
// Test de synchronisation Airbnb
const syncResult = await fetch('/functions/v1/sync-airbnb-unified', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  },
  body: JSON.stringify({
    propertyId: "test-property-123",
    force: true
  })
});

const syncData = await syncResult.json();
console.log('Résultat sync Airbnb:', syncData);
```

### Méthode 3: Via cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-airbnb-unified \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "test-property-123", "force": true}'
```

## 📊 3. Vérification des Résultats en Base de Données

### Script SQL à exécuter dans Supabase

```sql
-- 1. Vérifier les documents uploadés récents
SELECT 
    id,
    booking_id,
    guest_id,
    file_name,
    document_type,
    processing_status,
    created_at,
    extracted_data
FROM uploaded_documents 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 2. Vérifier les soumissions d'invités récentes
SELECT 
    id,
    booking_id,
    property_id,
    token_id,
    is_signed,
    created_at,
    booking_data,
    guest_data
FROM guest_submissions 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 3. Vérifier les réservations récentes
SELECT 
    id,
    property_id,
    check_in_date,
    check_out_date,
    number_of_guests,
    status,
    created_at
FROM bookings 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 4. Vérifier les invités récents
SELECT 
    id,
    booking_id,
    full_name,
    nationality,
    document_type,
    document_number,
    created_at
FROM guests 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 5. Vérifier les propriétés avec sync Airbnb
SELECT 
    id,
    name,
    airbnb_ics_url,
    airbnb_sync_status,
    airbnb_last_sync
FROM properties 
WHERE airbnb_ics_url IS NOT NULL
ORDER BY updated_at DESC;
```

## ✅ 4. Vérifications à Effectuer

### Pour l'Enregistrement des Documents

- [ ] **uploaded_documents** contient 2 documents avec `booking_id`
- [ ] **guest_submissions** contient 1 enregistrement avec `booking_id`
- [ ] **guests** contient 2 invités avec `booking_id`
- [ ] **bookings** contient 1 réservation avec `property_id`
- [ ] Les `document_type` sont corrects (`"identity"`)
- [ ] Les `processing_status` sont `"completed"`
- [ ] Les `extracted_data` contiennent les bonnes informations
- [ ] Les `file_name` sont générés correctement

### Pour la Synchronisation Airbnb

- [ ] L'URL ICS est sauvegardée dans `properties.airbnb_ics_url`
- [ ] Les réservations sont créées dans `bookings`
- [ ] Les invités sont créés dans `guests`
- [ ] Le statut de sync est mis à jour
- [ ] Aucune erreur dans les logs

## 🎯 5. Résultats Attendus

### Réponse de submit-guest-info

```json
{
  "success": true,
  "bookingId": "uuid-de-la-reservation",
  "isNewBooking": true,
  "message": "Nouvelle réservation créée",
  "propertyId": "test-property-123",
  "guestCount": 2,
  "documentsCount": 2,
  "checkInDate": "2024-02-15",
  "checkOutDate": "2024-02-20",
  "guestSubmissionId": "uuid-de-la-soumission"
}
```

### Réponse de sync-airbnb-unified

```json
{
  "success": true,
  "message": "Synchronisation réussie",
  "reservations_count": 5,
  "reservations": [...],
  "propertyName": "Nom de la propriété"
}
```

## 🚨 6. Dépannage

### Erreurs Communes

1. **"Missing required parameters"**
   - Vérifier que `propertyId`, `bookingData`, et `guestData` sont fournis

2. **"Token ne correspond pas à la propriété"**
   - Vérifier que le token est valide et correspond à la propriété

3. **"Erreur lors de la création de la réservation"**
   - Vérifier les contraintes de la table `bookings`
   - Vérifier que `property_id` existe

4. **"Erreur lors de la création des invités"**
   - Vérifier les contraintes de la table `guests`
   - Vérifier que `booking_id` est valide

### Logs à Vérifier

- **Console du navigateur** : Erreurs JavaScript
- **Logs Supabase** : Erreurs des Edge Functions
- **Base de données** : Contraintes et relations

## 📝 7. Notes Importantes

1. **Remplacez les valeurs de test** par vos vraies valeurs :
   - `YOUR_ANON_KEY` par votre clé Supabase
   - `your-project.supabase.co` par votre URL Supabase
   - `test-property-123` par un ID de propriété existant

2. **Les URLs de documents** dans les tests sont fictives - utilisez de vraies URLs pour des tests complets

3. **Les tokens** doivent être valides dans votre table `property_verification_tokens`

4. **La synchronisation Airbnb** nécessite une vraie URL ICS d'Airbnb

## 🎉 8. Succès

Si tous les tests passent, vous devriez voir :

- ✅ Documents enregistrés dans `uploaded_documents`
- ✅ Soumissions créées dans `guest_submissions`
- ✅ Invités créés dans `guests`
- ✅ Réservations créées dans `bookings`
- ✅ Synchronisation Airbnb fonctionnelle
- ✅ Relations entre tables intactes

Votre système d'enregistrement des documents et de synchronisation Airbnb fonctionne correctement ! 🚀
