-- Update existing property_verification_tokens with missing booking_id
-- Match tokens to bookings based on property_id and created_at proximity to booking dates

UPDATE property_verification_tokens 
SET booking_id = (
    SELECT b.id::text
    FROM bookings b 
    WHERE b.property_id = property_verification_tokens.property_id
    AND property_verification_tokens.created_at >= (b.check_in_date - INTERVAL '30 days')
    AND property_verification_tokens.created_at <= (b.check_out_date + INTERVAL '7 days')
    ORDER BY ABS(EXTRACT(EPOCH FROM (property_verification_tokens.created_at - b.check_in_date)))
    LIMIT 1
)
WHERE booking_id IS NULL 
AND EXISTS (
    SELECT 1 
    FROM bookings b 
    WHERE b.property_id = property_verification_tokens.property_id
    AND property_verification_tokens.created_at >= (b.check_in_date - INTERVAL '30 days')
    AND property_verification_tokens.created_at <= (b.check_out_date + INTERVAL '7 days')
);