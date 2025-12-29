-- ============================================================================
-- VÉRIFICATION DES RÉSERVATIONS PAR PROPRIÉTÉ
-- ============================================================================
-- Ce script vérifie le nombre de réservations pour chaque propriété
-- et identifie les incohérences potentielles

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
  COUNT(CASE WHEN b.user_id IS NULL THEN 1 END) as sans_user_id,
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
  b.user_id,
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
-- 3. VÉRIFICATION DES GUESTS POUR CHAQUE RÉSERVATION
-- ============================================================================
SELECT 
  'GUESTS PAR RÉSERVATION' as section,
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  b.status,
  COUNT(gs.id) as nombre_guests,
  COUNT(CASE WHEN gs.full_name IS NOT NULL AND gs.document_number IS NOT NULL AND gs.nationality IS NOT NULL THEN 1 END) as guests_complets
FROM bookings b
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
GROUP BY b.id, b.booking_reference, b.guest_name, b.status
ORDER BY b.check_in_date DESC;

-- ============================================================================
-- 4. RÉSERVATIONS QUI DEVRAIENT ÊTRE VISIBLES DANS LE CALENDRIER
-- ============================================================================
-- Critères : Toutes les réservations avec user_id valide
SELECT 
  'RÉSERVATIONS VISIBLES CALENDRIER' as section,
  COUNT(*) as total_visible_calendrier
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

-- ============================================================================
-- 5. RÉSERVATIONS QUI DEVRAIENT ÊTRE VISIBLES DANS LES CARDS
-- ============================================================================
-- Critères actuels du code (trop restrictifs) :
-- - status = 'completed' ET tous les documents OU status = 'confirmed'
SELECT 
  'RÉSERVATIONS VISIBLES CARDS (FILTRE ACTUEL)' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.status,
  COUNT(gs.id) as nombre_guests,
  COUNT(CASE WHEN gs.full_name IS NOT NULL AND gs.document_number IS NOT NULL AND gs.nationality IS NOT NULL THEN 1 END) as guests_complets,
  CASE 
    WHEN b.status = 'completed' AND COUNT(CASE WHEN gs.full_name IS NOT NULL AND gs.document_number IS NOT NULL AND gs.nationality IS NOT NULL THEN 1 END) = b.number_of_guests THEN 'OUI'
    WHEN b.status = 'confirmed' THEN 'OUI'
    ELSE 'NON'
  END as visible_dans_cards
FROM bookings b
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
GROUP BY b.id, b.booking_reference, b.guest_name, b.status, b.number_of_guests
ORDER BY b.check_in_date DESC;

-- ============================================================================
-- 6. RÉSUMÉ DES INCOHÉRENCES
-- ============================================================================
SELECT 
  'RÉSUMÉ' as section,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0') as total_en_base,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0') as devrait_etre_visible_calendrier,
  (SELECT COUNT(*) 
   FROM bookings b
   LEFT JOIN guest_submissions g ON g.booking_id = b.id
   WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' 
     AND b.user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
     AND (
       (b.status = 'completed' AND (SELECT COUNT(*) FROM guest_submissions WHERE booking_id = b.id AND full_name IS NOT NULL AND document_number IS NOT NULL AND nationality IS NOT NULL) = b.number_of_guests)
       OR b.status = 'confirmed'
     )
  ) as visible_cards_avec_filtre_actuel;
