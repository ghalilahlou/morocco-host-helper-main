# 🚨 ACTIONS URGENTES - Résolution Problème Réservations

## 🔍 Problème Confirmé

- ✅ **25 réservations** existent dans la table `bookings` (confirmé via SQL)
- ❌ **`rawDataCount: 0`** - Aucune réservation chargée par `useBookings.ts`

## ✅ Modifications Appliquées dans `useBookings.ts`

### 1. **Suppression Temporaire des Filtres**

```typescript
const REMOVE_FILTERS_FOR_DEBUG = true; // ✅ TEMPORAIRE
const SIMPLIFY_QUERY = true; // ✅ TEMPORAIRE

// Requête SANS filtres et SANS jointures
query = supabase.from('bookings').select(`*`);
```

**Résultat attendu** : La requête devrait retourner **TOUTES** les réservations de la table, sans filtres.

### 2. **Capture d'Erreur SQL Détaillée**

```typescript
if (error) {
  console.error('❌ [USE BOOKINGS] ERREUR SUPABASE DIRECTE:', {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error.status
  });
}
```

**Résultat attendu** : Si une erreur SQL se produit, elle sera loggée avec tous les détails.

### 3. **Logs Détaillés à Chaque Étape**

- `🔍 [USE BOOKINGS] Exécution de la requête Supabase...`
- `📊 [USE BOOKINGS] Résultat de la requête`
- `📊 [USE BOOKINGS] Raw bookings data loaded`
- `❌ [USE BOOKINGS] ERREUR SUPABASE DIRECTE` (si erreur)

## 🔧 Actions Manuelles Requises

### Action 1 : Exécuter le Script SQL pour RLS

**Fichier** : `scripts/fix-rls-bookings.sql`

**Via Supabase Dashboard → SQL Editor** :

```sql
-- Autoriser TOUS les utilisateurs authentifiés à lire TOUTES les réservations
CREATE POLICY IF NOT EXISTS "Enable read access for all authenticated users" 
ON public.bookings 
FOR SELECT 
TO authenticated
USING (true);

-- S'assurer que le RLS est activé
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
```

**OU** exécuter directement le fichier :
```bash
# Copier le contenu de scripts/fix-rls-bookings.sql dans Supabase Dashboard → SQL Editor
```

### Action 2 : Vérifier la Structure de la Table

**Via Supabase Dashboard → SQL Editor** :

```sql
-- Vérifier que la table bookings existe et a les bonnes colonnes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- Vérifier que les relations existent
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'bookings' 
  AND tc.constraint_type = 'FOREIGN KEY';
```

### Action 3 : Tester la Requête Directement

**Via Supabase Dashboard → SQL Editor** :

```sql
-- Test 1 : Requête simple (sans filtres)
SELECT COUNT(*) FROM bookings;

-- Test 2 : Vérifier les réservations
SELECT id, property_id, user_id, status, check_in_date, check_out_date 
FROM bookings 
LIMIT 10;

-- Test 3 : Vérifier avec votre user_id
SELECT id, property_id, user_id, status 
FROM bookings 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'ghalilahlou26@gmail.com')
LIMIT 10;
```

## 📊 Vérification dans la Console du Navigateur

Après avoir rechargé la page, vérifiez ces logs dans la console (F12) :

### ✅ Logs Attendus (Succès)

1. **`🔍 [USE BOOKINGS] MODE DEBUG : Requête SANS filtres et SANS jointures`**
   - Indique que le mode debug est activé

2. **`🔍 [USE BOOKINGS] Exécution de la requête Supabase...`**
   - Indique que la requête est exécutée

3. **`📊 [USE BOOKINGS] Résultat de la requête`**
   - **CRITIQUE** : Vérifier `dataCount` - doit être **25** (ou > 0)
   - Si `dataCount: 0`, vérifier `errorMessage`, `errorCode`, `errorDetails`

4. **`📊 [USE BOOKINGS] Raw bookings data loaded`**
   - **CRITIQUE** : Vérifier `count` - doit être **25** (ou > 0)
   - Vérifier `bookingsDetails` - doit contenir vos réservations

### ❌ Erreurs Possibles

1. **`❌ [USE BOOKINGS] ERREUR SUPABASE DIRECTE`**
   - **Cause** : Erreur SQL (permissions RLS, colonnes manquantes, etc.)
   - **Solution** : Vérifier `errorDetails` et `errorHint` pour la cause exacte

2. **`❌ [USE BOOKINGS] AUCUNE réservation chargée depuis la base de données!`**
   - **Cause** : La requête ne retourne aucune donnée
   - **Solution** : 
     - Vérifier les permissions RLS (Action 1)
     - Vérifier que les réservations existent (Action 3)
     - Vérifier que le `user_id` correspond

## 🔍 Diagnostic des Erreurs Communes

### Erreur 1 : "permission denied for table bookings"
**Cause** : RLS trop restrictif  
**Solution** : Exécuter `scripts/fix-rls-bookings.sql`

### Erreur 2 : "column guests does not exist"
**Cause** : Relation `guests` mal configurée  
**Solution** : Vérifier la structure de la table (Action 2)

### Erreur 3 : "relation bookings does not exist"
**Cause** : Table n'existe pas ou nom incorrect  
**Solution** : Vérifier que la table existe dans Supabase Dashboard

### Erreur 4 : `dataCount: 0` sans erreur
**Cause** : RLS filtre toutes les réservations  
**Solution** : Exécuter `scripts/fix-rls-bookings.sql`

## ✅ Résultat Attendu

Après avoir exécuté les actions :

1. ✅ **Logs dans la console** : `dataCount: 25` (ou > 0)
2. ✅ **Réservations chargées** : Les 25 réservations sont chargées
3. ✅ **Affichage dans le calendrier** : Toutes les réservations apparaissent

## 🔄 Prochaines Étapes

Une fois que les réservations sont chargées :

1. **Réactiver les filtres** : Mettre `REMOVE_FILTERS_FOR_DEBUG = false`
2. **Réactiver les jointures** : Mettre `SIMPLIFY_QUERY = false`
3. **Restreindre RLS** : Créer une politique plus sécurisée (voir `scripts/fix-rls-bookings.sql`)

## 📝 Notes Importantes

- ⚠️ **Mode DEBUG activé** : Les filtres sont désactivés temporairement
- ⚠️ **Requête simplifiée** : Pas de jointures pour éviter les erreurs de schéma
- ⚠️ **RLS permissif** : Tous les utilisateurs authentifiés peuvent lire toutes les réservations
- ✅ **Sécurité** : Réactiver les filtres et restreindre RLS une fois le problème résolu

