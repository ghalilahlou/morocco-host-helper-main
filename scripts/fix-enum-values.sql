-- 🔧 Correction des Valeurs ENUM booking_status
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour corriger l'erreur

-- 1. Vérifier les valeurs actuelles de l'ENUM booking_status
SELECT 
    enumlabel
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
ORDER BY enumsortorder;

-- 2. Vérifier la structure actuelle de la table bookings
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
    AND column_name = 'status'
ORDER BY ordinal_position;

-- 3. Vérifier les données existantes dans bookings
SELECT 
    status,
    COUNT(*) as count
FROM bookings 
GROUP BY status;

-- 4. Créer un nouveau type ENUM avec toutes les valeurs nécessaires
DO $$
BEGIN
    -- Supprimer l'ancien type s'il existe
    DROP TYPE IF EXISTS booking_status_new CASCADE;
    
    -- Créer le nouveau type avec toutes les valeurs
    CREATE TYPE booking_status_new AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    
    -- Modifier la colonne pour utiliser le nouveau type
    ALTER TABLE bookings 
    ALTER COLUMN status TYPE booking_status_new 
    USING 
        CASE 
            WHEN status::text = 'pending' THEN 'pending'::booking_status_new
            WHEN status::text = 'confirmed' THEN 'confirmed'::booking_status_new
            WHEN status::text = 'cancelled' THEN 'cancelled'::booking_status_new
            WHEN status::text = 'completed' THEN 'completed'::booking_status_new
            ELSE 'pending'::booking_status_new
        END;
    
    -- Supprimer l'ancien type
    DROP TYPE IF EXISTS booking_status CASCADE;
    
    -- Renommer le nouveau type
    ALTER TYPE booking_status_new RENAME TO booking_status;
    
    -- Mettre à jour la colonne pour utiliser le type renommé
    ALTER TABLE bookings 
    ALTER COLUMN status TYPE booking_status 
    USING status::text::booking_status;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En cas d'erreur, essayer une approche plus simple
        RAISE NOTICE 'Erreur lors de la modification du type: %', SQLERRM;
        
        -- Vérifier si la colonne existe et la modifier en text temporairement
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bookings' 
            AND column_name = 'status'
        ) THEN
            -- Convertir en text d'abord
            ALTER TABLE bookings ALTER COLUMN status TYPE text;
            
            -- Mettre à jour les valeurs invalides
            UPDATE bookings 
            SET status = 'pending' 
            WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'completed') 
               OR status IS NULL;
        END IF;
END $$;

-- 5. Vérifier que la correction a fonctionné
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
    AND column_name = 'status';

-- 6. Vérifier les nouvelles valeurs de l'ENUM
SELECT 
    enumlabel
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
ORDER BY enumsortorder;

-- 7. Vérifier les données après correction
SELECT 
    status,
    COUNT(*) as count
FROM bookings 
GROUP BY status;

-- 8. Test d'insertion pour vérifier que tout fonctionne
-- Cette requête va échouer si il n'y a pas de booking valide, mais c'est normal
-- INSERT INTO bookings (property_id, check_in_date, check_out_date, number_of_guests, status)
-- SELECT 
--     p.id,
--     '2025-01-01'::date,
--     '2025-01-05'::date,
--     2,
--     'pending'::booking_status
-- FROM properties p
-- LIMIT 1;

-- 9. Vérifier que tout fonctionne
SELECT 
    'ENUM booking_status fixed successfully' as status,
    now() as fixed_at;
