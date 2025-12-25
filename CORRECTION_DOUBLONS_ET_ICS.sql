-- ========================================================
-- 🔧 CORRECTION SPÉCIFIQUE - Doublons et Réservations ICS
-- ========================================================
-- Basé sur les résultats de votre diagnostic
-- ========================================================

-- ========================================================
-- PARTIE 1 : ANALYSE DES DOUBLONS (Lamiaa Benmouaz)
-- ========================================================

-- 🔍 Identifier les 6 doublons
SELECT 
  '🔍 DOUBLONS DÉTECTÉS' as section,
  id,
  booking_reference,
  status,
  check_in_date,
  check_out_date,
  guest_name,
  created_at,
  updated_at,
  
  -- Guests associés
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = bookings.id) as guests_count,
  (SELECT jsonb_agg(jsonb_build_object('nom', full_name, 'document', document_number))
   FROM public.guests WHERE booking_id = bookings.id) as guests_details,
  
  -- Documents
  documents_generated,
  
  -- Recommandation
  CASE 
    WHEN created_at = (
      SELECT MIN(created_at) 
      FROM public.bookings 
      WHERE guest_name = 'Lamiaa Benmouaz'
        AND check_in_date = '2025-12-17'
        AND check_out_date = '2025-12-20'
        AND status = 'completed'
    )
    THEN '✅ GARDER - Plus ancienne'
    ELSE '🗑️ SUPPRIMER - Doublon'
  END as action

FROM public.bookings
WHERE guest_name = 'Lamiaa Benmouaz'
  AND check_in_date = '2025-12-17'
  AND check_out_date = '2025-12-20'
  AND status = 'completed'
ORDER BY created_at ASC;

-- ========================================================
-- PARTIE 2 : SUPPRESSION DES DOUBLONS
-- ========================================================

-- ⚠️ ATTENTION : Cette requête supprime les doublons !
-- Décommentez uniquement après avoir vérifié la liste ci-dessus

/*
-- Étape 1 : Identifier la réservation à garder (la plus ancienne)
WITH reservation_a_garder AS (
  SELECT id
  FROM public.bookings
  WHERE guest_name = 'Lamiaa Benmouaz'
    AND check_in_date = '2025-12-17'
    AND check_out_date = '2025-12-20'
    AND status = 'completed'
  ORDER BY created_at ASC
  LIMIT 1
)

-- Étape 2 : Supprimer les doublons (garde automatiquement les guests de la première)
DELETE FROM public.bookings
WHERE guest_name = 'Lamiaa Benmouaz'
  AND check_in_date = '2025-12-17'
  AND check_out_date = '2025-12-20'
  AND status = 'completed'
  AND id NOT IN (SELECT id FROM reservation_a_garder);

-- Vérification
SELECT 
  '✅ VÉRIFICATION APRÈS SUPPRESSION' as section,
  COUNT(*) as reservations_restantes
FROM public.bookings
WHERE guest_name = 'Lamiaa Benmouaz'
  AND check_in_date = '2025-12-17'
  AND check_out_date = '2025-12-20'
  AND status = 'completed';
*/

-- ========================================================
-- PARTIE 3 : ANALYSE DES RÉSERVATIONS ICS SANS GUESTS
-- ========================================================

-- 🔍 Pourquoi ces réservations ICS n'ont pas de guests ?
SELECT 
  '🔍 RÉSERVATIONS ICS SANS GUESTS' as section,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  b.created_at,
  
  -- Vérifier si c'est une vraie réservation Airbnb
  CASE 
    WHEN b.booking_reference ~ '^HM[A-Z0-9]{8}$' THEN '✅ Format Airbnb valide'
    WHEN b.booking_reference ~ '^UID:' THEN '✅ UID Airbnb valide'
    ELSE '⚠️ Format inconnu'
  END as format_reference,
  
  -- Vérifier dans airbnb_reservations
  EXISTS (
    SELECT 1 FROM public.airbnb_reservations ar
    WHERE ar.airbnb_confirmation_code = b.booking_reference
  ) as existe_dans_airbnb_reservations,
  
  -- Vérifier dans guest_submissions
  (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) as guest_submissions,
  
  -- Diagnostic
  CASE 
    WHEN (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) > 0
    THEN '⚠️ Guest submission existe - Guests non créés'
    
    WHEN b.status = 'completed' AND b.check_out_date < CURRENT_DATE - INTERVAL '7 days'
    THEN '❌ Terminée depuis >7j sans soumission - Client n''a pas rempli le formulaire'
    
    WHEN b.status = 'completed' AND b.check_out_date >= CURRENT_DATE - INTERVAL '7 days'
    THEN '⚠️ Récente - Attendre soumission ou relancer client'
    
    ELSE '❓ À analyser'
  END as diagnostic

FROM public.bookings b
WHERE b.id IN (
  '5297a96a-3de5-4059-8993-82dd8c26548f',
  '6e17c909-bd72-41c8-a270-2e796263d0fd',
  '0834f907-e3ce-4d6f-9981-0852f10ae927',
  '7b9c6009-6c97-4567-8f3e-1731aa7a9b61',
  'e38b5900-2821-4987-8015-f289a1005e17',
  '62ca461a-5199-4381-b708-c172bab742bd',
  '6dbf0092-a740-49d9-b8e1-f9b9429a7b69',
  '02733fc6-9889-45c4-8bf9-22c08753971b',
  '11a36a83-8b47-443c-ac2f-598599f7b61b',
  'bd635083-8351-46f4-b0c8-6a07504dbb5c',
  '6e7277b7-0835-4a89-93fc-ebc5844ab4f2',
  'd45b603e-52fb-4f54-abe9-7025954a41cc',
  'ee14bf03-28e1-409d-94f5-fc94050187db',
  '254fb274-6693-4a85-a924-df8da09bd6f2',
  'ab7180ef-088d-48ee-9b66-e1023c33a8a2',
  '7d252a60-08ad-4767-8421-28982e9bde45',
  '92a52be9-215a-4072-8f4e-62500b3dbae9',
  'da1b8835-5b05-4192-8575-e856cf328daf',
  '45105c87-802e-4f66-ae76-35b6e63c9cae',
  'e50a2ee1-cdba-4976-80a4-cab9ce180f96'
)
ORDER BY b.check_out_date DESC;

-- ========================================================
-- PARTIE 4 : VÉRIFIER LES GUEST_SUBMISSIONS
-- ========================================================

-- 🔍 Y a-t-il des guest_submissions pour ces réservations ?
SELECT 
  '🔍 GUEST SUBMISSIONS POUR ICS' as section,
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  gs.id as submission_id,
  gs.submitted_at,
  gs.document_urls,
  
  -- Extraire les données soumises
  jsonb_pretty(gs.document_urls) as documents_soumis,
  
  '⚠️ Créer guests à partir de cette submission' as action

FROM public.bookings b
LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id
WHERE b.id IN (
  '5297a96a-3de5-4059-8993-82dd8c26548f',
  '6e17c909-bd72-41c8-a270-2e796263d0fd',
  '0834f907-e3ce-4d6f-9981-0852f10ae927',
  '7b9c6009-6c97-4567-8f3e-1731aa7a9b61',
  'e38b5900-2821-4987-8015-f289a1005e17',
  '62ca461a-5199-4381-b708-c172bab742bd',
  '6dbf0092-a740-49d9-b8e1-f9b9429a7b69',
  '02733fc6-9889-45c4-8bf9-22c08753971b',
  '11a36a83-8b47-443c-ac2f-598599f7b61b',
  'bd635083-8351-46f4-b0c8-6a07504dbb5c',
  '6e7277b7-0835-4a89-93fc-ebc5844ab4f2',
  'd45b603e-52fb-4f54-abe9-7025954a41cc',
  'ee14bf03-28e1-409d-94f5-fc94050187db',
  '254fb274-6693-4a85-a924-df8da09bd6f2',
  'ab7180ef-088d-48ee-9b66-e1023c33a8a2',
  '7d252a60-08ad-4767-8421-28982e9bde45',
  '92a52be9-215a-4072-8f4e-62500b3dbae9',
  'da1b8835-5b05-4192-8575-e856cf328daf',
  '45105c87-802e-4f66-ae76-35b6e63c9cae',
  'e50a2ee1-cdba-4976-80a4-cab9ce180f96'
)
ORDER BY b.check_out_date DESC;

-- ========================================================
-- PARTIE 5 : ACTIONS RECOMMANDÉES
-- ========================================================

SELECT 
  '📋 PLAN D''ACTION RECOMMANDÉ' as section,
  action_type,
  COUNT(*) as nombre_reservations,
  description,
  priorite
FROM (
  -- Action 1 : Supprimer doublons
  SELECT 
    'SUPPRIMER_DOUBLONS' as action_type,
    'Supprimer 5 doublons de Lamiaa Benmouaz (garder la plus ancienne)' as description,
    1 as priorite
  FROM public.bookings
  WHERE guest_name = 'Lamiaa Benmouaz'
    AND check_in_date = '2025-12-17'
    AND status = 'completed'
  LIMIT 1
  
  UNION ALL
  
  -- Action 2 : Générer documents pour Lamiaa
  SELECT 
    'GENERER_DOCUMENTS' as action_type,
    'Générer contrat et police pour Lamiaa Benmouaz (après suppression doublons)' as description,
    2 as priorite
  FROM public.bookings
  WHERE guest_name = 'Lamiaa Benmouaz'
    AND check_in_date = '2025-12-17'
    AND status = 'completed'
  LIMIT 1
  
  UNION ALL
  
  -- Action 3 : Analyser réservations ICS récentes
  SELECT 
    'RELANCER_CLIENTS' as action_type,
    'Relancer clients pour ' || COUNT(*) || ' réservations ICS récentes (<30j) sans guests' as description,
    3 as priorite
  FROM public.bookings
  WHERE status = 'completed'
    AND booking_reference ~ '^(HM|UID:)'
    AND check_out_date >= CURRENT_DATE - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
  
  UNION ALL
  
  -- Action 4 : Marquer anciennes ICS sans guests
  SELECT 
    'MARQUER_ANCIENNES' as action_type,
    'Marquer ' || COUNT(*) || ' réservations ICS anciennes (>30j) sans guests pour archivage' as description,
    4 as priorite
  FROM public.bookings
  WHERE status = 'completed'
    AND booking_reference ~ '^(HM|UID:)'
    AND check_out_date < CURRENT_DATE - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
) actions
GROUP BY action_type, description, priorite
ORDER BY priorite;

-- ========================================================
-- PARTIE 6 : SCRIPT DE CORRECTION POUR LAMIAA BENMOUAZ
-- ========================================================

-- ⚠️ Décommentez cette section pour corriger automatiquement

/*
-- Étape 1 : Identifier la réservation à garder
DO $$
DECLARE
  reservation_a_garder UUID;
  doublons_supprimes INTEGER;
BEGIN
  -- Trouver la plus ancienne réservation
  SELECT id INTO reservation_a_garder
  FROM public.bookings
  WHERE guest_name = 'Lamiaa Benmouaz'
    AND check_in_date = '2025-12-17'
    AND check_out_date = '2025-12-20'
    AND status = 'completed'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RAISE NOTICE 'Réservation à garder : %', reservation_a_garder;
  
  -- Supprimer les doublons
  DELETE FROM public.bookings
  WHERE guest_name = 'Lamiaa Benmouaz'
    AND check_in_date = '2025-12-17'
    AND check_out_date = '2025-12-20'
    AND status = 'completed'
    AND id != reservation_a_garder;
  
  GET DIAGNOSTICS doublons_supprimes = ROW_COUNT;
  RAISE NOTICE 'Doublons supprimés : %', doublons_supprimes;
  
  -- Vérifier que les guests sont bien associés
  IF EXISTS (
    SELECT 1 FROM public.guests 
    WHERE booking_id = reservation_a_garder
  ) THEN
    RAISE NOTICE '✅ Guests présents pour la réservation gardée';
  ELSE
    RAISE WARNING '⚠️ Aucun guest pour la réservation gardée !';
  END IF;
  
END $$;
*/

-- ========================================================
-- PARTIE 7 : MARQUER LES RÉSERVATIONS ICS ANCIENNES
-- ========================================================

-- Marquer les réservations ICS de plus de 30 jours sans guests
-- (au lieu de les supprimer, on les marque pour révision)

/*
UPDATE public.bookings
SET 
  documents_generated = COALESCE(documents_generated, '{}'::jsonb) || jsonb_build_object(
    '_ics_sans_guests', true,
    '_ancienne_reservation', true,
    '_flagged_at', NOW()::text,
    '_raison', 'Réservation ICS >30j sans soumission client'
  ),
  updated_at = NOW()
WHERE status = 'completed'
  AND booking_reference ~ '^(HM|UID:)'
  AND check_out_date < CURRENT_DATE - INTERVAL '30 days'
  AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
  AND NOT EXISTS (SELECT 1 FROM public.guest_submissions WHERE booking_id = bookings.id);
*/

-- ========================================================
-- PARTIE 8 : RAPPORT FINAL
-- ========================================================

SELECT 
  '📊 RÉSUMÉ FINAL' as section,
  
  -- Doublons
  (SELECT COUNT(*) - 1 FROM public.bookings
   WHERE guest_name = 'Lamiaa Benmouaz'
     AND check_in_date = '2025-12-17'
     AND status = 'completed'
  ) as doublons_a_supprimer,
  
  -- Réservations ICS récentes sans guests
  (SELECT COUNT(*) FROM public.bookings
   WHERE status = 'completed'
     AND booking_reference ~ '^(HM|UID:)'
     AND check_out_date >= CURRENT_DATE - INTERVAL '30 days'
     AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
  ) as ics_recentes_sans_guests,
  
  -- Réservations ICS anciennes sans guests
  (SELECT COUNT(*) FROM public.bookings
   WHERE status = 'completed'
     AND booking_reference ~ '^(HM|UID:)'
     AND check_out_date < CURRENT_DATE - INTERVAL '30 days'
     AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
  ) as ics_anciennes_sans_guests,
  
  -- Total à traiter
  (SELECT COUNT(*) - 1 FROM public.bookings
   WHERE guest_name = 'Lamiaa Benmouaz'
     AND check_in_date = '2025-12-17'
     AND status = 'completed'
  ) + 
  (SELECT COUNT(*) FROM public.bookings
   WHERE status = 'completed'
     AND booking_reference ~ '^(HM|UID:)'
     AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = bookings.id)
  ) as total_reservations_a_traiter;
