-- 🔧 Correction de l'Erreur de Syntaxe SQL - USER-DEFINED
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour corriger l'erreur

-- 1. Vérifier d'abord si le type booking_status existe
SELECT 
    typname,
    typtype
FROM pg_type 
WHERE typname = 'booking_status';

-- 2. Créer le type booking_status s'il n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    END IF;
END $$;

-- 3. Vérifier la structure actuelle de la table bookings
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

-- 4. Corriger la colonne status si nécessaire
DO $$
BEGIN
    -- Vérifier si la colonne status existe et a le bon type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'status'
    ) THEN
        -- Modifier le type de la colonne status
        ALTER TABLE bookings 
        ALTER COLUMN status TYPE booking_status 
        USING status::booking_status;
    ELSE
        -- Ajouter la colonne status si elle n'existe pas
        ALTER TABLE bookings 
        ADD COLUMN status booking_status DEFAULT 'pending'::booking_status;
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

-- 6. Vérifier les contraintes de la table bookings
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'bookings';

-- 7. Vérifier les clés étrangères
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'bookings';

-- 8. Vérifier les données existantes dans bookings
SELECT 
    id,
    property_id,
    check_in_date,
    check_out_date,
    number_of_guests,
    status,
    created_at
FROM bookings
LIMIT 10;

-- 9. Mettre à jour les statuts invalides si nécessaire
UPDATE bookings 
SET status = 'pending'::booking_status 
WHERE status IS NULL OR status NOT IN ('pending', 'confirmed', 'cancelled', 'completed');

-- 10. Vérifier que tout fonctionne
SELECT 
    'SQL syntax error fixed successfully' as status,
    now() as fixed_at;
