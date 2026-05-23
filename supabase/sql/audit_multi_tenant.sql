-- ============================================================
-- AUDIT MULTI-TENANT — Morocco Host Helper
-- Exécuter dans le SQL Editor de Supabase (rôle postgres ou service_role)
-- Chaque section = un CHECK indépendant
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- SECTION 1 : ÉTAT DES RLS (Row Level Security)
-- Tables sans RLS = n'importe quel utilisateur authentifié peut tout lire/écrire
-- ─────────────────────────────────────────────────────────────
SELECT
  '1. ÉTAT RLS' AS section,
  relname       AS table_name,
  CASE WHEN relrowsecurity THEN '✅ RLS ON' ELSE '🔴 RLS DÉSACTIVÉ' END AS rls_status,
  CASE WHEN relforcerowsecurity THEN 'FORCE ON' ELSE 'FORCE OFF' END     AS force_status
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
ORDER BY relrowsecurity ASC, relname;

-- ─────────────────────────────────────────────────────────────
-- SECTION 2 : POLICIES RLS EN PLACE
-- Vérifie que chaque table sensible a bien des policies
-- ─────────────────────────────────────────────────────────────
SELECT
  '2. POLICIES RLS' AS section,
  schemaname,
  tablename,
  policyname,
  cmd       AS operation,
  roles,
  CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK' ELSE 'sans CHECK' END AS check_present
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ─────────────────────────────────────────────────────────────
-- SECTION 3 : TABLES SANS AUCUNE POLICY
-- Si une table a RLS ON mais zéro policy → accès totalement bloqué (ou vide)
-- Si RLS OFF → zéro protection
-- ─────────────────────────────────────────────────────────────
SELECT
  '3. TABLES SANS POLICY' AS section,
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN 'RLS ON mais 0 policy !' ELSE 'RLS OFF + 0 policy' END AS situation
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;

-- ─────────────────────────────────────────────────────────────
-- SECTION 4 : CONFLITS DE RÉSERVATIONS EXISTANTS
-- Détecte les réservations qui se chevauchent sur une même propriété
-- ─────────────────────────────────────────────────────────────
SELECT
  '4. CONFLITS RÉSERVATIONS' AS section,
  a.id         AS booking_a,
  b.id         AS booking_b,
  a.property_id,
  a.check_in_date  AS a_in,
  a.check_out_date AS a_out,
  b.check_in_date  AS b_in,
  b.check_out_date AS b_out
FROM bookings a
JOIN bookings b
  ON a.property_id = b.property_id
 AND a.id < b.id
 AND a.check_in_date  < b.check_out_date
 AND a.check_out_date > b.check_in_date
 AND a.status NOT IN ('archived')
 AND b.status NOT IN ('archived')
ORDER BY a.property_id, a.check_in_date
LIMIT 50;

-- ─────────────────────────────────────────────────────────────
-- SECTION 5 : TOKENS EXPIRÉS ENCORE ACTIFS
-- Un token expiré mais is_active=true peut être utilisé si l'app ne valide pas bien
-- ─────────────────────────────────────────────────────────────
SELECT
  '5. TOKENS EXPIRÉS ACTIFS' AS section,
  id,
  property_id,
  token,
  expires_at,
  is_active,
  used_count,
  max_uses,
  type
FROM property_verification_tokens
WHERE is_active = TRUE
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
ORDER BY expires_at DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 6 : TOKENS SANS DATE D'EXPIRATION (permanents)
-- Risque si le token est compromis : accès illimité dans le temps
-- ─────────────────────────────────────────────────────────────
SELECT
  '6. TOKENS PERMANENTS (sans expiry)' AS section,
  COUNT(*) AS nb_tokens_sans_expiry,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS actifs
FROM property_verification_tokens
WHERE expires_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- SECTION 7 : TOKENS DÉPASSANT max_uses (no constraint DB)
-- Le dépassement est possible si deux requêtes simultanées arrivent
-- ─────────────────────────────────────────────────────────────
SELECT
  '7. TOKENS DÉPASSANT max_uses' AS section,
  id,
  property_id,
  token,
  max_uses,
  used_count,
  type
FROM property_verification_tokens
WHERE max_uses IS NOT NULL
  AND used_count > max_uses
ORDER BY used_count DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 8 : RÉSERVATIONS ORPHELINES
-- Bookings sans propriété valide (propriété supprimée sans cascade ?)
-- ─────────────────────────────────────────────────────────────
SELECT
  '8. RÉSERVATIONS ORPHELINES' AS section,
  b.id,
  b.property_id,
  b.check_in_date,
  b.status
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
WHERE p.id IS NULL
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- SECTION 9 : GUESTS ORPHELINS
-- Guests dont la réservation n'existe plus
-- ─────────────────────────────────────────────────────────────
SELECT
  '9. GUESTS ORPHELINS' AS section,
  g.id,
  g.full_name,
  g.booking_id,
  g.created_at
FROM guests g
LEFT JOIN bookings b ON b.id = g.booking_id
WHERE b.id IS NULL
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- SECTION 10 : PROPRIÉTÉS SANS OWNER VALIDE
-- owner_id ou user_id qui ne correspondent plus à un utilisateur Supabase Auth
-- ─────────────────────────────────────────────────────────────
SELECT
  '10. PROPRIÉTÉS SANS OWNER AUTH' AS section,
  p.id,
  p.name,
  p.user_id AS owner_id,
  p.created_at
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = p.user_id
)
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- SECTION 11 : GUEST_SUBMISSIONS SANS BOOKING RÉSOLU
-- Submissions dont le token est actif mais le booking_id NULL
-- Ces submissions sont "en suspens" et pourraient être perdues
-- ─────────────────────────────────────────────────────────────
SELECT
  '11. SUBMISSIONS SANS BOOKING' AS section,
  gs.id,
  gs.token_id,
  gs.status,
  gs.submitted_at,
  pvt.property_id,
  pvt.booking_id AS token_booking_ref
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON pvt.id = gs.token_id
WHERE gs.booking_id IS NULL
ORDER BY gs.submitted_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- SECTION 12 : ISOLEMENT MULTI-HÔTE — Vérification croisée
-- S'assure qu'aucun booking n'a un user_id qui ne correspond pas
-- au propriétaire de la propriété (colonne user_id legacy)
-- ─────────────────────────────────────────────────────────────
SELECT
  '12. BOOKING.user_id ≠ property.owner_id' AS section,
  b.id         AS booking_id,
  b.user_id    AS booking_user_id,
  p.user_id    AS property_owner_id,
  b.property_id,
  b.check_in_date
FROM bookings b
JOIN properties p ON p.id = b.property_id
WHERE b.user_id IS NOT NULL
  AND b.user_id != p.user_id
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- SECTION 13 : INDEX MANQUANTS — Scans séquentiels détectés
-- Tables qui reçoivent des seq_scans importants sans index suffisant
-- (nécessite pg_stat_user_tables, actif après quelques requêtes)
-- ─────────────────────────────────────────────────────────────
SELECT
  '13. SEQ SCANS (tables à risque)' AS section,
  relname       AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup    AS rows_estimate,
  CASE
    WHEN seq_scan > 100 AND (idx_scan = 0 OR seq_scan > idx_scan * 5)
    THEN '⚠️ INDEX MANQUANT probable'
    ELSE '✅ OK'
  END AS diagnostic
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 14 : INDEX NON UTILISÉS (candidates à supprimer)
-- Un index inutile ralentit les écritures sans bénéficier aux lectures
-- ─────────────────────────────────────────────────────────────
SELECT
  '14. INDEX NON UTILISÉS' AS section,
  schemaname,
  tablename,
  indexname,
  idx_scan      AS nb_utilisations,
  pg_size_pretty(pg_relation_size(indexrelid)) AS taille
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'          -- garder les PK
  AND indexname NOT LIKE '%_unique%'       -- garder les uniques
ORDER BY pg_relation_size(indexrelid) DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 15 : TAILLE DES TABLES ET CROISSANCE ESTIMÉE
-- ─────────────────────────────────────────────────────────────
SELECT
  '15. TAILLE TABLES' AS section,
  relname                                           AS table_name,
  n_live_tup                                        AS rows_live,
  pg_size_pretty(pg_total_relation_size(c.oid))     AS total_size,
  pg_size_pretty(pg_relation_size(c.oid))           AS table_size,
  pg_size_pretty(pg_total_relation_size(c.oid)
               - pg_relation_size(c.oid))           AS index_size
FROM pg_class c
JOIN pg_stat_user_tables s ON s.relname = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 16 : CONTRAINTES DE CLÉS ÉTRANGÈRES
-- Liste toutes les FK pour vérifier qu'on n'a pas de FK manquantes
-- ─────────────────────────────────────────────────────────────
SELECT
  '16. FOREIGN KEYS' AS section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule  AS on_delete,
  rc.update_rule  AS on_update
FROM information_schema.table_constraints       tc
JOIN information_schema.key_column_usage        kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc  ON rc.constraint_name  = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ─────────────────────────────────────────────────────────────
-- SECTION 17 : DOUBLONS airbnb_confirmation_code PAR PROPRIÉTÉ
-- La contrainte UNIQUE tolère plusieurs NULL → doublons possibles
-- ─────────────────────────────────────────────────────────────
SELECT
  '17. DOUBLONS CODES AIRBNB' AS section,
  property_id,
  airbnb_confirmation_code,
  COUNT(*) AS nb
FROM property_verification_tokens
WHERE airbnb_confirmation_code IS NOT NULL
GROUP BY property_id, airbnb_confirmation_code
HAVING COUNT(*) > 1
ORDER BY nb DESC;

-- ─────────────────────────────────────────────────────────────
-- SECTION 18 : RÉSUMÉ GLOBAL
-- Vue d'ensemble chiffrée du projet
-- ─────────────────────────────────────────────────────────────
SELECT '18. RÉSUMÉ GLOBAL' AS section, * FROM (
  SELECT 'Hôtes (auth users)'        AS métrique, COUNT(*)::TEXT AS valeur FROM auth.users
  UNION ALL
  SELECT 'Propriétés actives',       COUNT(*)::TEXT FROM properties WHERE is_active = TRUE
  UNION ALL
  SELECT 'Propriétés totales',       COUNT(*)::TEXT FROM properties
  UNION ALL
  SELECT 'Réservations pending',     COUNT(*)::TEXT FROM bookings WHERE status = 'pending'
  UNION ALL
  SELECT 'Réservations completed',   COUNT(*)::TEXT FROM bookings WHERE status = 'completed'
  UNION ALL
  SELECT 'Réservations archived',    COUNT(*)::TEXT FROM bookings WHERE status = 'archived'
  UNION ALL
  SELECT 'Guests total',             COUNT(*)::TEXT FROM guests
  UNION ALL
  SELECT 'Tokens actifs',            COUNT(*)::TEXT FROM property_verification_tokens WHERE is_active = TRUE
  UNION ALL
  SELECT 'Tokens expirés+actifs',    COUNT(*)::TEXT FROM property_verification_tokens WHERE is_active AND expires_at < NOW()
  UNION ALL
  SELECT 'Submissions pending',      COUNT(*)::TEXT FROM guest_submissions WHERE status = 'pending'
  UNION ALL
  SELECT 'Airbnb reservations',      COUNT(*)::TEXT FROM airbnb_reservations
) AS t;
