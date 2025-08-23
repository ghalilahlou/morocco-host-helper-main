# 🔍 Guide de Diagnostic : Problèmes d'Email de Confirmation

## 🚨 Problèmes courants d'email de confirmation

### **1. Vérifier la configuration Supabase Auth**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/auth/settings
**Vérifiez** :
- **Email confirmations** : Activé
- **SMTP Settings** : Configuré
- **Email Templates** : Personnalisés

### **2. Vérifier les utilisateurs non confirmés**

**Exécutez ce script dans Supabase SQL Editor :**

```sql
-- Vérifier les utilisateurs non confirmés
SELECT 
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
```

### **3. Vérifier les logs d'audit**

```sql
-- Vérifier les logs d'audit pour les emails
SELECT 
    id,
    user_id,
    event_type,
    created_at
FROM auth.audit_log_entries
WHERE event_type LIKE '%email%' OR event_type LIKE '%confirm%'
ORDER BY created_at DESC
LIMIT 20;
```

### **4. Vérifier la configuration email**

**Dans Supabase Dashboard :**
1. **Auth → Settings → Email Templates**
2. **Vérifiez** que les templates sont configurés
3. **Auth → Settings → SMTP Settings**
4. **Vérifiez** que SMTP est configuré

### **5. Vérifier les Edge Functions d'email**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
**Vérifiez** :
- `send-owner-notification` : Déployée
- **Secrets** : `RESEND_API_KEY` configuré

## 🔧 Solutions courantes

### **Problème 1 : Configuration SMTP manquante**
**Solution :** Configurer SMTP dans Supabase Auth Settings

### **Problème 2 : Templates d'email non configurés**
**Solution :** Personnaliser les templates dans Auth Settings

### **Problème 3 : Emails dans les spams**
**Solution :** Vérifier le dossier spam et configurer SPF/DKIM

### **Problème 4 : Edge Function non déployée**
**Solution :** Redéployer `send-owner-notification`

### **Problème 5 : Secrets manquants**
**Solution :** Configurer `RESEND_API_KEY` dans Edge Function Secrets

## 🎯 Actions à effectuer

1. **Vérifiez** la configuration Supabase Auth
2. **Exécutez** le script de diagnostic SQL
3. **Vérifiez** les Edge Functions d'email
4. **Testez** l'envoi d'email manuellement

## 📧 Configuration SMTP recommandée

**Dans Supabase Auth Settings :**
- **SMTP Host** : `smtp.gmail.com` (pour Gmail)
- **SMTP Port** : `587`
- **SMTP User** : Votre email
- **SMTP Pass** : Mot de passe d'application

**Commencez par vérifier la configuration Supabase Auth !** 🚀
