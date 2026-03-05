-- ============================================================================
-- DIAGNOSTIC COMPLET - Identifier la source du problème d'écrasement
-- Exécutez ces requêtes dans Supabase SQL Editor pour diagnostiquer
-- ============================================================================

-- ⚠️ ÉTAPE 1 : Sélectionnez UNE propriété spécifique pour le test
-- Remplacez 'VOTRE_PROPERTY_ID' par l'ID de la propriété que vous testez
-- Exemple: 'c28c29da-4868-4557-a8b0-988fbb800c79' (Palais Princess - 12 réservations)

-- 1. VÉRIFICATION DIRECTE : Toutes les réservations pour une propriété
SELECT 
  'RÉSERVATIONS DIRECTES' as diagnostic,
  b.id,
  b.guest_name,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.property_id,
  b.user_id,
  b.created_at,
  b.updated_at
FROM bookings b
WHERE b.property_id = 'c28c29da-4868-4557-a8b0-988fbb800c79' -- ← CHANGEZ CETTE VALEUR
ORDER BY b.created_at DESC;

-- 2. VÉRIFICATION DES TRIGGERS : Y a-t-il des triggers qui modifient les bookings ?
SELECT 
  'TRIGGERS SUR BOOKINGS' as diagnostic,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'bookings';

-- 3. VÉRIFICATION DES POLICIES RLS : Policies actives sur bookings
SELECT 
  'POLICIES RLS' as diagnostic,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'bookings';

-- 4. VÉRIFICATION DES SUPPRESSIONS RÉCENTES : Y a-t-il eu des suppressions ?
-- Note: Ceci ne fonctionnera que si vous avez une table d'audit
-- SELECT * FROM audit_log WHERE table_name = 'bookings' AND action = 'DELETE' 
-- ORDER BY created_at DESC LIMIT 10;

-- 5. COMPTAGE PAR STATUT pour la propriété sélectionnée
SELECT 
  'COMPTAGE PAR STATUT' as diagnostic,
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = 'c28c29da-4868-4557-a8b0-988fbb800c79' -- ← CHANGEZ CETTE VALEUR
GROUP BY status;

-- 6. VÉRIFICATION DU USER_ID : Toutes les réservations ont-elles le bon user_id ?
SELECT 
  'VÉRIFICATION USER_ID' as diagnostic,
  user_id,
  COUNT(*) as count
FROM bookings
WHERE property_id = 'c28c29da-4868-4557-a8b0-988fbb800c79' -- ← CHANGEZ CETTE VALEUR
GROUP BY user_id;

-- 7. DERNIÈRES MODIFICATIONS : Quelles réservations ont été modifiées récemment ?
SELECT 
  'DERNIÈRES MODIFICATIONS' as diagnostic,
  id,
  guest_name,
  status,
  created_at,
  updated_at
FROM bookings
WHERE property_id = 'c28c29da-4868-4557-a8b0-988fbb800c79' -- ← CHANGEZ CETTE VALEUR
ORDER BY updated_at DESC
LIMIT 10;
