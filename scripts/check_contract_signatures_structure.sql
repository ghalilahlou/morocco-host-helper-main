-- Vérifier la structure de la table contract_signatures
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- Voir toutes les signatures pour comprendre la structure
SELECT *
FROM contract_signatures
LIMIT 5;

-- Chercher toutes les signatures sans filtre signature_type
SELECT 
  id,
  booking_id,
  signer_name,
  signature_type,  -- Cette colonne existe-t-elle ?
  CASE 
    WHEN signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_data,
  LENGTH(signature_data) as data_length,
  signed_at,
  created_at
FROM contract_signatures
WHERE booking_id IN (
  SELECT id FROM bookings 
  WHERE guest_name LIKE '%MOUHCINE%' 
     OR guest_email = 'ghalilahlou26@gmail.com'
)
ORDER BY created_at DESC;
