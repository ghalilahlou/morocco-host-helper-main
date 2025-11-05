-- ⚠️ Script pour NETTOYER les doublons (ATTENTION: SUPPRIME DES DONNÉES)
-- Date: 2025-01-31
-- 
-- AVANT D'EXÉCUTER :
-- 1. Faire une sauvegarde de la base de données
-- 2. Exécuter check-duplicates.sql pour voir ce qui sera supprimé
-- 3. Confirmer que vous voulez vraiment supprimer ces données

-- 1. ⚠️ CONFIRMATION REQUISE
DO $$
BEGIN
  RAISE NOTICE '⚠️ ATTENTION : Ce script va SUPPRIMER des données !';
  RAISE NOTICE 'Appuyez sur Entrée pour continuer ou Ctrl+C pour annuler...';
  -- Pause de 5 secondes pour laisser le temps d'annuler
  PERFORM pg_sleep(5);
END $$;

-- 2. Nettoyer les doublons de réservations
DO $$
DECLARE
  result JSON;
BEGIN
  RAISE NOTICE '🧹 Nettoyage des doublons de réservations...';
  SELECT * INTO result FROM cleanup_duplicate_bookings(FALSE, 1000);
  RAISE NOTICE 'Résultat: %', result;
END $$;

-- 3. Nettoyer les doublons Airbnb
DO $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🧹 Nettoyage des doublons Airbnb...';
  
  WITH duplicates AS (
    SELECT duplicate_id FROM identify_duplicate_airbnb_reservations()
  )
  DELETE FROM airbnb_reservations
  WHERE id IN (SELECT duplicate_id FROM duplicates);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Supprimé % réservation(s) Airbnb en double', deleted_count;
END $$;

-- 4. Vérification finale
SELECT 
  '✅ VÉRIFICATION FINALE' as type,
  COUNT(*) as doublons_restants
FROM identify_duplicate_bookings();

SELECT 
  '✅ VÉRIFICATION FINALE AIRBNB' as type,
  COUNT(*) as doublons_restants
FROM identify_duplicate_airbnb_reservations();

-- 5. Résumé
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ NETTOYAGE TERMINÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Vérifiez le calendrier pour confirmer';
  RAISE NOTICE 'que les conflits ont disparu';
  RAISE NOTICE '========================================';
END $$;

