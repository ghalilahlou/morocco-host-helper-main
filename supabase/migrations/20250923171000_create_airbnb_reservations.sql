-- Migration: Création table airbnb_reservations pour résolution codes Airbnb
-- Objectif: Stocker réservations ICS avec normalisation automatique des codes

DO $$
BEGIN
  -- 1) Créer la table si elle n'existe pas
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'airbnb_reservations'
  ) THEN
    CREATE TABLE public.airbnb_reservations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL,
      airbnb_confirmation_code text NULL,
      airbnb_code_norm text GENERATED ALWAYS AS (
        upper(regexp_replace(coalesce(airbnb_confirmation_code,''), '\s+','','g'))
      ) STORED,
      check_in_date date NOT NULL,
      check_out_date date NOT NULL,
      guest_name text NULL,
      raw jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    
    RAISE NOTICE 'Table airbnb_reservations créée';
  ELSE
    -- Ajouter les colonnes manquantes si table existe
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'airbnb_reservations' 
      AND column_name = 'airbnb_code_norm'
    ) THEN
      ALTER TABLE public.airbnb_reservations
        ADD COLUMN airbnb_code_norm text GENERATED ALWAYS AS (
          upper(regexp_replace(coalesce(airbnb_confirmation_code,''), '\s+','','g'))
        ) STORED;
      RAISE NOTICE 'Colonne airbnb_code_norm ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'airbnb_reservations' 
      AND column_name = 'raw'
    ) THEN
      ALTER TABLE public.airbnb_reservations
        ADD COLUMN raw jsonb NOT NULL DEFAULT '{}';
      RAISE NOTICE 'Colonne raw ajoutée';
    END IF;
  END IF;

  -- 2) Dédoublonnage si des doublons existent
  -- Garder la ligne la plus récente par (property_id, airbnb_code_norm)
  DELETE FROM public.airbnb_reservations a
  USING public.airbnb_reservations b
  WHERE a.id < b.id
    AND a.property_id = b.property_id
    AND a.airbnb_code_norm = b.airbnb_code_norm
    AND a.airbnb_code_norm IS NOT NULL
    AND a.airbnb_code_norm != '';

  -- 3) Créer contrainte unique si elle n'existe pas
  IF NOT EXISTS (
    SELECT FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'airbnb_reservations'
    AND c.conname = 'airbnb_reservations_property_code_unique'
  ) THEN
    ALTER TABLE public.airbnb_reservations
      ADD CONSTRAINT airbnb_reservations_property_code_unique
      UNIQUE (property_id, airbnb_code_norm);
    RAISE NOTICE 'Contrainte unique (property_id, airbnb_code_norm) créée';
  END IF;

  -- 4) Créer indexes pour performance
  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'airbnb_reservations' 
    AND indexname = 'idx_airbnb_reservations_property_checkin'
  ) THEN
    CREATE INDEX idx_airbnb_reservations_property_checkin 
      ON public.airbnb_reservations(property_id, check_in_date);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'airbnb_reservations' 
    AND indexname = 'idx_airbnb_reservations_property_checkout'
  ) THEN
    CREATE INDEX idx_airbnb_reservations_property_checkout 
      ON public.airbnb_reservations(property_id, check_out_date);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE tablename = 'airbnb_reservations' 
    AND indexname = 'idx_airbnb_reservations_code_norm'
  ) THEN
    CREATE INDEX idx_airbnb_reservations_code_norm 
      ON public.airbnb_reservations(airbnb_code_norm) 
      WHERE airbnb_code_norm IS NOT NULL AND airbnb_code_norm != '';
  END IF;

  RAISE NOTICE 'Migration airbnb_reservations terminée avec succès';
END
$$;
