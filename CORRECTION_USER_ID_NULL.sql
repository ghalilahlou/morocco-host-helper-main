-- ============================================================================
-- CORRECTION DES RÉSERVATIONS AVEC user_id NULL
-- ============================================================================
-- Ce script corrige les réservations existantes qui ont user_id = NULL
-- en leur attribuant le bon user_id

-- IMPORTANT : Remplacez 'VOTRE_USER_ID' par votre vrai user_id
-- Vous pouvez le trouver avec : SELECT id, email FROM auth.users;

-- ============================================================================
-- 1. VÉRIFIER LES RÉSERVATIONS AVEC user_id NULL
-- ============================================================================
SELECT 
  'RÉSERVATIONS AVEC user_id NULL' as section,
  id,
  property_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM bookings
WHERE user_id IS NULL
ORDER BY created_at DESC;

-- ============================================================================
-- 2. CORRIGER LES RÉSERVATIONS (À EXÉCUTER APRÈS VÉRIFICATION)
-- ============================================================================
-- ⚠️ ATTENTION : Décommentez et remplacez 'VOTRE_USER_ID' avant d'exécuter

/*
UPDATE bookings
SET user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'  -- ✅ Remplacez par votre user_id
WHERE user_id IS NULL
  AND property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';  -- ✅ Optionnel : filtrer par propriété

-- Vérifier le résultat
SELECT 
  'RÉSERVATIONS CORRIGÉES' as section,
  id,
  user_id,
  property_id,
  guest_name,
  check_in_date,
  check_out_date
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY created_at DESC;
*/

-- ============================================================================
-- 3. VÉRIFIER QUE TOUTES LES RÉSERVATIONS ONT UN user_id
-- ============================================================================
SELECT 
  'STATISTIQUES user_id' as section,
  COUNT(*) as total,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as avec_user_id,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as sans_user_id
FROM bookings;
