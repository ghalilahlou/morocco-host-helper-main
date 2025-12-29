-- ============================================================================
-- VÉRIFICATION SIMPLIFIÉE DES RÉSERVATIONS PAR PROPRIÉTÉ
-- ============================================================================
-- Version simplifiée sans jointure sur guest_submissions pour éviter les erreurs de schéma

-- ============================================================================
-- 1. STATISTIQUES GLOBALES PAR PROPRIÉTÉ
-- ============================================================================
SELECT 
  'STATISTIQUES PAR PROPRIÉTÉ' as section,
  p.id as property_id,
  p.name as property_name,
  COUNT(b.id) as total_reservations,
  COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN b.booking_reference IS NULL OR b.booking_reference = 'INDEPENDENT_BOOKING' THEN 1 END) as reservations_independantes,
  COUNT(CASE WHEN b.booking_reference IS NOT NULL AND b.booking_reference != 'INDEPENDENT_BOOKING' THEN 1 END) as reservations_airbnb
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
WHERE p.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
GROUP BY p.id, p.name
ORDER BY p.name;

-- ============================================================================
-- 2. DÉTAILS POUR LA PROPRIÉTÉ ACTUELLE (studio casa)
-- ============================================================================
SELECT 
  'RÉSERVATIONS POUR studio casa' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  b.status,
  b.number_of_guests,
  b.created_at,
  CASE 
    WHEN b.booking_reference IS NULL OR b.booking_reference = 'INDEPENDENT_BOOKING' THEN 'Indépendante'
    ELSE 'Airbnb/ICS'
  END as type_reservation
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
ORDER BY b.check_in_date DESC;

-- ============================================================================
-- 3. RÉSUMÉ POUR CETTE PROPRIÉTÉ
-- ============================================================================
SELECT 
  'RÉSUMÉ studio casa' as section,
  COUNT(*) as total_en_base,
  COUNT(*) as devrait_etre_visible_calendrier,
  COUNT(CASE WHEN status = 'completed' OR status = 'confirmed' THEN 1 END) as visible_cards_avec_filtre_actuel,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as exclues_par_filtre
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';
