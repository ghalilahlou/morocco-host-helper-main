-- Script de nettoyage des URLs de documents invalides
-- Ce script supprime les documents avec des blob: URLs qui ne peuvent pas être affichés

-- =====================================================
-- NETTOYAGE DES DOCUMENTS INVALIDES
-- =====================================================

-- 1. Supprimer les documents générés avec des blob: URLs
DELETE FROM generated_documents
WHERE document_url LIKE 'blob:%';

-- 2. Supprimer les documents uploadés avec des blob: URLs
DELETE FROM uploaded_documents
WHERE document_url LIKE 'blob:%';

-- 3. Supprimer les fiches de police avec des data: URLs (non uploadées au Storage)
DELETE FROM generated_documents
WHERE document_type = 'police' 
  AND document_url LIKE 'data:%';

DELETE FROM uploaded_documents
WHERE document_type = 'police' 
  AND document_url LIKE 'data:%';

-- 4. Afficher un résumé des documents restants par booking
SELECT 
  b.id as booking_id,
  b.property_id,
  b.check_in_date,
  COUNT(DISTINCT CASE WHEN gd.document_type = 'contract' THEN gd.id END) as contracts,
  COUNT(DISTINCT CASE WHEN gd.document_type = 'identity' THEN gd.id END) as identities,
  COUNT(DISTINCT CASE WHEN gd.document_type = 'police' THEN gd.id END) as police_forms
FROM bookings b
LEFT JOIN generated_documents gd ON b.id = gd.booking_id
WHERE b.created_at >= NOW() - INTERVAL '7 days'
GROUP BY b.id, b.property_id, b.check_in_date
ORDER BY b.created_at DESC;

