-- Migration pour créer l'index filtrant les réservations 'draft'
-- Cette migration doit être exécutée APRÈS add_draft_status_to_bookings.sql
-- car PostgreSQL nécessite que les nouvelles valeurs ENUM soient commitées avant utilisation

-- ✅ CORRECTION : Créer l'index avec une fonction qui vérifie si 'draft' existe
-- Si 'draft' n'existe pas encore, l'index sera créé sans la clause WHERE

DO $$
BEGIN
  -- Vérifier si 'draft' existe dans l'ENUM booking_status
  IF EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'draft' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    -- Si 'draft' existe, créer l'index avec la clause WHERE
    CREATE INDEX IF NOT EXISTS idx_bookings_non_draft 
    ON public.bookings (property_id, check_in_date, check_out_date) 
    WHERE status != 'draft';
    
    COMMENT ON INDEX idx_bookings_non_draft IS 'Index pour exclure les réservations draft (non validées) des requêtes du calendrier';
  ELSE
    -- Si 'draft' n'existe pas encore, créer un index simple (sans filtre)
    -- Cet index sera mis à jour automatiquement une fois 'draft' ajouté
    CREATE INDEX IF NOT EXISTS idx_bookings_non_draft 
    ON public.bookings (property_id, check_in_date, check_out_date);
    
    COMMENT ON INDEX idx_bookings_non_draft IS 'Index pour les réservations (sera mis à jour avec filtre draft une fois la valeur ajoutée)';
    
    RAISE NOTICE 'Index créé sans filtre draft - la valeur draft n''existe pas encore dans l''ENUM';
  END IF;
END $$;

