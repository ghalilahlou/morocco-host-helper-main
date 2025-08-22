# 🔧 Guide de Résolution : Erreur Signature Électronique

## 🚨 Problème identifié
- **Erreur** : `500 (Internal Server Error)` lors de la sauvegarde de signature
- **Edge Function** : `save-contract-signature`
- **Message** : `"Edge Function returned a non-2xx status code"`

## 🔍 Diagnostic

### 1. Vérifier la structure de la table contract_signatures
Exécutez dans **Supabase SQL Editor** :
```sql
-- Vérifier si la table contract_signatures existe
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- Vérifier les contraintes de la table
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'contract_signatures';

-- Vérifier les politiques RLS
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE table_name = 'contract_signatures';
```

### 2. Tester une insertion manuelle
```sql
-- Tester une insertion simple
INSERT INTO contract_signatures (
  booking_id,
  signer_name,
  signer_email,
  signer_phone,
  signature_data,
  contract_content,
  signed_at
) VALUES (
  'test-booking-' || gen_random_uuid(),
  'Test Signer',
  'test@example.com',
  '+1234567890',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'Test contract content',
  now()
) RETURNING id, booking_id, signer_name;
```

## 🔧 Solution

### Étape 1 : Vérifier les logs de l'Edge Function
1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Cliquez sur** `save-contract-signature`
3. **Allez dans l'onglet "Logs"**
4. **Vérifiez les erreurs récentes**

### Étape 2 : Redéployer l'Edge Function
1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Cliquez sur** `save-contract-signature`
3. **Cliquez sur "Deploy updates"**

### Étape 3 : Tester la signature
1. **Allez sur** : https://morocco-host-helper-main.vercel.app
2. **Connectez-vous** avec `ghlilahlou26@gmail.com`
3. **Générez un lien client** et testez la signature
4. **Vérifiez les logs** dans la console du navigateur

## ✅ Vérification

### 1. Vérifier que la table existe et a la bonne structure
```sql
-- Vérifier que la table existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'contract_signatures'
);

-- Vérifier les colonnes requises
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
AND column_name IN ('booking_id', 'signer_name', 'signature_data', 'contract_content');
```

### 2. Vérifier les politiques RLS
```sql
-- Vérifier que RLS est activé
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'contract_signatures';

-- Vérifier les politiques
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'contract_signatures';
```

## 🎯 Résultat attendu
- ✅ Plus d'erreur `500 (Internal Server Error)`
- ✅ Signature sauvegardée avec succès
- ✅ Message de succès dans l'interface
- ✅ Signature visible dans la base de données

## 📝 Notes importantes
- L'Edge Function utilise `getServerClient()` pour accéder à la base de données
- Les signatures sont stockées en base64 PNG
- La table `contract_signatures` doit avoir les bonnes colonnes et contraintes
- Les politiques RLS doivent permettre l'insertion par l'Edge Function
