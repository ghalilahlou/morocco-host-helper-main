-- 🔍 DIAGNOSTIC POUR RÉSERVATIONS NORMALES (INDÉPENDANTES)
-- Cette requête permet d'identifier les problèmes qui empêchent
-- les réservations normales de fonctionner correctement

-- =====================================================
-- 1. IDENTIFIER LES RÉSERVATIONS NORMALES BLOQUÉES
-- =====================================================

SELECT 
  b.id,
  b.booking_reference,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  b.property_id,
  
  -- 🔍 VÉRIFICATION : Est-ce vraiment une réservation normale ?
  CASE 
    WHEN b.booking_reference = 'INDEPENDENT_BOOKING' OR b.booking_reference IS NULL
    THEN '✅ INDÉPENDANTE CONFIRMÉE'
    WHEN b.booking_reference IS NOT NULL 
      AND b.booking_reference != 'INDEPENDENT_BOOKING'
      AND (
        b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
        OR b.booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
      )
    THEN '❌ ERREUR - Code Airbnb détecté (devrait être ICS)'
    ELSE '⚠️ TYPE INCERTAIN'
  END as type_verification,
  
  -- 🔍 PROBLÈMES IDENTIFIÉS
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.id != b.id
        AND b2.property_id = b.property_id
        AND b2.check_in_date = b.check_in_date
        AND b2.check_out_date = b.check_out_date
        AND b2.booking_reference IS NOT NULL
        AND b2.booking_reference != 'INDEPENDENT_BOOKING'
        AND b2.status != 'archived'
    )
    THEN '❌ CONFLIT avec réservation ICS'
    
    WHEN b.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.guests g 
        WHERE g.booking_id = b.id 
          AND g.full_name IS NOT NULL 
          AND g.document_number IS NOT NULL 
          AND g.nationality IS NOT NULL
      )
      AND b.created_at < CURRENT_DATE - INTERVAL '7 days'
    THEN '⚠️ BLOQUÉE - En attente depuis plus de 7 jours sans guests'
    
    WHEN b.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.guests g 
        WHERE g.booking_id = b.id 
          AND g.full_name IS NOT NULL 
          AND g.document_number IS NOT NULL 
          AND g.nationality IS NOT NULL
      )
      AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM public.generated_documents WHERE booking_id = b.id)
    THEN '❌ COMPLÉTÉE SANS DONNÉES - Ancienne réservation vide'
    
    ELSE '✅ PAS DE PROBLÈME DÉTECTÉ'
  END as probleme_identifie,
  
  -- 📊 ÉTAT DES DONNÉES
  (SELECT COUNT(*) FROM public.guests g 
   WHERE g.booking_id = b.id 
     AND g.full_name IS NOT NULL 
     AND g.document_number IS NOT NULL 
     AND g.nationality IS NOT NULL
  ) as complete_guests,
  
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id) as uploaded_docs,
  (SELECT COUNT(*) FROM public.generated_documents WHERE booking_id = b.id) as generated_docs,
  (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) as guest_submissions,
  
  -- 🔧 ACTION RECOMMANDÉE
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.id != b.id
        AND b2.property_id = b.property_id
        AND b2.check_in_date = b.check_in_date
        AND b2.check_out_date = b.check_out_date
        AND b2.booking_reference IS NOT NULL
        AND b2.booking_reference != 'INDEPENDENT_BOOKING'
        AND b2.status = 'completed'
    )
    THEN 'FUSIONNER - Supprimer cette réservation, garder la réservation ICS completed'
    
    WHEN b.status = 'pending'
      AND b.created_at < CURRENT_DATE - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = b.id)
    THEN 'NETTOYER - Archiver ou supprimer (en attente trop longtemps)'
    
    WHEN b.status = 'completed'
      AND NOT EXISTS (SELECT 1 FROM public.guests WHERE booking_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM public.uploaded_documents WHERE booking_id = b.id)
      AND b.check_out_date < CURRENT_DATE - INTERVAL '30 days'
    THEN 'ARCHIVER - Ancienne réservation vide'
    
    ELSE 'AUCUNE ACTION'
  END as action_recommandee

FROM public.bookings b
WHERE b.booking_reference = 'INDEPENDENT_BOOKING' 
   OR b.booking_reference IS NULL
ORDER BY 
  CASE probleme_identifie
    WHEN '❌ CONFLIT avec réservation ICS' THEN 1
    WHEN '⚠️ BLOQUÉE - En attente depuis plus de 7 jours sans guests' THEN 2
    WHEN '❌ COMPLÉTÉE SANS DONNÉES - Ancienne réservation vide' THEN 3
    ELSE 4
  END,
  b.check_out_date DESC;

-- =====================================================
-- 2. VÉRIFIER L'ADAPTATION AUX FONCTIONNALITÉS COMPLÈTES
-- =====================================================

-- ✅ CHECKLIST : Vérifier que toutes les tables nécessaires sont présentes
SELECT 
  'bookings' as table_name,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END as status,
  (SELECT COUNT(*) FROM public.bookings) as row_count
UNION ALL
SELECT 
  'guests',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'guests'
  ) THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END,
  (SELECT COUNT(*) FROM public.guests)
UNION ALL
SELECT 
  'uploaded_documents',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'uploaded_documents'
  ) THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END,
  (SELECT COUNT(*) FROM public.uploaded_documents)
UNION ALL
SELECT 
  'generated_documents',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'generated_documents'
  ) THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END,
  (SELECT COUNT(*) FROM public.generated_documents)
UNION ALL
SELECT 
  'guest_submissions',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'guest_submissions'
  ) THEN '✅ EXISTE' ELSE '❌ MANQUANTE' END,
  (SELECT COUNT(*) FROM public.guest_submissions)
UNION ALL
SELECT 
  'bookings_audit',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bookings_audit'
  ) THEN '✅ EXISTE' ELSE '⚠️ RECOMMANDÉE (pour suivi suppressions)' END,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bookings_audit'
  ) THEN (SELECT COUNT(*) FROM public.bookings_audit) ELSE 0 END;

-- =====================================================
-- 3. ANALYSE DES CONFLITS ICS vs INDÉPENDANTES
-- =====================================================

-- ✅ CONFLITS DÉTAILLÉS : Identifier précisément les conflits
SELECT 
  'CONFLIT' as type_analyse,
  b_independent.id as booking_independent_id,
  b_independent.booking_reference as independent_reference,
  b_independent.status as independent_status,
  b_independent.created_at as independent_created,
  b_ics.id as booking_ics_id,
  b_ics.booking_reference as ics_reference,
  b_ics.status as ics_status,
  b_ics.created_at as ics_created,
  b_independent.property_id,
  b_independent.check_in_date,
  b_independent.check_out_date,
  
  -- 🔍 ANALYSE DU CONFLIT
  CASE 
    WHEN b_independent.status = 'pending' 
      AND b_ics.status = 'completed'
    THEN '✅ RÉSOLUTION SIMPLE - Supprimer indépendante (pending), garder ICS (completed)'
    
    WHEN b_independent.status = 'completed' 
      AND b_ics.status = 'pending'
    THEN '⚠️ CONFLIT COMPLEXE - Indépendante completed vs ICS pending'
    
    WHEN b_independent.status = 'completed' 
      AND b_ics.status = 'completed'
    THEN '❌ DOUBLON COMPLET - Deux réservations completed pour mêmes dates'
    
    ELSE '⚠️ CONFLIT - Analyser manuellement'
  END as resolution,
  
  -- 📊 DONNÉES COMPARATIVES
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = b_independent.id) as independent_guests,
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = b_ics.id) as ics_guests,
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b_independent.id) as independent_docs,
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b_ics.id) as ics_docs

FROM public.bookings b_independent
INNER JOIN public.bookings b_ics
  ON b_independent.property_id = b_ics.property_id
  AND b_independent.check_in_date = b_ics.check_in_date
  AND b_independent.check_out_date = b_ics.check_out_date
  AND b_independent.id != b_ics.id
WHERE 
  (b_independent.booking_reference = 'INDEPENDENT_BOOKING' OR b_independent.booking_reference IS NULL)
  AND b_ics.booking_reference IS NOT NULL
  AND b_ics.booking_reference != 'INDEPENDENT_BOOKING'
  AND (
    b_ics.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]{6,12}$'
    OR b_ics.booking_reference ~ '^UID:[a-f0-9-]+@airbnb\.com$'
  )
  AND b_independent.status != 'archived'
  AND b_ics.status != 'archived'
ORDER BY b_independent.check_out_date DESC;

