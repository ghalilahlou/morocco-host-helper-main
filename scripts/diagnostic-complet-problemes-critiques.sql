-- 🔍 DIAGNOSTIC COMPLET - PROBLÈMES CRITIQUES IDENTIFIÉS
-- Exécutez ce script dans l'éditeur SQL de Supabase pour diagnostiquer et résoudre tous les problèmes

-- =====================================================
-- 1. DIAGNOSTIC DE L'ENUM booking_status
-- =====================================================

-- Vérifier les valeurs actuelles de l'ENUM booking_status
SELECT 
    '1. VALEURS ENUM booking_status' as section,
    enumlabel as valeur_enum
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
ORDER BY enumsortorder;

-- Vérifier la structure de la table bookings
SELECT 
    '2. STRUCTURE TABLE bookings' as section,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
    AND column_name = 'status'
ORDER BY ordinal_position;

-- Vérifier les données existantes dans bookings
SELECT 
    '3. DONNÉES EXISTANTES bookings' as section,
    status,
    COUNT(*) as nombre_reservations
FROM bookings 
GROUP BY status;

-- =====================================================
-- 2. DIAGNOSTIC DE LA TABLE contract_signatures
-- =====================================================

-- Vérifier si la table contract_signatures existe
SELECT 
    '4. EXISTENCE TABLE contract_signatures' as section,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'contract_signatures';

-- Vérifier la structure de contract_signatures
SELECT 
    '5. STRUCTURE TABLE contract_signatures' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- Vérifier les contraintes de contract_signatures
SELECT 
    '6. CONTRAINTES contract_signatures' as section,
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'contract_signatures';

-- =====================================================
-- 3. DIAGNOSTIC DES POLITIQUES RLS
-- =====================================================

-- Vérifier les politiques RLS sur property_verification_tokens
SELECT 
    '7. POLITIQUES RLS property_verification_tokens' as section,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'property_verification_tokens';

-- Vérifier les politiques RLS sur contract_signatures
SELECT 
    '8. POLITIQUES RLS contract_signatures' as section,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- Vérifier les politiques RLS sur bookings
SELECT 
    '9. POLITIQUES RLS bookings' as section,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'bookings';

-- =====================================================
-- 4. DIAGNOSTIC DES UTILISATEURS ET AUTHENTIFICATION
-- =====================================================

-- Vérifier les utilisateurs non confirmés
SELECT 
    '10. UTILISATEURS NON CONFIRMÉS' as section,
    id,
    email,
    email_confirmed_at,
    CASE
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmé'
        ELSE '❌ Non confirmé'
    END as status,
    created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- Vérifier tous les utilisateurs récents
SELECT 
    '11. TOUS LES UTILISATEURS RÉCENTS' as section,
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

-- =====================================================
-- 5. DIAGNOSTIC DES PROPRIÉTÉS ET RÉSERVATIONS
-- =====================================================

-- Vérifier les propriétés existantes
SELECT 
    '12. PROPRIÉTÉS EXISTANTES' as section,
    id,
    name,
    user_id,
    created_at
FROM properties
ORDER BY created_at DESC;

-- Vérifier les réservations existantes
SELECT 
    '13. RÉSERVATIONS EXISTANTES' as section,
    id,
    property_id,
    check_in_date,
    check_out_date,
    status,
    user_id,
    created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 6. DIAGNOSTIC DES TOKENS DE VÉRIFICATION
-- =====================================================

-- Vérifier les tokens de vérification existants
SELECT 
    '14. TOKENS DE VÉRIFICATION' as section,
    id,
    property_id,
    token,
    is_active,
    created_at
FROM property_verification_tokens
ORDER BY created_at DESC;

-- =====================================================
-- 7. DIAGNOSTIC DES SOUMISSIONS D'INVITÉS
-- =====================================================

-- Vérifier les soumissions d'invités
SELECT 
    '15. SOUMISSIONS D\'INVITÉS' as section,
    id,
    token_id,
    status,
    submitted_at,
    created_at
FROM guest_submissions
ORDER BY created_at DESC;

-- =====================================================
-- 8. RÉSUMÉ DU DIAGNOSTIC
-- =====================================================

SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Total utilisateurs' as metric,
    COUNT(*) as value
FROM auth.users
UNION ALL
SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Utilisateurs non confirmés' as metric,
    COUNT(*) as value
FROM auth.users
WHERE email_confirmed_at IS NULL
UNION ALL
SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Total propriétés' as metric,
    COUNT(*) as value
FROM properties
UNION ALL
SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Total réservations' as metric,
    COUNT(*) as value
FROM bookings
UNION ALL
SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Total tokens' as metric,
    COUNT(*) as value
FROM property_verification_tokens
UNION ALL
SELECT 
    '16. RÉSUMÉ DU DIAGNOSTIC' as section,
    'Total soumissions' as metric,
    COUNT(*) as value
FROM guest_submissions;
