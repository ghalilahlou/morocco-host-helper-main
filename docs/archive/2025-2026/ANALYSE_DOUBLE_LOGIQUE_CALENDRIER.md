# 🔍 Analyse Exhaustive : Double Logique du Calendrier

## 📋 Problème Identifié

Le calendrier affiche deux comportements différents selon l'action effectuée :

1. **"Actualiser" (Refresh)** : Réservations en **ROUGE** avec chevauchements
2. **"Synchroniser" (Sync)** : Réservations en **TEAL** sans chevauchements

## 🔬 Analyse Technique

### Action 1 : "Actualiser" (handleManualRefresh)

**Flux actuel :**
```
handleManualRefresh()
  └─> airbnbCache.clear()
  └─> loadAirbnbReservations()
      └─> fetchAirbnbCalendarEvents() (depuis airbnb_reservations)
      └─> setAirbnbReservations() ✅ Mise à jour
      └─> ❌ NE rafraîchit PAS les bookings (prop statique)
```

**Problème :**
- Les `bookings` restent obsolètes (prop passée depuis `PropertyDetail`)
- Les `airbnbReservations` sont à jour (chargées depuis la base)
- Les conflits sont détectés entre `bookings` (obsolètes) et `airbnbReservations` (à jour)
- **Résultat : Faux conflits → Réservations en ROUGE**

### Action 2 : "Synchroniser" (handleSyncFromCalendar)

**Flux actuel :**
```
handleSyncFromCalendar()
  └─> AirbnbEdgeFunctionService.syncReservations()
      └─> sync-airbnb-unified Edge Function
          └─> Met à jour airbnb_reservations dans la base
          └─> Déclenche subscription en temps réel
              └─> PropertyDetail.useBookings() se met à jour
                  └─> bookings prop se met à jour ✅
  └─> loadAirbnbReservations() (après sync)
      └─> setAirbnbReservations() ✅ Mise à jour
```

**Pourquoi ça marche :**
- Les `bookings` sont mis à jour via la subscription en temps réel
- Les `airbnbReservations` sont chargées après la sync
- Les deux sont synchronisés
- **Résultat : Pas de conflits → Réservations en TEAL**

## 🎯 Solution : Unification de la Logique

### Solution 1 : Rafraîchir les bookings dans handleManualRefresh

**Modification nécessaire :**
1. Ajouter `onRefreshBookings` comme prop à `CalendarView`
2. Appeler `onRefreshBookings()` dans `handleManualRefresh()`
3. Attendre que les bookings soient mis à jour avant de charger les réservations Airbnb

### Solution 2 : Utiliser useBookings directement dans CalendarView

**Avantage :** Plus de dépendance sur les props
**Inconvénient :** Duplication de logique, nécessite de passer `propertyId`

### Solution 3 : Unifier les deux actions avec la même logique

**Approche :**
- `handleManualRefresh` : Rafraîchir bookings + rafraîchir airbnbReservations
- `handleSyncFromCalendar` : Sync ICS + rafraîchir bookings + rafraîchir airbnbReservations

## 📝 Plan d'Action

1. ✅ Ajouter `onRefreshBookings?: () => void` comme prop optionnelle à `CalendarView`
2. ✅ Modifier `handleManualRefresh` pour appeler `onRefreshBookings()` avant `loadAirbnbReservations()`
3. ✅ Modifier `PropertyDetail` pour passer `refreshBookings` comme prop
4. ✅ S'assurer que `handleSyncFromCalendar` utilise aussi `onRefreshBookings()` après la sync
5. ✅ Tester que les deux actions produisent le même résultat visuel

## 🎨 Résultat Attendu

**Après correction :**
- "Actualiser" : Réservations en TEAL (pas de conflits)
- "Synchroniser" : Réservations en TEAL (pas de conflits)
- **Unification complète de l'apparence du calendrier**

