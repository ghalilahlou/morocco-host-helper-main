# 🔍 ANALYSE - PROBLÈME D'ENREGISTREMENT DES RÉSERVATIONS INDÉPENDANTES

**Date** : 30 janvier 2026  
**Problème rapporté** : Les réservations indépendantes ne s'enregistrent pas correctement quand un même guest a plusieurs réservations

---

## 🐛 PROBLÈME IDENTIFIÉ

### Symptômes
- Quand un guest a plusieurs réservations indépendantes (même nom, dates différentes)
- La deuxième réservation peut bloquer ou ne pas s'enregistrer
- Le système peut confondre les réservations ou créer des doublons

### Cause racine

**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`  
**Lignes** : 786-805

```typescript
if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
  // Pour les réservations indépendantes, chercher par property_id + guest_name + check_in_date
  const fullGuestName = `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`;
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('property_id', booking.propertyId)
    .eq('booking_reference', 'INDEPENDENT_BOOKING')
    .eq('guest_name', fullGuestName)  // ❌ PROBLÈME ICI
    .eq('check_in_date', booking.checkIn)
    .maybeSingle();
  existingBooking = data;
}
```

**Problème** : La logique cherche une réservation existante par `guest_name + check_in_date`. Mais il y a plusieurs cas problématiques :

1. **Cas 1 : Même guest, dates différentes**
   - Réservation 1 : "John Doe" du 15-17 février
   - Réservation 2 : "John Doe" du 20-22 février
   - ✅ Devrait créer 2 réservations distinctes
   - ✅ Fonctionne correctement (dates différentes)

2. **Cas 2 : Même guest, mêmes dates, soumission multiple**
   - Guest soumet le formulaire 2 fois pour la même réservation
   - ❌ Devrait mettre à jour la réservation existante
   - ❌ Peut créer un doublon si race condition

3. **Cas 3 : Garde global bloque la soumission**
   - **Fichier** : `src/services/documentServiceUnified.ts` ligne 64-89
   - Variable globale `isUnifiedWorkflowRunning` bloque les appels multiples
   - ❌ Si le guest a plusieurs réservations et essaie de les remplir rapidement
   - ❌ La deuxième réservation est bloquée avec l'erreur "Un workflow est déjà en cours"

---

## 🔍 ANALYSE DÉTAILLÉE

### Problème 1 : Garde global trop strict

**Code actuel** :
```typescript
// src/services/documentServiceUnified.ts
let isUnifiedWorkflowRunning = false;
let currentWorkflowRequestId: string | null = null;

export async function submitDocumentsUnified(request: DocumentGenerationRequest) {
  const requestId = `${request.token}-${request.airbnbCode}-${Date.now()}`;
  
  // ❌ BLOQUE TOUS LES APPELS, même pour des réservations différentes
  if (isUnifiedWorkflowRunning) {
    console.warn('⚠️ Workflow déjà en cours, appel ignoré');
    throw new Error('Un workflow est déjà en cours. Veuillez patienter.');
  }
  
  isUnifiedWorkflowRunning = true;
  // ...
}
```

**Impact** :
- Si un guest a 2 réservations (15-17 fév et 20-22 fév)
- Il remplit la première → `isUnifiedWorkflowRunning = true`
- Il essaie de remplir la deuxième → **BLOQUÉ**
- Il doit attendre que la première soit terminée (peut prendre 10-30 secondes)

**Solution** : Utiliser un garde par réservation au lieu d'un garde global

```typescript
// ✅ SOLUTION : Garde par réservation
const runningWorkflows = new Map<string, boolean>();

export async function submitDocumentsUnified(request: DocumentGenerationRequest) {
  const workflowKey = `${request.token}-${request.airbnbCode}`;
  
  if (runningWorkflows.get(workflowKey)) {
    throw new Error('Cette réservation est déjà en cours de traitement.');
  }
  
  runningWorkflows.set(workflowKey, true);
  
  try {
    // ... traitement
  } finally {
    runningWorkflows.delete(workflowKey);
  }
}
```

---

### Problème 2 : Détection de doublon insuffisante

**Code actuel** (ligne 968-996) :
```typescript
// ✅ CORRIGÉ : Vérifier à nouveau juste avant l'insertion
const lastCheck = await supabase
  .from('bookings')
  .select('id, status')
  .eq('property_id', booking.propertyId)
  .eq('booking_reference', booking.airbnbCode)  // ❌ Pour INDEPENDENT_BOOKING, tous ont le même code
  .maybeSingle();
```

**Problème** : Pour les réservations indépendantes, `booking_reference = 'INDEPENDENT_BOOKING'` pour **toutes** les réservations. La vérification ne distingue pas les réservations par guest ou par date.

**Impact** :
- Si 2 guests différents ont des réservations indépendantes
- Le `lastCheck` peut trouver la réservation d'un autre guest
- Le système met à jour la mauvaise réservation

**Solution** : Ajouter `guest_name` et `check_in_date` à la vérification

```typescript
// ✅ SOLUTION : Vérification plus précise pour INDEPENDENT_BOOKING
let lastCheckQuery = supabase
  .from('bookings')
  .select('id, status')
  .eq('property_id', booking.propertyId);

if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
  // Pour les réservations indépendantes, vérifier aussi guest_name + check_in_date
  lastCheckQuery = lastCheckQuery
    .eq('booking_reference', 'INDEPENDENT_BOOKING')
    .eq('guest_name', bookingData.guest_name)
    .eq('check_in_date', booking.checkIn);
} else {
  // Pour les réservations Airbnb, booking_reference suffit
  lastCheckQuery = lastCheckQuery
    .eq('booking_reference', booking.airbnbCode);
}

const lastCheck = await lastCheckQuery.maybeSingle();
```

---

### Problème 3 : Pas de contrainte unique en base de données

**Problème** : La table `bookings` n'a pas de contrainte unique pour éviter les doublons

**Impact** :
- Si 2 requêtes arrivent exactement en même temps (race condition)
- Les deux passent la vérification `lastCheck`
- Les deux créent une réservation → **DOUBLON**

**Solution** : Ajouter une contrainte unique en base de données

```sql
-- ✅ SOLUTION : Contrainte unique pour éviter les doublons
-- Pour les réservations Airbnb : property_id + booking_reference
CREATE UNIQUE INDEX idx_bookings_airbnb_unique 
ON bookings(property_id, booking_reference)
WHERE booking_reference != 'INDEPENDENT_BOOKING';

-- Pour les réservations indépendantes : property_id + guest_name + check_in_date
CREATE UNIQUE INDEX idx_bookings_independent_unique 
ON bookings(property_id, guest_name, check_in_date)
WHERE booking_reference = 'INDEPENDENT_BOOKING';
```

---

## ✅ PLAN DE CORRECTION

### Phase 1 : Correction urgente du garde global (15 min)

**Fichier** : `src/services/documentServiceUnified.ts`

**Changement** :
```typescript
// ❌ AVANT : Garde global
let isUnifiedWorkflowRunning = false;

// ✅ APRÈS : Garde par réservation
const runningWorkflows = new Map<string, boolean>();

export async function submitDocumentsUnified(request: DocumentGenerationRequest) {
  const workflowKey = `${request.token}-${request.airbnbCode}`;
  
  if (runningWorkflows.get(workflowKey)) {
    throw new Error('Cette réservation est déjà en cours de traitement. Veuillez patienter.');
  }
  
  runningWorkflows.set(workflowKey, true);
  
  try {
    // ... traitement existant
    return result;
  } finally {
    runningWorkflows.delete(workflowKey);
  }
}
```

**Impact** : Permet à un guest de remplir plusieurs réservations en parallèle

---

### Phase 2 : Amélioration de la détection de doublon (30 min)

**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`

**Changement ligne 968-996** :
```typescript
// ✅ CORRIGÉ : Vérification adaptée selon le type de réservation
let lastCheckQuery = supabase
  .from('bookings')
  .select('id, status, guest_name, check_in_date')
  .eq('property_id', booking.propertyId);

if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
  // Pour INDEPENDENT_BOOKING : vérifier guest_name + check_in_date
  lastCheckQuery = lastCheckQuery
    .eq('booking_reference', 'INDEPENDENT_BOOKING')
    .eq('guest_name', bookingData.guest_name)
    .eq('check_in_date', booking.checkIn);
  
  log('info', 'Vérification doublon INDEPENDENT_BOOKING', {
    guestName: bookingData.guest_name,
    checkIn: booking.checkIn
  });
} else {
  // Pour réservations Airbnb : booking_reference suffit (unique)
  lastCheckQuery = lastCheckQuery
    .eq('booking_reference', booking.airbnbCode);
  
  log('info', 'Vérification doublon Airbnb', {
    airbnbCode: booking.airbnbCode
  });
}

const lastCheck = await lastCheckQuery.maybeSingle();
```

---

### Phase 3 : Contraintes en base de données (1 heure)

**Fichier** : Nouvelle migration SQL

**Étapes** :
1. Créer une migration Supabase
2. Ajouter les contraintes uniques
3. Nettoyer les doublons existants avant d'appliquer les contraintes

**SQL** :
```sql
-- Migration : Contraintes uniques pour éviter les doublons de réservations

-- 1. Nettoyer les doublons existants (garder le plus récent)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY property_id, booking_reference 
      ORDER BY created_at DESC
    ) as rn
  FROM bookings
  WHERE booking_reference != 'INDEPENDENT_BOOKING'
)
DELETE FROM bookings
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Même chose pour INDEPENDENT_BOOKING
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY property_id, guest_name, check_in_date 
      ORDER BY created_at DESC
    ) as rn
  FROM bookings
  WHERE booking_reference = 'INDEPENDENT_BOOKING'
)
DELETE FROM bookings
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Ajouter les contraintes uniques
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_airbnb_unique 
ON bookings(property_id, booking_reference)
WHERE booking_reference != 'INDEPENDENT_BOOKING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_independent_unique 
ON bookings(property_id, guest_name, check_in_date)
WHERE booking_reference = 'INDEPENDENT_BOOKING';

-- 3. Ajouter un commentaire pour documentation
COMMENT ON INDEX idx_bookings_airbnb_unique IS 
'Évite les doublons pour les réservations Airbnb (property + booking_reference unique)';

COMMENT ON INDEX idx_bookings_independent_unique IS 
'Évite les doublons pour les réservations indépendantes (property + guest + date unique)';
```

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Même guest, 2 réservations différentes
1. Créer 2 liens ICS pour le même guest
   - Réservation A : 15-17 février
   - Réservation B : 20-22 février
2. Remplir le formulaire pour la réservation A
3. **IMMÉDIATEMENT** remplir le formulaire pour la réservation B
4. ✅ Vérifier que les 2 réservations sont créées
5. ✅ Vérifier qu'il n'y a pas de message "workflow déjà en cours"

### Test 2 : Même guest, même réservation, soumission double
1. Créer 1 lien ICS
2. Remplir le formulaire
3. Cliquer 2 fois sur "Soumettre" rapidement
4. ✅ Vérifier qu'une seule réservation est créée
5. ✅ Vérifier que la deuxième soumission met à jour la première

### Test 3 : 2 guests différents, même date
1. Créer 2 liens ICS pour 2 guests différents
   - Guest A : "John Doe" du 15-17 février
   - Guest B : "Jane Smith" du 15-17 février
2. Remplir les 2 formulaires
3. ✅ Vérifier que 2 réservations distinctes sont créées
4. ✅ Vérifier qu'il n'y a pas de confusion entre les guests

---

## 📊 IMPACT ESTIMÉ

| Correction | Effort | Impact | Risque |
|------------|--------|--------|--------|
| **Phase 1 : Garde par réservation** | 15 min | 🔥 ÉLEVÉ | 🟢 FAIBLE |
| **Phase 2 : Détection doublon** | 30 min | 🔥 ÉLEVÉ | 🟢 FAIBLE |
| **Phase 3 : Contraintes DB** | 1h | 🟡 MOYEN | 🟡 MOYEN |

**Recommandation** : Appliquer Phase 1 et 2 immédiatement, Phase 3 après tests

---

## 🎯 RÉSUMÉ EXÉCUTIF

### Problème
Les réservations indépendantes peuvent bloquer ou créer des doublons quand un même guest a plusieurs réservations.

### Cause
1. **Garde global** bloque toutes les soumissions en parallèle
2. **Détection de doublon** insuffisante pour `INDEPENDENT_BOOKING`
3. **Pas de contrainte DB** pour éviter les race conditions

### Solution
1. ✅ Remplacer le garde global par un garde par réservation
2. ✅ Améliorer la détection de doublon avec `guest_name + check_in_date`
3. ✅ Ajouter des contraintes uniques en base de données

### Bénéfices
- ✅ Guest peut remplir plusieurs réservations en parallèle
- ✅ Pas de doublons même en cas de soumission multiple
- ✅ Pas de confusion entre les réservations de guests différents
