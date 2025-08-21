-- Fix the v_guest_submissions view to handle invalid UUID strings in booking_id
DROP VIEW IF EXISTS public.v_guest_submissions CASCADE;

CREATE VIEW public.v_guest_submissions AS 
SELECT 
    gs.*,
    pvt.property_id,
    CASE 
        -- Use token's booking_id if it's a valid UUID format
        WHEN pvt.booking_id IS NOT NULL AND pvt.booking_id != '' AND pvt.booking_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN pvt.booking_id::uuid
        -- Otherwise, try to match with bookings by property_id and check-in/out dates
        ELSE (
            SELECT b.id
            FROM bookings b 
            WHERE b.property_id = pvt.property_id 
            AND b.check_in_date::text = (gs.booking_data->>'checkInDate')
            AND b.check_out_date::text = (gs.booking_data->>'checkOutDate')
            LIMIT 1
        )
    END as booking_id
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id;

-- Recreate the booking verification summary view with the updated guest submissions view
DROP VIEW IF EXISTS public.v_booking_verification_summary CASCADE;

CREATE VIEW public.v_booking_verification_summary AS
SELECT 
    b.id as booking_id,
    b.property_id,
    p.user_id,
    COALESCE(guest_counts.guest_submissions_count, 0) as guest_submissions_count,
    COALESCE(doc_counts.uploaded_documents_count, 0) as uploaded_documents_count,
    COALESCE(signature_status.has_signature, false) as has_signature
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN (
    SELECT booking_id, COUNT(*) as guest_submissions_count
    FROM v_guest_submissions 
    WHERE booking_id IS NOT NULL
    GROUP BY booking_id
) guest_counts ON b.id = guest_counts.booking_id
LEFT JOIN (
    SELECT booking_id, COUNT(*) as uploaded_documents_count
    FROM uploaded_documents 
    GROUP BY booking_id
) doc_counts ON b.id = doc_counts.booking_id
LEFT JOIN (
    SELECT booking_id, true as has_signature
    FROM contract_signatures 
    GROUP BY booking_id
) signature_status ON b.id = signature_status.booking_id;