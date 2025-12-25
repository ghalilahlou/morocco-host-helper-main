-- ========================================================
-- 🔧 CORRECTION AUTOMATIQUE DES RÉSERVATIONS SANS DOCUMENTS
-- ========================================================
-- Ce script corrige les 28 réservations sans documents en :
-- 1. Synchronisant les documents depuis uploaded_documents
-- 2. Synchronisant les documents depuis generated_documents  
-- 3. Synchronisant les documents depuis guest_submissions
-- 4. Archivant les anciennes réservations vides
-- ========================================================

-- ========================================================
-- ÉTAPE 1 : ANALYSE PRÉ-CORRECTION
-- ========================================================

-- Créer une table temporaire pour suivre les corrections
CREATE TEMP TABLE IF NOT EXISTS corrections_log (
  booking_id UUID,
  booking_reference TEXT,
  action TEXT,
  source_table TEXT,
  documents_found TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ========================================================
-- ÉTAPE 2 : SYNCHRONISATION DEPUIS uploaded_documents
-- ========================================================

-- 🔍 D'abord, identifier les réservations concernées
INSERT INTO corrections_log (booking_id, booking_reference, action, source_table, documents_found)
SELECT 
  b.id,
  b.booking_reference,
  'SYNC_UPLOADED_DOCS',
  'uploaded_documents',
  string_agg(DISTINCT ud.document_type, ', ')
FROM public.bookings b
INNER JOIN public.uploaded_documents ud ON ud.booking_id = b.id
WHERE b.status IN ('completed', 'confirmed')
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
      AND (b.documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (b.documents_generated->>'police')::boolean IS NOT TRUE
      AND b.documents_generated->>'policeUrl' IS NULL
    )
  )
  AND ud.document_type IN ('contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport')
GROUP BY b.id, b.booking_reference;

-- 🔧 Appliquer la correction
UPDATE public.bookings b
SET 
  documents_generated = COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
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
  ),
  updated_at = NOW()
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
  );

-- ========================================================
-- ÉTAPE 3 : SYNCHRONISATION DEPUIS generated_documents
-- ========================================================

-- 🔍 Identifier les réservations concernées
INSERT INTO corrections_log (booking_id, booking_reference, action, source_table, documents_found)
SELECT 
  b.id,
  b.booking_reference,
  'SYNC_GENERATED_DOCS',
  'generated_documents',
  string_agg(DISTINCT gd.document_type, ', ')
FROM public.bookings b
INNER JOIN public.generated_documents gd ON gd.booking_id = b.id
WHERE b.status IN ('completed', 'confirmed')
  AND (
    b.documents_generated IS NULL
    OR (
      (b.documents_generated->>'contract')::boolean IS NOT TRUE
      AND b.documents_generated->>'contractUrl' IS NULL
      AND (b.documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (b.documents_generated->>'police')::boolean IS NOT TRUE
      AND b.documents_generated->>'policeUrl' IS NULL
    )
  )
  AND gd.document_type IN ('contract', 'police', 'identity')
GROUP BY b.id, b.booking_reference;

-- 🔧 Appliquer la correction
UPDATE public.bookings b
SET 
  documents_generated = COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
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
  ),
  updated_at = NOW()
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
  );

-- ========================================================
-- ÉTAPE 4 : SYNCHRONISATION DEPUIS guest_submissions
-- ========================================================

-- 🔍 Identifier les réservations avec guest_submissions
INSERT INTO corrections_log (booking_id, booking_reference, action, source_table, documents_found)
SELECT 
  b.id,
  b.booking_reference,
  'SYNC_GUEST_SUBMISSIONS',
  'guest_submissions',
  'identity documents from submissions'
FROM public.bookings b
INNER JOIN public.guest_submissions gs ON gs.booking_id = b.id
WHERE b.status IN ('completed', 'confirmed')
  AND (
    b.documents_generated IS NULL
    OR b.documents_generated->>'identityUrl' IS NULL
  )
  AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0;

-- 🔧 Appliquer la correction pour les pièces d'identité depuis guest_submissions
UPDATE public.bookings b
SET 
  documents_generated = COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
    'identityUrl', (
      SELECT gs.document_urls->0->>'url'
      FROM public.guest_submissions gs
      WHERE gs.booking_id = b.id
        AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
      ORDER BY gs.submitted_at DESC
      LIMIT 1
    )
  ),
  updated_at = NOW()
WHERE b.status IN ('completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.guest_submissions gs
    WHERE gs.booking_id = b.id
      AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
  )
  AND (
    b.documents_generated IS NULL
    OR b.documents_generated->>'identityUrl' IS NULL
  );

-- ========================================================
-- ÉTAPE 5 : MARQUER RÉSERVATIONS NÉCESSITANT GÉNÉRATION
-- ========================================================

-- Pour les réservations avec guests complets mais sans documents
-- On ajoute un flag pour indiquer qu'il faut générer les documents

INSERT INTO corrections_log (booking_id, booking_reference, action, source_table, documents_found)
SELECT 
  b.id,
  b.booking_reference,
  'NEEDS_GENERATION',
  'guests',
  'complete guests found - documents need generation'
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
  );

-- ========================================================
-- ÉTAPE 6 : IDENTIFIER ANCIENNES RÉSERVATIONS VIDES (>90 jours)
-- ========================================================

-- ⚠️ NOTE : Au lieu d'archiver, on identifie simplement ces réservations
-- Vous pourrez décider manuellement si vous voulez les supprimer ou les garder

-- Identifier les réservations de plus de 90 jours sans aucune donnée
INSERT INTO corrections_log (booking_id, booking_reference, action, source_table, documents_found)
SELECT 
  b.id,
  b.booking_reference,
  'OLD_EMPTY_BOOKING',
  'none',
  'old booking (>90 days) with no data - consider manual deletion'
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
  );

-- 🗑️ OPTION A : Supprimer directement (décommentez si vous voulez supprimer)
/*
DELETE FROM public.bookings b
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
  );
*/

-- 📝 OPTION B : Marquer avec un flag dans documents_generated (recommandé)
UPDATE public.bookings b
SET 
  documents_generated = COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
    '_old_empty_booking', true,
    '_flagged_for_review', true,
    '_flagged_at', NOW()::text
  ),
  updated_at = NOW()
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
  );

-- ========================================================
-- ÉTAPE 7 : RAPPORT DE CORRECTION
-- ========================================================

-- 📊 Résumé des corrections appliquées
SELECT 
  '📊 RÉSUMÉ DES CORRECTIONS' as section,
  action,
  source_table,
  COUNT(*) as nombre_reservations,
  string_agg(DISTINCT booking_reference, ', ') as references
FROM corrections_log
GROUP BY action, source_table
ORDER BY 
  CASE action
    WHEN 'SYNC_UPLOADED_DOCS' THEN 1
    WHEN 'SYNC_GENERATED_DOCS' THEN 2
    WHEN 'SYNC_GUEST_SUBMISSIONS' THEN 3
    WHEN 'NEEDS_GENERATION' THEN 4
    WHEN 'ARCHIVED' THEN 5
  END;

-- 📋 Détail des corrections par réservation
SELECT 
  '📋 DÉTAIL DES CORRECTIONS' as section,
  booking_id,
  booking_reference,
  action,
  source_table,
  documents_found,
  timestamp
FROM corrections_log
ORDER BY timestamp DESC;

-- ========================================================
-- ÉTAPE 8 : VÉRIFICATION POST-CORRECTION
-- ========================================================

-- 📊 État après correction
SELECT 
  '📊 ÉTAT APRÈS CORRECTION' as section,
  status,
  COUNT(*) as total,
  
  -- Documents complets (police + contrat + identité)
  COUNT(*) FILTER (
    WHERE (
      (documents_generated->>'contract')::boolean = TRUE
      OR documents_generated->>'contractUrl' IS NOT NULL
    )
    AND (
      (documents_generated->>'policeForm')::boolean = TRUE
      OR (documents_generated->>'police')::boolean = TRUE
      OR documents_generated->>'policeUrl' IS NOT NULL
    )
    AND documents_generated->>'identityUrl' IS NOT NULL
  ) as documents_complets,
  
  -- Documents partiels
  COUNT(*) FILTER (
    WHERE (
      (documents_generated->>'contract')::boolean = TRUE
      OR documents_generated->>'contractUrl' IS NOT NULL
      OR (documents_generated->>'policeForm')::boolean = TRUE
      OR (documents_generated->>'police')::boolean = TRUE
      OR documents_generated->>'policeUrl' IS NOT NULL
      OR documents_generated->>'identityUrl' IS NOT NULL
    )
    AND NOT (
      (
        (documents_generated->>'contract')::boolean = TRUE
        OR documents_generated->>'contractUrl' IS NOT NULL
      )
      AND (
        (documents_generated->>'policeForm')::boolean = TRUE
        OR (documents_generated->>'police')::boolean = TRUE
        OR documents_generated->>'policeUrl' IS NOT NULL
      )
      AND documents_generated->>'identityUrl' IS NOT NULL
    )
  ) as documents_partiels,
  
  -- Aucun document
  COUNT(*) FILTER (
    WHERE documents_generated IS NULL
    OR (
      (documents_generated->>'contract')::boolean IS NOT TRUE
      AND documents_generated->>'contractUrl' IS NULL
      AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (documents_generated->>'police')::boolean IS NOT TRUE
      AND documents_generated->>'policeUrl' IS NULL
      AND documents_generated->>'identityUrl' IS NULL
    )
  ) as aucun_document,
  
  -- Amélioration
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE (
        (documents_generated->>'contract')::boolean = TRUE
        OR documents_generated->>'contractUrl' IS NOT NULL
      )
      AND (
        (documents_generated->>'policeForm')::boolean = TRUE
        OR (documents_generated->>'police')::boolean = TRUE
        OR documents_generated->>'policeUrl' IS NOT NULL
      )
      AND documents_generated->>'identityUrl' IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    2
  ) as pourcentage_completude

FROM public.bookings
WHERE status IN ('completed', 'confirmed')
GROUP BY status
ORDER BY status;

-- 📋 Liste des réservations nécessitant encore une action manuelle
SELECT 
  '📋 RÉSERVATIONS NÉCESSITANT ACTION MANUELLE' as section,
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  
  -- Diagnostic
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.booking_id = b.id
        AND g.full_name IS NOT NULL
        AND g.document_number IS NOT NULL
        AND g.nationality IS NOT NULL
    )
    THEN '⚠️ GÉNÉRER DOCUMENTS - Guests complets présents'
    
    WHEN EXISTS (SELECT 1 FROM public.guests WHERE booking_id = b.id)
    THEN '⚠️ COMPLÉTER GUESTS - Informations manquantes'
    
    WHEN b.check_out_date >= CURRENT_DATE - INTERVAL '90 days'
    THEN '⚠️ RÉCENTE - Contacter le client pour documents'
    
    ELSE '❓ ANALYSER - Cas complexe'
  END as action_requise,
  
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id) as guests_count,
  (SELECT COUNT(*) FROM public.guests g 
   WHERE g.booking_id = b.id 
     AND g.full_name IS NOT NULL 
     AND g.document_number IS NOT NULL
  ) as complete_guests_count

FROM public.bookings b
WHERE b.status IN ('completed', 'confirmed')
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
ORDER BY 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.booking_id = b.id
        AND g.full_name IS NOT NULL
        AND g.document_number IS NOT NULL
        AND g.nationality IS NOT NULL
    ) THEN 1
    WHEN EXISTS (SELECT 1 FROM public.guests WHERE booking_id = b.id) THEN 2
    ELSE 3
  END,
  b.check_out_date DESC;

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS corrections_log;
