-- Diagnostic des problèmes d'email de confirmation
-- Vérifier la configuration Supabase Auth

-- 1. Vérifier les utilisateurs non confirmés
SELECT 
    id,
    email,
    email_confirmed_at,
    CASE
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmé'
        ELSE '❌ Non confirmé'
    END as status,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- 2. Vérifier les tentatives d'envoi d'email
SELECT 
    id,
    user_id,
    email,
    type,
    created_at,
    confirmed_at,
    expires_at
FROM auth.email_templates
ORDER BY created_at DESC
LIMIT 10;

-- 3. Vérifier les logs d'audit pour les emails
SELECT 
    id,
    user_id,
    event_type,
    ip_address,
    user_agent,
    created_at
FROM auth.audit_log_entries
WHERE event_type LIKE '%email%' OR event_type LIKE '%confirm%'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Vérifier la configuration email de Supabase
SELECT 
    key,
    value
FROM auth.config
WHERE key LIKE '%email%' OR key LIKE '%smtp%' OR key LIKE '%mail%';

-- 5. Vérifier les utilisateurs récents
SELECT 
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
