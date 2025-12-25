-- ========================================================
-- 🧪 TEST DE CORRECTION - Mode Simulation (DRY RUN)
-- ========================================================
-- Ce script simule la correction SANS modifier les données
-- Utilisez-le pour voir ce qui SERAIT corrigé avant d'exécuter
-- le vrai script de correction
-- ========================================================

-- ========================================================
-- SIMULATION 1 : Réservations qui seraient synchronisées depuis uploaded_documents
-- ========================================================

SELECT 
  '🔧 SIMULATION SYNC_UPLOADED_DOCS' as action,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  
  -- Documents actuels
  b.documents_generated as documents_actuels,
  
  -- Documents qui seraient ajoutés
  jsonb_build_object(
    'contract', COALESCE((b.documents_generated->>'contract')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.uploaded_documents 
      WHERE booking_id = b.id AND document_type = 'contract'
    ),
    'contractUrl', COALESCE(
      b.documents_generated->>'contractUrl',
      (SELECT document_url FROM public.uploaded_documents 
       WHERE booking_id = b.id AND document_type = 'contract' 
       ORDER BY created_at DESC LIMIT 1)
    ),
    'policeForm', COALESCE((b.documents_generated->>'policeForm')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.uploaded_documents 
      WHERE booking_id = b.id AND document_type = 'police'
    ),
    'police', COALESCE((b.documents_generated->>'police')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.uploaded_documents 
      WHERE booking_id = b.id AND document_type = 'police'
    ),
    'policeUrl', COALESCE(
      b.documents_generated->>'policeUrl',
      (SELECT document_url FROM public.uploaded_documents 
       WHERE booking_id = b.id AND document_type = 'police' 
       ORDER BY created_at DESC LIMIT 1)
    ),
    'identityUrl', COALESCE(
      b.documents_generated->>'identityUrl',
      (SELECT document_url FROM public.uploaded_documents 
       WHERE booking_id = b.id 
         AND document_type IN ('identity', 'identity_upload', 'id-document', 'passport')
       ORDER BY created_at DESC LIMIT 1)
    )
  ) as documents_apres_sync,
  
  -- Documents trouvés dans uploaded_documents
  (SELECT string_agg(DISTINCT document_type, ', ') 
   FROM public.uploaded_documents 
   WHERE booking_id = b.id
  ) as documents_trouves

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.uploaded_documents ud
    WHERE ud.booking_id = b.id
      AND ud.document_type IN ('contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport')
  )
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
    )
  )
ORDER BY b.check_out_date DESC;

-- ========================================================
-- SIMULATION 2 : Réservations qui seraient synchronisées depuis generated_documents
-- ========================================================

SELECT 
  '🔧 SIMULATION SYNC_GENERATED_DOCS' as action,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  
  -- Documents actuels
  b.documents_generated as documents_actuels,
  
  -- Documents qui seraient ajoutés
  COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
    'contract', COALESCE((b.documents_generated->>'contract')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.generated_documents 
      WHERE booking_id = b.id AND document_type = 'contract'
    ),
    'contractUrl', COALESCE(
      b.documents_generated->>'contractUrl',
      (SELECT document_url FROM public.generated_documents 
       WHERE booking_id = b.id AND document_type = 'contract' 
       ORDER BY created_at DESC LIMIT 1)
    ),
    'policeForm', COALESCE((b.documents_generated->>'policeForm')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.generated_documents 
      WHERE booking_id = b.id AND document_type = 'police'
    ),
    'police', COALESCE((b.documents_generated->>'police')::boolean, FALSE) OR EXISTS (
      SELECT 1 FROM public.generated_documents 
      WHERE booking_id = b.id AND document_type = 'police'
    ),
    'policeUrl', COALESCE(
      b.documents_generated->>'policeUrl',
      (SELECT document_url FROM public.generated_documents 
       WHERE booking_id = b.id AND document_type = 'police' 
       ORDER BY created_at DESC LIMIT 1)
    ),
    'identityUrl', COALESCE(
      b.documents_generated->>'identityUrl',
      (SELECT document_url FROM public.generated_documents 
       WHERE booking_id = b.id AND document_type = 'identity'
       ORDER BY created_at DESC LIMIT 1)
    )
  ) as documents_apres_sync,
  
  -- Documents trouvés dans generated_documents
  (SELECT string_agg(DISTINCT document_type, ', ') 
   FROM public.generated_documents 
   WHERE booking_id = b.id
  ) as documents_trouves

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.generated_documents gd
    WHERE gd.booking_id = b.id
      AND gd.document_type IN ('contract', 'police', 'identity')
  )
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
    )
  )
ORDER BY b.check_out_date DESC;

-- ========================================================
-- SIMULATION 3 : Réservations qui seraient synchronisées depuis guest_submissions
-- ========================================================

SELECT 
  '🔧 SIMULATION SYNC_GUEST_SUBMISSIONS' as action,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  
  -- Documents actuels
  b.documents_generated->>'identityUrl' as identite_actuelle,
  
  -- Identité qui serait ajoutée
  (
    SELECT gs.document_urls->0->>'url'
    FROM public.guest_submissions gs
    WHERE gs.booking_id = b.id
      AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
    ORDER BY gs.submitted_at DESC
    LIMIT 1
  ) as identite_apres_sync,
  
  -- Nombre de documents dans guest_submissions
  (SELECT COUNT(*) 
   FROM public.guest_submissions gs
   WHERE gs.booking_id = b.id
     AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
  ) as submissions_avec_docs

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.guest_submissions gs
    WHERE gs.booking_id = b.id
      AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
  )
  AND (
    b.documents_generated IS NULL
    OR b.documents_generated->>'identityUrl' IS NULL
  )
ORDER BY b.check_out_date DESC;

-- ========================================================
-- SIMULATION 4 : Réservations qui nécessiteraient génération manuelle
-- ========================================================

SELECT 
  '⚠️ SIMULATION NEEDS_GENERATION' as action,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  
  -- Nombre de guests complets
  (SELECT COUNT(*) FROM public.guests g
   WHERE g.booking_id = b.id
     AND g.full_name IS NOT NULL
     AND g.document_number IS NOT NULL
     AND g.nationality IS NOT NULL
  ) as guests_complets,
  
  -- Détail des guests
  (SELECT jsonb_agg(jsonb_build_object(
    'nom', g.full_name,
    'document', g.document_number,
    'nationalite', g.nationality
  ))
   FROM public.guests g
   WHERE g.booking_id = b.id
     AND g.full_name IS NOT NULL
     AND g.document_number IS NOT NULL
     AND g.nationality IS NOT NULL
  ) as guests_details,
  
  'Générer contrat et police à partir des guests' as action_requise

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.booking_id = b.id
      AND g.full_name IS NOT NULL
      AND g.document_number IS NOT NULL
      AND g.nationality IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.uploaded_documents 
    WHERE booking_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.generated_documents 
    WHERE booking_id = b.id
  )
ORDER BY b.check_out_date DESC;

-- ========================================================
-- SIMULATION 5 : Anciennes réservations qui seraient marquées
-- ========================================================

SELECT 
  '🗑️ SIMULATION OLD_EMPTY_BOOKING' as action,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  
  -- Âge de la réservation
  CURRENT_DATE - b.check_out_date as jours_depuis_checkout,
  
  -- Ce qui serait ajouté
  jsonb_build_object(
    '_old_empty_booking', true,
    '_flagged_for_review', true,
    '_flagged_at', NOW()::text
  ) as flag_qui_serait_ajoute,
  
  'Ancienne réservation vide - à supprimer manuellement si nécessaire' as action_requise

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
  AND b.check_out_date < CURRENT_DATE - INTERVAL '90 days'
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
      AND (b.documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (b.documents_generated->>'police')::boolean IS NOT TRUE
      AND b.documents_generated->>'policeUrl' IS NULL
      AND b.documents_generated->>'identityUrl' IS NULL
    )
  )
  AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM public.guest_submissions WHERE booking_id = b.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.guests 
    WHERE booking_id = b.id 
      AND full_name IS NOT NULL 
      AND document_number IS NOT NULL
  )
ORDER BY b.check_out_date DESC;

-- ========================================================
-- RÉSUMÉ DE LA SIMULATION
-- ========================================================

SELECT 
  '📊 RÉSUMÉ DE LA SIMULATION' as section,
  
  (SELECT COUNT(*) FROM public.bookings b
   WHERE b.status IN ('completed', 'confirmed')
   AND EXISTS (
     SELECT 1 FROM public.uploaded_documents ud
     WHERE ud.booking_id = b.id
       AND ud.document_type IN ('contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport')
   )
   AND (
     b.documents_generated IS NULL
     OR (
       (b.documents_generated->>'contract')::boolean IS NOT TRUE
       AND b.documents_generated->>'contractUrl' IS NULL
     )
   )
  ) as sync_uploaded_docs,
  
  (SELECT COUNT(*) FROM public.bookings b
   WHERE b.status IN ('completed', 'confirmed')
   AND EXISTS (
     SELECT 1 FROM public.generated_documents gd
     WHERE gd.booking_id = b.id
       AND gd.document_type IN ('contract', 'police', 'identity')
   )
   AND (
     b.documents_generated IS NULL
     OR (
       (b.documents_generated->>'contract')::boolean IS NOT TRUE
       AND b.documents_generated->>'contractUrl' IS NULL
     )
   )
  ) as sync_generated_docs,
  
  (SELECT COUNT(*) FROM public.bookings b
   WHERE b.status IN ('completed', 'confirmed')
   AND EXISTS (
     SELECT 1 FROM public.guest_submissions gs
     WHERE gs.booking_id = b.id
       AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
   )
   AND (
     b.documents_generated IS NULL
     OR b.documents_generated->>'identityUrl' IS NULL
   )
  ) as sync_guest_submissions,
  
  (SELECT COUNT(*) FROM public.bookings b
   WHERE b.status IN ('completed', 'confirmed')
   AND (
     b.documents_generated IS NULL
     OR (
       (b.documents_generated->>'contract')::boolean IS NOT TRUE
       AND b.documents_generated->>'contractUrl' IS NULL
     )
   )
   AND EXISTS (
     SELECT 1 FROM public.guests g
     WHERE g.booking_id = b.id
       AND g.full_name IS NOT NULL
       AND g.document_number IS NOT NULL
       AND g.nationality IS NOT NULL
   )
   AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id)
  ) as needs_generation,
  
  (SELECT COUNT(*) FROM public.bookings b
   WHERE b.status IN ('completed', 'confirmed')
   AND b.check_out_date < CURRENT_DATE - INTERVAL '90 days'
   AND (
     b.documents_generated IS NULL
     OR (
       (b.documents_generated->>'contract')::boolean IS NOT TRUE
       AND b.documents_generated->>'contractUrl' IS NULL
       AND (b.documents_generated->>'policeForm')::boolean IS NOT TRUE
       AND (b.documents_generated->>'police')::boolean IS NOT TRUE
       AND b.documents_generated->>'policeUrl' IS NULL
       AND b.documents_generated->>'identityUrl' IS NULL
     )
   )
   AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM public.guest_submissions WHERE booking_id = b.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.guests 
     WHERE booking_id = b.id 
       AND full_name IS NOT NULL 
       AND document_number IS NOT NULL
   )
  ) as old_empty_bookings;
