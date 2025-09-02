-- Migration pour ajouter l'utilisateur ghalilahlou26@gmail.com comme super administrateur
-- Date: 2025-01-26

-- 1. Trouver l'ID de l'utilisateur par son email
WITH user_info AS (
  SELECT id FROM auth.users
  WHERE email = 'ghalilahlou26@gmail.com'
  LIMIT 1
)

-- 2. Insérer l'utilisateur comme super admin (sans ON CONFLICT)
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT
  id as user_id,
  'super_admin' as role,
  id as created_by,
  true as is_active
FROM user_info;

-- 3. Allouer des tokens de test (sans ON CONFLICT)
INSERT INTO public.token_allocations (user_id, tokens_allocated, tokens_used, tokens_remaining, is_active, allocated_by, notes)
SELECT
  id as user_id,
  100 as tokens_allocated,
  0 as tokens_used,
  100 as tokens_remaining,
  true as is_active,
  id as allocated_by,
  'Tokens de test pour l''administrateur' as notes
FROM auth.users
WHERE email = 'ghalilahlou26@gmail.com';

-- 4. Vérifier que l'insertion a réussi
SELECT
  au.id,
  au.user_id,
  au.role,
  au.is_active,
  au.created_at,
  u.email,
  ta.tokens_allocated,
  ta.tokens_remaining
FROM public.admin_users au
JOIN auth.users u ON au.user_id = u.id
LEFT JOIN public.token_allocations ta ON au.user_id = ta.user_id
WHERE u.email = 'ghalilahlou26@gmail.com';
