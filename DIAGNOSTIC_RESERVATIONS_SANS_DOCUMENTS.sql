-- ========================================================
-- 🔍 DIAGNOSTIC COMPLET : RÉSERVATIONS SANS DOCUMENTS
-- ========================================================
-- Objectif : Identifier et corriger les réservations terminées/confirmées
-- qui ne contiennent aucun document (police, contrat, pièce d'identité)
-- 
-- Auteur : Diagnostic automatique
-- Date : 2025-12-25
-- ========================================================

-- ========================================================
-- 1. INSPECTION GLOBALE : Vue d'ensemble du problème
-- ========================================================

-- 📊 STATISTIQUES GÉNÉRALES
SELECT 
  '📊 STATISTIQUES GÉNÉRALES' as section,
  COUNT(*) as total_reservations,
  COUNT(*) FILTER (WHERE status IN ('completed', 'confirmed')) as completed_confirmed_count,
  COUNT(*) FILTER (
    WHERE status IN ('completed', 'confirmed')
    AND (
      documents_generated IS NULL
      OR (
        (documents_generated->>'contract')::boolean IS NOT TRUE
        AND documents_generated->>'contractUrl' IS NULL
        AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
        AND (documents_generated->>'police')::boolean IS NOT TRUE
        AND documents_generated->>'policeUrl' IS NULL
        AND documents_generated->>'identityUrl' IS NULL
      )
    )
  ) as completed_sans_documents,
  
  -- Pourcentage de réservations problématiques
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE status IN ('completed', 'confirmed')
      AND (
        documents_generated IS NULL
        OR (
          (documents_generated->>'contract')::boolean IS NOT TRUE
          AND documents_generated->>'contractUrl' IS NULL
          AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
          AND (documents_generated->>'police')::boolean IS NOT TRUE
          AND documents_generated->>'policeUrl' IS NULL
          AND documents_generated->>'identityUrl' IS NULL
        )
      )
    ) / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'confirmed')), 0),
    2
  ) as pourcentage_problematique

FROM public.bookings;

-- ========================================================
-- 2. LISTE DÉTAILLÉE : Réservations problématiques
-- ========================================================

-- 🔍 RÉSERVATIONS COMPLETED/CONFIRMED SANS DOCUMENTS
WITH problematic_bookings AS (
  SELECT 
    b.id,
    b.booking_reference,
    b.status,
    b.check_in_date,
    b.check_out_date,
    b.guest_name,
    b.number_of_guests,
    b.created_at,
    b.updated_at,
    b.documents_generated,
    
    -- Vérifier présence dans autres tables
    (SELECT COUNT(*) FROM public.uploaded_documents ud 
     WHERE ud.booking_id = b.id 
       AND ud.document_type IN ('contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport')
    ) as uploaded_docs_count,
    
    (SELECT COUNT(*) FROM public.generated_documents gd 
     WHERE gd.booking_id = b.id 
       AND gd.document_type IN ('contract', 'police', 'identity')
    ) as generated_docs_count,
    
    (SELECT COUNT(*) FROM public.guest_submissions gs 
     WHERE gs.booking_id = b.id
    ) as guest_submissions_count,
    
    (SELECT COUNT(*) FROM public.guests g 
     WHERE g.booking_id = b.id 
       AND g.full_name IS NOT NULL 
       AND g.document_number IS NOT NULL 
       AND g.nationality IS NOT NULL
    ) as complete_guests_count,
    
    (SELECT COUNT(*) FROM public.guests g 
     WHERE g.booking_id = b.id
    ) as total_guests_count
    
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
)

SELECT 
  '🔍 RÉSERVATIONS PROBLÉMATIQUES' as section,
  id,
  booking_reference,
  status,
  check_in_date,
  check_out_date,
  guest_name,
  number_of_guests,
  created_at,
  updated_at,
  
  -- Diagnostic détaillé
  CASE 
    WHEN uploaded_docs_count > 0 OR generated_docs_count > 0 OR guest_submissions_count > 0
    THEN '⚠️ DOCUMENTS DANS AUTRES TABLES - Synchronisation nécessaire'
    
    WHEN complete_guests_count > 0
    THEN '⚠️ GUESTS COMPLETS - Documents à générer'
    
    WHEN total_guests_count > 0
    THEN '⚠️ GUESTS INCOMPLETS - Informations manquantes'
    
    ELSE '❌ AUCUNE DONNÉE - Réservation vide'
  END as diagnostic,
  
  -- Détails des documents trouvés
  uploaded_docs_count,
  generated_docs_count,
  guest_submissions_count,
  complete_guests_count,
  total_guests_count,
  
  -- Score de récupérabilité (0-100)
  (
    (CASE WHEN uploaded_docs_count > 0 THEN 30 ELSE 0 END) +
    (CASE WHEN generated_docs_count > 0 THEN 30 ELSE 0 END) +
    (CASE WHEN guest_submissions_count > 0 THEN 20 ELSE 0 END) +
    (CASE WHEN complete_guests_count > 0 THEN 20 ELSE 0 END)
  ) as recuperabilite_score,
  
  -- Action recommandée
  CASE 
    WHEN uploaded_docs_count > 0 OR generated_docs_count > 0
    THEN '✅ SYNCHRONISER - Copier documents vers documents_generated'
    
    WHEN complete_guests_count > 0
    THEN '✅ GÉNÉRER - Créer documents à partir des guests'
    
    WHEN total_guests_count > 0
    THEN '⚠️ COMPLÉTER - Demander informations manquantes'
    
    WHEN check_out_date < CURRENT_DATE - INTERVAL '90 days'
    THEN '🗑️ ARCHIVER - Ancienne réservation sans données'
    
    ELSE '⚠️ ANALYSER - Cas complexe'
  END as action_recommandee

FROM problematic_bookings
ORDER BY 
  recuperabilite_score DESC,
  check_out_date DESC;

-- ========================================================
-- 3. ANALYSE PAR TYPE DE PROBLÈME
-- ========================================================

-- 📊 RÉPARTITION PAR TYPE DE PROBLÈME
SELECT 
  '📊 RÉPARTITION PAR TYPE' as section,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id) > 0 
      OR (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = b.id) > 0
    THEN 'Documents dans autres tables'
    
    WHEN (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id 
          AND full_name IS NOT NULL 
          AND document_number IS NOT NULL 
          AND nationality IS NOT NULL) > 0
    THEN 'Guests complets sans documents'
    
    WHEN (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id) > 0
    THEN 'Guests incomplets'
    
    ELSE 'Aucune donnée'
  END as type_probleme,
  
  COUNT(*) as nombre_reservations,
  
  -- Ancienneté
  COUNT(*) FILTER (WHERE check_out_date < CURRENT_DATE - INTERVAL '90 days') as anciennes_90j,
  COUNT(*) FILTER (WHERE check_out_date >= CURRENT_DATE - INTERVAL '90 days' 
                   AND check_out_date < CURRENT_DATE - INTERVAL '30 days') as anciennes_30_90j,
  COUNT(*) FILTER (WHERE check_out_date >= CURRENT_DATE - INTERVAL '30 days') as recentes_30j

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
GROUP BY type_probleme
ORDER BY nombre_reservations DESC;

-- ========================================================
-- 4. DÉTAILS DES DOCUMENTS DANS AUTRES TABLES
-- ========================================================

-- 📄 DOCUMENTS TROUVÉS DANS uploaded_documents
SELECT 
  '📄 UPLOADED_DOCUMENTS' as section,
  b.id as booking_id,
  b.booking_reference,
  b.status,
  ud.id as document_id,
  ud.document_type,
  ud.document_url,
  ud.file_path,
  ud.is_signed,
  ud.created_at as document_created_at,
  
  '✅ Copier vers documents_generated' as action

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
ORDER BY b.check_out_date DESC, ud.created_at DESC;

-- 📄 DOCUMENTS TROUVÉS DANS generated_documents
SELECT 
  '📄 GENERATED_DOCUMENTS' as section,
  b.id as booking_id,
  b.booking_reference,
  b.status,
  gd.id as document_id,
  gd.document_type,
  gd.document_url,
  gd.is_signed,
  gd.created_at as document_created_at,
  
  '✅ Copier vers documents_generated' as action

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
ORDER BY b.check_out_date DESC, gd.created_at DESC;

-- 📄 GUEST SUBMISSIONS AVEC DOCUMENTS
SELECT 
  '📄 GUEST_SUBMISSIONS' as section,
  b.id as booking_id,
  b.booking_reference,
  b.status,
  gs.id as submission_id,
  gs.document_urls,
  gs.submitted_at,
  
  '✅ Extraire URLs vers documents_generated' as action

FROM public.bookings b
INNER JOIN public.guest_submissions gs ON gs.booking_id = b.id
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
  AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0
ORDER BY b.check_out_date DESC, gs.submitted_at DESC;

-- ========================================================
-- 5. SCRIPT DE CORRECTION AUTOMATIQUE
-- ========================================================

-- ⚠️ ATTENTION : Ce script modifie les données !
-- Exécuter uniquement après validation manuelle

-- 🔧 CORRECTION 1 : Synchroniser uploaded_documents vers documents_generated
/*
UPDATE public.bookings b
SET documents_generated = jsonb_build_object(
  'contract', EXISTS (
    SELECT 1 FROM public.uploaded_documents 
    WHERE booking_id = b.id AND document_type = 'contract'
  ),
  'contractUrl', (
    SELECT document_url FROM public.uploaded_documents 
    WHERE booking_id = b.id AND document_type = 'contract' 
    ORDER BY created_at DESC LIMIT 1
  ),
  'policeForm', EXISTS (
    SELECT 1 FROM public.uploaded_documents 
    WHERE booking_id = b.id AND document_type = 'police'
  ),
  'police', EXISTS (
    SELECT 1 FROM public.uploaded_documents 
    WHERE booking_id = b.id AND document_type = 'police'
  ),
  'policeUrl', (
    SELECT document_url FROM public.uploaded_documents 
    WHERE booking_id = b.id AND document_type = 'police' 
    ORDER BY created_at DESC LIMIT 1
  ),
  'identityUrl', (
    SELECT document_url FROM public.uploaded_documents 
    WHERE booking_id = b.id 
      AND document_type IN ('identity', 'identity_upload', 'id-document', 'passport')
    ORDER BY created_at DESC LIMIT 1
  )
)
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
*/

-- 🔧 CORRECTION 2 : Synchroniser generated_documents vers documents_generated
/*
UPDATE public.bookings b
SET documents_generated = COALESCE(b.documents_generated, '{}'::jsonb) || jsonb_build_object(
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
)
WHERE b.status IN ('completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.generated_documents gd
    WHERE gd.booking_id = b.id
      AND gd.document_type IN ('contract', 'police', 'identity')
  );
*/

-- 🔧 CORRECTION 3 : Archiver anciennes réservations vides (>90 jours)
/*
UPDATE public.bookings
SET status = 'archived',
    updated_at = NOW()
WHERE status IN ('completed', 'confirmed')
  AND check_out_date < CURRENT_DATE - INTERVAL '90 days'
  AND (
    documents_generated IS NULL
    OR (
      (documents_generated->>'contract')::boolean IS NOT TRUE
      AND documents_generated->>'contractUrl' IS NULL
      AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (documents_generated->>'police')::boolean IS NOT TRUE
      AND documents_generated->>'policeUrl' IS NULL
      AND documents_generated->>'identityUrl' IS NULL
    )
  )
  AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = bookings.id)
  AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = bookings.id)
  AND NOT EXISTS (SELECT 1 FROM public.guest_submissions WHERE booking_id = bookings.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.guests 
    WHERE booking_id = bookings.id 
      AND full_name IS NOT NULL 
      AND document_number IS NOT NULL
  );
*/

-- ========================================================
-- 6. VÉRIFICATION POST-CORRECTION
-- ========================================================

-- 📊 VÉRIFICATION : Compter les réservations encore problématiques
SELECT 
  '📊 VÉRIFICATION POST-CORRECTION' as section,
  COUNT(*) as total_completed_confirmed,
  COUNT(*) FILTER (
    WHERE (
      documents_generated IS NULL
      OR (
        (documents_generated->>'contract')::boolean IS NOT TRUE
        AND documents_generated->>'contractUrl' IS NULL
        AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
        AND (documents_generated->>'police')::boolean IS NOT TRUE
        AND documents_generated->>'policeUrl' IS NULL
        AND documents_generated->>'identityUrl' IS NULL
      )
    )
  ) as encore_sans_documents,
  
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
  ) as avec_tous_documents

FROM public.bookings
WHERE status IN ('completed', 'confirmed');

-- ========================================================
-- 7. RAPPORT FINAL
-- ========================================================

-- 📋 RAPPORT : Résumé de l'état actuel
SELECT 
  '📋 RAPPORT FINAL' as section,
  status,
  COUNT(*) as total,
  
  -- Documents complets
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
  
  -- Pourcentage de complétude
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
