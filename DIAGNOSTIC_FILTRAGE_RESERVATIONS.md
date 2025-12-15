# 🔍 Diagnostic du Filtrage des Réservations

## 🐛 Problème Identifié

**Symptôme :**
- L'utilisateur dit qu'il n'y a pas autant de réservations manuelles (26 semble trop élevé)
- Le filtre par `propertyId` pourrait ne pas fonctionner correctement
- Il y a peut-être un double filtrage ou un problème de cache

---

## 🔎 Analyse du Code

### 1. Appel de `useBookings` dans PropertyDetail

**Fichier : `src/components/PropertyDetail.tsx`**

```typescript
// Ligne ~27-30 (à vérifier)
const { bookings, refreshBookings, deleteBooking } = useBookings({ 
  propertyId: property?.id 
});
```

**✅ Le hook est appelé avec `propertyId`** - Le filtre devrait être appliqué côté base de données.

---

### 2. Filtrage Supplémentaire Côté Client (Ligne 222)

```typescript
// Filter bookings by this property
const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);
```

**⚠️ PROBLÈME POTENTIEL :**
- Si `useBookings` filtre déjà par `propertyId` côté base de données, ce filtre supplémentaire ne devrait rien changer
- **MAIS** si le filtre côté base de données ne fonctionne pas, ce filtre côté client est nécessaire
- **OU** si le cache contient des données de toutes les propriétés, ce filtre est nécessaire

---

### 3. Logique de Filtrage dans `useBookings.ts`

**Fichier : `src/hooks/useBookings.ts` (lignes 305-309)**

```typescript
// ✅ PHASE 1 : Ajouter le filtre par propriété si fourni
if (propertyId) {
  query = query.eq('property_id', propertyId);
  debug('Filtering bookings by property_id', { propertyId });
}
```

**✅ Le filtre est appliqué côté base de données** - Normalement, cela devrait fonctionner.

---

### 4. Problèmes Potentiels

#### Problème 1 : Cache Contient Toutes les Réservations

**Scénario :**
1. L'utilisateur charge d'abord toutes ses réservations (sans `propertyId`)
2. Le cache stocke toutes les réservations avec la clé `bookings-all-${user.id}`
3. L'utilisateur navigue vers une propriété spécifique
4. Le hook vérifie le cache avec la clé `bookings-${propertyId}`
5. Le cache n'est pas trouvé, donc il charge depuis la base de données
6. **MAIS** si le cache mémoire contient encore les anciennes données, elles pourraient être utilisées

**Vérification :**
```typescript
// Dans useBookings.ts, ligne 256
const memoryCached = bookingsCache.get(cacheKey);
```

**⚠️ Si `cacheKey` ne correspond pas exactement, le cache pourrait retourner des données incorrectes.**

---

#### Problème 2 : Réservations avec `propertyId` Null ou Incorrect

**Scénario :**
- Des réservations pourraient avoir `property_id = null`
- Des réservations pourraient avoir un `property_id` incorrect
- Le filtre côté client pourrait ne pas les exclure correctement

**Vérification :**
```typescript
// Dans PropertyDetail.tsx, ligne 222
const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);
```

**⚠️ Si `booking.propertyId` est `null` ou `undefined`, cette comparaison pourrait ne pas fonctionner comme prévu.**

---

#### Problème 3 : Vue Matérialisée Non Filtrée

**Scénario :**
- Si la vue matérialisée `mv_bookings_enriched` n'existe pas encore
- Le fallback utilise la table `bookings` avec le filtre
- **MAIS** si le filtre n'est pas appliqué correctement dans le fallback, toutes les réservations sont chargées

**Vérification :**
```typescript
// Dans useBookings.ts, ligne 343
if (propertyId) {
  fallbackQuery = fallbackQuery.eq('property_id', propertyId);
}
```

**✅ Le filtre est appliqué dans le fallback aussi.**

---

#### Problème 4 : Réservations de Toutes les Propriétés dans le Cache

**Scénario :**
1. L'utilisateur charge les réservations pour la propriété A
2. Le cache stocke avec la clé `bookings-${propertyA.id}`
3. L'utilisateur charge les réservations pour la propriété B
4. Le cache vérifie avec la clé `bookings-${propertyB.id}`
5. **MAIS** si le cache mémoire contient encore les données de la propriété A, elles pourraient être utilisées par erreur

**Vérification :**
```typescript
// Dans useBookings.ts, ligne 243-245
const cacheKey = propertyId 
  ? `bookings-${propertyId}${dateRangeKey}` 
  : `bookings-all-${user?.id || 'anonymous'}${dateRangeKey}`;
```

**✅ Les clés de cache sont différentes pour chaque propriété.**

---

## 🔧 Solutions Proposées

### Solution 1 : Ajouter des Logs de Diagnostic

**Modifier `PropertyDetail.tsx` :**

```typescript
// Filter bookings by this property
const propertyBookings = bookings.filter(booking => booking.propertyId === property.id);

// ✅ DIAGNOSTIC : Log pour vérifier le filtrage
useEffect(() => {
  console.log('🔍 [PROPERTY DETAIL] Diagnostic du filtrage:', {
    propertyId: property?.id,
    totalBookings: bookings.length,
    filteredBookings: propertyBookings.length,
    bookingsWithPropertyId: bookings.filter(b => b.propertyId === property?.id).length,
    bookingsWithoutPropertyId: bookings.filter(b => !b.propertyId).length,
    bookingsWithOtherPropertyId: bookings.filter(b => b.propertyId && b.propertyId !== property?.id).length,
    bookingIds: bookings.map(b => ({
      id: b.id.substring(0, 8),
      propertyId: b.propertyId,
      matches: b.propertyId === property?.id
    }))
  });
}, [bookings, property?.id, propertyBookings.length]);
```

---

### Solution 2 : Vérifier le Cache

**Modifier `useBookings.ts` :**

```typescript
// ✅ DIAGNOSTIC : Log du cache
const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKey);
if (cached) {
  console.log('🔍 [USE BOOKINGS] Cache utilisé:', {
    cacheKey,
    cachedCount: cached.length,
    propertyId,
    cachedPropertyIds: [...new Set(cached.map(b => b.propertyId))],
    expectedPropertyId: propertyId
  });
  debug('Using multi-level cached bookings', { cacheKey, count: cached.length });
  setBookings(cached);
  setIsLoading(false);
  return;
}
```

---

### Solution 3 : Forcer le Rechargement et Invalider le Cache

**Ajouter un bouton de diagnostic dans PropertyDetail :**

```typescript
const handleForceRefresh = async () => {
  // Invalider tous les caches
  await multiLevelCache.invalidatePattern('bookings-');
  bookingsCache.clear();
  
  // Forcer le rechargement
  await refreshBookings();
  
  console.log('🔄 [PROPERTY DETAIL] Cache invalidé et rechargement forcé');
};
```

---

### Solution 4 : Vérifier les Données dans la Base de Données

**Requête SQL de diagnostic :**

```sql
-- Vérifier toutes les réservations pour un utilisateur
SELECT 
  id,
  property_id,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM bookings
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;

-- Vérifier les réservations pour une propriété spécifique
SELECT 
  id,
  property_id,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM bookings
WHERE property_id = 'PROPERTY_ID_HERE'
ORDER BY created_at DESC;

-- Compter les réservations par propriété
SELECT 
  property_id,
  COUNT(*) as count
FROM bookings
WHERE user_id = 'USER_ID_HERE'
GROUP BY property_id;
```

---

## 🎯 Plan d'Action

1. **✅ Ajouter des logs de diagnostic** pour comprendre ce qui se passe
2. **✅ Vérifier le cache** pour voir s'il contient des données incorrectes
3. **✅ Vérifier la base de données** pour voir combien de réservations il y a réellement
4. **✅ Corriger le problème** une fois identifié

---

## 📝 Fichiers à Modifier

1. `src/components/PropertyDetail.tsx`
   - Ajouter des logs de diagnostic
   - Vérifier le filtrage

2. `src/hooks/useBookings.ts`
   - Ajouter des logs de diagnostic pour le cache
   - Vérifier que le filtre est bien appliqué

3. Optionnel : Ajouter un bouton de diagnostic pour forcer l'invalidation du cache

