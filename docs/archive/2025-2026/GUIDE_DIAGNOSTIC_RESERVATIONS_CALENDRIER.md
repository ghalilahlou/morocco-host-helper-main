# Guide de Diagnostic - Réservations Non Affichées dans le Calendrier

## 🔍 Problème

Aucune réservation n'apparaît dans le calendrier, même si elles existent dans la base de données.

## 📋 Étapes de Diagnostic

### 1. Vider le Cache

Le cache peut contenir un tableau vide `[]` qui empêche le rechargement des réservations.

**Solution** :
```bash
npm run clear:cache
```

Ou manuellement dans la console du navigateur :
```javascript
// Ouvrir la console (F12) et exécuter :
localStorage.clear();
indexedDB.deleteDatabase('multiLevelCache');
location.reload();
```

### 2. Vérifier les Logs dans la Console

Ouvrez la console du navigateur (F12) et cherchez ces logs :

#### ✅ Logs Attendus

1. **`🔍 [USE BOOKINGS] Filtering bookings by property_id`**
   - Indique que le filtre par propriété est appliqué
   - Vérifier que `propertyId` correspond à votre propriété

2. **`🔍 [USE BOOKINGS] Exécution de la requête`**
   - Indique que la requête est exécutée
   - Vérifier `source: 'bookings_table'` (pas `materialized_view`)

3. **`📊 [USE BOOKINGS] Résultat de la requête`**
   - Indique le résultat de la requête
   - **CRITIQUE** : Vérifier `dataCount` - doit être > 0

4. **`📊 [USE BOOKINGS] Raw bookings data loaded`**
   - Indique les données brutes chargées
   - **CRITIQUE** : Vérifier `count` - doit être > 0
   - Vérifier `bookingsDetails` - doit contenir vos réservations

5. **`📊 [USE BOOKINGS] Bookings transformés`**
   - Indique les réservations transformées
   - **CRITIQUE** : Vérifier `transformed` - doit être > 0

6. **`✅ [USE BOOKINGS] Bookings cached (multi-level)`**
   - Indique que les réservations sont mises en cache
   - **CRITIQUE** : Vérifier `count` - doit être > 0

7. **`📊 [CalendarView] Réservations reçues`**
   - Indique les réservations reçues par CalendarView
   - **CRITIQUE** : Vérifier `total` - doit être > 0

8. **`📊 [CalendarView] Réservations finales pour affichage`**
   - Indique les réservations finales pour affichage
   - **CRITIQUE** : Vérifier `total` - doit être > 0

#### ❌ Erreurs à Rechercher

1. **`❌ [USE BOOKINGS] AUCUNE réservation chargée depuis la base de données!`**
   - **Cause** : La requête ne retourne aucune donnée
   - **Solution** : Vérifier que les réservations existent dans la base de données avec le bon `property_id` et `user_id`

2. **`❌ [USE BOOKINGS] AUCUNE réservation transformée!`**
   - **Cause** : Les données sont chargées mais la transformation échoue
   - **Solution** : Vérifier les logs de transformation pour voir pourquoi

3. **`⚠️ [USE BOOKINGS] Cache contient 0 réservations`**
   - **Cause** : Le cache contient un tableau vide
   - **Solution** : Le cache sera automatiquement invalidé, mais vous pouvez aussi vider manuellement

### 3. Vérifier la Base de Données

Vérifiez que les réservations existent dans la base de données :

```sql
-- Via Supabase Dashboard → SQL Editor
SELECT 
  id, 
  property_id, 
  user_id,
  status, 
  check_in_date, 
  check_out_date,
  documents_generated
FROM bookings 
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' 
  AND user_id = (SELECT id FROM auth.users WHERE email = 'ghalilahlou26@gmail.com')
ORDER BY check_in_date DESC;
```

**Vérifications** :
- ✅ Les réservations existent
- ✅ `property_id` correspond
- ✅ `user_id` correspond
- ✅ `status` est correct (pas 'draft')

### 4. Vérifier le Filtre dans CalendarView

Le filtre est temporairement désactivé (`SHOW_ALL_BOOKINGS = true`), donc toutes les réservations devraient apparaître.

**Si aucune réservation n'apparaît encore** :
- Les réservations ne sont pas chargées depuis la base de données
- Vérifier les logs `📊 [USE BOOKINGS]` pour voir où ça bloque

## 🔧 Solutions

### Solution 1 : Vider le Cache

```bash
npm run clear:cache
```

Puis recharger la page.

### Solution 2 : Forcer le Rechargement

Dans la console du navigateur :
```javascript
// Invalider le cache
localStorage.clear();
indexedDB.deleteDatabase('multiLevelCache');

// Recharger la page
location.reload();
```

### Solution 3 : Vérifier les Permissions RLS

Vérifiez que les politiques RLS (Row Level Security) permettent de lire les réservations :

```sql
-- Via Supabase Dashboard → SQL Editor
SELECT * FROM bookings 
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
LIMIT 1;
```

Si cette requête retourne des données mais pas l'application, c'est un problème de permissions RLS.

## 📊 Logs de Diagnostic

Les logs suivants vous aideront à identifier le problème :

1. **Chargement** : `🔍 [USE BOOKINGS] Filtering bookings by property_id`
2. **Requête** : `🔍 [USE BOOKINGS] Exécution de la requête`
3. **Résultat** : `📊 [USE BOOKINGS] Résultat de la requête`
4. **Données brutes** : `📊 [USE BOOKINGS] Raw bookings data loaded`
5. **Transformation** : `📊 [USE BOOKINGS] Bookings transformés`
6. **Cache** : `✅ [USE BOOKINGS] Bookings cached (multi-level)`
7. **CalendarView** : `📊 [CalendarView] Réservations reçues`
8. **Affichage** : `📊 [CalendarView] Réservations finales pour affichage`

## ✅ Résultat Attendu

Après avoir vidé le cache et rechargé la page, vous devriez voir :

1. ✅ Les logs indiquant que les réservations sont chargées
2. ✅ Les réservations apparaissant dans le calendrier
3. ✅ Le cache contenant les réservations

Si le problème persiste, partagez les logs de la console pour un diagnostic plus approfondi.

