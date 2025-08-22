-- 🔍 Diagnostic Authentification Supabase - Problème "Email not confirmed"
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour diagnostiquer le problème

-- 1. Vérifier tous les utilisateurs et leur statut
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as status
FROM auth.users
ORDER BY created_at DESC;

-- 2. Vérifier spécifiquement l'utilisateur ghlilahlou26@gmail.com
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as status,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmé'
        ELSE '❌ Email non confirmé'
    END as message
FROM auth.users
WHERE email = 'ghlilahlou26@gmail.com';

-- 3. Compter les utilisateurs par statut
SELECT 
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as status,
    COUNT(*) as count
FROM auth.users
GROUP BY 
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END;

-- 4. Vérifier les sessions actives
SELECT 
    id,
    user_id,
    created_at,
    updated_at,
    expires_at,
    CASE 
        WHEN expires_at > NOW() THEN 'Active'
        ELSE 'Expired'
    END as session_status
FROM auth.sessions
ORDER BY created_at DESC
LIMIT 10;

-- 5. Vérifier les tentatives de connexion récentes
SELECT 
    id,
    user_id,
    ip_address,
    user_agent,
    created_at,
    event_type
FROM auth.audit_log_entries
WHERE event_type IN ('login', 'signup', 'email_confirmed')
ORDER BY created_at DESC
LIMIT 20;

-- 6. Forcer la confirmation de l'email (ATTENTION: à utiliser avec précaution)
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email = 'ghlilahlou26@gmail.com' 
-- AND email_confirmed_at IS NULL;

-- 7. Vérifier les paramètres d'authentification
SELECT 
    key,
    value
FROM auth.config
WHERE key IN ('enable_signup', 'enable_email_confirmations', 'enable_email_change_confirmations');

-- 8. Vérifier les identités liées à l'utilisateur
SELECT 
    id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
FROM auth.identities
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'ghlilahlou26@gmail.com'
);
