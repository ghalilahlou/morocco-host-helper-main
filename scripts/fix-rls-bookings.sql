-- =============================================================================
-- Script SQL pour assouplir les permissions RLS sur la table bookings
-- =============================================================================
-- URGENT : Exécuter ce script dans Supabase Dashboard → SQL Editor
-- pour permettre la lecture de toutes les réservations pour les utilisateurs authentifiés
-- =============================================================================

-- 1. Vérifier l'état actuel du RLS
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'bookings';

-- 2. Lister les politiques RLS existantes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'bookings';

-- 3. Supprimer les politiques restrictives existantes (si nécessaire)
-- DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
-- DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
-- DROP POLICY IF EXISTS "Enable read access for all users" ON public.bookings;

-- 4. Créer une politique permissive pour TOUS les utilisateurs authentifiés
-- Cette politique permet à TOUS les utilisateurs authentifiés de lire TOUTES les réservations
CREATE POLICY IF NOT EXISTS "Enable read access for all authenticated users" 
ON public.bookings 
FOR SELECT 
TO authenticated
USING (true); -- ✅ PERMISSIF : Permet la lecture de toutes les réservations

-- 5. S'assurer que le RLS est activé
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6. Vérifier que la politique a été créée
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'bookings' 
  AND policyname = 'Enable read access for all authenticated users';

-- =============================================================================
-- VÉRIFICATION : Tester la requête
-- =============================================================================
-- Exécuter cette requête pour vérifier qu'elle retourne des données :
-- SELECT COUNT(*) FROM bookings;
-- SELECT id, property_id, user_id, status FROM bookings LIMIT 5;
-- =============================================================================

-- =============================================================================
-- NOTE : Cette politique est très permissive et devrait être restreinte
-- une fois le problème résolu. Pour une politique plus sécurisée :
-- =============================================================================
-- CREATE POLICY "Users can view own bookings" 
-- ON public.bookings 
-- FOR SELECT 
-- TO authenticated
-- USING (auth.uid() = user_id);
-- =============================================================================

