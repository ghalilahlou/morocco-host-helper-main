-- ✅ VÉRIFICATION: Données des Guests dans guest_submissions
-- Exécuter cette requête pour voir les données stockées

SELECT 
  id,
  booking_id,
  guest_data,
  extracted_data,
  submitted_at,
  created_at
FROM guest_submissions
WHERE booking_id = 'VOTRE_BOOKING_ID'  -- Remplacer par l'ID de la réservation
ORDER BY created_at DESC;

-- ✅ Exemple de résultat attendu pour MOUHCINE TEMSAMANI:
/*
guest_data: {
  "full_name": "MOUHCINE TEMSAMANI",
  "date_of_birth": "29/11/1978",
  "nationality": "MAROCAIN",
  "document_type": "Carte d'identité",
  "document_number": "K01234567",
  "motif_sejour": "Tourisme",
  "email": "...",
  ...
}

extracted_data: {
  "full_name": "MOUHCINE TEMSAMANI",
  "date_of_birth": "1978-11-29",
  "nationality": "MAROCAIN",
  ...
}
*/

-- ✅ Vérifier les différentes clés possibles:
SELECT 
  id,
  booking_id,
  guest_data->>'full_name' as full_name,
  guest_data->>'fullName' as fullName_camelCase,
  guest_data->>'name' as name,
  guest_data->>'first_name' as first_name,
  guest_data->>'last_name' as last_name,
  guest_data->>'email' as email,
  guest_data->>'nationality' as nationality,
  guest_data->>'nationalite' as nationalite,
  guest_data->>'document_number' as document_number,
  guest_data->>'date_of_birth' as date_of_birth,
  extracted_data->>'full_name' as extracted_full_name,
  extracted_data->>'email' as extracted_email
FROM guest_submissions
WHERE booking_id = 'VOTRE_BOOKING_ID'
ORDER BY created_at DESC;

-- ✅ Vérifier le format de date:
SELECT 
  id,
  guest_data->>'date_of_birth' as date_format_1,
  guest_data->>'dateOfBirth' as date_format_2,
  guest_data->>'birth_date' as date_format_3,
  extracted_data->>'date_of_birth' as extracted_date
FROM guest_submissions
WHERE booking_id = 'VOTRE_BOOKING_ID';
