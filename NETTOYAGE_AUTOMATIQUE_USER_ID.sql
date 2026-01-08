-- ============================================================================
-- NETTOYAGE AUTOMATIQUE : Réservations avec user_id NULL
-- ============================================================================
-- Ce script corrige AUTOMATIQUEMENT les réservations avec user_id NULL
-- en récupérant le user_id depuis la table properties
-- ============================================================================

-- ÉTAPE 1 : Vérifier combien de réservations sont affectées
-- ============================================================================
SELECT 
  '🔍 AUDIT : Réservations avec user_id NULL' as section,
  COUNT(*) as total_a_corriger,
  COUNT(DISTINCT property_id) as proprietes_affectees
FROM bookings
WHERE user_id IS NULL;

-- ÉTAPE 2 : Voir le détail des réservations à corriger
-- ============================================================================
SELECT 
  '📋 DÉTAIL : Réservations à corriger' as section,
  b.id,
  b.property_id,
  b.guest_name,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.status,
  b.created_at,
  p.user_id as user_id_a_appliquer,
  p.name as nom_propriete
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
WHERE b.user_id IS NULL
ORDER BY b.created_at DESC;

-- ÉTAPE 3 : CORRECTION AUTOMATIQUE
-- ============================================================================
-- ✅ Cette requête récupère automatiquement le user_id depuis la table properties
-- et l'applique aux réservations correspondantes
-- ============================================================================

-- D'abord, compter combien de réservations seront affectées
WITH affected_bookings AS (
  SELECT 
    b.id,
    p.user_id as correct_user_id
  FROM bookings b
  INNER JOIN properties p ON b.property_id = p.id
  WHERE b.user_id IS NULL
    AND p.user_id IS NOT NULL
)
SELECT 
  '✅ APERÇU : Réservations qui seront corrigées' as section,
  COUNT(*) as total_qui_seront_corrigées
FROM affected_bookings;

-- ⚠️ DÉCOMMENTEZ LA SECTION CI-DESSOUS POUR APPLIQUER LA CORRECTION
/*
-- CORRECTION AUTOMATIQUE : Mettre à jour les réservations avec le bon user_id
UPDATE bookings
SET user_id = p.user_id,
    updated_at = NOW()
FROM properties p
WHERE bookings.property_id = p.id
  AND bookings.user_id IS NULL
  AND p.user_id IS NOT NULL;

-- Afficher le résultat
SELECT 
  '✅ RÉSULTAT : Correction appliquée' as section,
  COUNT(*) as total_corrigé
FROM bookings
WHERE updated_at >= NOW() - INTERVAL '10 seconds';
*/

-- ÉTAPE 4 : VÉRIFICATION POST-CORRECTION
-- ============================================================================
SELECT 
  '📊 STATISTIQUES FINALES' as section,
  COUNT(*) as total_reservations,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as avec_user_id,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as sans_user_id,
  ROUND(
    (COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)::NUMERIC / 
     NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
    2
  ) as pourcentage_valide
FROM bookings;

-- ÉTAPE 5 : Identifier les réservations orphelines (si elles existent encore)
-- ============================================================================
-- Ces réservations ont un property_id qui n'existe pas dans la table properties
-- Elles nécessitent une intervention manuelle
SELECT 
  '⚠️ RÉSERVATIONS ORPHELINES (intervention manuelle requise)' as section,
  b.id,
  b.property_id,
  b.guest_name,
  b.booking_reference,
  b.check_in_date,
  'Property not found' as probleme
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
WHERE b.user_id IS NULL
  AND p.id IS NULL;

-- ============================================================================
-- INSTRUCTIONS D'UTILISATION
-- ============================================================================
-- 1. Exécutez les ÉTAPES 1-2 pour voir quelles réservations seront affectées
-- 2. Vérifiez l'ÉTAPE 3 (aperçu) pour confirmer le nombre de corrections
-- 3. Décommentez la section UPDATE dans l'ÉTAPE 3 pour appliquer la correction
-- 4. Exécutez l'ÉTAPE 4 pour vérifier que toutes les réservations ont un user_id
-- 5. Si l'ÉTAPE 5 retourne des résultats, contactez un administrateur
-- ============================================================================
