-- =============================================================================
-- Script SQL pour optimiser les performances de v_guest_submissions
-- =============================================================================
-- URGENT : Exécuter ce script dans Supabase Dashboard → SQL Editor
-- pour améliorer les performances et éviter les timeouts
-- =============================================================================

-- 1. Augmenter le temps de réponse autorisé pour les requêtes complexes
-- Cette commande augmente le timeout pour la session courante
SET statement_timeout = '15s';

-- 2. Vérifier si la table guest_submissions existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'guest_submissions'
);

-- 3. Créer un index sur booking_id pour accélérer les recherches
-- Cet index accélère les requêtes .in('resolved_booking_id', bookingIds)
CREATE INDEX IF NOT EXISTS idx_guest_submissions_booking_id 
ON public.guest_submissions(booking_id);

-- 4. Créer un index sur resolved_booking_id si la colonne existe
-- (vérifier d'abord si la colonne existe dans votre schéma)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guest_submissions' 
    AND column_name = 'resolved_booking_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_guest_submissions_resolved_booking_id 
    ON public.guest_submissions(resolved_booking_id);
    RAISE NOTICE 'Index créé sur resolved_booking_id';
  ELSE
    RAISE NOTICE 'Colonne resolved_booking_id n''existe pas, index non créé';
  END IF;
END $$;

-- 5. Créer un index composite sur (resolved_booking_id, status) pour optimiser les filtres
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guest_submissions' 
    AND column_name = 'resolved_booking_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_guest_submissions_booking_status 
    ON public.guest_submissions(resolved_booking_id, status);
    RAISE NOTICE 'Index composite créé sur (resolved_booking_id, status)';
  END IF;
END $$;

-- 6. Vérifier les index existants sur guest_submissions
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'guest_submissions'
  AND schemaname = 'public'
ORDER BY indexname;

-- 7. Analyser la table pour mettre à jour les statistiques
-- Cela aide le planificateur de requêtes à choisir les meilleurs index
ANALYZE public.guest_submissions;

-- 8. Vérifier la vue v_guest_submissions si elle existe
SELECT EXISTS (
  SELECT FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'v_guest_submissions'
);

-- =============================================================================
-- NOTES IMPORTANTES
-- =============================================================================
-- 1. Les index peuvent prendre quelques minutes à créer sur de grandes tables
-- 2. Le statement_timeout est valide uniquement pour la session courante
--    Pour le rendre permanent, utilisez ALTER DATABASE ou ALTER ROLE
-- 3. ANALYZE doit être exécuté régulièrement pour maintenir les statistiques à jour
-- =============================================================================

-- =============================================================================
-- OPTIONNEL : Rendre le timeout permanent pour un rôle spécifique
-- =============================================================================
-- ALTER ROLE authenticated SET statement_timeout = '15s';
-- =============================================================================

