-- Create view for guest submissions with booking_id resolved
CREATE OR REPLACE VIEW public.v_guest_submissions AS
SELECT 
  gs.*,
  pvt.property_id,
  -- Resolve booking_id by joining through tokens
  b.id as booking_id
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
JOIN bookings b ON (
  b.property_id = pvt.property_id 
  AND b.check_in_date = (gs.booking_data->>'checkInDate')::date
)
WHERE pvt.is_active = true;

-- Create view for booking verification summary with counts
CREATE OR REPLACE VIEW public.v_booking_verification_summary AS
SELECT 
  b.id as booking_id,
  b.property_id,
  b.user_id,
  COALESCE(guest_count.count, 0) as guest_submissions_count,
  COALESCE(docs_count.count, 0) as uploaded_documents_count,
  COALESCE(sig_count.count > 0, false) as has_signature
FROM bookings b
LEFT JOIN (
  SELECT booking_id, COUNT(*) as count
  FROM v_guest_submissions 
  GROUP BY booking_id
) guest_count ON b.id = guest_count.booking_id
LEFT JOIN (
  SELECT booking_id, COUNT(*) as count
  FROM uploaded_documents 
  WHERE booking_id IS NOT NULL
  GROUP BY booking_id
) docs_count ON b.id = docs_count.booking_id  
LEFT JOIN (
  SELECT booking_id, COUNT(*) as count
  FROM contract_signatures
  GROUP BY booking_id
) sig_count ON b.id = sig_count.booking_id;