-- Script pour vérifier les doublons
-- Date: 2025-01-31

-- 1. Vérifier les doublons de réservations
SELECT 
  '🔍 DOUBLONS DE RÉSERVATIONS' as type,
  COUNT(*) as total_doublons
FROM identify_duplicate_bookings();

-- 2. Détail des doublons
SELECT * FROM identify_duplicate_bookings()
ORDER BY property_id, check_in_date;

-- 3. Vérifier les doublons Airbnb
SELECT 
  '🔍 DOUBLONS AIRBNB' as type,
  COUNT(*) as total_doublons
FROM identify_duplicate_airbnb_reservations();

-- 4. Détail des doublons Airbnb
SELECT * FROM identify_duplicate_airbnb_reservations()
ORDER BY property_id, start_date;

-- 5. Rapport JSON complet
SELECT cleanup_duplicate_bookings(TRUE, 1000) as rapport_doublons;

