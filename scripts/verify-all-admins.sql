-- Vérification de tous les administrateurs dans le système

-- 1. Liste de tous les administrateurs
SELECT 'Tous les administrateurs' as section;
SELECT 
  au.id,
  au.user_id,
  au.role,
  au.is_active,
  au.created_at,
  u.email,
  ta.tokens_allocated,
  ta.tokens_remaining,
  CASE 
    WHEN au.role = 'super_admin' THEN '👑 Super Administrateur'
    WHEN au.role = 'admin' THEN '🔧 Administrateur'
    ELSE '❓ Rôle inconnu'
  END as role_display
FROM public.admin_users au
JOIN auth.users u ON au.user_id = u.id
LEFT JOIN public.token_allocations ta ON au.user_id = ta.user_id
ORDER BY au.role DESC, u.email;

-- 2. Statistiques des administrateurs
SELECT 'Statistiques' as section;
SELECT 
  COUNT(*) as total_admins,
  COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN is_active = true THEN 1 END) as admins_actifs,
  SUM(COALESCE(ta.tokens_allocated, 0)) as total_tokens_alloues,
  SUM(COALESCE(ta.tokens_remaining, 0)) as total_tokens_restants
FROM public.admin_users au
LEFT JOIN public.token_allocations ta ON au.user_id = ta.user_id;

-- 3. Vérification spécifique des 3 administrateurs
SELECT 'Vérification des 3 administrateurs' as section;
SELECT 
  u.email,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Administrateur'
    ELSE '❌ Non administrateur'
  END as statut_admin,
  au.role,
  CASE 
    WHEN ta.id IS NOT NULL THEN '✅ Tokens alloués'
    ELSE '❌ Pas de tokens'
  END as statut_tokens,
  ta.tokens_allocated,
  ta.tokens_remaining
FROM auth.users u
LEFT JOIN public.admin_users au ON u.id = au.user_id
LEFT JOIN public.token_allocations ta ON u.id = ta.user_id
WHERE u.email IN ('ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

