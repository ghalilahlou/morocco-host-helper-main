# ⚡ Guide de Redéploiement des Edge Functions - Morocco Host Helper

**Date :** 22 Août 2025  
**Projet :** csopyblkfyofwkeqqegd  
**Statut :** ⚠️ **REDÉPLOIEMENT NÉCESSAIRE**

---

## 🚨 **Problème Identifié**

### **Erreurs JavaScript dans l'Application**
- Les Edge Functions retournent des erreurs `non-2xx status code`
- Cela cause des erreurs JavaScript dans l'application frontend
- 14 fonctions nécessitent un redéploiement

### **Fonctions Affectées (14/14)**
- `extract-document-data`
- `generate-documents`
- `get-airbnb-reservation`
- `get-booking-verification-summary`
- `get-guest-docs`
- `issue-guest-link`
- `list-guest-docs`
- `resolve-guest-link`
- `save-contract-signature`
- `send-owner-notification`
- `storage-sign-url`
- `submit-guest-info`
- `sync-airbnb-calendar`
- `sync-airbnb-reservations`

---

## 🔧 **Méthodes de Redéploiement**

### **Méthode 1: Via Supabase Dashboard (Recommandée)**

#### **Étapes :**
1. **Accédez au Dashboard Supabase**
   - URL : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd
   - Connectez-vous avec votre compte Supabase

2. **Naviguez vers Edge Functions**
   - Dans le menu de gauche, cliquez sur "Edge Functions"
   - Vous verrez la liste de toutes vos fonctions

3. **Redéployez chaque fonction**
   - Pour chaque fonction, cliquez sur le bouton "Deploy" ou "Redeploy"
   - Attendez que le déploiement se termine
   - Répétez pour toutes les 14 fonctions

#### **Avantages :**
- ✅ Interface graphique intuitive
- ✅ Pas d'installation requise
- ✅ Contrôle individuel de chaque fonction
- ✅ Logs de déploiement visibles

---

### **Méthode 2: Via Supabase CLI**

#### **Installation du CLI :**

**Option A : Téléchargement Direct**
1. Allez sur https://supabase.com/docs/guides/cli
2. Téléchargez la version Windows
3. Installez l'exécutable

**Option B : Via Package Manager**
```bash
# Avec winget (si disponible)
winget install Supabase.CLI

# Avec Chocolatey (si installé)
choco install supabase

# Avec Scoop (si installé)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### **Utilisation du CLI :**
```bash
# 1. Se connecter à Supabase
supabase login

# 2. Lier le projet
supabase link --project-ref csopyblkfyofwkeqqegd

# 3. Redéployer toutes les fonctions
supabase functions deploy

# 4. Ou redéployer une fonction spécifique
supabase functions deploy get-airbnb-reservation
```

#### **Avantages :**
- ✅ Déploiement en lot
- ✅ Automatisation possible
- ✅ Intégration CI/CD

---

### **Méthode 3: Via GitHub Actions (Automatique)**

#### **Étapes :**
1. **Poussez vos changements vers GitHub**
   ```bash
   git add .
   git commit -m "Fix: Redéploiement Edge Functions"
   git push origin main
   ```

2. **Les Edge Functions se redéploieront automatiquement**
   - Si vous avez configuré GitHub Actions
   - Sinon, utilisez les méthodes 1 ou 2

#### **Avantages :**
- ✅ Automatique
- ✅ Pas d'intervention manuelle
- ✅ Intégration continue

---

## 🧪 **Vérification Post-Déploiement**

### **Test Automatique**
```bash
# Exécuter le script de test
node scripts/test-supabase-connection.js

# Ou le script spécifique aux Edge Functions
node scripts/deploy-edge-functions-rest.js
```

### **Test Manuel**
1. **Ouvrez votre application** : http://localhost:3000
2. **Vérifiez la console du navigateur** (F12)
3. **Testez les fonctionnalités** qui utilisent les Edge Functions

### **Résultats Attendus**
- ✅ Toutes les Edge Functions retournent des réponses 2xx
- ✅ Plus d'erreurs JavaScript dans la console
- ✅ Application complètement fonctionnelle

---

## 🔍 **Diagnostic des Problèmes**

### **Si le Redéploiement Échoue :**

1. **Vérifiez les Logs de Déploiement**
   - Dans le Dashboard Supabase > Edge Functions
   - Regardez les logs de chaque fonction

2. **Vérifiez la Configuration**
   ```bash
   # Vérifier le fichier config.toml
   cat supabase/config.toml
   ```

3. **Vérifiez les Variables d'Environnement**
   - Dans le Dashboard Supabase > Settings > Environment Variables
   - Assurez-vous que toutes les variables sont configurées

### **Variables d'Environnement Requises :**
```env
# Dans le Dashboard Supabase > Settings > Environment Variables
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=your_resend_api_key
SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📋 **Checklist de Redéploiement**

### **Avant le Redéploiement :**
- [ ] Sauvegarder les changements locaux
- [ ] Vérifier la configuration des variables d'environnement
- [ ] S'assurer que le code des fonctions est à jour

### **Pendant le Redéploiement :**
- [ ] Redéployer toutes les 14 fonctions
- [ ] Vérifier les logs de déploiement
- [ ] Attendre la confirmation de succès

### **Après le Redéploiement :**
- [ ] Tester la connexion Supabase
- [ ] Vérifier les Edge Functions
- [ ] Tester l'application complète
- [ ] Vérifier la console du navigateur

---

## 🎯 **Résultat Final Attendu**

Après le redéploiement réussi :
- ✅ **14/14 Edge Functions** fonctionnelles
- ✅ **Erreurs JavaScript** résolues
- ✅ **Application complètement** opérationnelle
- ✅ **Fonctionnalités avancées** disponibles (OCR, emails, etc.)

---

## 📞 **Support**

### **Si les Problèmes Persistent :**
1. Vérifiez les logs de déploiement dans le Dashboard Supabase
2. Testez avec `node scripts/test-supabase-connection.js`
3. Vérifiez la configuration des variables d'environnement
4. Contactez le support Supabase si nécessaire

### **Liens Utiles :**
- **Dashboard Supabase :** https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd
- **Documentation CLI :** https://supabase.com/docs/guides/cli
- **Documentation Edge Functions :** https://supabase.com/docs/guides/functions

---

**🎉 Une fois les Edge Functions redéployées, votre application Morocco Host Helper sera complètement fonctionnelle !**
