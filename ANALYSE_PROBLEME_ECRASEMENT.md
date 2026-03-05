# Analyse du Problème d'Écrasement des Réservations

## Problème Identifié

D'après l'analyse des logs, le problème d'écrasement provient de **race conditions multiples** dans le hook `useBookings` :

### 1. Race Condition dans les useEffect (Lignes 121-152)

**Problème** : Plusieurs `useEffect` créent des `setTimeout` presque simultanément :
- Ligne 128-131 : `useEffect` sur `propertyId` change
- Ligne 145-148 : `useEffect` sur `user?.id` change
- Ligne 170-175 : `useEffect` pour real-time subscriptions

**Conséquence** : Même si le premier `loadBookings()` marque `loadingRef.current = true`, les autres `setTimeout` sont déjà créés et vont s'exécuter après, créant des appels concurrents.

### 2. Vérification du Verrou Trop Tardive (Ligne 404)

**Problème** : Le verrou `loadingRef.current` est vérifié **DANS** `loadBookings`, mais les `setTimeout` sont créés **AVANT** dans les `useEffect`.

**Séquence problématique** :
```
T0: useEffect 1 crée setTimeout(50ms) → loadBookings()
T1: useEffect 2 crée setTimeout(50ms) → loadBookings()
T2: useEffect 3 crée setTimeout(50ms) → loadBookings()
T50: setTimeout 1 s'exécute → vérifie loadingRef (false) → marque true → charge
T51: setTimeout 2 s'exécute → vérifie loadingRef (true) → ignoré ✅
T52: setTimeout 3 s'exécute → vérifie loadingRef (true) → ignoré ✅
```

**MAIS** si les setTimeout sont créés dans la même frame React :
```
T0: useEffect 1 crée setTimeout(50ms)
T0: useEffect 2 crée setTimeout(50ms)  
T0: useEffect 3 crée setTimeout(50ms)
T50: Tous s'exécutent → tous voient loadingRef = false → tous passent la vérification ❌
```

### 3. Écrasement lors de l'Utilisation du Cache (Ligne 600-630)

**Problème** : Quand le cache est utilisé, `setBookings` est appelé directement sans vérifier si un autre chargement est en cours.

**Scénario problématique** :
1. `loadBookings()` A commence → charge depuis DB → enrichit → met à jour state
2. `loadBookings()` B commence → trouve cache → appelle `setBookings` immédiatement
3. `setBookings` de B écrase les données de A qui sont en cours d'enrichissement

### 4. Fusion Non Atomique (Ligne 2117-2185)

**Problème** : La fonction de fusion utilise `setBookings(prev => ...)`, mais si plusieurs appels arrivent en même temps, ils peuvent tous lire le même `prev` avant que le premier ne termine.

**Exemple** :
```
T0: loadBookings A lit prev = [booking1]
T1: loadBookings B lit prev = [booking1] (même valeur)
T2: loadBookings A calcule merged = [booking1, booking2]
T3: loadBookings B calcule merged = [booking1, booking3]
T4: A applique setBookings([booking1, booking2])
T5: B applique setBookings([booking1, booking3]) → écrase A ❌
```

## Solution Proposée

### 1. Vérifier le Verrou AVANT le setTimeout

```typescript
useEffect(() => {
  if (propertyId !== undefined || options?.propertyId === undefined) {
    // ✅ Vérifier le verrou AVANT de créer le setTimeout
    if (loadingRef.current) {
      console.warn('⚠️ [USE BOOKINGS] loadBookings déjà en cours, setTimeout ignoré');
      return;
    }
    
    if (loadBookingsDebounceRef.current) {
      clearTimeout(loadBookingsDebounceRef.current);
    }
    loadBookingsDebounceRef.current = setTimeout(() => {
      loadBookingsDebounceRef.current = null;
      // ✅ Vérifier à nouveau juste avant l'appel
      if (!loadingRef.current) {
        loadBookings();
      }
    }, 50);
  }
}, [propertyId]);
```

### 2. Verrou avec Timestamp/ID Unique

```typescript
const loadingRef = useRef<{ loading: boolean; id: string; timestamp: number } | null>(null);

const loadBookings = useCallback(async () => {
  const loadId = `${Date.now()}-${Math.random()}`;
  
  // Vérifier et acquérir le verrou atomiquement
  if (loadingRef.current?.loading) {
    console.warn('⚠️ [USE BOOKINGS] loadBookings déjà en cours, ignoré');
    return;
  }
  
  loadingRef.current = { loading: true, id: loadId, timestamp: Date.now() };
  
  try {
    // ... chargement ...
  } finally {
    // Ne libérer que si c'est notre verrou
    if (loadingRef.current?.id === loadId) {
      loadingRef.current = null;
    }
  }
}, []);
```

### 3. Éviter le Cache si Chargement en Cours

```typescript
const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKey);
if (cached && !loadingRef.current) { // ✅ Ne pas utiliser le cache si un chargement est en cours
  // Utiliser le cache
} else if (cached && loadingRef.current) {
  // Attendre que le chargement se termine ou ignorer le cache
  console.warn('⚠️ [USE BOOKINGS] Cache ignoré - chargement en cours');
}
```

### 4. Fusion Atomique avec Version

```typescript
const stateVersionRef = useRef(0);

setBookings(prev => {
  const currentVersion = ++stateVersionRef.current;
  // ... calcul de merged ...
  
  // ✅ Vérifier que la version n'a pas changé pendant le calcul
  return (currentVersion === stateVersionRef.current) ? finalMerged : prev;
});
```

## Logs à Surveiller

Les logs montrent clairement le problème :
- `🔴🔴🔴 [DIAGNOSTIC] loadBookings APPELÉ` apparaît plusieurs fois avec le même `propertyId` et `loadingRefValue: true`
- `⚠️ [USE BOOKINGS] loadBookings déjà en cours, ignoré` apparaît mais trop tard
- `🔴🔴🔴 [DIAGNOSTIC] CACHE UTILISÉ` peut apparaître pendant qu'un autre chargement est en cours
