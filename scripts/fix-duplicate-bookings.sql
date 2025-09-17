-- ✅ SCRIPT: Nettoyage des réservations dupliquées et prévention des futurs doublons
-- Ce script identifie et fusionne les réservations en double créées par le processus de soumission d'invités

-- 1. Identifier les réservations potentiellement dupliquées
-- (même propriété, mêmes dates, même utilisateur)
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as booking_count,
    array_agg(id ORDER BY created_at) as booking_ids,
    array_agg(status ORDER BY created_at) as statuses,
    array_agg(booking_reference ORDER BY created_at) as references,
    array_agg(submission_id ORDER BY created_at) as submission_ids
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  booking_count,
  booking_ids,
  statuses,
  references,
  submission_ids
FROM duplicate_bookings
ORDER BY check_in_date DESC;

-- 2. Script de nettoyage pour les doublons (à exécuter après vérification manuelle)
-- ATTENTION: Ce script supprime les doublons - vérifiez d'abord les résultats ci-dessus

/*
-- DÉCOMMENTEZ ET ADAPTEZ SELON VOS BESOINS APRÈS VÉRIFICATION

WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as booking_count,
    array_agg(id ORDER BY created_at) as booking_ids,
    array_agg(status ORDER BY created_at) as statuses,
    array_agg(booking_reference ORDER BY created_at) as references,
    array_agg(submission_id ORDER BY created_at) as submission_ids,
    -- Garder la première réservation (la plus ancienne)
    (array_agg(id ORDER BY created_at))[1] as keep_booking_id,
    -- Supprimer les autres
    array_remove(array_agg(id ORDER BY created_at), (array_agg(id ORDER BY created_at))[1]) as delete_booking_ids
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
),
-- Fusionner les données importantes avant suppression
merge_data AS (
  SELECT 
    db.keep_booking_id,
    -- Prendre le submission_id le plus récent (non null)
    (SELECT submission_id FROM unnest(db.submission_ids) AS sid WHERE sid IS NOT NULL ORDER BY sid DESC LIMIT 1) as best_submission_id,
    -- Prendre le statut le plus avancé (completed > pending)
    CASE 
      WHEN 'completed' = ANY(db.statuses) THEN 'completed'
      WHEN 'pending' = ANY(db.statuses) THEN 'pending'
      ELSE (db.statuses)[1]
    END as best_status
  FROM duplicate_bookings db
)
-- Mettre à jour la réservation conservée avec les meilleures données
UPDATE public.bookings
SET 
  submission_id = md.best_submission_id,
  status = md.best_status::booking_status,
  updated_at = NOW()
FROM merge_data md
WHERE bookings.id = md.keep_booking_id;

-- Déplacer les invités des réservations à supprimer vers la réservation conservée
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    (array_agg(id ORDER BY created_at))[1] as keep_booking_id,
    array_remove(array_agg(id ORDER BY created_at), (array_agg(id ORDER BY created_at))[1]) as delete_booking_ids
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
UPDATE public.guests
SET booking_id = db.keep_booking_id
FROM duplicate_bookings db
WHERE guests.booking_id = ANY(db.delete_booking_ids);

-- Déplacer les signatures de contrat vers la réservation conservée
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    (array_agg(id ORDER BY created_at))[1] as keep_booking_id,
    array_remove(array_agg(id ORDER BY created_at), (array_agg(id ORDER BY created_at))[1]) as delete_booking_ids
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
UPDATE public.contract_signatures
SET booking_id = db.keep_booking_id
FROM duplicate_bookings db
WHERE contract_signatures.booking_id = ANY(db.delete_booking_ids);

-- Supprimer les réservations dupliquées (maintenant vides)
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    array_remove(array_agg(id ORDER BY created_at), (array_agg(id ORDER BY created_at))[1]) as delete_booking_ids
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
DELETE FROM public.bookings
WHERE id = ANY(
  SELECT unnest(delete_booking_ids) FROM duplicate_bookings
);

*/

-- 3. Vérification après nettoyage
SELECT 
  'Réservations restantes après nettoyage' as status,
  COUNT(*) as total_bookings
FROM public.bookings;

-- 4. Vérifier qu'il n'y a plus de doublons
WITH potential_duplicates AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as booking_count
  FROM public.bookings
  WHERE check_in_date IS NOT NULL 
    AND check_out_date IS NOT NULL
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Aucun doublon détecté'
    ELSE CONCAT('⚠️ ', COUNT(*), ' groupes de doublons encore présents')
  END as verification_result
FROM potential_duplicates;
