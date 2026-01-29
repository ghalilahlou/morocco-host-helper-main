-- Vérifier si ce booking spécifique (Mouhcine Temsamani) a une signature guest
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  b.guest_email,
  cs.id as signature_id,
  cs.signature_type,
  cs.signer_name,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_signature_data,
  CASE 
    WHEN cs.signature_data IS NOT NULL 
    THEN LENGTH(cs.signature_data)
    ELSE 0
  END as signature_length,
  SUBSTRING(cs.signature_data, 1, 50) || '...' as signature_preview,
  cs.signed_at,
  cs.created_at as signature_created_at,
  -- Vérifier la fiche de police
  (
    SELECT COUNT(*) 
    FROM uploaded_documents ud 
    WHERE ud.booking_id = b.id 
    AND ud.document_type = 'police_form'
  ) as police_forms_count,
  (
    SELECT MAX(created_at)
    FROM uploaded_documents ud 
    WHERE ud.booking_id = b.id 
    AND ud.document_type = 'police_form'
  ) as last_police_form_date
FROM bookings b
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
WHERE 
  b.guest_email = 'ghalilahlou24@gmail.com'
  OR b.guest_name LIKE '%MOUHCINE%'
  OR b.guest_name LIKE '%TEMSAMANI%'
ORDER BY b.created_at DESC
LIMIT 5;
