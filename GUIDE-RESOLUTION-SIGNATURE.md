# 🔧 Guide de Résolution - Problème de Signature Électronique

## 🚨 Problème Identifié

L'erreur `500 (Internal Server Error)` lors de la signature électronique indique que l'Edge Function `save-contract-signature` n'est pas correctement déployée ou configurée.

## 📋 Solutions à Appliquer

### 1. 🔄 Redéployer les Edge Functions

**Étapes manuelles :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions

2. **Pour chaque fonction, cliquez sur "Deploy updates" :**
   - ✅ `save-contract-signature` (CRITIQUE - pour la signature)
   - ✅ `submit-guest-info` (pour la soumission des infos client)
   - ✅ `resolve-guest-link` (pour la vérification des liens)
   - ✅ `list-guest-docs` (pour lister les documents)
   - ✅ `send-owner-notification` (pour les notifications)
   - ✅ `storage-sign-url` (pour le stockage)

### 2. 🌐 Configurer les Allowed Origins

**Étapes :**

1. **Supabase Dashboard** → **Settings** → **Authentication** → **URL Configuration**
2. **Ajoutez** : `http://localhost:3001`
3. **Sauvegardez** les changements

### 3. 🔑 Vérifier les Secrets

**Dans Supabase Dashboard** → **Settings** → **Edge Function Secrets :**

- `OPENAI_API_KEY` (si vous utilisez l'OCR)
- `RESEND_API_KEY` (pour les emails)

### 4. 🗄️ Vérifier la Table `contract_signatures`

**Assurez-vous que la table existe dans votre base de données :**

```sql
-- Vérifiez que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'contract_signatures';

-- Si elle n'existe pas, créez-la :
CREATE TABLE IF NOT EXISTS contract_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signature_data TEXT NOT NULL,
  contract_content TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

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

## ✅ Vérification Finale

Après avoir appliqué toutes les solutions :

1. ✅ **Edge Functions redéployées**
2. ✅ **Allowed Origins configurées**
3. ✅ **Secrets configurés**
4. ✅ **Table `contract_signatures` existe**
5. ✅ **Signature fonctionne sans erreur 500**

## 🆘 Support

Si le problème persiste après avoir suivi ce guide :

1. **Vérifiez** les logs Supabase Edge Functions
2. **Testez** avec un autre navigateur
3. **Vérifiez** votre connexion internet
4. **Contactez** le support si nécessaire

---

**🎯 Objectif :** Résoudre l'erreur 500 lors de la signature électronique pour permettre aux clients de signer leurs contrats de location.
