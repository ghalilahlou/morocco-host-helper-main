-- 🔍 Vérification de l'utilisateur liloulalou961@gmail.com
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Vérifier si l'utilisateur existe
SELECT 
    '1. VÉRIFICATION EXISTENCE UTILISATEUR' as section,
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    CASE
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmé'
        ELSE '❌ Non confirmé'
    END as status
FROM auth.users
WHERE email = 'liloulalou961@gmail.com';

-- 2. Vérifier tous les utilisateurs récents pour comparaison
SELECT 
    '2. TOUS LES UTILISATEURS RÉCENTS' as section,
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    CASE
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmé'
        ELSE '❌ Non confirmé'
    END as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 3. Vérifier les utilisateurs non confirmés
SELECT 
    '3. UTILISATEURS NON CONFIRMÉS' as section,
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- 4. Compter le nombre total d'utilisateurs
SELECT 
    '4. STATISTIQUES UTILISATEURS' as section,
    'Total utilisateurs' as metric,
    COUNT(*) as value
FROM auth.users
UNION ALL
SELECT 
    '4. STATISTIQUES UTILISATEURS' as section,
    'Utilisateurs confirmés' as metric,
    COUNT(*) as value
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 
    '4. STATISTIQUES UTILISATEURS' as section,
    'Utilisateurs non confirmés' as metric,
    COUNT(*) as value
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- 5. Vérifier les logs d'audit pour cet utilisateur
SELECT 
    '5. LOGS D\'AUDIT POUR L\'UTILISATEUR' as section,
    id,
    user_id,
    event_type,
    ip_address,
    created_at
FROM auth.audit_log_entries
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'liloulalou961@gmail.com'
)
ORDER BY created_at DESC
LIMIT 10;

-- 6. Vérifier les tentatives d'envoi d'email
SELECT 
    '6. TENTATIVES D\'ENVOI D\'EMAIL' as section,
    id,
    user_id,
    email,
    type,
    created_at,
    confirmed_at,
    expires_at
FROM auth.email_templates
WHERE email = 'liloulalou961@gmail.com'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Résumé de la vérification
SELECT 
    '7. RÉSUMÉ DE LA VÉRIFICATION' as section,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'liloulalou961@gmail.com') THEN '✅ Utilisateur trouvé'
        ELSE '❌ Utilisateur non trouvé'
    END as existence,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'liloulalou961@gmail.com' AND email_confirmed_at IS NOT NULL) THEN '✅ Email confirmé'
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'liloulalou961@gmail.com' AND email_confirmed_at IS NULL) THEN '❌ Email non confirmé'
        ELSE '❓ Statut inconnu'
    END as confirmation_status,
    now() as verified_at;
