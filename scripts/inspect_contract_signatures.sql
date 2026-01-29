-- Script pour inspecter les signatures dans contract_signatures
-- pour les bookings de MOUHCINE TEMSAMANI

-- 1. Vérifier les signatures pour les bookings récents
SELECT 
    cs.id,
    cs.booking_id,
    cs.signer_name,
    cs.signer_email,
    cs.signed_at,
    LENGTH(cs.signature_data) as signature_length,
    SUBSTRING(cs.signature_data, 1, 50) as signature_preview,
    cs.created_at,
    b.guest_name,
    b.guest_email,
    b.check_in_date,
    b.check_out_date
FROM contract_signatures cs
LEFT JOIN bookings b ON cs.booking_id = b.id
WHERE b.guest_name ILIKE '%MOUHCINE%'
   OR b.guest_email ILIKE '%ghalilahlou24%'
ORDER BY cs.created_at DESC
LIMIT 10;

-- 2. Comparer signer_name avec guest_name pour voir le pattern
SELECT 
    cs.booking_id,
    cs.signer_name as "Nom Signataire",
    b.guest_name as "Nom Guest (booking)",
    cs.signer_email as "Email Signataire",
    b.guest_email as "Email Guest",
    cs.signed_at,
    LENGTH(cs.signature_data) as signature_length
FROM contract_signatures cs
LEFT JOIN bookings b ON cs.booking_id = b.id
WHERE cs.created_at > NOW() - INTERVAL '7 days'
ORDER BY cs.created_at DESC
LIMIT 20;
