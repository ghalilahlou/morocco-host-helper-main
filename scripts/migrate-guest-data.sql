-- Migration script pour transférer les données des guest_submissions vers la table guests

-- Fonction pour migrer les données d'invités depuis guest_submissions vers guests
DO $$
DECLARE
    submission_record RECORD;
    guest_record JSONB;
    booking_record RECORD;
BEGIN
    -- Parcourir toutes les soumissions avec des données d'invités
    FOR submission_record IN 
        SELECT 
            gs.id as submission_id,
            gs.guest_data,
            b.id as booking_id
        FROM guest_submissions gs
        JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
        JOIN bookings b ON b.submission_id = gs.id
        WHERE gs.guest_data IS NOT NULL 
        AND gs.guest_data->'guests' IS NOT NULL
        AND jsonb_array_length(gs.guest_data->'guests') > 0
    LOOP
        -- Nettoyer les invités existants pour cette réservation
        DELETE FROM guests WHERE booking_id = submission_record.booking_id;
        
        -- Insérer chaque invité
        FOR guest_record IN 
            SELECT * FROM jsonb_array_elements(submission_record.guest_data->'guests')
        LOOP
            INSERT INTO guests (
                booking_id,
                full_name,
                date_of_birth,
                document_number,
                nationality,
                place_of_birth,
                document_type
            )
            VALUES (
                submission_record.booking_id,
                COALESCE(guest_record->>'fullName', guest_record->>'full_name'),
                CASE 
                    WHEN guest_record->>'dateOfBirth' IS NOT NULL 
                    THEN (guest_record->>'dateOfBirth')::DATE
                    WHEN guest_record->>'date_of_birth' IS NOT NULL 
                    THEN (guest_record->>'date_of_birth')::DATE
                    ELSE NULL
                END,
                COALESCE(guest_record->>'documentNumber', guest_record->>'document_number'),
                guest_record->>'nationality',
                COALESCE(guest_record->>'placeOfBirth', guest_record->>'place_of_birth'),
                COALESCE(guest_record->>'documentType', guest_record->>'document_type')::document_type
            );
        END LOOP;
        
        RAISE NOTICE 'Migrated guests for booking: %', submission_record.booking_id;
    END LOOP;
    
    RAISE NOTICE 'Migration des données d''invités terminée';
END $$;

-- Afficher un résumé des données migrées
SELECT 
    COUNT(*) as total_bookings_with_guests,
    SUM(jsonb_array_length(gs.guest_data->'guests')) as total_guests_migrated
FROM guest_submissions gs
JOIN bookings b ON b.submission_id = gs.id
WHERE gs.guest_data IS NOT NULL 
AND gs.guest_data->'guests' IS NOT NULL
AND jsonb_array_length(gs.guest_data->'guests') > 0;


