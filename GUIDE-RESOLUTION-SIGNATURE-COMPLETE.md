# 🔧 Guide de Résolution : Erreur Signature Électronique - SOLUTION COMPLÈTE

## 🚨 Problème identifié
- **Erreur** : `column "signer_name" of relation "contract_signatures" does not exist`
- **Cause** : La table `contract_signatures` n'existe pas ou a une structure incorrecte
- **Impact** : Impossible de sauvegarder les signatures électroniques

## 🔧 Solution en 3 étapes

### **Étape 1 : Créer la table contract_signatures**

Exécutez ce script dans **Supabase SQL Editor** :

```sql
-- Créer la table contract_signatures si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signature_data TEXT NOT NULL,
  contract_content TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Users can view signatures for their bookings" 
ON public.contract_signatures 
FOR SELECT 
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create signatures for their bookings" 
ON public.contract_signatures 
FOR INSERT 
WITH CHECK (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update signatures for their bookings" 
ON public.contract_signatures 
FOR UPDATE 
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id 
ON public.contract_signatures(booking_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at 
ON public.contract_signatures(signed_at);
```

### **Étape 2 : Vérifier que la table a été créée**

```sql
-- Vérifier la structure de la table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- Vérifier les politiques RLS
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'contract_signatures';
```

### **Étape 3 : Tester une insertion**

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

## 🔄 Redéployer l'Edge Function

### **Étape 4 : Redéployer save-contract-signature**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Cliquez sur** `save-contract-signature`
3. **Cliquez sur "Deploy updates"**
4. **Attendez** que le déploiement soit terminé

## ✅ Test de la solution

### **Étape 5 : Tester la signature**

1. **Allez sur** : https://morocco-host-helper-main.vercel.app
2. **Connectez-vous** avec `ghlilahlou26@gmail.com`
3. **Générez un lien client** depuis votre propriété
4. **Ouvrez le lien** dans un nouvel onglet
5. **Remplissez le formulaire** et signez le contrat
6. **Vérifiez** qu'il n'y a plus d'erreur 500

## 🔍 Diagnostic avancé

### **Si le problème persiste :**

1. **Vérifiez les logs Supabase :**
   - Dashboard → Edge Functions → `save-contract-signature` → Logs
   - Cherchez les erreurs récentes

2. **Vérifiez la console du navigateur :**
   - Ouvrez les outils de développement (F12)
   - Allez dans l'onglet "Console"
   - Cherchez les erreurs lors de la signature

3. **Testez la fonction directement :**
   ```bash
   curl -X POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/save-contract-signature \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"bookingId":"test","signerName":"Test","signatureDataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}'
   ```

## 🎯 Résultat attendu

Après avoir suivi ces étapes :

- ✅ **Table `contract_signatures` créée** avec la bonne structure
- ✅ **Politiques RLS configurées** pour la sécurité
- ✅ **Edge Function redéployée** avec les corrections
- ✅ **Signature fonctionne** sans erreur 500
- ✅ **Message de succès** dans l'interface
- ✅ **Signature visible** dans la base de données

## 📝 Notes importantes

- La table `contract_signatures` stocke les signatures en base64 PNG
- Les politiques RLS permettent aux utilisateurs de voir/créer des signatures pour leurs réservations
- L'Edge Function utilise `getServerClient()` pour accéder à la base de données
- Les signatures sont liées aux réservations via `booking_id`

---

**🎯 Objectif :** Permettre aux clients de signer électroniquement leurs contrats de location sans erreur.
