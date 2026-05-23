# 🔍 ANALYSE - INCOHÉRENCE CARTE vs CALENDRIER

**Date** : 30 janvier 2026  
**Problème** : La carte affiche "MOUHCINE TEMSAMANI" (✅ correct) mais le calendrier affiche "Réservation" (❌ incorrect)

---

## 🎯 PROBLÈME IDENTIFIÉ

### Symptômes observés (screenshots)
1. **Carte** : Affiche "MOUHCINE TEMSAMANI" avec statut "Terminé" ✅
2. **Calendrier** : Affiche "Réservation" en noir du 15 au 17 ❌

### Cause racine

**Le calendrier utilise un CACHE qui n'est PAS invalidé après la soumission du formulaire**

#### Flux actuel (PROBLÉMATIQUE)
```
1. Guest remplit le formulaire → submitDocumentsUnified()
2. Edge Function met à jour la DB → guest_name = "Mouhcine Temsamani"
3. Carte recharge les données → Affiche "MOUHCINE TEMSAMANI" ✅
4. Calendrier garde le cache → Affiche "Réservation" (ancienne valeur) ❌
```

#### Détails techniques

**Fichier** : `src/hooks/useBookings.ts`
- **Ligne 39** : `const bookingsCache = new Map<string, CacheEntry>();`
- **Ligne 41** : `const BOOKINGS_CACHE_DURATION = 60000; // 60 secondes`

**Problème** :
- Le cache a une durée de **60 secondes**
- Après la soumission du formulaire, le `guest_name` est mis à jour en DB
- Mais le calendrier utilise encore le cache pendant 60 secondes
- Pendant ce temps, il affiche l'ancienne valeur ("Réservation" au lieu de "Mouhcine")

**Fichier** : `src/utils/bookingDisplay.ts`
- **Ligne 268** : `return 'Réservation';` ← Fallback quand pas de nom valide

**Pourquoi "Réservation" ?**
- Quand la réservation est créée via le lien ICS, elle n'a pas encore de `guest_name`
- `getUnifiedBookingDisplayText()` retourne "Réservation" comme fallback
- Cette valeur est mise en cache
- Après la soumission, le `guest_name` est mis à jour en DB
- Mais le calendrier affiche toujours la valeur en cache ("Réservation")

---

## 🔍 VÉRIFICATION DU CODE

### 1. La carte charge-t-elle les bonnes données ?

**Fichier** : `src/components/Dashboard.tsx`

La carte utilise probablement un composant qui recharge les données après la soumission. Cherchons comment :

```typescript
// La carte doit avoir un mécanisme de rafraîchissement
// Probablement via useBookings() avec refreshBookings()
```

### 2. Le calendrier charge-t-il les bonnes données ?

**Fichier** : `src/components/CalendarView.tsx`
- **Ligne 59** : `bookings: EnrichedBooking[]` ← Reçoit les bookings en props
- **Ligne 62** : `onRefreshBookings?: () => void` ← Callback pour rafraîchir

**Le calendrier reçoit les bookings en props depuis `PropertyDashboard`**

**Fichier** : `src/components/PropertyDashboard.tsx`
- **Ligne 26** : `const { bookings, refreshBookings } = useBookings({ propertyId })`
- **Ligne 280** : `<CalendarView bookings={filteredBookings} onRefreshBookings={refreshBookings} />`

**Le problème** : `filteredBookings` vient de `useBookings()` qui utilise le cache !

---

## ✅ SOLUTION

### Option 1 : Invalider le cache après soumission (RECOMMANDÉ)

**Fichier à modifier** : `src/services/documentServiceUnified.ts`

**Changement** :
```typescript
// ✅ APRÈS la soumission réussie
export async function submitDocumentsUnified(request: DocumentGenerationRequest) {
  try {
    // ... soumission existante ...
    
    const result = {
      bookingId: response.data.bookingId,
      // ...
    };
    
    // ✅ NOUVEAU : Invalider le cache des bookings pour forcer le rechargement
    // Émettre un événement pour que useBookings() recharge les données
    window.dispatchEvent(new CustomEvent('booking-updated', {
      detail: { bookingId: result.bookingId }
    }));
    
    return result;
  } catch (error) {
    // ...
  }
}
```

**Fichier à modifier** : `src/hooks/useBookings.ts`

**Changement** :
```typescript
// ✅ AJOUTER un listener pour l'événement booking-updated
useEffect(() =\u003e {
  const handler = (event: CustomEvent) =\u003e {
    console.log('📡 [USE BOOKINGS] Booking updated event received', event.detail);
    
    // Invalider le cache
    const cacheKey = propertyId 
      ? `bookings-${propertyId}` 
      : `bookings-all-${user?.id || 'anonymous'}`;
    
    multiLevelCache.invalidate(cacheKey).catch(() =\u003e {});
    bookingsCache.delete(cacheKey);
    
    // Recharger les bookings
    loadBookings();
  };
  
  window.addEventListener('booking-updated', handler as EventListener);
  return () =\u003e window.removeEventListener('booking-updated', handler as EventListener);
}, [propertyId, user?.id]);
```

---

### Option 2 : Réduire la durée du cache (TEMPORAIRE)

**Fichier** : `src/hooks/useBookings.ts`

**Changement** :
```typescript
// ❌ AVANT
const BOOKINGS_CACHE_DURATION = 60000; // 60 secondes

// ✅ APRÈS
const BOOKINGS_CACHE_DURATION = 5000; // 5 secondes (temporaire pour debug)
```

**Impact** : Plus de requêtes à la DB, mais les données sont plus à jour

---

### Option 3 : Forcer le rechargement après navigation

**Fichier** : `src/pages/GuestVerification.tsx`

**Changement** :
```typescript
// ✅ APRÈS la navigation vers la page de confirmation
navigate('/contract-signing', {
  state: navigationState,
  replace: true
});

// ✅ NOUVEAU : Invalider le cache avant de naviguer
const cacheKey = `bookings-${propertyId}`;
multiLevelCache.invalidate(cacheKey).catch(() =\u003e {});

// ✅ NOUVEAU : Émettre un événement pour forcer le rechargement
window.dispatchEvent(new CustomEvent('booking-updated', {
  detail: { bookingId }
}));
```

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Correction immédiate (30 min)

1. ✅ **Ajouter l'événement `booking-updated`** dans `documentServiceUnified.ts`
2. ✅ **Ajouter le listener** dans `useBookings.ts`
3. ✅ **Tester** : Soumettre un formulaire et vérifier que le calendrier se met à jour

### Phase 2 : Vérification (15 min)

1. ✅ Vérifier que la carte et le calendrier affichent le même nom
2. ✅ Vérifier que la couleur est correcte (gris pour complété)
3. ✅ Vérifier qu'il n'y a pas de régression

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Soumission formulaire + rafraîchissement calendrier
1. Créer un lien ICS pour "John Doe" du 15-17 février
2. Ouvrir le lien et remplir le formulaire
3. Soumettre le formulaire
4. **Vérifier** : Le calendrier affiche "John" (pas "Réservation")
5. **Vérifier** : La couleur est grise (pas noire)

### Test 2 : Cohérence carte vs calendrier
1. Après la soumission du Test 1
2. Aller sur la vue "Cards"
3. **Vérifier** : La carte affiche "JOHN DOE"
4. Aller sur la vue "Calendrier"
5. **Vérifier** : Le calendrier affiche "John" (même nom)

---

## 📊 RÉSUMÉ

| Aspect | État actuel | État souhaité |
|--------|-------------|---------------|
| **Carte** | ✅ "MOUHCINE TEMSAMANI" | ✅ "MOUHCINE TEMSAMANI" |
| **Calendrier** | ❌ "Réservation" | ✅ "Mouhcine" |
| **Couleur** | ❌ Noir | ✅ Gris |
| **Cache** | ❌ Pas invalidé | ✅ Invalidé après soumission |

---

## 🎯 CONCLUSION

Le problème est un **problème de cache** :
- Les données sont correctement enregistrées en DB
- La carte les affiche correctement
- Mais le calendrier utilise un cache qui n'est pas invalidé

**Solution** : Invalider le cache après la soumission du formulaire en émettant un événement `booking-updated`.

**Temps estimé** : 30 minutes
**Risque** : Faible
**Impact** : Élevé (résout l'incohérence carte vs calendrier)
