# 🚀 Guide de Déploiement Complet - GitHub + Vercel

## 📋 Prérequis

### 1. **Comptes Requis**
- ✅ Compte GitHub
- ✅ Compte Vercel
- ✅ Compte Supabase

### 2. **Outils Locaux**
- ✅ Git installé
- ✅ Node.js (v18+)
- ✅ Supabase CLI (optionnel)

## 🔧 Étape 1 : Préparation du Projet

### 1.1 Nettoyer les Fichiers Temporaires
```bash
# Supprimer les fichiers de test et temporaires
rm -f test-*.js
rm -f debug-*.js
rm -f fix-*.js
rm -f deploy-*.js
rm -f generate-contract-*.ts
rm -f submit-guest-info-*.ts
rm -rf backup-functions-*
rm -rf downloaded-functions/
rm -rf edge-functions-backup/
```

### 1.2 Créer .gitignore
```bash
# Créer/éditer .gitignore
echo "node_modules/
.env
.env.local
.env.production
dist/
build/
*.log
.DS_Store
.vscode/
.idea/
*.tmp
*.temp
backup-*
test-*
debug-*
fix-*
deploy-*
downloaded-functions/
edge-functions-backup/" > .gitignore
```

## 📤 Étape 2 : Déploiement sur GitHub

### 2.1 Initialiser Git (si pas déjà fait)
```bash
git init
git add .
git commit -m "feat: Ajout des 4 types de documents (Police, Contrat, Pièces ID, Fiches ID)"
```

### 2.2 Créer le Repository GitHub
1. Aller sur [GitHub.com](https://github.com)
2. Cliquer sur "New repository"
3. Nom : `morocco-host-helper`
4. Description : `Système de gestion de réservations pour hôtes au Maroc`
5. Public ou Private (selon préférence)
6. **NE PAS** cocher "Add README" (déjà présent)

### 2.3 Pousser vers GitHub
```bash
git remote add origin https://github.com/VOTRE_USERNAME/morocco-host-helper.git
git branch -M main
git push -u origin main
```

## 🌐 Étape 3 : Déploiement sur Vercel

### 3.1 Connexion Vercel-GitHub
1. Aller sur [Vercel.com](https://vercel.com)
2. Se connecter avec GitHub
3. Cliquer sur "New Project"
4. Importer le repository `morocco-host-helper`

### 3.2 Configuration Vercel
```json
{
  "Framework Preset": "Vite",
  "Root Directory": "./",
  "Build Command": "npm run vercel-build",
  "Output Directory": "dist",
  "Install Command": "npm install --legacy-peer-deps"
}
```

### 3.3 Variables d'Environnement
Dans Vercel Dashboard > Settings > Environment Variables :

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 Étape 4 : Déploiement des Edge Functions

### 4.1 Via Supabase Dashboard
1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Edge Functions > Deploy
4. Uploader les fonctions une par une :

**Fonctions à déployer :**
- ✅ `submit-guest-info`
- ✅ `generate-contract`
- ✅ `generate-police-forms`
- ✅ `generate-id-documents`
- ✅ `save-contract-signature`
- ✅ `storage-sign-url`

### 4.2 Via CLI (Optionnel)
```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref VOTRE_PROJECT_REF

# Déployer les fonctions
supabase functions deploy submit-guest-info
supabase functions deploy generate-contract
supabase functions deploy generate-police-forms
supabase functions deploy generate-id-documents
supabase functions deploy save-contract-signature
supabase functions deploy storage-sign-url
```

## 🧪 Étape 5 : Tests de Déploiement

### 5.1 Test Frontend
1. Aller sur l'URL Vercel
2. Tester la connexion Supabase
3. Vérifier l'affichage des 4 types de documents

### 5.2 Test Edge Functions
```bash
# Tester chaque fonction
curl -X POST https://VOTRE_PROJECT_REF.supabase.co/functions/v1/submit-guest-info \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 📊 Étape 6 : Monitoring et Maintenance

### 6.1 Vercel Analytics
- Activer Vercel Analytics
- Monitorer les performances
- Surveiller les erreurs

### 6.2 Supabase Monitoring
- Dashboard Supabase
- Logs des Edge Functions
- Métriques de base de données

## 🔒 Étape 7 : Sécurité

### 7.1 Variables d'Environnement
- ✅ Ne jamais commiter les clés
- ✅ Utiliser les variables Vercel
- ✅ Rotation régulière des clés

### 7.2 RLS (Row Level Security)
- ✅ Vérifier les politiques RLS
- ✅ Tester les permissions
- ✅ Auditer l'accès

## 🎯 Checklist de Déploiement

### Frontend (Vercel)
- [ ] Repository GitHub créé
- [ ] Code poussé sur GitHub
- [ ] Projet Vercel créé
- [ ] Variables d'environnement configurées
- [ ] Build réussi
- [ ] Site accessible

### Backend (Supabase)
- [ ] Edge Functions déployées
- [ ] Base de données migrée
- [ ] RLS configuré
- [ ] Storage configuré
- [ ] Tests fonctionnels

### Tests
- [ ] Connexion frontend-backend
- [ ] Génération de documents
- [ ] Upload de fichiers
- [ ] Authentification
- [ ] Responsive design

## 🚨 Résolution de Problèmes

### Erreur de Build Vercel
```bash
# Vérifier les logs
vercel logs

# Build local
npm run vercel-build
```

### Erreur Edge Functions
```bash
# Vérifier les logs Supabase
supabase functions logs FUNCTION_NAME
```

### Problème de Variables d'Environnement
- Vérifier les noms (VITE_ prefix pour le frontend)
- Vérifier les valeurs dans Vercel Dashboard
- Redéployer après modification

## 📞 Support

- **Vercel** : [Vercel Support](https://vercel.com/support)
- **Supabase** : [Supabase Support](https://supabase.com/support)
- **GitHub** : [GitHub Support](https://support.github.com)

---

## 🎉 Félicitations !

Votre application est maintenant déployée et accessible au monde entier !

**URLs importantes :**
- 🌐 **Frontend** : `https://votre-projet.vercel.app`
- 🔧 **Supabase Dashboard** : `https://supabase.com/dashboard/project/VOTRE_PROJECT_REF`
- 📊 **Vercel Dashboard** : `https://vercel.com/dashboard`
