# Solution - Désactivation Temporaire de la Vue Matérialisée

## 🔍 Problème Identifié

La vue matérialisée `mv_bookings_enriched` retourne constamment une erreur **500 (Internal Server Error)**, empêchant le chargement des réservations.

```
GET https://csopyblkfyofwkeqqegd.supabase.co/rest/v1/mv_bookings_enriched?... 500 (Internal Server Error)
```

**Cause** : La vue matérialisée a probablement un problème (non rafraîchie, problème avec `v_guest_submissions`, timeout, etc.).

## ✅ Solution Appliquée

### 1. **Désactivation Temporaire de la Vue Matérialisée**

**Fichier : `src/hooks/useBookings.ts`**

Ajout d'un flag `USE_MATERIALIZED_VIEW = false` pour désactiver temporairement la vue matérialisée :

```typescript
// ✅ CORRECTION CRITIQUE : La vue matérialisée retourne constamment 500
// Désactiver temporairement la vue matérialisée et utiliser directement la table bookings
const USE_MATERIALIZED_VIEW = false; // ✅ DÉSACTIVÉ : La vue matérialisée retourne 500

let query;
if (USE_MATERIALIZED_VIEW) {
  // ✅ Vue matérialisée (désactivée pour l'instant)
  query = supabase.from('mv_bookings_enriched').select(...);
} else {
  // ✅ FALLBACK DIRECT : Utiliser directement la table bookings
  query = supabase
    .from('bookings')
    .select(`*, guests (*), property:properties (*)`)
    .eq('user_id', user.id);
}
```

### 2. **Adaptation de la Transformation des Données**

**Problème** : Le code transformait les données comme si elles venaient de la vue matérialisée, mais maintenant elles viennent directement de la table `bookings`.

**Solution** : Adaptation du code pour gérer les deux sources :

```typescript
// ✅ ADAPTATION : Gérer les deux sources de données
let propertyData, guestsData, submissionsData;

if (USE_MATERIALIZED_VIEW) {
  // ✅ Données depuis la vue matérialisée
  propertyData = booking.property_data || {};
  guestsData = Array.isArray(booking.guests_data) ? booking.guests_data : [];
  submissionsData = Array.isArray(booking.guest_submissions_data) ? booking.guest_submissions_data : [];
} else {
  // ✅ Données depuis la table bookings (fallback direct)
  const property = Array.isArray(booking.property) ? booking.property[0] : booking.property;
  propertyData = property || {};
  guestsData = Array.isArray(booking.guests) ? booking.guests : [];
  submissionsData = []; // Pas de submissions_data dans la table bookings directement
}
```

### 3. **Enrichissement avec `guest_submissions`**

**Problème** : Quand on utilise directement la table `bookings`, on n'a pas les données de `guest_submissions`.

**Solution** : Enrichissement automatique avec `enrichBookingsWithGuestSubmissions` :

```typescript
// ✅ ENRICHISSEMENT : Si on utilise directement la table bookings, enrichir avec guest_submissions
let finalEnrichedBookings = enrichedBookings;
if (!USE_MATERIALIZED_VIEW) {
  // ✅ Enrichir avec guest_submissions pour obtenir les données manquantes
  finalEnrichedBookings = await enrichBookingsWithGuestSubmissions(enrichedBookings);
}
```

### 4. **Préservation Complète de `documents_generated`**

**Correction** : Utilisation de `Record<string, any>` au lieu de `{ policeForm: boolean; contract: boolean; }` pour préserver toutes les propriétés, y compris `identity`, `contractUrl`, `policeUrl`, etc.

## 📋 Résultat Attendu

1. ✅ **Plus d'erreur 500** : La vue matérialisée n'est plus utilisée
2. ✅ **Chargement direct depuis `bookings`** : Toutes les réservations sont chargées, y compris les "completed"
3. ✅ **Enrichissement automatique** : Les données sont enrichies avec `guest_submissions` pour obtenir les informations manquantes
4. ✅ **Documents préservés** : Toutes les propriétés de `documents_generated` sont préservées (y compris `identity`)

## 🔧 Réactivation de la Vue Matérialisée

Pour réactiver la vue matérialisée une fois qu'elle sera corrigée :

1. **Rafraîchir la vue matérialisée** :
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
   ```

2. **Vérifier qu'elle fonctionne** :
   ```sql
   SELECT COUNT(*) FROM mv_bookings_enriched;
   ```

3. **Réactiver dans le code** :
   ```typescript
   const USE_MATERIALIZED_VIEW = true; // ✅ RÉACTIVÉ
   ```

## ✅ Résultat

Les réservations "completed" avec tous les documents devraient maintenant :
- ✅ Être chargées depuis la table `bookings` directement
- ✅ Avoir leurs `documents_generated` préservés complètement (y compris `identity`)
- ✅ Être enrichies avec `guest_submissions` pour obtenir les données manquantes
- ✅ Passer le filtre `hasAllRequiredDocumentsForCalendar`
- ✅ Apparaître dans le calendrier

