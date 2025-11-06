-- 🧹 NETTOYAGE COMPLET DES NOMS DE GUESTS INVALIDES
-- Version améliorée qui nettoie AUSSI les noms de test et les noms invalides

-- ✅ ÉTAPE 1 : Nettoyer les noms invalides (codes Airbnb, "Phone Number", etc.)
UPDATE public.airbnb_reservations
SET 
  guest_name = NULL,
  summary = CASE 
    WHEN airbnb_booking_id IS NOT NULL 
    THEN 'Airbnb – Réservation ' || airbnb_booking_id
    ELSE 'Airbnb – Réservation'
  END,
  updated_at = NOW()
WHERE 
  guest_name IS NOT NULL
  AND (
    -- Condition 1 : Contient "Phone Number"
    guest_name ILIKE '%Phone Number%'
    
    -- Condition 2 : Commence par un code Airbnb (HMxxxxxxxx)
    OR guest_name ~ '^HM[A-Z0-9]{8,12}'
    
    -- Condition 3 : Contient un retour à la ligne avec "Phone"
    OR guest_name LIKE '%\n%Phone%'
    
    -- Condition 4 : Nom de test "MICHAEL JOSEPH JACKSON"
    OR guest_name ILIKE '%MICHAEL%JACKSON%'
    
    -- Condition 5 : Moins de 2 caractères (trop court)
    OR LENGTH(TRIM(guest_name)) < 2
    
    -- Condition 6 : Uniquement des chiffres
    OR guest_name ~ '^\d+$'
  );

-- 📊 Vérification : Afficher les réservations nettoyées
SELECT 
  'Nettoyage terminé' as status,
  COUNT(*) as reservations_nettoyees
FROM public.airbnb_reservations
WHERE 
  guest_name IS NULL 
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ✅ ÉTAPE 2 : Vérifier les réservations restantes avec guest_name
-- (ce sont les VRAIES réservations validées)
SELECT 
  ar.airbnb_booking_id,
  ar.guest_name,
  ar.start_date,
  ar.end_date,
  b.id as booking_id,
  b.status as booking_status,
  COUNT(g.id) as nombre_guests,
  '✅ Réservation validée' as remarque
FROM public.airbnb_reservations ar
LEFT JOIN public.bookings b ON b.booking_reference = ar.airbnb_booking_id 
  AND b.property_id = ar.property_id
LEFT JOIN public.guests g ON g.booking_id = b.id
WHERE 
  ar.guest_name IS NOT NULL
GROUP BY 
  ar.airbnb_booking_id, 
  ar.guest_name, 
  ar.start_date, 
  ar.end_date, 
  b.id, 
  b.status
ORDER BY ar.start_date DESC;

-- 🗑️ ÉTAPE 3 (OPTIONNEL) : Supprimer complètement les bookings de test
-- ⚠️ ATTENTION : Cette étape supprime DÉFINITIVEMENT les données de test
-- Décommentez SEULEMENT si vous voulez supprimer "MICHAEL JOSEPH JACKSON"

/*
-- Supprimer les guests de test
DELETE FROM public.guests
WHERE booking_id IN (
  SELECT b.id 
  FROM public.bookings b
  WHERE b.booking_reference IN ('HM8548HWET') -- Ajoutez d'autres codes si nécessaire
);

-- Supprimer les uploaded_documents de test
DELETE FROM public.uploaded_documents
WHERE booking_id IN (
  SELECT b.id 
  FROM public.bookings b
  WHERE b.booking_reference IN ('HM8548HWET')
);

-- Supprimer les bookings de test
DELETE FROM public.bookings
WHERE booking_reference IN ('HM8548HWET');

-- Nettoyer la table airbnb_reservations correspondante
UPDATE public.airbnb_reservations
SET 
  guest_name = NULL,
  summary = 'Airbnb – Réservation ' || airbnb_booking_id,
  updated_at = NOW()
WHERE airbnb_booking_id IN ('HM8548HWET');

SELECT 'Booking de test HM8548HWET supprimé' as status;
*/

-- 📋 RÉSUMÉ FINAL
SELECT 
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE guest_name IS NULL) as reservations_sans_guest,
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE guest_name IS NOT NULL) as reservations_avec_guest,
  (SELECT COUNT(*) FROM public.bookings) as total_bookings,
  (SELECT COUNT(*) FROM public.guests) as total_guests;

