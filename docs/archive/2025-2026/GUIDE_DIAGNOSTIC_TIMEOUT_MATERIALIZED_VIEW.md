# Guide de Diagnostic - Timeout Vue Matérialisée (Code 57014)

## 🔍 Comprendre l'erreur

L'erreur **57014** (Query timeout) indique que la requête sur la vue matérialisée `mv_bookings_enriched` prend plus de 2 secondes à s'exécuter.

**Symptômes** :
- ⚠️ `Materialized view error, falling back to bookings table`
- ⚠️ `Query timeout after 2s`
- ⚠️ Code d'erreur `57014`
- Le système passe automatiquement au fallback (table `bookings`)

## 🎯 Causes Possibles

### 1. Vue matérialisée non rafraîchie

**Problème** : La vue matérialisée est obsolète et doit être rafraîchie.

**Vérification** :
```sql
-- Vérifier la dernière fois que la vue a été rafraîchie
SELECT schemaname, matviewname, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews 
WHERE matviewname = 'mv_bookings_enriched';
```

**Solution** :
```sql
-- Rafraîchir la vue matérialisée
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
```

### 2. Vue matérialisée trop complexe

**Problème** : Les agrégations JSON (`jsonb_agg`, `jsonb_build_object`) sont coûteuses, surtout avec beaucoup de données.

**Indicateurs** :
- Beaucoup de réservations (> 1000)
- Beaucoup d'invités par réservation
- Beaucoup de soumissions par réservation

**Solution** : Optimiser la vue (voir section Optimisations ci-dessous)

### 3. Vue `v_guest_submissions` lente

**Problème** : La vue matérialisée utilise `v_guest_submissions` qui pourrait être lente.

**Vérification** :
```sql
-- Tester la performance de v_guest_submissions
EXPLAIN ANALYZE SELECT * FROM v_guest_submissions LIMIT 100;
```

**Solution** : Créer une vue matérialisée pour `v_guest_submissions` ou l'optimiser

### 4. Index manquants

**Problème** : Les index sur la vue matérialisée ne sont pas utilisés efficacement.

**Vérification** :
```sql
-- Vérifier les index existants
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'mv_bookings_enriched';
```

**Solution** : Vérifier que les index sont utilisés dans les requêtes

### 5. Trop de données dans la vue

**Problème** : La vue contient toutes les réservations, y compris les drafts et les anciennes réservations.

**Solution** : Ajouter un filtre WHERE pour exclure les données inutiles

## 🔧 Solutions

### Solution 1 : Rafraîchir la vue matérialisée

**Via SQL Editor dans Supabase Dashboard** :

```sql
-- Rafraîchir la vue matérialisée
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
```

**Via Edge Function ou script** :

```typescript
// Appeler la fonction de refresh
const { error } = await supabase.rpc('refresh_bookings_enriched');
```

### Solution 2 : Désactiver temporairement la vue matérialisée

**Modifier `useBookings.ts`** :

```typescript
// Ligne ~320 : Commenter l'utilisation de la vue matérialisée
// let query = supabase
//   .from('mv_bookings_enriched')
//   .select(...)

// Utiliser directement la table bookings
let query = supabase
  .from('bookings')
  .select(`*, guests (*), property:properties (*)`)
```

### Solution 3 : Augmenter le timeout (temporaire)

**Modifier `useBookings.ts` ligne ~373** :

```typescript
// Augmenter le timeout de 2s à 5s
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Query timeout after 5s')), 5000)
);
```

⚠️ **Note** : Ce n'est qu'une solution temporaire. Il faut optimiser la vue.

### Solution 4 : Optimiser la vue matérialisée

**Créer une migration pour optimiser la vue** :

```sql
-- 1. Ajouter un filtre WHERE pour exclure les drafts
DROP MATERIALIZED VIEW IF EXISTS public.mv_bookings_enriched CASCADE;

CREATE MATERIALIZED VIEW public.mv_bookings_enriched AS
SELECT 
  b.id,
  b.property_id,
  b.user_id,
  -- ... autres colonnes ...
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN v_guest_submissions gs ON gs.resolved_booking_id = b.id
WHERE b.status != 'draft'  -- ✅ Exclure les drafts
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '1 year'  -- ✅ Seulement les réservations récentes
GROUP BY ...;

-- 2. Créer un index unique pour permettre REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bookings_enriched_id 
  ON public.mv_bookings_enriched(id);

-- 3. Rafraîchir
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
```

### Solution 5 : Simplifier les agrégations JSON

**Problème** : Les agrégations JSON sont coûteuses.

**Solution** : Stocker les données agrégées de manière plus simple :

```sql
-- Au lieu de jsonb_agg, utiliser des colonnes simples
-- guests_data -> guest_count (INTEGER)
-- guest_submissions_data -> submission_count (INTEGER)
```

## 📋 Checklist de Diagnostic

- [ ] Vérifier que la vue matérialisée existe
- [ ] Vérifier la dernière fois que la vue a été rafraîchie
- [ ] Tester la performance de la vue directement en SQL
- [ ] Vérifier les index sur la vue matérialisée
- [ ] Vérifier la performance de `v_guest_submissions`
- [ ] Compter le nombre de réservations dans la vue
- [ ] Vérifier les logs Supabase pour les erreurs de performance

## 🧪 Tests de Performance

### Test 1 : Performance de la vue matérialisée

```sql
-- Tester la requête avec EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM mv_bookings_enriched 
WHERE property_id = 'YOUR_PROPERTY_ID'
LIMIT 50;
```

**Résultat attendu** : < 500ms

### Test 2 : Performance avec filtre par date

```sql
EXPLAIN ANALYZE
SELECT * FROM mv_bookings_enriched 
WHERE property_id = 'YOUR_PROPERTY_ID'
  AND check_in_date >= '2025-01-01'
  AND check_out_date <= '2025-12-31'
ORDER BY check_in_date DESC
LIMIT 50;
```

### Test 3 : Comparer avec la table bookings

```sql
-- Tester la même requête sur la table bookings
EXPLAIN ANALYZE
SELECT b.*, 
       json_agg(g.*) as guests,
       p.* as property
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN properties p ON p.id = b.property_id
WHERE b.property_id = 'YOUR_PROPERTY_ID'
  AND b.status != 'draft'
GROUP BY b.id, p.id
LIMIT 50;
```

## 🚀 Optimisations Recommandées

### 1. Ajouter un filtre WHERE dans la vue

```sql
WHERE b.status != 'draft'
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '1 year'
```

### 2. Limiter les agrégations JSON

Au lieu de stocker tous les détails, stocker seulement les compteurs :

```sql
-- Au lieu de :
jsonb_agg(DISTINCT jsonb_build_object(...)) as guests_data

-- Utiliser :
COUNT(DISTINCT g.id) as guest_count
```

### 3. Créer une vue matérialisée pour `v_guest_submissions`

Si `v_guest_submissions` est lente, créer une vue matérialisée :

```sql
CREATE MATERIALIZED VIEW mv_guest_submissions AS
SELECT * FROM v_guest_submissions;

CREATE UNIQUE INDEX idx_mv_guest_submissions_id ON mv_guest_submissions(id);
```

### 4. Rafraîchir la vue automatiquement

Créer un job cron pour rafraîchir la vue toutes les heures :

```sql
-- Via pg_cron (si disponible)
SELECT cron.schedule(
  'refresh-bookings-enriched',
  '0 * * * *',  -- Toutes les heures
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched$$
);
```

## 💡 Solution Immédiate (Quick Fix)

Si vous avez besoin d'une solution immédiate :

1. **Désactiver la vue matérialisée** dans `useBookings.ts` :
   ```typescript
   // Commenter la ligne ~320
   // .from('mv_bookings_enriched')
   
   // Utiliser directement
   .from('bookings')
   ```

2. **Augmenter le timeout** à 5 secondes (ligne ~373)

3. **Rafraîchir la vue** manuellement via SQL Editor

## 🔗 Ressources

- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)
- [REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/performance)

