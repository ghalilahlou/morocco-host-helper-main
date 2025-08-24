# 🔒 GUIDE DE SÉCURITÉ - MOROCCO HOST HELPER

## 🚨 URGENCE SÉCURITÉ - ACTIONS IMMÉDIATES

### **1. PURGE DE L'HISTORIQUE GIT (OBLIGATOIRE)**

**Option A - BFG Repo-Cleaner (Recommandé)**
```bash
# 1. Sauvegarde du repo
git clone --mirror https://github.com/ghalilahlou/morocco-host-helper-main.git
cd morocco-host-helper-main.git

# 2. Purge des fichiers sensibles
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-files ".env.*.local"

# 3. Nettoyage et push forcé
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**Option B - git filter-repo**
```bash
# 1. Installation
pip install git-filter-repo

# 2. Clone et purge
git clone https://github.com/ghalilahlou/morocco-host-helper-main.git
cd morocco-host-helper-main

git filter-repo --path .env --invert-paths
git filter-repo --path-glob ".env.*.local" --invert-paths

git push origin --force
```

### **2. ROTATION DES CLÉS SUPABASE (OBLIGATOIRE)**

**Après la purge Git :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/settings/api
2. **Générez de nouvelles clés** :
   - Anon Key (public)
   - Service Role Key (secret)
   - JWT Secret
3. **Mettez à jour Vercel** avec les nouvelles clés

### **3. CONFIGURATION VERCEL**

**Variables d'environnement à configurer :**
```
VITE_SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
VITE_SUPABASE_ANON_KEY=[NOUVELLE_CLÉ_ANON]
```

**Instructions :**
1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet
3. Settings > Environment Variables
4. Ajoutez les variables ci-dessus
5. Redéployez

## 🔧 SÉCURISATION SUPABASE

### **1. EXÉCUTION DU SCRIPT RLS**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql

**Exécutez le script** : `scripts/supabase-rls-safe-defaults.sql`

### **2. CONFIGURATION CORS**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/settings/api

**Additional Allowed Origins :**
```
https://morocco-host-helper-main-58sp4dz5i-songos-projects-a250e94a.vercel.app
https://morocco-host-helper-main.vercel.app
http://localhost:3000
```

### **3. CONFIGURATION AUTHENTIFICATION**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/auth/url-configuration

**Site URL :**
```
https://morocco-host-helper-main-58sp4dz5i-songos-projects-a250e94a.vercel.app
```

**Redirect URLs :**
```
https://morocco-host-helper-main-58sp4dz5i-songos-projects-a250e94a.vercel.app/auth/callback
https://morocco-host-helper-main-58sp4dz5i-songos-projects-a250e94a.vercel.app/dashboard
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
```

### **4. CONFIGURATION STORAGE**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/storage/buckets

**Pour chaque bucket :**
1. **Rendez privé** par défaut
2. **Ajoutez des politiques RLS** si nécessaire
3. **Vérifiez les permissions**

## 🚀 DÉPLOIEMENT SÉCURISÉ

### **1. VÉRIFICATION PRÉ-DÉPLOIEMENT**

```bash
# Test local complet
npm run typecheck
npm run lint
npm run build
npm run preview
```

### **2. DÉPLOIEMENT VERCEL**

1. **Push sur GitHub** → Déploiement automatique
2. **Vérifiez les logs** de build
3. **Testez l'application** déployée

### **3. VÉRIFICATION POST-DÉPLOIEMENT**

- [ ] Authentification fonctionne
- [ ] CRUD propriétés fonctionne
- [ ] Réservations fonctionnent
- [ ] Signatures électroniques fonctionnent
- [ ] Liens de vérification fonctionnent
- [ ] Edge Functions répondent

## 🔍 MONITORING ET MAINTENANCE

### **1. LOGS VERCEL**

**Consultez régulièrement :**
- Build Logs : https://vercel.com/dashboard/[PROJECT]/deployments
- Runtime Logs : https://vercel.com/dashboard/[PROJECT]/functions

### **2. LOGS SUPABASE**

**Consultez régulièrement :**
- Database Logs : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/logs
- Edge Functions Logs : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions

### **3. AUDIT DE SÉCURITÉ**

**Mensuellement :**
- Vérifiez les accès utilisateurs
- Auditez les politiques RLS
- Vérifiez les variables d'environnement
- Testez les fonctionnalités critiques

## 🛡️ BONNES PRATIQUES

### **1. DÉVELOPPEMENT**

- **NEVER** commiter de secrets
- Utilisez des variables d'environnement
- Testez les politiques RLS
- Validez les entrées utilisateur

### **2. DÉPLOIEMENT**

- Utilisez des environnements séparés (dev/staging/prod)
- Validez les builds avant déploiement
- Surveillez les logs d'erreur
- Testez après chaque déploiement

### **3. MAINTENANCE**

- Mettez à jour les dépendances régulièrement
- Surveillez les vulnérabilités
- Sauvegardez les données importantes
- Documentez les changements

## 🚨 EN CAS D'INCIDENT

### **1. FUITE DE SECRETS**

1. **IMMÉDIAT** : Roter toutes les clés exposées
2. **Purge** : Nettoyer l'historique Git
3. **Notification** : Informer les utilisateurs si nécessaire
4. **Investigation** : Identifier la cause

### **2. COMPROMISSION DE COMPTE**

1. **IMMÉDIAT** : Révoquer les sessions
2. **Audit** : Vérifier les accès
3. **Nettoyage** : Supprimer les données compromises
4. **Prévention** : Renforcer la sécurité

### **3. ERREURS DE PRODUCTION**

1. **Rollback** : Revenir à la version stable
2. **Investigation** : Analyser les logs
3. **Correction** : Déployer le fix
4. **Monitoring** : Surveiller la stabilité

## 📞 CONTACTS D'URGENCE

- **GitHub Issues** : https://github.com/ghalilahlou/morocco-host-helper-main/issues
- **Vercel Support** : https://vercel.com/support
- **Supabase Support** : https://supabase.com/support

---

**⚠️ IMPORTANT : Ce guide doit être suivi à la lettre pour garantir la sécurité de l'application.**
