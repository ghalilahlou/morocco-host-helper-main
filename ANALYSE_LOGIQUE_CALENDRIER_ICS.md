# 🔍 ANALYSE COMPLÈTE - Logique d'Affichage du Calendrier ICS

## 📊 État Actuel du Système

### 1. Sources de Données du Calendrier

Le calendrier affiche les réservations de **3 sources** :

```typescript
// CalendarView.tsx - ligne 757-870
const allReservations = useMemo(() => {
  // Source 1: bookings (réservations manuelles)
  const filteredBookings = bookings.filter(...)
  
  // Source 2: airbnbReservations (depuis airbnb_reservations table)
  const filteredAirbnb = airbnbReservations.map(...)
  
  // Source 3: bookings avec codes Airbnb (HM%, CL%, etc.)
  // Ces réservations sont AUSSI dans bookings !
  
  return [...filteredBookings, ...uniqueAirbnbReservations];
}, [bookings, airbnbReservations]);
```

### 2. Flux de Données Complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYNCHRONISATION ICS                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         Edge Function: sync-airbnb-unified/index.ts             │
│                                                                 │
│  1. Récupère le fichier ICS                                    │
│  2. Parse les événements VEVENT                                │
│  3. Insère dans airbnb_reservations                            │
│  4. ✅ NOUVEAU: Supprime les anciennes réservations            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              TABLE: airbnb_reservations                         │
│                                                                 │
│  Colonnes:                                                      │
│  - id                                                           │
│  - property_id                                                  │
│  - airbnb_booking_id (ex: HMCKR2KEST)                          │
│  - guest_name                                                   │
│  - start_date                                                   │
│  - end_date                                                     │
│  - created_at                                                   │
│  - updated_at                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         Service: calendarData.ts                                │
│         Fonction: fetchAirbnbCalendarEvents()                   │
│                                                                 │
│  1. Récupère bookings (INCLUT codes Airbnb !)                  │
│  2. Récupère airbnb_reservations                               │
│  3. Enrichit avec les noms validés                             │
│  4. Retourne les événements calendrier                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CALENDRIER (CalendarView.tsx)                      │
│                                                                 │
│  Affiche:                                                       │
│  - Réservations manuelles (bookings)                           │
│  - Réservations Airbnb (airbnb_reservations)                   │
│  - ❌ PROBLÈME: Aussi les bookings avec codes Airbnb !         │
└─────────────────────────────────────────────────────────────────┘
```

---

## ❌ Problèmes Identifiés

### Problème 1 : Double Source pour les Codes Airbnb

**Symptôme :** Les réservations avec codes Airbnb apparaissent même après suppression du lien ICS.

**Cause :** Le calendrier lit à la fois :
- `airbnb_reservations` (table dédiée ICS)
- `bookings` (table générale qui CONTIENT aussi des codes Airbnb)

**Exemple :**
```
Réservation HMCKR2KEST peut exister dans:
1. airbnb_reservations (depuis ICS)
2. bookings (créée manuellement ou par ancien système)

Quand vous supprimez le lien ICS:
✅ airbnb_reservations est vidée
❌ bookings garde la réservation
→ Le calendrier affiche toujours HMCKR2KEST !
```

---

### Problème 2 : Logique de Récupération dans calendarData.ts

**Fichier :** `src/services/calendarData.ts`

**Ligne 49-55 :**
```typescript
const { data: bookingsData } = await supabase
  .from('bookings')
  .select('id, booking_reference, guest_name, check_in_date, check_out_date')
  .eq('property_id', propertyId)
  .gte('check_in_date', start)
  .lte('check_out_date', end);
  // ❌ PROBLÈME: Récupère TOUS les bookings, y compris ceux avec codes Airbnb
```

**Ligne 63-69 :**
```typescript
const { data: airbnbData } = await supabase
  .from('airbnb_reservations')
  .select('airbnb_booking_id, summary, guest_name, start_date, end_date')
  .eq('property_id', propertyId)
  .gte('start_date', start)
  .lte('end_date', end);
  // ✅ OK: Récupère uniquement depuis airbnb_reservations
```

**Résultat :** Les bookings avec codes Airbnb sont récupérés ET utilisés pour enrichir les réservations Airbnb.

---

### Problème 3 : Pas de Distinction Claire

Le système ne fait pas de distinction claire entre :
1. **Réservations ICS pures** (doivent être dans `airbnb_reservations` uniquement)
2. **Réservations manuelles avec codes Airbnb** (dans `bookings` avec `booking_reference` = code Airbnb)
3. **Réservations manuelles normales** (dans `bookings` sans code Airbnb)

---

## ✅ Solutions Proposées

### Solution 1 : Filtrer les Codes Airbnb dans calendarData.ts (RECOMMANDÉ)

**Principe :** Ne pas utiliser les bookings avec codes Airbnb pour enrichir les réservations ICS.

**Modification :** `src/services/calendarData.ts`

```typescript
// Ligne 49-55 : Exclure les codes Airbnb
const { data: bookingsData, error: bookingsError } = await supabase
  .from('bookings')
  .select('id, booking_reference, guest_name, check_in_date, check_out_date, status')
  .eq('property_id', propertyId)
  .gte('check_in_date', start)
  .lte('check_out_date', end)
  // ✅ NOUVEAU: Exclure les réservations avec codes Airbnb
  .not('booking_reference', 'like', 'HM%')
  .not('booking_reference', 'like', 'CL%')
  .not('booking_reference', 'like', 'PN%')
  // ... autres patterns
  .order('check_in_date', { ascending: true });
```

**Avantages :**
- ✅ Simple à implémenter
- ✅ Résout le problème immédiatement
- ✅ Pas de modification de la structure de données

**Inconvénients :**
- ⚠️ Si vous avez des réservations légitimes dans `bookings` avec codes Airbnb, elles ne seront plus visibles

---

### Solution 2 : Ajouter un Flag `source` dans bookings

**Principe :** Marquer explicitement l'origine de chaque réservation.

**Modification :** Ajouter une colonne `source` dans `bookings`

```sql
ALTER TABLE public.bookings
ADD COLUMN source TEXT DEFAULT 'manual';

-- Valeurs possibles: 'manual', 'ics_airbnb', 'api', etc.
```

**Utilisation :**
```typescript
// Lors de la création manuelle
INSERT INTO bookings (source) VALUES ('manual');

// Lors de la synchronisation ICS (si on crée dans bookings)
INSERT INTO bookings (source) VALUES ('ics_airbnb');

// Dans calendarData.ts
const { data: bookingsData } = await supabase
  .from('bookings')
  .select('...')
  .eq('source', 'manual'); // Seulement les manuelles
```

**Avantages :**
- ✅ Distinction claire de l'origine
- ✅ Flexibilité pour d'autres sources futures
- ✅ Pas de perte de données

**Inconvénients :**
- ⚠️ Nécessite une migration de données
- ⚠️ Plus complexe à implémenter

---

### Solution 3 : Utiliser UNIQUEMENT airbnb_reservations pour ICS

**Principe :** Ne JAMAIS créer de réservations dans `bookings` depuis la synchronisation ICS.

**Architecture :**
```
ICS Sync → airbnb_reservations (UNIQUEMENT)
Manuel → bookings (UNIQUEMENT)
Calendrier → Affiche les 2 sources séparément
```

**Modifications :**
1. S'assurer que l'Edge Function n'insère QUE dans `airbnb_reservations`
2. Modifier `calendarData.ts` pour ne PAS enrichir avec `bookings`
3. Le calendrier affiche les 2 sources indépendamment

**Avantages :**
- ✅ Séparation claire des responsabilités
- ✅ Pas de confusion possible
- ✅ Architecture propre

**Inconvénients :**
- ⚠️ Perte de l'enrichissement (noms validés)
- ⚠️ Nécessite de nettoyer les données existantes

---

## 🎯 Recommandation Finale

### Approche Hybride (Meilleure Solution)

**Étape 1 : Court Terme (Immédiat)**
- Implémenter **Solution 1** : Filtrer les codes Airbnb dans `calendarData.ts`
- Nettoyer les `bookings` existants avec codes Airbnb via la fonction `handleDeleteUrl`

**Étape 2 : Moyen Terme (1-2 semaines)**
- Implémenter **Solution 2** : Ajouter le flag `source` dans `bookings`
- Migrer les données existantes
- Adapter le code pour utiliser ce flag

**Étape 3 : Long Terme (Optionnel)**
- Implémenter la table `property_ics_sources` pour gérer plusieurs liens ICS
- Ajouter `ics_source_id` dans `airbnb_reservations`

---

## 🔧 Code à Modifier Immédiatement

### 1. calendarData.ts

```typescript
// Ligne 49-55
const { data: bookingsData, error: bookingsError } = await supabase
  .from('bookings')
  .select('id, booking_reference, guest_name, check_in_date, check_out_date, status')
  .eq('property_id', propertyId)
  .gte('check_in_date', start)
  .lte('check_out_date', end)
  // ✅ FILTRER les codes Airbnb
  .or('booking_reference.is.null,booking_reference.eq.INDEPENDENT_BOOKING,booking_reference.not.like.HM%')
  .order('check_in_date', { ascending: true });
```

### 2. Vérifier l'Edge Function

S'assurer qu'elle n'insère QUE dans `airbnb_reservations` :

```typescript
// sync-airbnb-unified/index.ts
// ✅ VÉRIFIER: Pas d'insertion dans bookings
const { data: upsertedReservations, error: upsertError } = await supabaseClient
  .from('airbnb_reservations')  // ✅ Seulement ici
  .upsert(reservationsToUpsert, {
    onConflict: 'property_id,airbnb_booking_id',
    ignoreDuplicates: false
  })
  .select();
```

---

## 📊 Diagnostic Actuel

Pour vérifier l'état actuel, exécutez le script SQL `VERIFICATION_ETAT_RESERVATIONS.sql` que j'ai créé.

**Questions clés :**
1. Combien de réservations dans `airbnb_reservations` ?
2. Combien de réservations dans `bookings` avec codes Airbnb ?
3. D'où vient `HMCKR2KEST` ? (airbnb_reservations ou bookings ?)

---

## ✅ Conclusion

**OUI, le problème peut être résolu !**

**Solution immédiate :**
1. Modifier `calendarData.ts` pour filtrer les codes Airbnb
2. Utiliser `handleDeleteUrl` pour nettoyer les bookings existants
3. Le calendrier affichera uniquement les réservations de `airbnb_reservations`

**Voulez-vous que j'implémente la Solution 1 maintenant ?** 🚀
