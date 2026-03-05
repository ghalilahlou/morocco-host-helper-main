-- ============================================================================
-- SCRIPT POUR VÉRIFIER LES VALEURS VALIDES DE L'ENUM booking_status
-- ============================================================================

-- 1. VÉRIFIER LES VALEURS DE L'ENUM booking_status
-- ============================================================================
SELECT 
  '=== VALEURS DE L''ENUM booking_status ===' as section,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'booking_status'
ORDER BY e.enumsortorder;

-- 2. COMPTER LES RÉSERVATIONS PAR STATUT (seulement les valeurs valides)
-- ============================================================================
SELECT 
  '=== COMPTAGE PAR STATUT (valeurs valides uniquement) ===' as section,
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- 3. VÉRIFIER S'IL Y A DES STATUTS INVALIDES
-- ============================================================================
SELECT 
  '=== STATUTS INVALIDES (si erreur) ===' as section,
  id,
  status as invalid_status,
  guest_name,
  created_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status NOT IN (
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'booking_status'
  );
