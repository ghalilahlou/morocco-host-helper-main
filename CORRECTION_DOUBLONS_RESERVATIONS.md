# ✅ Correction des Doublons de Réservations

## 🐛 Problème Identifié

**Symptôme :**
- Après synchronisation Airbnb : **34 réservations** (au lieu de 17)
- Après rechargement : **17 réservations** (retour à la normale)
- Les logs montrent : `📋 [DASHBOARD DIAGNOSTIC] Réservations: {total: 34, filtered: 34, ...}`

**Cause :**
- Les websockets ajoutent des réservations en double via les mises à jour optimistes
- Le cache n'est pas invalidé correctement après la synchronisation
- Les réservations sont ajoutées à l'état sans vérifier si elles existent déjà

---

## 🔧 Corrections Appliquées

### 1. Protection contre les Doublons dans les Websockets

**Fichier : `src/hooks/useBookings.ts`**

**Avant :**
```typescript
if (!lastBookingIdsRef.current.has(newBooking.id)) {
  setBookings(prev => {
    const exists = prev.some(b => b.id === newBooking.id);
    if (exists) return prev;
    // Ajouter...
  });
}
```

**Problème :** La vérification `exists` se fait dans `setBookings`, mais `lastBookingIdsRef` peut être obsolète.

**Après :**
```typescript
setBookings(prev => {
  const existsInState = prev.some(b => b.id === newBooking.id);
  
  if (existsInState) {
    debug('⚠️ [REAL-TIME] Réservation déjà présente dans l\'état, ignorée');
    return prev; // Ne pas modifier l'état
  }
  
  // Vérifier aussi dans lastBookingIdsRef
  if (!lastBookingIdsRef.current.has(newBooking.id)) {
    // Ajouter...
  }
  
  return prev;
});
```

**Bénéfices :**
- ✅ Vérification dans l'état actuel (plus fiable)
- ✅ Logs de diagnostic pour identifier les doublons
- ✅ Protection contre les ajouts multiples

---

### 2. Invalidation du Cache après Synchronisation

**Fichier : `src/components/CalendarView.tsx`**

**Avant :**
```typescript
if (onRefreshBookings) {
  await onRefreshBookings();
  await new Promise(resolve => setTimeout(resolve, 500));
}
airbnbCache.clear();
await loadAirbnbReservations();
```

**Problème :** Le cache multi-niveaux n'est pas invalidé.

**Après :**
```typescript
// Invalider TOUS les caches avant de rafraîchir
airbnbCache.clear();
if (propertyId) {
  const { multiLevelCache } = await import('@/services/multiLevelCache');
  await multiLevelCache.invalidatePattern(`bookings-${propertyId}`);
}

if (onRefreshBookings) {
  await onRefreshBookings();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Augmenté à 1s
}

await loadAirbnbReservations();
```

**Bénéfices :**
- ✅ Cache multi-niveaux invalidé
- ✅ Plus de temps pour les websockets se mettre à jour
- ✅ Données fraîches après synchronisation

---

### 3. Protection contre les Doublons dans loadBookings

**Fichier : `src/hooks/useBookings.ts`**

**Ajout :**
```typescript
setBookings(prev => {
  // ✅ DIAGNOSTIC : Log pour détecter les doublons
  const duplicateIds = enrichedBookings
    .filter(b => existingMap.has(b.id))
    .map(b => b.id.substring(0, 8));
  
  if (duplicateIds.length > 0) {
    debug('⚠️ [LOAD BOOKINGS] Doublons détectés dans les données chargées', {
      duplicateIds,
      existingCount: prev.length,
      newCount: enrichedBookings.length
    });
  }
  
  // Fusionner sans créer de doublons
  const merged = enrichedBookings.map(newBooking => {
    // ...
  });
  
  // ✅ PROTECTION : Ne pas ajouter les réservations qui existent déjà
  // (déjà géré dans merged)
  
  return merged;
});
```

**Bénéfices :**
- ✅ Détection des doublons dans les données chargées
- ✅ Logs de diagnostic
- ✅ Protection contre les doublons lors du merge

---

## 📊 Résultat Attendu

**Avant correction :**
- Après sync : **34 réservations** (doublons)
- Après rechargement : **17 réservations** (normal)

**Après correction :**
- Après sync : **17 réservations** (pas de doublons)
- Après rechargement : **17 réservations** (normal)

---

## 🔍 Logs de Diagnostic Ajoutés

1. **Dans les websockets :**
   - `⚠️ [REAL-TIME] Réservation déjà présente dans l'état, ignorée`
   - `Real-time: Nouvelle réservation détectée, mise à jour optimiste`

2. **Dans loadBookings :**
   - `⚠️ [LOAD BOOKINGS] Doublons détectés dans les données chargées`
   - `Bookings merged` avec compteurs

3. **Dans CalendarView :**
   - `🔄 Rafraîchissement des bookings après sync...`

---

## 📝 Points d'Attention

1. **Timing des websockets :**
   - Les websockets peuvent déclencher plusieurs événements rapidement
   - Le debounce aide, mais la vérification dans l'état est cruciale

2. **Cache multi-niveaux :**
   - Doit être invalidé après chaque synchronisation
   - Sinon, les anciennes données peuvent être réutilisées

3. **Mises à jour optimistes :**
   - Utiles pour l'UX, mais peuvent créer des doublons
   - La vérification dans l'état actuel est essentielle

---

## ✅ Vérification

Pour vérifier que les corrections fonctionnent :

1. **Synchroniser avec Airbnb**
2. **Vérifier les logs dans la console :**
   - `⚠️ [REAL-TIME]` si des doublons sont détectés
   - `⚠️ [LOAD BOOKINGS]` si des doublons sont dans les données chargées
3. **Vérifier le comptage :**
   - Devrait rester à **17** (ou le nombre réel) après la sync

