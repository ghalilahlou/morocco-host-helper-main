-- 📊 INSPECTION COMPLÈTE DES RÉSERVATIONS
-- Cette requête permet d'analyser l'état de toutes les réservations
-- et d'identifier les réservations terminées avec ou sans documents

-- ✅ VUE D'ENSEMBLE : Toutes les réservations avec leur statut et documents
SELECT 
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.number_of_guests,
  b.created_at,
  b.updated_at,
  
  -- 📄 Documents générés (depuis documents_generated)
  b.documents_generated,
  (b.documents_generated->>'contract')::boolean as has_contract_flag,
  (b.documents_generated->>'policeForm')::boolean as has_police_flag,
  (b.documents_generated->>'police')::boolean as has_police_alt_flag,
  b.documents_generated->>'contractUrl' as contract_url,
  b.documents_generated->>'policeUrl' as police_url,
  b.documents_generated->>'identityUrl' as identity_url,
  
  -- 👥 Guests associés
  COUNT(DISTINCT g.id) as guests_count,
  COUNT(DISTINCT CASE 
    WHEN g.full_name IS NOT NULL 
      AND g.document_number IS NOT NULL 
      AND g.nationality IS NOT NULL 
    THEN g.id 
  END) as complete_guests_count,
  
  -- 📄 Documents uploadés
  COUNT(DISTINCT ud.id) FILTER (WHERE ud.document_type = 'contract') as uploaded_contracts,
  COUNT(DISTINCT ud.id) FILTER (WHERE ud.document_type = 'police') as uploaded_police,
  COUNT(DISTINCT ud.id) FILTER (WHERE ud.document_type IN ('identity', 'identity_upload', 'id-document', 'passport')) as uploaded_identity,
  
  -- 📄 Documents générés (table generated_documents)
  COUNT(DISTINCT gd.id) FILTER (WHERE gd.document_type = 'contract') as generated_contracts,
  COUNT(DISTINCT gd.id) FILTER (WHERE gd.document_type = 'police') as generated_police,
  COUNT(DISTINCT gd.id) FILTER (WHERE gd.document_type = 'identity') as generated_identity,
  
  -- 📋 Guest submissions (Meet Guest Info)
  COUNT(DISTINCT gs.id) as guest_submissions_count,
  CASE 
    WHEN COUNT(DISTINCT gs.id) > 0 THEN jsonb_agg(DISTINCT gs.document_urls) 
    ELSE '[]'::jsonb 
  END as guest_submissions_document_urls,
  
  -- 🔍 Indicateurs de validation
  CASE 
    WHEN b.status = 'completed' 
      AND (
        (b.documents_generated->>'contract')::boolean = true 
        OR b.documents_generated->>'contractUrl' IS NOT NULL
        OR COUNT(DISTINCT ud.id) FILTER (WHERE ud.document_type = 'contract') > 0
        OR COUNT(DISTINCT gd.id) FILTER (WHERE gd.document_type = 'contract') > 0
      )
      AND (
        (b.documents_generated->>'policeForm')::boolean = true 
        OR (b.documents_generated->>'police')::boolean = true
        OR b.documents_generated->>'policeUrl' IS NOT NULL
        OR COUNT(DISTINCT ud.id) FILTER (WHERE ud.document_type = 'police') > 0
        OR COUNT(DISTINCT gd.id) FILTER (WHERE gd.document_type = 'police') > 0
      )
    THEN '✅ Validée avec documents'
    WHEN b.status = 'completed' 
      AND COUNT(DISTINCT CASE 
        WHEN g.full_name IS NOT NULL 
          AND g.document_number IS NOT NULL 
          AND g.nationality IS NOT NULL 
        THEN g.id 
      END) > 0
    THEN '✅ Validée avec guests complets'
    WHEN b.status = 'completed' THEN '⚠️ Terminée sans documents ni guests'
    WHEN b.status = 'pending' 
      AND b.booking_reference IS NOT NULL 
      AND b.booking_reference != 'INDEPENDENT_BOOKING'
      AND COUNT(DISTINCT CASE 
        WHEN g.full_name IS NOT NULL 
          AND g.document_number IS NOT NULL 
          AND g.nationality IS NOT NULL 
        THEN g.id 
      END) = 0
    THEN '🔵 ICS non terminée'
    ELSE '⏳ ' || b.status
  END as validation_status,
  
  -- 📅 Ancienneté
  CASE 
    WHEN b.check_out_date < CURRENT_DATE - INTERVAL '30 days' THEN 'Ancienne (>30j)'
    WHEN b.check_out_date < CURRENT_DATE - INTERVAL '7 days' THEN 'Récente (7-30j)'
    WHEN b.check_out_date < CURRENT_DATE THEN 'En cours'
    WHEN b.check_in_date <= CURRENT_DATE AND b.check_out_date >= CURRENT_DATE THEN 'Active'
    ELSE 'Future'
  END as age_category

FROM public.bookings b
LEFT JOIN public.guests g ON g.booking_id = b.id
LEFT JOIN public.uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN public.generated_documents gd ON gd.booking_id = b.id
LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id

GROUP BY b.id, b.booking_reference, b.status, b.check_in_date, b.check_out_date, 
         b.number_of_guests, b.created_at, b.updated_at, b.documents_generated

ORDER BY 
  b.status DESC,
  b.check_out_date DESC,
  b.created_at DESC;

-- ✅ RÉSUMÉ PAR STATUT : Vue d'ensemble rapide
SELECT 
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE documents_generated IS NOT NULL 
    AND (
      (documents_generated->>'contract')::boolean = true 
      OR documents_generated->>'contractUrl' IS NOT NULL
    )
  ) as with_contract,
  COUNT(*) FILTER (WHERE documents_generated IS NOT NULL 
    AND (
      (documents_generated->>'policeForm')::boolean = true 
      OR (documents_generated->>'police')::boolean = true
      OR documents_generated->>'policeUrl' IS NOT NULL
    )
  ) as with_police,
  COUNT(*) FILTER (WHERE booking_reference IS NOT NULL 
    AND booking_reference != 'INDEPENDENT_BOOKING'
  ) as with_airbnb_code,
  COUNT(*) FILTER (WHERE check_out_date < CURRENT_DATE - INTERVAL '30 days') as older_than_30_days
FROM public.bookings
GROUP BY status
ORDER BY status;

-- ✅ RÉSERVATIONS TERMINÉES SANS DOCUMENTS : À inspecter
SELECT 
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  b.documents_generated,
  
  -- Vérifier si des documents existent dans d'autres tables
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id) as uploaded_docs_count,
  (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = b.id) as generated_docs_count,
  (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) as guest_submissions_count,
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id 
    AND full_name IS NOT NULL 
    AND document_number IS NOT NULL 
    AND nationality IS NOT NULL
  ) as complete_guests_count,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id) > 0 
      OR (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = b.id) > 0
      OR (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) > 0
    THEN '⚠️ Documents dans autres tables'
    WHEN (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id 
      AND full_name IS NOT NULL 
      AND document_number IS NOT NULL 
      AND nationality IS NOT NULL
    ) > 0
    THEN '✅ Guests complets mais pas de documents'
    ELSE '❌ Aucun document ni guest complet'
  END as diagnostic

FROM public.bookings b
WHERE b.status = 'completed'
  AND (
    -- Pas de documents dans documents_generated
    documents_generated IS NULL
    OR (
      (documents_generated->>'contract')::boolean IS NOT TRUE
      AND documents_generated->>'contractUrl' IS NULL
      AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (documents_generated->>'police')::boolean IS NOT TRUE
      AND documents_generated->>'policeUrl' IS NULL
    )
  )
ORDER BY b.check_out_date DESC, b.created_at DESC;

-- ✅ DÉTAILS D'UNE RÉSERVATION SPÉCIFIQUE : Remplacer 'BOOKING_ID' par l'ID de la réservation
/*
SELECT 
  b.*,
  jsonb_agg(DISTINCT jsonb_build_object(
    'id', g.id,
    'full_name', g.full_name,
    'document_number', g.document_number,
    'nationality', g.nationality,
    'complete', CASE 
      WHEN g.full_name IS NOT NULL 
        AND g.document_number IS NOT NULL 
        AND g.nationality IS NOT NULL 
      THEN true 
      ELSE false 
    END
  )) FILTER (WHERE g.id IS NOT NULL) as guests,
  jsonb_agg(DISTINCT jsonb_build_object(
    'id', ud.id,
    'document_type', ud.document_type,
    'document_url', ud.document_url,
    'file_path', ud.file_path,
    'is_signed', ud.is_signed
  )) FILTER (WHERE ud.id IS NOT NULL) as uploaded_documents,
  jsonb_agg(DISTINCT jsonb_build_object(
    'id', gd.id,
    'document_type', gd.document_type,
    'document_url', gd.document_url,
    'is_signed', gd.is_signed
  )) FILTER (WHERE gd.id IS NOT NULL) as generated_documents,
  jsonb_agg(DISTINCT jsonb_build_object(
    'id', gs.id,
    'document_urls', gs.document_urls,
    'submitted_at', gs.submitted_at
  )) FILTER (WHERE gs.id IS NOT NULL) as guest_submissions
FROM public.bookings b
LEFT JOIN public.guests g ON g.booking_id = b.id
LEFT JOIN public.uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN public.generated_documents gd ON gd.booking_id = b.id
LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id
WHERE b.id = 'BOOKING_ID'  -- ⚠️ REMPLACER PAR L'ID DE LA RÉSERVATION
GROUP BY b.id;
*/

