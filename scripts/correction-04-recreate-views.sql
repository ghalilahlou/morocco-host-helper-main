-- ============================================================
-- CORRECTION ÉTAPE 4 : Recréer les vues sans SECURITY DEFINER
-- ============================================================

-- 4.1 Sauvegarder les définitions actuelles (pour référence)
SELECT 
    'Définitions actuelles des vues' as info,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('v_guest_submissions', 'v_booking_health')
ORDER BY viewname;

-- 4.2 Recréer v_guest_submissions sans SECURITY DEFINER
-- (Les vues sans SECURITY DEFINER utilisent SECURITY INVOKER par défaut)

-- 4.2.1 Supprimer l'ancienne vue
DROP VIEW IF EXISTS public.v_guest_submissions CASCADE;

-- 4.2.2 Créer la nouvelle vue (sans SECURITY DEFINER)
CREATE VIEW public.v_guest_submissions AS
SELECT 
    gs.*,
    pvt.property_id,
    -- Utiliser booking_id direct s'il existe, sinon résoudre via token
    COALESCE(gs.booking_id, 
        CASE 
            WHEN pvt.booking_id IS NOT NULL 
                 AND pvt.booking_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
            THEN pvt.booking_id::uuid
            ELSE NULL
        END
    ) as resolved_booking_id
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
WHERE pvt.is_active = true;

-- 4.2.3 Vérification
SELECT 
    'Vue v_guest_submissions' as vue,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'v_guest_submissions'
        )
        THEN '✅ Recréée avec succès'
        ELSE '❌ Erreur lors de la recréation'
    END as status;

-- 4.3 Recréer v_booking_health sans SECURITY DEFINER (si elle existe)
DO $view$
DECLARE
    view_exists BOOLEAN;
BEGIN
    -- Vérifier si la vue existe
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'v_booking_health'
    ) INTO view_exists;
    
    IF view_exists THEN
        -- Supprimer l'ancienne vue
        EXECUTE 'DROP VIEW IF EXISTS public.v_booking_health CASCADE';
        
        -- Recréer sans SECURITY DEFINER
        EXECUTE $view$
            CREATE VIEW public.v_booking_health AS
            SELECT 
                b.id as booking_id,
                b.property_id,
                b.user_id,
                b.status,
                b.check_in_date,
                b.check_out_date,
                COUNT(DISTINCT gs.id) as guest_submissions_count,
                COUNT(DISTINCT gd.id) as generated_documents_count,
                COUNT(DISTINCT cs.id) as contract_signatures_count,
                COUNT(DISTINCT g.id) as guests_count,
                CASE 
                    WHEN COUNT(DISTINCT cs.id) > 0 THEN true
                    ELSE false
                END as has_contract_signed
            FROM public.bookings b
            LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id
            LEFT JOIN public.generated_documents gd ON gd.booking_id = b.id
            LEFT JOIN public.contract_signatures cs ON cs.booking_id = b.id
            LEFT JOIN public.guests g ON g.booking_id = b.id
            GROUP BY b.id, b.property_id, b.user_id, b.status, b.check_in_date, b.check_out_date
        $view$;
        
        RAISE NOTICE '✅ Vue v_booking_health recréée avec succès';
    ELSE
        RAISE NOTICE 'ℹ️ Vue v_booking_health n''existe pas, création d''une nouvelle';
        
        -- Créer la vue si elle n'existe pas
        EXECUTE $view$
            CREATE VIEW public.v_booking_health AS
            SELECT 
                b.id as booking_id,
                b.property_id,
                b.user_id,
                b.status,
                b.check_in_date,
                b.check_out_date,
                COUNT(DISTINCT gs.id) as guest_submissions_count,
                COUNT(DISTINCT gd.id) as generated_documents_count,
                COUNT(DISTINCT cs.id) as contract_signatures_count,
                COUNT(DISTINCT g.id) as guests_count,
                CASE 
                    WHEN COUNT(DISTINCT cs.id) > 0 THEN true
                    ELSE false
                END as has_contract_signed
            FROM public.bookings b
            LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id
            LEFT JOIN public.generated_documents gd ON gd.booking_id = b.id
            LEFT JOIN public.contract_signatures cs ON cs.booking_id = b.id
            LEFT JOIN public.guests g ON g.booking_id = b.id
            GROUP BY b.id, b.property_id, b.user_id, b.status, b.check_in_date, b.check_out_date
        $view$;
    END IF;
END $view$;

-- 4.4 Vérification finale des vues
SELECT 
    viewname,
    CASE 
        WHEN viewname IN ('v_guest_submissions', 'v_booking_health')
        THEN '✅ Vue recréée sans SECURITY DEFINER'
        ELSE 'Autre vue'
    END as status,
    substring(definition, 1, 100) as definition_preview
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('v_guest_submissions', 'v_booking_health')
ORDER BY viewname;

