-- =====================================================
-- DIAGNOSTIC COMPLET : Signatures & Fiches de Police
-- =====================================================

-- 1. BOOKINGS RÉCENTS (dernières 24h)
SELECT 
  id,
  guest_name,
  guest_email,
  check_in_date,
  check_out_date,
  created_at,
  status
FROM bookings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. SIGNATURES POUR CES BOOKINGS
SELECT 
  cs.booking_id,
  b.guest_name as booking_guest_name,
  b.guest_email as booking_guest_email,
  cs.signer_name,
  cs.signer_email,
  LENGTH(cs.signature_data) as signature_length,
  cs.signed_at,
  cs.created_at
FROM contract_signatures cs
JOIN bookings b ON cs.booking_id = b.id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
ORDER BY cs.created_at DESC;

-- 3. FICHES DE POLICE GÉNÉRÉES
SELECT 
  b.id as booking_id,
  b.guest_name,
  b.guest_email,
  dg.police_form as has_police,
  dg.police_url,
  dg.updated_at
FROM bookings b
LEFT JOIN documents_generated dg ON b.id = dg.booking_id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
ORDER BY b.created_at DESC;

-- 4. MATCHING EMAIL : Signature ↔ Booking
SELECT 
  b.id as booking_id,
  b.guest_name,
  b.guest_email as booking_email,
  cs.signer_email as signature_email,
  CASE 
    WHEN LOWER(b.guest_email) = LOWER(cs.signer_email) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as email_match,
  cs.created_at as signature_date
FROM bookings b
LEFT JOIN contract_signatures cs ON b.id = cs.booking_id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
ORDER BY b.created_at DESC;

-- 5. DERNIER BOOKING AVEC TOUS LES DÉTAILS
SELECT 
  b.id,
  b.guest_name,
  b.guest_email,
  b.created_at as booking_created,
  cs.signer_email,
  cs.signed_at,
  LENGTH(cs.signature_data) as sig_length,
  dg.police_form,
  dg.police_url IS NOT NULL as has_police_url
FROM bookings b
LEFT JOIN contract_signatures cs ON b.id = cs.booking_id
LEFT JOIN documents_generated dg ON b.id = dg.booking_id
ORDER BY b.created_at DESC
LIMIT 1;
