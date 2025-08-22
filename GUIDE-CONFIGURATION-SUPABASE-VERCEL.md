# 🔧 Configuration Supabase pour Vercel - Guide Complet

## 🎯 **Problème actuel :**
- Application déployée sur Vercel : `https://morocco-host-helper-main.vercel.app`
- Erreur d'authentification : "Email not confirmed"
- Erreurs 400 dans la console Supabase

## 📋 **Étapes de configuration :**

### **1. Allowed Origins (CRITIQUE)**
Allez sur : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/settings/auth

**Dans "URL Configuration" :**
- ✅ **Site URL** : `https://morocco-host-helper-main.vercel.app`
- ✅ **Redirect URLs** : 
  - `https://morocco-host-helper-main.vercel.app/auth/callback`
  - `https://morocco-host-helper-main.vercel.app/dashboard`
  - `https://morocco-host-helper-main.vercel.app/`

**Dans "Additional Allowed Origins" :**
- ✅ `https://morocco-host-helper-main.vercel.app`
- ✅ `https://*.vercel.app`

### **2. Vérifier l'utilisateur**
Allez sur : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/auth/users

**Pour l'utilisateur `ghlilahlou26@gmail.com` :**
- ✅ **Confirmer l'email** : Cliquez sur "Confirm"
- ✅ **Vérifier le statut** : Doit être "Confirmed"

### **3. Variables d'environnement Vercel**
Allez sur : https://vercel.com/dashboard/project/morocco-host-helper-main/settings/environment-variables

**Ajoutez ces variables :**
```
VITE_SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iJjvuckTVJyKo6wDd9AMEeakM
```

### **4. Redéployer l'application**
Après avoir configuré Supabase, redéployez sur Vercel :
- Allez sur : https://vercel.com/dashboard/project/morocco-host-helper-main
- Cliquez sur "Redeploy"

## 🧪 **Test après configuration :**

1. **Vider le cache navigateur** (Ctrl+Shift+R)
2. **Aller sur** : https://morocco-host-helper-main.vercel.app/auth
3. **Tester la connexion** avec `ghlilahlou26@gmail.com`
4. **Vérifier la console** : Plus d'erreurs 400

## 🔍 **Si le problème persiste :**

### **Option 1 : Créer un nouvel utilisateur**
1. Allez sur la page d'inscription
2. Créez un nouveau compte avec un email différent
3. Confirmez l'email dans Supabase

### **Option 2 : Réinitialiser le mot de passe**
1. Utilisez "Mot de passe oublié"
2. Réinitialisez le mot de passe
3. Connectez-vous avec le nouveau mot de passe

## 📞 **Support :**
Si les problèmes persistent, vérifiez :
- Les logs Vercel : https://vercel.com/dashboard/project/morocco-host-helper-main/functions
- Les logs Supabase : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/logs
