-- Script pour ajouter L.benmouaz@gmail.com et Hicham.boumnade@nexa-p.com comme administrateurs

-- 1. Vérifier si les utilisateurs existent
SELECT 'Vérification utilisateurs' as etape;
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com');

-- 2. Ajouter L.benmouaz@gmail.com comme administrateur
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'admin' as role,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as created_by, -- créé par le super admin
  true as is_active
FROM auth.users 
WHERE email = 'L.benmouaz@gmail.com';

-- 3. Ajouter Hicham.boumnade@nexa-p.com comme administrateur
INSERT INTO public.admin_users (user_id, role, created_by, is_active)
SELECT 
  id as user_id,
  'admin' as role,
  '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' as created_by, -- créé par le super admin
  true as is_active
FROM auth.users 
WHERE email = 'Hicham.boumnade@nexa-p.com';

-- 4. Allouer des tokens à L.benmouaz@gmail.com
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
WHERE email = 'L.benmouaz@gmail.com';

-- 5. Allouer des tokens à Hicham.boumnade@nexa-p.com
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
WHERE email = 'Hicham.boumnade@nexa-p.com';

-- 6. Vérification finale
SELECT 'Vérification finale' as etape;
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
WHERE u.email IN ('L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

