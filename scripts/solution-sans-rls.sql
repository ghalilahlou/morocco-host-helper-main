-- =====================================================
-- SOLUTION ALTERNATIVE SANS RLS (SI NÉCESSAIRE)
-- =====================================================

-- 1. DÉSACTIVER COMPLÈTEMENT RLS SUR LES TABLES ADMIN
-- =====================================================
SELECT '1. DÉSACTIVATION COMPLÈTE RLS' as section;

-- Désactiver RLS sur toutes les tables admin
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_statistics DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES POLITIQUES RLS
-- =====================================================
SELECT '2. SUPPRESSION DE TOUTES LES POLITIQUES RLS' as section;

-- Supprimer toutes les politiques RLS sur les tables admin
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all token allocations" ON public.token_allocations;
DROP POLICY IF EXISTS "Admins can manage token allocations" ON public.token_allocations;
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins can insert activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Admins can view statistics" ON public.admin_statistics;
DROP POLICY IF EXISTS "Admins can manage statistics" ON public.admin_statistics;
DROP POLICY IF EXISTS "Allow admin access to admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow admin access to token_allocations" ON public.token_allocations;
DROP POLICY IF EXISTS "Allow admin access to admin_activity_logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Allow admin access to admin_statistics" ON public.admin_statistics;

-- 3. NETTOYER LES DONNÉES
-- =====================================================
SELECT '3. NETTOYAGE DES DONNÉES' as section;

-- Supprimer les doublons dans admin_users
DELETE FROM public.admin_users 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.admin_users
  ORDER BY user_id, created_at DESC
);

-- Supprimer les doublons dans token_allocations
DELETE FROM public.token_allocations 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.token_allocations
  ORDER BY user_id, created_at DESC
);

-- 4. S'ASSURER QUE LES ADMINISTRATEURS EXISTENT
-- =====================================================
SELECT '4. VÉRIFICATION DES ADMINISTRATEURS' as section;

-- Vérifier les administrateurs actuels
SELECT 
  u.email,
  au.role,
  au.is_active,
  ta.tokens_allocated,
  ta.tokens_remaining
FROM auth.users u
LEFT JOIN public.admin_users au ON u.id = au.user_id
LEFT JOIN public.token_allocations ta ON u.id = ta.user_id
WHERE u.email IN ('ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

-- 5. AJOUTER LES ADMINISTRATEURS MANQUANTS (SI NÉCESSAIRE)
-- =====================================================
SELECT '5. AJOUT DES ADMINISTRATEURS MANQUANTS' as section;

-- Ajouter ghalilahlou26@gmail.com comme super admin (si pas déjà présent)
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'super_admin' as role,
  id as created_by,
  true as is_active
FROM auth.users 
WHERE email = 'ghalilahlou26@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Ajouter L.benmouaz@gmail.com comme admin (si pas déjà présent)
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'admin' as role,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as created_by,
  true as is_active
FROM auth.users 
WHERE email = 'L.benmouaz@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Ajouter Hicham.boumnade@nexa-p.com comme admin (si pas déjà présent)
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'admin' as role,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as created_by,
  true as is_active
FROM auth.users 
WHERE email = 'Hicham.boumnade@nexa-p.com'
ON CONFLICT (user_id) DO NOTHING;

-- 6. AJOUTER LES TOKENS (SI NÉCESSAIRE)
-- =====================================================
SELECT '6. AJOUT DES TOKENS' as section;

-- Ajouter des tokens pour ghalilahlou26@gmail.com
INSERT INTO public.token_allocations (user_id, tokens_allocated, tokens_used, tokens_remaining, is_active, allocated_by, notes)
SELECT 
  id as user_id,
  100 as tokens_allocated,
  0 as tokens_used,
  100 as tokens_remaining,
  true as is_active,
  id as allocated_by,
  'Tokens pour super administrateur' as notes
FROM auth.users 
WHERE email = 'ghalilahlou26@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Ajouter des tokens pour L.benmouaz@gmail.com
INSERT INTO public.token_allocations (user_id, tokens_allocated, tokens_used, tokens_remaining, is_active, allocated_by, notes)
SELECT 
  id as user_id,
  50 as tokens_allocated,
  0 as tokens_used,
  50 as tokens_remaining,
  true as is_active,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as allocated_by,
  'Tokens pour administrateur L.benmouaz' as notes
FROM auth.users 
WHERE email = 'L.benmouaz@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Ajouter des tokens pour Hicham.boumnade@nexa-p.com
INSERT INTO public.token_allocations (user_id, tokens_allocated, tokens_used, tokens_remaining, is_active, allocated_by, notes)
SELECT 
  id as user_id,
  50 as tokens_allocated,
  0 as tokens_used,
  50 as tokens_remaining,
  true as is_active,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as allocated_by,
  'Tokens pour administrateur Hicham.boumnade' as notes
FROM auth.users 
WHERE email = 'Hicham.boumnade@nexa-p.com'
ON CONFLICT (user_id) DO NOTHING;

-- 7. VÉRIFICATION FINALE
-- =====================================================
SELECT '7. VÉRIFICATION FINALE' as section;

-- Vérifier l'état final
SELECT 
  u.email,
  au.role,
  au.is_active,
  ta.tokens_allocated,
  ta.tokens_remaining,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Administrateur'
    ELSE '❌ Non administrateur'
  END as status
FROM auth.users u
LEFT JOIN public.admin_users au ON u.id = au.user_id
LEFT JOIN public.token_allocations ta ON u.id = ta.user_id
WHERE u.email IN ('ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

