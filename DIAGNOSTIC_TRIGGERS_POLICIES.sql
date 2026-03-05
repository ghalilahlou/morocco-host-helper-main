-- ============================================================================
-- DIAGNOSTIC COMPLET - TRIGGERS, CONTRAINTES ET POLICIES
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================================================

-- 1. VÉRIFIER LES TRIGGERS SUR LA TABLE BOOKINGS
-- Si un trigger existe, il pourrait supprimer automatiquement les anciennes réservations
SELECT 
  '1. TRIGGERS SUR BOOKINGS' as section,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'bookings';

-- 2. VÉRIFIER LES CONTRAINTES UNIQUES
-- Une contrainte UNIQUE mal configurée pourrait causer des remplacements
SELECT 
  '2. CONTRAINTES UNIQUES' as section,
  conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'bookings' AND c.contype = 'u';

-- 3. VÉRIFIER LES POLICIES RLS
SELECT 
  '3. POLICIES RLS' as section,
  policyname,
  permissive,
  cmd,
  SUBSTRING(qual::text, 1, 100) as qual_preview,
  SUBSTRING(with_check::text, 1, 100) as with_check_preview
FROM pg_policies
WHERE tablename = 'bookings';

-- 4. COMPTER LES RÉSERVATIONS PAR PROPRIÉTÉ (pour comparaison)
SELECT 
  '4. COMPTAGE PAR PROPRIÉTÉ' as section,
  p.name as property_name,
  COUNT(b.id) as total_reservations
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
WHERE p.id IN (
  '488d5074-b6ce-40a8-b0d5-036e97993410',  -- studio casa
  'c28c29da-4868-4557-a8b0-988fbb800c79'   -- Palais Princess (pour comparaison)
)
GROUP BY p.id, p.name;

-- 5. HISTORIQUE DÉTAILLÉ DE "STUDIO CASA"
SELECT 
  '5. HISTORIQUE STUDIO CASA' as section,
  id,
  guest_name,
  status,
  check_in_date,
  check_out_date,
  booking_reference,
  created_at,
  updated_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY created_at DESC;

-- 6. VÉRIFIER S'IL Y A DES BOOKINGS SUPPRIMÉS (si table d'audit existe)
-- Décommentez si vous avez une table d'audit
-- SELECT * FROM audit_log WHERE table_name = 'bookings' AND action = 'DELETE' LIMIT 10;
