-- Migration optionnelle pour mettre à jour l'index avec le filtre 'draft'
-- À exécuter APRÈS que 'draft' ait été ajouté à l'ENUM et commité
-- Cette migration recrée l'index avec la clause WHERE pour exclure les drafts

-- ✅ DÉFENSIF : Vérifier si 'draft' existe avant de créer l'index avec filtre
DO $$
BEGIN
  -- Vérifier si 'draft' existe dans l'ENUM booking_status
  IF EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'draft' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    -- Supprimer l'ancien index s'il existe
    DROP INDEX IF EXISTS idx_bookings_non_draft;
    
    -- Recréer l'index avec le filtre draft
    CREATE INDEX idx_bookings_non_draft 
    ON public.bookings (property_id, check_in_date, check_out_date) 
    WHERE status != 'draft';
    
    -- Commenter l'index
    COMMENT ON INDEX idx_bookings_non_draft IS 'Index pour exclure les réservations draft (non validées) des requêtes du calendrier';
    
    RAISE NOTICE 'Index créé avec succès avec filtre draft';
  ELSE
    RAISE NOTICE 'La valeur "draft" n''existe pas encore dans l''ENUM booking_status. Veuillez d''abord exécuter add_draft_status_to_bookings.sql';
  END IF;
END $$;

