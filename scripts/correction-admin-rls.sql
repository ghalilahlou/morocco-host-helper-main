-- =====================================================
-- CORRECTION DES PROBLÈMES RLS ET NETTOYAGE ADMIN
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR DIAGNOSTIC
-- =====================================================
SELECT '1. DÉSACTIVATION TEMPORAIRE RLS' as section;

-- Désactiver RLS temporairement sur admin_users
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER LES POLITIQUES RLS PROBLÉMATIQUES
-- =====================================================
SELECT '2. SUPPRESSION DES POLITIQUES RLS' as section;

-- Supprimer toutes les politiques RLS sur admin_users
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all token allocations" ON public.token_allocations;
DROP POLICY IF EXISTS "Admins can manage token allocations" ON public.token_allocations;
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins can insert activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins can view statistics" ON public.admin_statistics;
DROP POLICY IF EXISTS "Admins can manage statistics" ON public.admin_statistics;

-- 3. NETTOYER LES DOUBLONS
-- =====================================================
SELECT '3. NETTOYAGE DES DOUBLONS' as section;

-- Supprimer les doublons en gardant seulement le plus récent
DELETE FROM public.admin_users 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.admin_users
  ORDER BY user_id, created_at DESC
);

-- 4. CRÉER DES POLITIQUES RLS SIMPLES ET SÛRES
-- =====================================================
SELECT '4. CRÉATION DE POLITIQUES RLS SIMPLES' as section;

-- Politique simple pour admin_users : permettre l'accès aux admins
CREATE POLICY "Allow admin access to admin_users" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- Politique simple pour token_allocations
CREATE POLICY "Allow admin access to token_allocations" ON public.token_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- Politique simple pour admin_activity_logs
CREATE POLICY "Allow admin access to admin_activity_logs" ON public.admin_activity_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- Politique simple pour admin_statistics
CREATE POLICY "Allow admin access to admin_statistics" ON public.admin_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- 5. RÉACTIVER RLS
-- =====================================================
SELECT '5. RÉACTIVATION RLS' as section;

-- Réactiver RLS sur toutes les tables admin
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_statistics ENABLE ROW LEVEL SECURITY;

-- 6. VÉRIFICATION FINALE
-- =====================================================
SELECT '6. VÉRIFICATION FINALE' as section;

-- Vérifier que les politiques sont créées
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies 
WHERE tablename IN ('admin_users', 'token_allocations', 'admin_activity_logs', 'admin_statistics')
ORDER BY tablename, policyname;

-- Vérifier les administrateurs
SELECT 
  u.email,
  au.role,
  au.is_active,
  ta.tokens_allocated,
  ta.tokens_remaining
FROM auth.users u
JOIN public.admin_users au ON u.id = au.user_id
LEFT JOIN public.token_allocations ta ON u.id = ta.user_id
WHERE u.email IN ('ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

