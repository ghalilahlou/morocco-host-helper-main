# 🔍 Analyse Profonde des Logs - Problème d'Écrasement

## 📊 Observations Clés des Logs

### 1. **État des Réservations**
```
📋 [DASHBOARD] Réservations filtrées | Context: {"total":1,"filtered":1,...}
🔴🔴🔴 [DIAGNOSTIC] setBookings FINAL (fusion) {
  prevCount: 0 ou 1,
  uniqueEnrichedCount: 1,
  finalMergedCount: 1
}
```

**Conclusion** : Il n'y a qu'**UNE SEULE réservation** dans l'état, alors que l'utilisateur indique qu'il devrait y en avoir plusieurs.

---

### 2. **Problème Identifié : La Requête SQL Ne Retourne Qu'Une Réservation**

#### Analyse de la Requête SQL (ligne 765-775)
```typescript
query = supabase
  .from('bookings')
  .select(`*, guests (*), property:properties (*)`)
  .eq('user_id', user.id);

if (propertyId) {
  query = query.eq('property_id', propertyId);
}
```

**Problème Potentiel** : La requête ne contient **AUCUN ORDER BY** ni **LIMIT**, mais elle ne retourne qu'une seule réservation.

#### Causes Possibles :

1. **RLS (Row Level Security)**
   - Les politiques RLS pourraient filtrer les résultats
   - Seules les réservations "completed" sont visibles ?

2. **Statut des Réservations**
   - Les anciennes réservations ont peut-être un statut différent ("pending", "confirmed")
   - Seules les réservations "completed" sont retournées ?

3. **Problème de Cache**
   - Le cache pourrait retourner une ancienne valeur avec une seule réservation
   - Le cache n'est pas invalidé correctement

4. **Problème de Filtrage**
   - Un filtre invisible élimine les autres réservations
   - Les réservations sont filtrées par date ou statut

---

### 3. **Problème de Race Condition**

#### Logs Montrant le Problème :
```
🔴🔴🔴 [DIAGNOSTIC] loadBookings APPELÉ {loadingRefValue: true}
⚠️ [USE BOOKINGS] loadBookings déjà en cours, ignoré
```

**Problème** : Plusieurs appels arrivent presque simultanément :
- Le premier appel marque `loadingRef.current = true`
- Mais le log montre `loadingRefValue: true` **AVANT** le log
- Cela signifie que plusieurs appels passent la vérification avant que le premier ne marque le verrou

**Solution** : Le verrou doit être atomique (vérifier ET marquer en une seule opération).

---

### 4. **Problème de Fusion**

#### Logique de Fusion (lignes 2117-2185)
```typescript
setBookings(prev => {
  const prevForCurrentProperty = propertyId 
    ? prev.filter(b => b.propertyId === propertyId)
    : prev;
  
  const existingMap = new Map(prevForCurrentProperty.map(b => [b.id, b]));
  const newIds = new Set(uniqueEnrichedBookings.map(b => b.id));
  
  // Fusionner les nouvelles avec les existantes
  const merged = uniqueEnrichedBookings.map(...);
  
  // Ajouter les existantes qui ne sont PAS dans les nouvelles
  const existingNotInNew = prevForCurrentProperty.filter(b => !newIds.has(b.id));
  const combinedMerged = [...merged, ...existingNotInNew];
  
  return finalMerged;
});
```

**Analyse** :
- ✅ La logique de fusion semble **CORRECTE**
- ✅ Elle préserve les réservations existantes qui ne sont pas dans les nouvelles données
- ❌ **MAIS** : Si `prev` ne contient qu'une seule réservation, la fusion ne peut pas créer plus de réservations

**Conclusion** : Le problème n'est **PAS** dans la fusion, mais dans le fait que la requête SQL ne retourne qu'une seule réservation.

---

## 🎯 Cause Racine Probable

### **La Requête SQL Ne Retourne Qu'Une Réservation**

#### Hypothèses :

1. **RLS Filtre les Réservations**
   ```sql
   -- Les politiques RLS pourraient avoir un filtre par statut
   -- Exemple : Seules les réservations "completed" sont visibles
   ```

2. **Problème de Statut**
   - Les anciennes réservations ont le statut "pending" ou "confirmed"
   - Seules les réservations "completed" sont retournées
   - La nouvelle réservation "completed" écrase les autres

3. **Problème de Cache**
   - Le cache contient une ancienne valeur avec une seule réservation
   - Le cache n'est pas invalidé lors de la création d'une nouvelle réservation

4. **Problème de Filtrage par Date**
   - Les réservations passées sont filtrées
   - Seules les réservations futures sont retournées

---

## 🔧 Solutions Proposées

### Solution 1 : Vérifier les Politiques RLS

```sql
-- Vérifier les politiques RLS sur la table bookings
SELECT * FROM pg_policies WHERE tablename = 'bookings';
```

### Solution 2 : Ajouter un Log de la Requête SQL

```typescript
// Dans loadBookings, avant l'exécution de la requête
console.log('🔍 [SQL] Requête complète:', {
  table: 'bookings',
  filters: {
    user_id: user.id,
    property_id: propertyId
  },
  expectedCount: 'multiple'
});

// Après l'exécution
console.log('🔍 [SQL] Résultat:', {
  count: data?.length || 0,
  bookingIds: data?.map(b => ({ id: b.id, status: b.status })) || []
});
```

### Solution 3 : Vérifier Tous les Statuts

```typescript
// Ne pas filtrer par statut dans la requête
// Récupérer TOUTES les réservations, peu importe le statut
query = supabase
  .from('bookings')
  .select(`*, guests (*), property:properties (*)`)
  .eq('user_id', user.id);

if (propertyId) {
  query = query.eq('property_id', propertyId);
}

// Ne PAS ajouter de filtre par statut
// .eq('status', 'completed') // ❌ NE PAS FAIRE CELA
```

### Solution 4 : Invalider le Cache Correctement

```typescript
// Lors de la création d'une nouvelle réservation
const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id}`;
await multiLevelCache.invalidatePattern(cacheKey);
bookingsCache.delete(cacheKey);
```

---

## 📝 Actions Immédiates

1. **Vérifier la Base de Données**
   ```sql
   SELECT id, status, property_id, guest_name, created_at 
   FROM bookings 
   WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
   ORDER BY created_at DESC;
   ```

2. **Vérifier les Politiques RLS**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'bookings';
   ```

3. **Ajouter des Logs Détaillés**
   - Log de la requête SQL complète
   - Log du nombre de réservations retournées
   - Log des statuts des réservations

4. **Vérifier le Cache**
   - Vérifier si le cache contient une ancienne valeur
   - Invalider le cache lors de la création d'une nouvelle réservation

---

## 🎯 Conclusion

Le problème d'écrasement n'est **PAS** causé par la logique de fusion (qui est correcte), mais par le fait que **la requête SQL ne retourne qu'une seule réservation**.

**Cause Probable** :
- Les politiques RLS filtrent les réservations
- Seules les réservations "completed" sont visibles
- La nouvelle réservation "completed" est la seule retournée

**Solution** :
- Vérifier et corriger les politiques RLS
- S'assurer que TOUTES les réservations sont retournées, peu importe le statut
- Invalider le cache correctement
