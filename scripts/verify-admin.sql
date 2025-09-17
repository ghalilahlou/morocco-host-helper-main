-- Vérification du statut administrateur pour ghalilahlou26@gmail.com

-- 1. Vérifier si l'utilisateur existe
SELECT 'Utilisateur existe' as status, id, email, created_at 
FROM auth.users 
WHERE email = 'ghalilahlou26@gmail.com';

-- 2. Vérifier s'il est dans admin_users
SELECT 'Statut admin' as status, au.*, u.email
FROM public.admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE u.email = 'ghalilahlou26@gmail.com';

-- 3. Vérifier ses tokens
SELECT 'Tokens' as status, ta.*, u.email
FROM public.token_allocations ta
JOIN auth.users u ON ta.user_id = u.id
WHERE u.email = 'ghalilahlou26@gmail.com';
