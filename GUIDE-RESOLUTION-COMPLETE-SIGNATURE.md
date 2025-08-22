# 🔧 Guide Complet de Résolution - Problème de Signature Électronique

## 🚨 Problème Identifié

L'erreur `500 (Internal Server Error)` lors de la signature électronique indique un problème avec l'Edge Function `save-contract-signature` ou la base de données.

## 📋 Diagnostic Complet

### 1. 🔍 Diagnostic de la Base de Données

**Exécutez d'abord le diagnostic :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql
2. **Copiez et exécutez** le contenu de `scripts/diagnostic-database.sql`
3. **Analysez les résultats** pour identifier les problèmes

### 2. 🔧 Correction de la Base de Données

**Si le diagnostic révèle des problèmes :**

1. **Exécutez** le contenu de `scripts/fix-database-issues.sql`
2. **Vérifiez** que toutes les requêtes s'exécutent sans erreur
3. **Confirmez** que la table `contract_signatures` est correctement configurée

### 3. 🔄 Redéploiement des Edge Functions

**Étapes manuelles :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Pour chaque fonction, cliquez sur "Deploy updates" :**
   - ✅ `save-contract-signature` (CRITIQUE)
   - ✅ `submit-guest-info`
   - ✅ `resolve-guest-link`
   - ✅ `list-guest-docs`
   - ✅ `send-owner-notification`
   - ✅ `storage-sign-url`

### 4. 🌐 Configuration des Allowed Origins

**Étapes :**

1. **Supabase Dashboard** → **Settings** → **Authentication** → **URL Configuration**
2. **Ajoutez** : `http://localhost:3001`
3. **Sauvegardez** les changements

### 5. 🔑 Vérification des Secrets

**Dans Supabase Dashboard** → **Settings** → **Edge Function Secrets :**

- `OPENAI_API_KEY` (si vous utilisez l'OCR)
- `RESEND_API_KEY` (pour les emails)

## 🧪 Test de la Solution

### 1. **Redémarrez l'application :**
```bash
npm run dev
```

### 2. **Testez la signature :**
- Allez sur `http://localhost:3001/`
- Suivez le processus de signature
- Vérifiez que la signature est sauvegardée

### 3. **Vérifiez les logs :**
- Ouvrez la console du navigateur
- Vérifiez qu'il n'y a plus d'erreurs 500

## 🔍 Diagnostic Avancé

### Si le problème persiste :

1. **Vérifiez les logs Supabase :**
   - Dashboard → Edge Functions → `save-contract-signature` → Logs

2. **Testez la fonction directement :**
   ```bash
   curl -X POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/save-contract-signature \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"bookingId":"test","signerName":"Test","signatureDataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}'
   ```

3. **Vérifiez la connectivité :**
   - Assurez-vous que votre réseau n'a pas de restrictions
   - Désactivez temporairement l'antivirus/firewall

## 📊 Requêtes de Vérification

### Vérifier la structure de la table :
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;
```

### Vérifier les données existantes :
```sql
SELECT 
    COUNT(*) as total_signatures,
    COUNT(CASE WHEN signature_data IS NOT NULL THEN 1 END) as valid_signatures
FROM contract_signatures;
```

### Vérifier les permissions RLS :
```sql
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'contract_signatures';
```

## ✅ Vérification Finale

Après avoir appliqué toutes les solutions :

1. ✅ **Base de données diagnostiquée et corrigée**
2. ✅ **Edge Functions redéployées**
3. ✅ **Allowed Origins configurées**
4. ✅ **Secrets configurés**
5. ✅ **Signature fonctionne sans erreur 500**

## 🆘 Support

Si le problème persiste après avoir suivi ce guide :

1. **Vérifiez** les logs Supabase Edge Functions
2. **Testez** avec un autre navigateur
3. **Vérifiez** votre connexion internet
4. **Contactez** le support si nécessaire

---

**🎯 Objectif :** Résoudre l'erreur 500 lors de la signature électronique pour permettre aux clients de signer leurs contrats de location.
