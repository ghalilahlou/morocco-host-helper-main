-- ============================================================================
-- NETTOYAGE DES GUEST_SUBMISSIONS ORPHELINES - VERSION CORRIGÉE
-- ============================================================================

-- ÉTAPE 1 : Identifier les guest_submissions orphelines
SELECT 
  gs.id,
  gs.booking_id,
  gs.created_at,
  'ORPHELINE (booking supprimé)' as statut
FROM public.guest_submissions gs
LEFT JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.id IS NULL
ORDER BY gs.created_at DESC;

-- ÉTAPE 2 : Compter les orphelines
SELECT 
  COUNT(*) as guest_submissions_orphelines
FROM public.guest_submissions gs
LEFT JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.id IS NULL;

-- ÉTAPE 3 : SUPPRIMER les guest_submissions orphelines
DELETE FROM public.guest_submissions
WHERE id IN (
  SELECT gs.id
  FROM public.guest_submissions gs
  LEFT JOIN public.bookings b ON gs.booking_id = b.id
  WHERE b.id IS NULL
);

-- ÉTAPE 4 : Vérification finale
SELECT 
  COUNT(*) as guest_submissions_restantes
FROM public.guest_submissions;

SELECT 
  COUNT(*) as guest_submissions_orphelines_restantes
FROM public.guest_submissions gs
LEFT JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.id IS NULL;

-- Devrait retourner 0
