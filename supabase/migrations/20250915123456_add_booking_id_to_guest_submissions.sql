-- Migration pour ajouter booking_id direct a guest_submissions
-- Date: 2025-09-15

-- 1. Ajouter la colonne booking_id a guest_submissions
ALTER TABLE public.guest_submissions
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id);

-- 2. Mettre a jour les donnees existantes avec la resolution depuis property_verification_tokens
UPDATE public.guest_submissions gs
SET booking_id = (
    -- Resoudre le booking_id depuis property_verification_tokens si c'est un UUID valide ET existe dans bookings
    SELECT pvt.booking_id::uuid
    FROM property_verification_tokens pvt 
    JOIN bookings b ON pvt.booking_id::uuid = b.id
    WHERE gs.token_id = pvt.id
    AND pvt.booking_id IS NOT NULL AND pvt.booking_id != '' 
    AND pvt.booking_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
    LIMIT 1
)
WHERE booking_id IS NULL;

-- 3. Mettre a jour avec resolution par dates pour les autres cas (uniquement si le booking existe)
UPDATE public.guest_submissions gs
SET booking_id = (
    -- Resoudre par property_id et dates de check-in/out (uniquement si le booking existe)
    SELECT b.id
    FROM bookings b 
    JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
    WHERE b.property_id = pvt.property_id 
    AND b.check_in_date::text = (gs.booking_data->>'checkInDate')
    AND b.check_out_date::text = (gs.booking_data->>'checkOutDate')
    LIMIT 1
)
WHERE booking_id IS NULL 
AND gs.booking_data->>'checkInDate' IS NOT NULL 
AND gs.booking_data->>'checkOutDate' IS NOT NULL;

-- 4. Creer un index pour ameliorer les performances
CREATE INDEX IF NOT EXISTS idx_guest_submissions_booking_id ON public.guest_submissions(booking_id);

-- 5. Ajouter un commentaire pour documenter
COMMENT ON COLUMN public.guest_submissions.booking_id IS 'Reference directe a la reservation associee';

-- 6. Simplifier la vue maintenant qu'on a une reference directe
DROP VIEW IF EXISTS public.v_guest_submissions CASCADE;

CREATE VIEW public.v_guest_submissions AS
SELECT 
    gs.*,
    pvt.property_id,
    -- Utiliser le booking_id direct s'il existe, sinon la resolution par token
    COALESCE(gs.booking_id, 
        CASE 
            WHEN pvt.booking_id IS NOT NULL AND pvt.booking_id != '' 
                 AND pvt.booking_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
            THEN pvt.booking_id::uuid
            ELSE NULL
        END
    ) as resolved_booking_id
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id;
