# 🔧 Guide de Résolution : Erreur RLS property_verification_tokens

## 🚨 Problème identifié
- **Erreur** : `403 (Forbidden)` lors de la génération de lien client
- **Cause** : Violation de la politique RLS (Row Level Security) sur la table `property_verification_tokens`
- **Message** : `"new row violates row-level security policy for table 'property_verification_tokens'"`

## 🔍 Diagnostic

### 1. Vérifier les politiques RLS actuelles
Exécutez dans **Supabase SQL Editor** :
```sql
-- Vérifier les politiques RLS sur property_verification_tokens
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'property_verification_tokens';
```

### 2. Vérifier la propriété de l'utilisateur
```sql
-- Vérifier si l'utilisateur actuel peut voir ses propriétés
SELECT 
    id,
    name,
    user_id,
    CASE 
        WHEN user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd' THEN '✅ Propriété de l\'utilisateur actuel'
        ELSE '❌ Propriété d\'un autre utilisateur'
    END as status
FROM properties 
WHERE id = 'a1072d02-dc8a-48b2-82a7-7f50d02d3985';
```

## 🔧 Solution

### Étape 1 : Corriger les politiques RLS
Exécutez ce script dans **Supabase SQL Editor** :

```sql
-- Supprimer les anciennes politiques RLS
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;

-- Recréer les politiques RLS correctement
CREATE POLICY "Users can view tokens for their properties" 
ON public.property_verification_tokens 
FOR SELECT 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tokens for their properties" 
ON public.property_verification_tokens 
FOR INSERT 
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tokens for their properties" 
ON public.property_verification_tokens 
FOR UPDATE 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- Vérifier que RLS est activé
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;
```

### Étape 2 : Tester la création de token
```sql
-- Test d'insertion manuel pour vérifier
INSERT INTO public.property_verification_tokens (
  property_id,
  token,
  is_active
) VALUES (
  'a1072d02-dc8a-48b2-82a7-7f50d02d3985',
  'test-token-' || gen_random_uuid(),
  true
) ON CONFLICT (property_id) DO UPDATE SET
  token = EXCLUDED.token,
  is_active = EXCLUDED.is_active,
  updated_at = now();
```

## ✅ Vérification

### 1. Vérifier que les politiques sont créées
```sql
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'property_verification_tokens'
ORDER BY policyname;
```

### 2. Tester la génération de lien
1. **Allez sur** : https://morocco-host-helper-main.vercel.app/auth
2. **Connectez-vous** avec `ghlilahlou26@gmail.com`
3. **Cliquez sur "Générer lien client"**
4. **Vérifiez qu'il n'y a plus d'erreur 403**

## 🎯 Résultat attendu
- ✅ Plus d'erreur `403 (Forbidden)`
- ✅ Lien client généré avec succès
- ✅ Message de succès dans l'interface

## 📝 Notes importantes
- Les politiques RLS utilisent `auth.uid()` pour identifier l'utilisateur connecté
- La propriété doit appartenir à l'utilisateur authentifié
- Les tokens sont uniques par propriété (contrainte UNIQUE sur property_id)
