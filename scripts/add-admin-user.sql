-- Script pour ajouter un utilisateur administrateur
-- Remplacez 'USER_EMAIL_HERE' par l'email de l'utilisateur que vous voulez promouvoir admin

-- 1. Trouver l'ID de l'utilisateur par son email
-- Remplacez 'ghlilahlou26@gmail.com' par l'email de l'utilisateur
WITH user_info AS (
  SELECT id FROM auth.users 
  WHERE email = 'ghlilahlou26@gmail.com'
  LIMIT 1
)

-- 2. Insérer l'utilisateur comme super admin
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'super_admin' as role,
  id as created_by,
  true as is_active
FROM user_info
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  updated_at = now();

-- 3. Vérifier que l'insertion a réussi
SELECT 
  au.id,
  au.user_id,
  au.role,
  au.is_active,
  au.created_at,
  u.email
FROM public.admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE u.email = 'ghlilahlou26@gmail.com';

-- 4. Allouer des tokens de test (optionnel)
-- INSERT INTO public.token_allocations (user_id, tokens_allocated, allocated_by)
-- SELECT 
--   id as user_id,
--   100 as tokens_allocated,
--   id as allocated_by
-- FROM auth.users 
-- WHERE email = 'ghlilahlou26@gmail.com'
-- ON CONFLICT (user_id) DO UPDATE SET
--   tokens_allocated = EXCLUDED.tokens_allocated,
--   updated_at = now();
