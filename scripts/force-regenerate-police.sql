-- Script pour régénérer la fiche de police avec la VERSION 134
-- Exécutez ceci dans Supabase SQL Editor

-- Option 1: Supprimer l'ancienne fiche de police pour forcer la régénération
DELETE FROM uploaded_documents 
WHERE booking_id = '36f52d9c-2629-4f98-9506-2c6c7f3c809b' 
  AND document_type = 'police';

-- Vérification
SELECT * FROM uploaded_documents 
WHERE booking_id = '36f52d9c-2629-4f98-9506-2c6c7f3c809b';

-- Maintenant, appelez la fonction Edge pour régénérer :
-- POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/submit-guest-info-unified
-- Body: {"action": "regenerate_police", "bookingId": "36f52d9c-2629-4f98-9506-2c6c7f3c809b"}
