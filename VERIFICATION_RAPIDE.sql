-- ========================================================
-- 📊 VÉRIFICATION RAPIDE - État des Réservations
-- ========================================================
-- Exécutez cette requête AVANT et APRÈS la correction
-- pour comparer les résultats
-- ========================================================

-- 📊 STATISTIQUES GLOBALES
SELECT 
  '📊 VUE D''ENSEMBLE' as section,
  status,
  COUNT(*) as total_reservations,
  
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
  ) as avec_tous_documents,
  
  -- Au moins un document
  COUNT(*) FILTER (
    WHERE (
      (documents_generated->>'contract')::boolean = TRUE
      OR documents_generated->>'contractUrl' IS NOT NULL
      OR (documents_generated->>'policeForm')::boolean = TRUE
      OR (documents_generated->>'police')::boolean = TRUE
      OR documents_generated->>'policeUrl' IS NOT NULL
      OR documents_generated->>'identityUrl' IS NOT NULL
    )
  ) as avec_au_moins_un_document,
  
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
  ) as sans_aucun_document,
  
  -- Pourcentages
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
  ) as pourcentage_complet,
  
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE documents_generated IS NULL
      OR (
        (documents_generated->>'contract')::boolean IS NOT TRUE
        AND documents_generated->>'contractUrl' IS NULL
        AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
        AND (documents_generated->>'police')::boolean IS NOT TRUE
        AND documents_generated->>'policeUrl' IS NULL
        AND documents_generated->>'identityUrl' IS NULL
      )
    ) / NULLIF(COUNT(*), 0),
    2
  ) as pourcentage_vide

FROM public.bookings
WHERE status IN ('completed', 'confirmed')
GROUP BY status
ORDER BY status;

-- 📋 DÉTAIL PAR TYPE DE DOCUMENT
SELECT 
  '📋 DÉTAIL PAR DOCUMENT' as section,
  status,
  COUNT(*) as total,
  
  -- Contrat
  COUNT(*) FILTER (
    WHERE (documents_generated->>'contract')::boolean = TRUE
    OR documents_generated->>'contractUrl' IS NOT NULL
  ) as avec_contrat,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE (documents_generated->>'contract')::boolean = TRUE
      OR documents_generated->>'contractUrl' IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    1
  ) as pct_contrat,
  
  -- Police
  COUNT(*) FILTER (
    WHERE (documents_generated->>'policeForm')::boolean = TRUE
    OR (documents_generated->>'police')::boolean = TRUE
    OR documents_generated->>'policeUrl' IS NOT NULL
  ) as avec_police,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE (documents_generated->>'policeForm')::boolean = TRUE
      OR (documents_generated->>'police')::boolean = TRUE
      OR documents_generated->>'policeUrl' IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    1
  ) as pct_police,
  
  -- Identité
  COUNT(*) FILTER (
    WHERE documents_generated->>'identityUrl' IS NOT NULL
  ) as avec_identite,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE documents_generated->>'identityUrl' IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    1
  ) as pct_identite

FROM public.bookings
WHERE status IN ('completed', 'confirmed')
GROUP BY status
ORDER BY status;

-- 🔍 TOP 10 RÉSERVATIONS SANS DOCUMENTS (les plus récentes)
SELECT 
  '🔍 TOP 10 SANS DOCUMENTS' as section,
  id,
  booking_reference,
  status,
  check_in_date,
  check_out_date,
  guest_name,
  
  -- Vérifier si données dans autres tables
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = bookings.id) as uploaded_docs,
  (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = bookings.id) as generated_docs,
  (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = bookings.id) as submissions,
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = bookings.id) as guests,
  
  -- Diagnostic rapide
  CASE 
    WHEN (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = bookings.id) > 0
      OR (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = bookings.id) > 0
    THEN '⚠️ Docs dans autres tables'
    WHEN (SELECT COUNT(*) FROM public.guests WHERE booking_id = bookings.id 
          AND full_name IS NOT NULL AND document_number IS NOT NULL) > 0
    THEN '✅ Guests complets'
    WHEN (SELECT COUNT(*) FROM public.guests WHERE booking_id = bookings.id) > 0
    THEN '⚠️ Guests incomplets'
    ELSE '❌ Aucune donnée'
  END as diagnostic

FROM public.bookings
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
ORDER BY check_out_date DESC
LIMIT 10;

-- 📊 RÉSUMÉ COMPARATIF (à exécuter avant et après)
SELECT 
  '📊 RÉSUMÉ COMPARATIF' as section,
  NOW() as date_verification,
  
  (SELECT COUNT(*) FROM public.bookings WHERE status IN ('completed', 'confirmed')) as total_completed_confirmed,
  
  (SELECT COUNT(*) FROM public.bookings 
   WHERE status IN ('completed', 'confirmed')
   AND (
     (documents_generated->>'contract')::boolean = TRUE
     OR documents_generated->>'contractUrl' IS NOT NULL
   )
   AND (
     (documents_generated->>'policeForm')::boolean = TRUE
     OR (documents_generated->>'police')::boolean = TRUE
     OR documents_generated->>'policeUrl' IS NOT NULL
   )
   AND documents_generated->>'identityUrl' IS NOT NULL
  ) as avec_tous_documents,
  
  (SELECT COUNT(*) FROM public.bookings 
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
  ) as sans_aucun_document,
  
  ROUND(
    100.0 * (SELECT COUNT(*) FROM public.bookings 
     WHERE status IN ('completed', 'confirmed')
     AND (
       (documents_generated->>'contract')::boolean = TRUE
       OR documents_generated->>'contractUrl' IS NOT NULL
     )
     AND (
       (documents_generated->>'policeForm')::boolean = TRUE
       OR (documents_generated->>'police')::boolean = TRUE
       OR documents_generated->>'policeUrl' IS NOT NULL
     )
     AND documents_generated->>'identityUrl' IS NOT NULL
    ) / NULLIF((SELECT COUNT(*) FROM public.bookings WHERE status IN ('completed', 'confirmed')), 0),
    2
  ) as taux_completude,
  
  ROUND(
    100.0 * (SELECT COUNT(*) FROM public.bookings 
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
    ) / NULLIF((SELECT COUNT(*) FROM public.bookings WHERE status IN ('completed', 'confirmed')), 0),
    2
  ) as taux_vide;
