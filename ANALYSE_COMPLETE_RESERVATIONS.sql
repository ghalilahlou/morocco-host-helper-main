-- 📊 ANALYSE COMPLÈTE ET DIAGNOSTIC DES RÉSERVATIONS
-- Cette requête permet d'analyser en profondeur l'état des réservations,
-- identifier les réservations ICS vs indépendantes, détecter les conflits,
-- et vérifier l'adaptation aux fonctionnalités complètes

-- =====================================================
-- 1. IDENTIFICATION RÉSERVATIONS ICS vs INDÉPENDANTES
-- =====================================================

-- ✅ DÉTECTION PRÉCISE : Identifier le type de réservation
WITH booking_classification AS (
  SELECT 
    b.id,
    b.booking_reference,
    b.status,
    b.check_in_date,
    b.check_out_date,
    b.property_id,
    b.created_at,
    b.updated_at,
    b.guest_name,
    b.number_of_guests,
    b.documents_generated,
    
    -- 🔍 CLASSIFICATION : Type de réservation
    CASE 
      -- Réservation ICS : booking_reference existe et n'est pas INDEPENDENT_BOOKING
      -- ET correspond à un format Airbnb (HM, CL, etc.) ou UID
      WHEN b.booking_reference IS NOT NULL 
        AND b.booking_reference != 'INDEPENDENT_BOOKING'
        AND (
          -- Format code Airbnb (HMxxxxxxxx, CLxxxxxxxx, etc.)
          b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
          -- OU format UID Airbnb
          OR b.booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
        )
        -- ET pas de guests complets (caractéristique des réservations ICS non terminées)
        AND NOT EXISTS (
          SELECT 1 FROM public.guests g 
          WHERE g.booking_id = b.id 
            AND g.full_name IS NOT NULL 
            AND g.document_number IS NOT NULL 
            AND g.nationality IS NOT NULL
        )
      THEN 'ICS_NON_TERMINEE'
      
      -- Réservation ICS terminée : même critères mais avec guests complets
      WHEN b.booking_reference IS NOT NULL 
        AND b.booking_reference != 'INDEPENDENT_BOOKING'
        AND (
          b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
          OR b.booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
        )
        AND EXISTS (
          SELECT 1 FROM public.guests g 
          WHERE g.booking_id = b.id 
            AND g.full_name IS NOT NULL 
            AND g.document_number IS NOT NULL 
            AND g.nationality IS NOT NULL
        )
      THEN 'ICS_TERMINEE'
      
      -- Réservation indépendante : booking_reference = 'INDEPENDENT_BOOKING' ou NULL
      WHEN b.booking_reference = 'INDEPENDENT_BOOKING' OR b.booking_reference IS NULL
      THEN 'INDEPENDANTE'
      
      -- Réservation Airbnb directe (depuis table airbnb_reservations)
      WHEN EXISTS (
        SELECT 1 FROM public.airbnb_reservations ar
        WHERE (
          ar.airbnb_confirmation_code = b.booking_reference
          OR UPPER(REGEXP_REPLACE(COALESCE(ar.airbnb_confirmation_code, ''), '\s+', '', 'g')) = UPPER(REGEXP_REPLACE(b.booking_reference, '\s+', '', 'g'))
        )
          AND ar.property_id = b.property_id
      )
      THEN 'AIRBNB_DIRECTE'
      
      ELSE 'TYPE_INCONNU'
    END as reservation_type,
    
    -- 📄 ÉTAT DES DOCUMENTS
    CASE 
      WHEN (b.documents_generated->>'contract')::boolean = true 
        OR b.documents_generated->>'contractUrl' IS NOT NULL
      THEN true
      ELSE false
    END as has_contract,
    
    CASE 
      WHEN (b.documents_generated->>'policeForm')::boolean = true 
        OR (b.documents_generated->>'police')::boolean = true
        OR b.documents_generated->>'policeUrl' IS NOT NULL
      THEN true
      ELSE false
    END as has_police,
    
    -- 👥 ÉTAT DES GUESTS
    (SELECT COUNT(*) FROM public.guests g 
     WHERE g.booking_id = b.id 
       AND g.full_name IS NOT NULL 
       AND g.document_number IS NOT NULL 
       AND g.nationality IS NOT NULL
    ) as complete_guests_count,
    
    (SELECT COUNT(*) FROM public.guests g WHERE g.booking_id = b.id) as total_guests_count,
    
    -- 📄 DOCUMENTS DANS AUTRES TABLES
    (SELECT COUNT(*) FROM public.uploaded_documents ud 
     WHERE ud.booking_id = b.id 
       AND ud.document_type IN ('contract', 'police', 'identity')
    ) as uploaded_docs_count,
    
    (SELECT COUNT(*) FROM public.generated_documents gd 
     WHERE gd.booking_id = b.id 
       AND gd.document_type IN ('contract', 'police', 'identity')
    ) as generated_docs_count,
    
    (SELECT COUNT(*) FROM public.guest_submissions gs 
     WHERE gs.booking_id = b.id
    ) as guest_submissions_count
    
  FROM public.bookings b
)

-- ✅ RÉSULTAT PRINCIPAL : Vue d'ensemble avec classification
SELECT 
  id,
  booking_reference,
  status,
  reservation_type,
  check_in_date,
  check_out_date,
  property_id,
  guest_name,
  number_of_guests,
  created_at,
  updated_at,
  
  -- 📊 ÉTAT COMPLET
  has_contract,
  has_police,
  complete_guests_count,
  total_guests_count,
  uploaded_docs_count,
  generated_docs_count,
  guest_submissions_count,
  
  -- 🔍 DIAGNOSTIC COMPLET
  CASE 
    WHEN status = 'completed' 
      AND has_contract = true 
      AND has_police = true 
      AND complete_guests_count > 0
    THEN '✅ COMPLÈTE - Tous les documents et guests présents'
    
    WHEN status = 'completed' 
      AND (has_contract = true OR has_police = true)
      AND complete_guests_count > 0
    THEN '⚠️ COMPLÈTE PARTIELLE - Documents ou guests manquants'
    
    WHEN status = 'completed' 
      AND (uploaded_docs_count > 0 OR generated_docs_count > 0 OR guest_submissions_count > 0)
    THEN '⚠️ COMPLÈTE - Documents dans autres tables (à synchroniser)'
    
    WHEN status = 'completed' 
      AND complete_guests_count = 0
      AND uploaded_docs_count = 0
      AND generated_docs_count = 0
    THEN '❌ COMPLÈTE VIDE - Aucun document ni guest (ancienne réservation)'
    
    WHEN reservation_type = 'ICS_NON_TERMINEE'
    THEN '🔵 ICS NON TERMINÉE - En attente de soumission formulaire'
    
    WHEN reservation_type = 'ICS_TERMINEE'
      AND (has_contract = true OR has_police = true)
    THEN '✅ ICS TERMINÉE - Documents générés'
    
    WHEN reservation_type = 'ICS_TERMINEE'
      AND complete_guests_count > 0
    THEN '✅ ICS TERMINÉE - Guests complets (documents à générer)'
    
    WHEN reservation_type = 'INDEPENDANTE'
      AND status = 'pending'
      AND complete_guests_count = 0
    THEN '⏳ INDÉPENDANTE EN ATTENTE - Pas encore de guests'
    
    WHEN reservation_type = 'INDEPENDANTE'
      AND complete_guests_count > 0
    THEN '✅ INDÉPENDANTE - Guests présents'
    
    ELSE '⏳ ' || status || ' - ' || reservation_type
  END as diagnostic_complet,
  
  -- 🔍 CONFLITS POTENTIELS
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.id != booking_classification.id
        AND b2.property_id = booking_classification.property_id
        AND b2.check_in_date = booking_classification.check_in_date
        AND b2.check_out_date = booking_classification.check_out_date
        AND b2.status != 'archived'
    )
    THEN '⚠️ CONFLIT - Dates identiques avec autre réservation'
    ELSE '✅ PAS DE CONFLIT'
  END as conflit_dates

FROM booking_classification
ORDER BY 
  CASE reservation_type
    WHEN 'ICS_NON_TERMINEE' THEN 1
    WHEN 'ICS_TERMINEE' THEN 2
    WHEN 'INDEPENDANTE' THEN 3
    ELSE 4
  END,
  check_out_date DESC,
  created_at DESC;

-- =====================================================
-- 2. DÉTECTION DES CONFLITS ENTRE RÉSERVATIONS
-- =====================================================

-- ✅ CONFLITS : Réservations avec mêmes dates et propriété
SELECT 
  b1.id as booking_1_id,
  b1.booking_reference as booking_1_reference,
  b1.status as booking_1_status,
  b1.created_at as booking_1_created,
  b2.id as booking_2_id,
  b2.booking_reference as booking_2_reference,
  b2.status as booking_2_status,
  b2.created_at as booking_2_created,
  b1.property_id,
  b1.check_in_date,
  b1.check_out_date,
  
  -- 🔍 TYPE DE CONFLIT
  CASE 
    WHEN b1.booking_reference = 'INDEPENDENT_BOOKING' 
      AND b2.booking_reference != 'INDEPENDENT_BOOKING'
      AND b2.booking_reference IS NOT NULL
    THEN '⚠️ CONFLIT ICS vs INDÉPENDANTE'
    
    WHEN b1.booking_reference != 'INDEPENDENT_BOOKING'
      AND b1.booking_reference IS NOT NULL
      AND b2.booking_reference = 'INDEPENDENT_BOOKING'
    THEN '⚠️ CONFLIT ICS vs INDÉPENDANTE (inversé)'
    
    WHEN b1.booking_reference = b2.booking_reference
      AND b1.booking_reference != 'INDEPENDENT_BOOKING'
    THEN '⚠️ DOUBLON - Même code de réservation'
    
    WHEN b1.booking_reference = 'INDEPENDENT_BOOKING'
      AND b2.booking_reference = 'INDEPENDENT_BOOKING'
    THEN '⚠️ DOUBLON - Deux réservations indépendantes'
    
    ELSE '⚠️ CONFLIT - Dates identiques'
  END as type_conflit,
  
  -- 🔍 RÉSOLUTION RECOMMANDÉE
  CASE 
    WHEN b1.booking_reference != 'INDEPENDENT_BOOKING'
      AND b1.booking_reference IS NOT NULL
      AND b2.booking_reference = 'INDEPENDENT_BOOKING'
      AND b1.status = 'pending'
      AND b2.status = 'completed'
    THEN '✅ FUSIONNER - Garder booking_2 (completed), supprimer booking_1 (ICS pending)'
    
    WHEN b1.booking_reference = 'INDEPENDENT_BOOKING'
      AND b2.booking_reference != 'INDEPENDENT_BOOKING'
      AND b2.booking_reference IS NOT NULL
      AND b1.status = 'pending'
      AND b2.status = 'completed'
    THEN '✅ FUSIONNER - Garder booking_2 (completed), supprimer booking_1 (indépendante pending)'
    
    WHEN b1.created_at < b2.created_at
      AND b1.status = 'pending'
      AND b2.status = 'completed'
    THEN '✅ FUSIONNER - Garder booking_2 (plus récent et completed), supprimer booking_1'
    
    WHEN b1.status = 'completed'
      AND b2.status = 'pending'
    THEN '✅ FUSIONNER - Garder booking_1 (completed), supprimer booking_2 (pending)'
    
    ELSE '⚠️ ANALYSER MANUELLEMENT - Conflit complexe'
  END as resolution_recommandee

FROM public.bookings b1
INNER JOIN public.bookings b2 
  ON b1.property_id = b2.property_id
  AND b1.check_in_date = b2.check_in_date
  AND b1.check_out_date = b2.check_out_date
  AND b1.id < b2.id  -- Éviter les doublons
  AND b1.status != 'archived'
  AND b2.status != 'archived'
ORDER BY b1.check_out_date DESC, b1.created_at DESC;

-- =====================================================
-- 3. VÉRIFICATION ADAPTATION FONCTIONNALITÉS COMPLÈTES
-- =====================================================

-- ✅ VÉRIFICATION : Réservations adaptées aux fonctionnalités complètes
SELECT 
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  
  -- 📄 DOCUMENTS : Vérifier présence dans toutes les sources
  CASE 
    WHEN (b.documents_generated->>'contract')::boolean = true 
      OR b.documents_generated->>'contractUrl' IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id AND document_type = 'contract')
      OR EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id AND document_type = 'contract')
    THEN true
    ELSE false
  END as contract_present,
  
  CASE 
    WHEN (b.documents_generated->>'policeForm')::boolean = true 
      OR (b.documents_generated->>'police')::boolean = true
      OR b.documents_generated->>'policeUrl' IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id AND document_type = 'police')
      OR EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id AND document_type = 'police')
    THEN true
    ELSE false
  END as police_present,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id AND document_type IN ('identity', 'identity_upload', 'id-document', 'passport'))
      OR EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id AND document_type = 'identity')
      OR EXISTS (SELECT 1 FROM public.guest_submissions gs WHERE gs.booking_id = b.id AND jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) > 0)
    THEN true
    ELSE false
  END as identity_present,
  
  -- 👥 GUESTS : Vérifier présence et complétude
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.guests g 
      WHERE g.booking_id = b.id 
        AND g.full_name IS NOT NULL 
        AND g.document_number IS NOT NULL 
        AND g.nationality IS NOT NULL
    )
    THEN true
    ELSE false
  END as guests_complete,
  
  -- 📋 GUEST SUBMISSIONS : Vérifier soumission formulaire
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.guest_submissions WHERE booking_id = b.id)
    THEN true
    ELSE false
  END as has_guest_submission,
  
  -- 🔍 ADAPTATION COMPLÈTE
  CASE 
    WHEN status = 'completed'
      AND contract_present = true
      AND police_present = true
      AND identity_present = true
      AND guests_complete = true
    THEN '✅ ADAPTÉE - Tous les éléments présents'
    
    WHEN status = 'completed'
      AND (contract_present = true OR police_present = true)
      AND guests_complete = true
    THEN '⚠️ PARTIELLEMENT ADAPTÉE - Documents ou identité manquants'
    
    WHEN status = 'completed'
      AND guests_complete = false
    THEN '❌ NON ADAPTÉE - Guests manquants'
    
    WHEN status = 'pending'
      AND guests_complete = true
    THEN '⏳ EN COURS - Guests présents, documents à générer'
    
    WHEN status = 'pending'
      AND guests_complete = false
    THEN '⏳ EN ATTENTE - Guests à ajouter'
    
    ELSE '❓ ÉTAT INCONNU'
  END as adaptation_status,
  
  -- 📊 SCORE DE COMPLÉTUDE (0-100)
  (
    (CASE WHEN contract_present THEN 25 ELSE 0 END) +
    (CASE WHEN police_present THEN 25 ELSE 0 END) +
    (CASE WHEN identity_present THEN 25 ELSE 0 END) +
    (CASE WHEN guests_complete THEN 25 ELSE 0 END)
  ) as completeness_score

FROM public.bookings b
ORDER BY 
  completeness_score ASC,  -- Les moins complètes en premier
  check_out_date DESC;

-- =====================================================
-- 4. HISTORIQUE ET SUIVI DES RÉSERVATIONS SUPPRIMÉES
-- =====================================================

-- ✅ RECOMMANDATION : Créer une table d'audit pour les réservations supprimées
-- Cette requête vérifie si une table d'audit existe, sinon propose sa création

-- Vérifier si la table bookings_audit existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings_audit'
  ) THEN
    RAISE NOTICE '⚠️ Table bookings_audit n''existe pas - Création recommandée';
    
    -- Script de création (à exécuter séparément)
    /*
    CREATE TABLE public.bookings_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL,
      action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
      old_data JSONB,
      new_data JSONB,
      changed_by UUID REFERENCES auth.users(id),
      changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      reason TEXT
    );
    
    CREATE INDEX idx_bookings_audit_booking_id ON public.bookings_audit(booking_id);
    CREATE INDEX idx_bookings_audit_changed_at ON public.bookings_audit(changed_at);
    */
  ELSE
    RAISE NOTICE '✅ Table bookings_audit existe';
  END IF;
END $$;

-- ✅ ANALYSE : Réservations avec historique complet (si table audit existe)
-- Cette requête fonctionne si bookings_audit existe
SELECT 
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  
  -- Historique des modifications (si table audit existe)
  (SELECT COUNT(*) FROM public.bookings_audit ba 
   WHERE ba.booking_id = b.id
  ) as modification_count,
  
  (SELECT jsonb_agg(jsonb_build_object(
    'action', ba.action,
    'changed_at', ba.changed_at,
    'reason', ba.reason
  ) ORDER BY ba.changed_at DESC)
   FROM public.bookings_audit ba 
   WHERE ba.booking_id = b.id
  ) as modification_history

FROM public.bookings b
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'bookings_audit')
ORDER BY b.updated_at DESC;

-- =====================================================
-- 5. RÉSUMÉ STATISTIQUE PAR TYPE DE RÉSERVATION
-- =====================================================

SELECT 
  CASE 
    WHEN booking_reference IS NOT NULL 
      AND booking_reference != 'INDEPENDENT_BOOKING'
      AND (
        booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
        OR booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
      )
    THEN 'ICS'
    WHEN booking_reference = 'INDEPENDENT_BOOKING' OR booking_reference IS NULL
    THEN 'INDÉPENDANTE'
    ELSE 'AUTRE'
  END as type_reservation,
  
  status,
  COUNT(*) as total,
  
  -- Documents
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
  
  -- Guests
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.guests g 
    WHERE g.booking_id = bookings.id 
      AND g.full_name IS NOT NULL 
      AND g.document_number IS NOT NULL 
      AND g.nationality IS NOT NULL
  )) as with_complete_guests,
  
  -- Conflits
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.bookings b2
    WHERE b2.id != bookings.id
      AND b2.property_id = bookings.property_id
      AND b2.check_in_date = bookings.check_in_date
      AND b2.check_out_date = bookings.check_out_date
      AND b2.status != 'archived'
  )) as with_conflicts,
  
  -- Ancienneté
  COUNT(*) FILTER (WHERE check_out_date < CURRENT_DATE - INTERVAL '30 days') as older_than_30_days,
  COUNT(*) FILTER (WHERE check_out_date >= CURRENT_DATE) as future

FROM public.bookings
GROUP BY 
  CASE 
    WHEN booking_reference IS NOT NULL 
      AND booking_reference != 'INDEPENDENT_BOOKING'
      AND (
        booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
        OR booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
      )
    THEN 'ICS'
    WHEN booking_reference = 'INDEPENDENT_BOOKING' OR booking_reference IS NULL
    THEN 'INDÉPENDANTE'
    ELSE 'AUTRE'
  END,
  status
ORDER BY type_reservation, status;

-- =====================================================
-- 6. RECOMMANDATIONS POUR RÉSOLUTION DES CONFLITS
-- =====================================================

-- ✅ ACTIONS RECOMMANDÉES : Réservations à fusionner ou nettoyer
SELECT 
  'FUSIONNER' as action_type,
  b1.id as booking_to_keep,
  b2.id as booking_to_remove,
  b1.booking_reference as reference_to_keep,
  b2.booking_reference as reference_to_remove,
  b1.property_id,
  b1.check_in_date,
  b1.check_out_date,
  'Garder booking_1 (completed), supprimer booking_2 (pending/duplicate)' as raison
FROM public.bookings b1
INNER JOIN public.bookings b2 
  ON b1.property_id = b2.property_id
  AND b1.check_in_date = b2.check_in_date
  AND b1.check_out_date = b2.check_out_date
  AND b1.id < b2.id
  AND b1.status = 'completed'
  AND b2.status = 'pending'
  AND b1.status != 'archived'
  AND b2.status != 'archived'

UNION ALL

SELECT 
  'NETTOYER' as action_type,
  b.id as booking_to_keep,
  NULL as booking_to_remove,
  b.booking_reference as reference_to_keep,
  NULL as reference_to_remove,
  b.property_id,
  b.check_in_date,
  b.check_out_date,
  'Réservation completed sans documents ni guests - Ancienne réservation à archiver' as raison
FROM public.bookings b
WHERE b.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.guests g 
    WHERE g.booking_id = b.id 
      AND g.full_name IS NOT NULL 
      AND g.document_number IS NOT NULL 
      AND g.nationality IS NOT NULL
  )
  AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id)
  AND (
    documents_generated IS NULL
    OR (
      (documents_generated->>'contract')::boolean IS NOT TRUE
      AND documents_generated->>'contractUrl' IS NULL
      AND (documents_generated->>'policeForm')::boolean IS NOT TRUE
      AND (documents_generated->>'police')::boolean IS NOT TRUE
    )
  )
  AND b.check_out_date < CURRENT_DATE - INTERVAL '30 days'  -- Anciennes seulement

ORDER BY action_type, check_out_date DESC;

