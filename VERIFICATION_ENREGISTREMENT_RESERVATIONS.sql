-- ============================================================================
-- VÉRIFICATION DE L'ENREGISTREMENT DES RÉSERVATIONS
-- ============================================================================
-- Script pour vérifier si les réservations sont bien enregistrées en base

-- 1. Vérifier les réservations créées dans les dernières 24 heures
SELECT 
  'RÉSERVATIONS RÉCENTES (24h)' as section,
  id,
  property_id,
  user_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at,
  CASE 
    WHEN user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' THEN '✅ CET UTILISATEUR'
    ELSE '⚠️ AUTRE UTILISATEUR'
  END as user_match
FROM bookings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Vérifier les réservations pour cette propriété (TOUS utilisateurs)
SELECT 
  'TOUTES RÉSERVATIONS POUR CETTE PROPRIÉTÉ' as section,
  id,
  user_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at,
  CASE 
    WHEN user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' THEN '✅ CET UTILISATEUR'
    ELSE '⚠️ AUTRE UTILISATEUR'
  END as user_match
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Compter les réservations par utilisateur pour cette propriété
SELECT 
  'RÉPARTITION PAR UTILISATEUR' as section,
  user_id,
  COUNT(*) as count,
  STRING_AGG(guest_name, ', ') as guest_names
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY user_id;
