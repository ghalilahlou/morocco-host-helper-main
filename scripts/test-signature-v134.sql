-- TEST : Vérifier si un booking RÉCENT (après 12:27) a la signature

-- 1. Bookings créés APRÈS le déploiement (12:27)
SELECT 
  b.id,
  b.guest_name,
  b.guest_email,
  b.created_at,
  cs.signature_data IS NOT NULL as has_signature,
  LENGTH(cs.signature_data) as sig_length
FROM bookings b
LEFT JOIN contract_signatures cs ON b.id = cs.booking_id
WHERE b.created_at > '2026-01-12 11:27:00'
ORDER BY b.created_at DESC;

-- 2. Vérifier les fiches de police APRÈS 12:27
SELECT 
  ud.booking_id,
  b.guest_name,
  ud.document_url,
  ud.created_at as police_generated_at,
  b.created_at as booking_created_at
FROM uploaded_documents ud
JOIN bookings b ON ud.booking_id = b.id
WHERE ud.document_type = 'police'
  AND ud.created_at > '2026-01-12 11:27:00'
ORDER BY ud.created_at DESC;
