-- Script pour appliquer les améliorations de prévention de conflits
-- Date: 2025-01-31
-- Usage: Exécuter ce script via Supabase SQL Editor ou CLI

BEGIN;

-- 1. ✅ Appliquer la migration de prévention de conflits
\i supabase/migrations/20250131000001_improve_conflict_prevention.sql

-- 2. ✅ Identifier les doublons existants (rapport)
DO $$
DECLARE
  report JSON;
BEGIN
  SELECT * INTO report FROM cleanup_duplicate_bookings(TRUE, 1000);
  RAISE NOTICE 'RAPPORT DE DOUBLONS: %', report;
END $$;

-- 3. ✅ Afficher les doublons (pour vérification manuelle)
SELECT 
  'DOUBLONS DÉTECTÉS' as type,
  COUNT(*) as total
FROM identify_duplicate_bookings();

SELECT * FROM identify_duplicate_bookings();

-- 4. ✅ Afficher les doublons Airbnb
SELECT 
  'DOUBLONS AIRBNB DÉTECTÉS' as type,
  COUNT(*) as total
FROM identify_duplicate_airbnb_reservations();

SELECT * FROM identify_duplicate_airbnb_reservations();

-- 5. ✅ OPTION : Nettoyer les doublons (décommenter si confirmé)
-- ⚠️ ATTENTION : Ceci va SUPPRIMER des données !
-- SELECT * FROM cleanup_duplicate_bookings(FALSE, 1000);

-- 6. ✅ Vérifier l'état final
SELECT 
  'ÉTAT FINAL' as type,
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicates_count
FROM bookings
WHERE status NOT IN ('cancelled', 'rejected')
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1;

COMMIT;

-- 7. ✅ Tests de validation
-- Test 1: Vérifier qu'une réservation en conflit est détectée
DO $$
DECLARE
  test_property_id UUID;
  test_check_in DATE := '2025-12-01';
  test_check_out DATE := '2025-12-05';
  conflicts JSON;
BEGIN
  -- Récupérer une propriété de test
  SELECT id INTO test_property_id FROM properties LIMIT 1;
  
  IF test_property_id IS NOT NULL THEN
    -- Vérifier les conflits pour des dates de test
    conflicts := check_all_booking_conflicts(
      test_property_id,
      test_check_in,
      test_check_out,
      NULL
    );
    
    RAISE NOTICE 'TEST CONFLITS pour propriété %: %', test_property_id, conflicts;
  ELSE
    RAISE NOTICE 'Aucune propriété trouvée pour le test';
  END IF;
END $$;

-- 8. ✅ Afficher le résumé
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ DES AMÉLIORATIONS APPLIQUÉES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Fonctions de détection créées';
  RAISE NOTICE '✅ Trigger de prévention mis à jour';
  RAISE NOTICE '✅ Contraintes assouplies';
  RAISE NOTICE '✅ Vérifiez les doublons ci-dessus';
  RAISE NOTICE '========================================';
END $$;

