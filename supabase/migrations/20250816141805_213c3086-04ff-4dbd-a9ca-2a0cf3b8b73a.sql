-- Corriger le token de ANAS LAMHANDAR pour qu'il pointe vers la bonne réservation (29-30 août)
UPDATE property_verification_tokens 
SET booking_id = 'e5c43c78-ee49-41ed-9a83-9dcc6d41fb97',
    updated_at = now()
WHERE id = 'c4c9f338-cb0d-4c93-bef0-7ad34fe88bb0';

-- Nettoyer les tokens de test avec des codes Airbnb
DELETE FROM property_verification_tokens 
WHERE booking_id IN ('HMRPA2FPRD', 'HMA2RP2CDD');