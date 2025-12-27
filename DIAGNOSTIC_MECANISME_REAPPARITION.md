# 🔍 DIAGNOSTIC COMPLET - Mécanisme de Réapparition des Réservations

## 🎯 Problème Identifié

**Symptôme :** Les réservations disparaissent pendant 1 seconde puis réapparaissent

**Cause Racine :** Real-time subscription + rechargement automatique

---

## 🔄 Mécanisme de Réapparition

### Étape 1 : Rafraîchissement Initial (F5)
```
1. Page se charge
2. Calendrier vide (réservations supprimées de la DB)
3. ✅ Calendrier vide pendant ~1 seconde
```

### Étape 2 : Real-Time Subscription Déclenche un Reload
```typescript
// CalendarView.tsx ligne 462-485
useEffect(() => {
  const channel = supabase
    .channel(`calendar-${propertyId}`)
    .on('postgres_changes', {
      event: '*',  // ⚠️ Écoute TOUS les événements
      schema: 'public',
      table: 'airbnb_reservations',
      filter: `property_id=eq.${propertyId}`
    }, debouncedReload)  // ❌ Déclenche un reload !
    .subscribe();
}, [propertyId, debouncedReload]);
```

**Résultat :** Dès qu'il y a un changement dans `airbnb_reservations`, `debouncedReload` est appelé.

### Étape 3 : debouncedReload Recharge les Données
```typescript
// CalendarView.tsx ligne 434-459
const debouncedReload = useCallback(() => {
  airbnbCache.clear();  // Vide le cache
  loadAirbnbReservations();  // ❌ Recharge depuis la DB !
}, [loadAirbnbReservations]);
```

### Étape 4 : loadAirbnbReservations Appelle fetchAirbnbCalendarEvents
```typescript
// CalendarView.tsx ligne 239
const calendarEvents = await fetchAirbnbCalendarEvents(propertyId, startStr, endStr);
```

### Étape 5 : fetchAirbnbCalendarEvents Lit la Base de Données
```typescript
// calendarData.ts ligne 51-60
const { data: bookingsData } = await supabase
  .from('bookings')
  .select('...')
  .eq('property_id', propertyId)
  .or('booking_reference.is.null,booking_reference.eq.INDEPENDENT_BOOKING')  // ✅ Filtrage
  .order('check_in_date', { ascending: true });
```

**MAIS** : Le serveur Vite n'avait pas rechargé le fichier modifié !

---

## ✅ Solution

### 1. Redémarrage du Serveur (FAIT)
```bash
taskkill /F /IM node.exe
npm run dev
```

### 2. Vider le Cache du Navigateur
```
Ctrl + Shift + Delete
→ Cocher "Cached images and files"
→ Clear data
→ F5
```

### 3. Vérifier que le Filtrage Fonctionne

Le filtrage dans `calendarData.ts` doit maintenant être actif :
```typescript
.or('booking_reference.is.null,booking_reference.eq.INDEPENDENT_BOOKING')
```

**Ce filtrage exclut :**
- ✅ Tous les codes Airbnb (HM%, CL%, PN%, etc.)
- ✅ Garde seulement les réservations manuelles (null ou INDEPENDENT_BOOKING)

---

## 🧪 Test de Validation

### Test 1 : Rafraîchir la Page
1. Appuyez sur F5
2. Les réservations doivent disparaître
3. Elles NE DOIVENT PAS réapparaître

### Test 2 : Vérifier la Console
Ouvrez la console du navigateur (F12) et cherchez :
```
📊 [LOAD BOOKINGS] Bookings cached | Context: {"count":X}
```

**X doit être 2** (les 2 réservations manuelles uniquement)

### Test 3 : Vérifier le Calendrier
Le calendrier doit afficher :
- ✅ 27 réservations ICS (de `airbnb_reservations`)
- ✅ 2 réservations manuelles (de `bookings`)
- ❌ AUCUN code Airbnb (HM%, CL%, etc.)

---

## 📊 Architecture du Rechargement

```
┌─────────────────────────────────────────────────────────────┐
│                    RAFRAÎCHISSEMENT (F5)                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Real-Time Subscription (airbnb_reservations)        │
│  Écoute les changements dans la table                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              debouncedReload() déclenché                    │
│  - Vide le cache                                            │
│  - Appelle loadAirbnbReservations()                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         fetchAirbnbCalendarEvents(propertyId, ...)          │
│  - Lit bookings (AVEC filtrage maintenant ✅)               │
│  - Lit airbnb_reservations                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   CALENDRIER MIS À JOUR                     │
│  - 27 réservations ICS                                      │
│  - 2 réservations manuelles                                 │
│  - 0 codes Airbnb ✅                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Points d'Attention

### 1. Cache du Navigateur
Si le problème persiste, videz complètement le cache :
```
Ctrl + Shift + Delete
→ Tout cocher
→ Clear data
```

### 2. Cache de Vite
Si nécessaire, supprimez le cache de Vite :
```bash
rm -r node_modules/.vite
npm run dev
```

### 3. Vérifier le Code Déployé
Ouvrez la console du navigateur et vérifiez que le fichier `calendarData.ts` contient bien le filtrage :
```
Sources → calendarData.ts → ligne 59
```

---

## ✅ Checklist Finale

- [x] Serveur redémarré
- [ ] Cache navigateur vidé
- [ ] Page rafraîchie (F5)
- [ ] Vérifier que les codes Airbnb ne réapparaissent PAS
- [ ] Vérifier la console : count doit être 2
- [ ] Vérifier le calendrier : 27 ICS + 2 manuelles

---

**Maintenant, videz le cache du navigateur et rafraîchissez la page !** 🚀
