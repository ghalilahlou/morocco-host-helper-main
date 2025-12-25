# ✅ CORRECTION - Dates Libres pour Réservations Indépendantes

## 📋 Problème Résolu

**Symptôme :** Les dates étaient pré-remplies (26/12/2025 - 28/12/2025) même pour les réservations indépendantes

**Cause :** Le système créait automatiquement des `reservationData` avec des dates par défaut pour tous les liens

**Impact :** Les guests ne pouvaient pas choisir leurs propres dates pour les réservations indépendantes

## 🔧 Modifications Appliquées

### 1. **useGuestVerification.ts** (Lignes 193-220)

**Avant :**
```typescript
let finalReservationData = options?.reservationData;

if (!finalReservationData && airbnbBookingId) {
  finalReservationData = {
    airbnbCode: airbnbBookingId,
    startDate: new Date(), // ❌ Dates par défaut créées automatiquement
    endDate: new Date(),
    numberOfGuests: 1
  };
}
```

**Après :**
```typescript
let finalReservationData = options?.reservationData;

// ✅ SUPPRIMÉ : Ne plus créer de dates par défaut automatiquement
// Les réservations indépendantes n'auront pas de dates pré-remplies
// Seules les réservations ICS/Airbnb auront des dates dans l'URL
```

### 2. **useGuestVerification.ts** (Lignes 269-343)

**Avant :**
```typescript
const reservationData = options?.reservationData || finalReservationData;

if (reservationData) {
  // ❌ Toujours inclure les dates dans l'URL
  let urlParams = `startDate=${startDate}&endDate=${endDate}...`;
  const shortUrl = `${baseUrl}/v/${token}`;
  return shortUrl;
}
```

**Après :**
```typescript
const reservationData = options?.reservationData;

// ✅ Vérifier si c'est une réservation indépendante
const isIndependentBooking = !reservationData || 
  reservationData.airbnbCode === 'INDEPENDENT_BOOKING' ||
  !reservationData.startDate ||
  !reservationData.endDate;

if (reservationData && !isIndependentBooking) {
  // ✅ RÉSERVATION ICS/AIRBNB : Inclure les dates dans l'URL
  let urlParams = `startDate=${startDate}&endDate=${endDate}...`;
  const fullUrl = `${baseUrl}/guest-verification/${propertyId}/${token}?${urlParams}`;
  return fullUrl;
} else {
  // ✅ RÉSERVATION INDÉPENDANTE : URL simple sans dates
  const shortUrl = `${baseUrl}/v/${token}`;
  return shortUrl;
}
```

## 📊 Comportement Après Correction

| Type de Réservation | Dates dans URL | Guest Choisit Dates | Exemple URL |
|---------------------|----------------|---------------------|-------------|
| **ICS/Airbnb** | ✅ Oui | ❌ Non (pré-remplies) | `/guest-verification/...?startDate=2025-12-26&endDate=2025-12-28` |
| **Indépendante** | ❌ Non | ✅ Oui (libres) | `/v/abc123` |

## 🎯 Résultat Attendu

### Réservation ICS/Airbnb
1. Host clique sur "Copier le lien invité" depuis une réservation ICS
2. URL générée : `https://checky.ma/guest-verification/...?startDate=2025-12-26&endDate=2025-12-28`
3. Guest ouvre le lien → **Dates pré-remplies** (26/12 - 28/12)
4. Guest ne peut pas modifier les dates (elles viennent du fichier ICS)

### Réservation Indépendante
1. Host clique sur "Copier le lien invité" depuis le dashboard (sans réservation)
2. URL générée : `https://checky.ma/v/abc123`
3. Guest ouvre le lien → **Dates vides** (calendrier ouvert)
4. Guest **choisit ses propres dates** librement

## ✅ Validation

Pour tester :

1. **Réservation ICS** :
   - Ouvrir une réservation Airbnb dans le calendrier
   - Cliquer "Copier le lien invité"
   - Ouvrir le lien → Dates doivent être pré-remplies

2. **Réservation Indépendante** :
   - Aller sur le dashboard
   - Cliquer "Copier le lien invité" (bouton général)
   - Ouvrir le lien → Dates doivent être vides, guest choisit

## 🔍 Détection Automatique

Le système détecte automatiquement le type de réservation :

```typescript
const isIndependentBooking = !reservationData || 
  reservationData.airbnbCode === 'INDEPENDENT_BOOKING' ||
  !reservationData.startDate ||
  !reservationData.endDate;
```

**Critères pour réservation indépendante :**
- Pas de `reservationData` fourni
- OU `airbnbCode === 'INDEPENDENT_BOOKING'`
- OU pas de `startDate` ou `endDate`

---

**Correction terminée ! Les guests peuvent maintenant choisir leurs dates pour les réservations indépendantes. 🎉**
