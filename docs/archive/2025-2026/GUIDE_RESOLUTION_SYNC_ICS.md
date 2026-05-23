# 🔍 GUIDE COMPLET - Résolution du Problème de Synchronisation ICS

## 📊 Diagnostic

**Problème identifié :** 22 réservations avec codes Airbnb persistent dans la table `bookings`

**Impact :** Le calendrier affiche ces réservations même si le lien ICS est supprimé

---

## 🎯 Plan d'Action en 3 Étapes

### Étape 1 : Inspection Approfondie (5 min)

**Objectif :** Comprendre exactement quelles données existent

**Action :**
1. Ouvrez Supabase SQL Editor
2. Exécutez le script `INSPECTION_APPROFONDIE_SYNC_ICS.sql`
3. Analysez les résultats :
   - Combien de réservations dans `airbnb_reservations` ?
   - Combien de réservations dans `bookings` avec codes Airbnb ?
   - Y a-t-il des doublons ?

**Résultats attendus :**
```
airbnb_reservations: X réservations
bookings (codes Airbnb): 22 réservations
Doublons: Y réservations
```

---

### Étape 2 : Nettoyage Définitif (2 min)

**Objectif :** Supprimer toutes les réservations avec codes Airbnb de `bookings`

**Action :**
1. Ouvrez Supabase SQL Editor
2. Exécutez le script `NETTOYAGE_DEFINITIF.sql`
3. Vérifiez que le résultat est `codes_airbnb_restants: 0`

**Commande SQL :**
```sql
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';
```

**Résultat attendu :**
```
DELETE 22
```

---

### Étape 3 : Vérification dans le Calendrier (1 min)

**Objectif :** Confirmer que le calendrier affiche correctement les données

**Action :**
1. Rafraîchissez la page du calendrier (F5)
2. Vérifiez que les codes Airbnb ont disparu
3. Seules les réservations de `airbnb_reservations` doivent apparaître

**Si ça ne fonctionne pas :**
- Videz le cache du navigateur (Ctrl+Shift+Delete)
- Rafraîchissez à nouveau (F5)

---

## 🔍 Pourquoi le Problème Persiste ?

### Cause Racine

Le problème vient de **2 sources de données** pour le calendrier :

```typescript
// calendarData.ts
const { data: bookingsData } = await supabase
  .from('bookings')  // ❌ Contient des codes Airbnb
  .select('...')

const { data: airbnbData } = await supabase
  .from('airbnb_reservations')  // ✅ Source ICS pure
  .select('...')
```

**Résultat :** Le calendrier affiche les 2 sources, donc les codes Airbnb de `bookings` apparaissent.

---

### Solution Implémentée

**Modification dans `calendarData.ts` :**
```typescript
const { data: bookingsData } = await supabase
  .from('bookings')
  .select('...')
  // ✅ FILTRAGE : Exclure les codes Airbnb
  .or('booking_reference.is.null,booking_reference.eq.INDEPENDENT_BOOKING')
```

**Problème :** Cette modification n'est pas encore déployée ou le cache n'est pas invalidé.

---

## ✅ Solution Complète

### 1. Nettoyage Immédiat (SQL)

**Supprimer les 22 réservations avec codes Airbnb :**
```sql
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';
```

### 2. Vérifier le Déploiement du Code

**Fichier modifié :** `src/services/calendarData.ts`

**Vérifier que cette ligne existe :**
```typescript
.or('booking_reference.is.null,booking_reference.eq.INDEPENDENT_BOOKING')
```

**Si elle n'existe pas :**
1. Le code n'est pas déployé
2. Redémarrez le serveur de développement
3. Vérifiez que le fichier a bien été modifié

### 3. Invalider les Caches

**Après le nettoyage SQL :**
1. Rafraîchissez la page (F5)
2. Videz le cache navigateur si nécessaire
3. Le calendrier doit se mettre à jour

---

## 🧪 Tests de Validation

### Test 1 : Vérifier la Suppression

```sql
SELECT COUNT(*) as codes_restants
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';
```

**Résultat attendu :** `codes_restants: 0`

### Test 2 : Vérifier le Calendrier

1. Ouvrez le calendrier
2. Vérifiez qu'il n'y a plus de codes comme `HMAXNTNAYM`, `HM8F5Q9Y5N`, etc.
3. Seules les réservations de `airbnb_reservations` doivent apparaître

### Test 3 : Tester la Synchronisation

1. Allez dans **Synchronisation**
2. Cliquez sur **"Synchroniser maintenant"**
3. Vérifiez que les nouvelles réservations apparaissent
4. Vérifiez qu'elles sont UNIQUEMENT dans `airbnb_reservations`

---

## 📊 Architecture Finale

```
┌─────────────────────────────────────────────────────────────┐
│                    FICHIER ICS                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Edge Function: sync-airbnb-unified                  │
│  - Parse ICS                                                │
│  - Upsert dans airbnb_reservations                          │
│  - Supprime anciennes réservations                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              TABLE: airbnb_reservations                     │
│  Source UNIQUE pour ICS                                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Service: calendarData.ts                            │
│  - Récupère airbnb_reservations                            │
│  - Récupère bookings (SANS codes Airbnb) ✅                │
│  - Enrichit avec noms validés                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   CALENDRIER                                │
│  Affiche UNIQUEMENT:                                        │
│  - Réservations ICS (airbnb_reservations)                  │
│  - Réservations manuelles (bookings sans codes)            │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Points d'Attention

### 1. Backup Avant Suppression

Le script `NETTOYAGE_DEFINITIF.sql` crée automatiquement un backup :
```sql
CREATE TABLE public.bookings_backup_20250127 AS
SELECT * FROM public.bookings
WHERE booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';
```

### 2. Vérifier le Déploiement

Assurez-vous que le code modifié dans `calendarData.ts` est bien déployé :
```bash
# Vérifier que le serveur de dev est à jour
npm run dev
```

### 3. Cache Navigateur

Si le problème persiste après le nettoyage SQL :
1. Videz le cache navigateur (Ctrl+Shift+Delete)
2. Fermez et rouvrez le navigateur
3. Rafraîchissez la page

---

## ✅ Checklist Finale

- [ ] Exécuter `INSPECTION_APPROFONDIE_SYNC_ICS.sql`
- [ ] Analyser les résultats
- [ ] Exécuter `NETTOYAGE_DEFINITIF.sql`
- [ ] Vérifier que `codes_airbnb_restants = 0`
- [ ] Rafraîchir le calendrier
- [ ] Vérifier que les codes Airbnb ont disparu
- [ ] Tester une synchronisation
- [ ] Confirmer que tout fonctionne

---

## 🚀 Prochaines Étapes

Une fois le nettoyage effectué :

1. **Test de Suppression du Lien ICS**
   - Supprimez le lien ICS
   - Vérifiez que le calendrier se vide

2. **Test d'Ajout d'un Nouveau Lien**
   - Ajoutez un nouveau lien ICS
   - Synchronisez
   - Vérifiez que les réservations apparaissent

3. **Test de Changement de Lien**
   - Changez le lien ICS
   - Synchronisez
   - Vérifiez que les anciennes réservations sont supprimées
   - Vérifiez que les nouvelles apparaissent

---

**Exécutez maintenant le script `NETTOYAGE_DEFINITIF.sql` et le problème sera résolu !** 🎉
