-- Script simple pour ajouter l'utilisateur ghalilahlou26@gmail.com comme super administrateur

-- 1. Vérifier si l'utilisateur existe
SELECT id, email FROM auth.users WHERE email = 'ghalilahlou26@gmail.com';

-- 2. Ajouter l'utilisateur comme super admin
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'super_admin' as role,
  id as created_by,
  true as is_active
FROM auth.users 
WHERE email = 'ghalilahlou26@gmail.com';

-- 3. Allouer des tokens de test
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

-- 4. Vérifier le résultat
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

