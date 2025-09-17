# 🚀 Guide de Déploiement - Morocco Host Helper

Ce guide vous explique comment déployer votre application Morocco Host Helper en utilisant Docker, GitHub Actions et Vercel.

## 📋 Table des Matières

1. [Configuration Initiale](#configuration-initiale)
2. [Déploiement Docker](#déploiement-docker)
3. [Déploiement Vercel](#déploiement-vercel)
4. [GitHub Actions](#github-actions)
5. [Variables d'Environnement](#variables-denvironnement)
6. [Commandes Utiles](#commandes-utiles)

## 🔧 Configuration Initiale

### Prérequis

- Docker Desktop installé
- Compte GitHub
- Compte Vercel
- Compte Supabase
- Node.js 18+

### 1. Configuration GitHub

```bash
# Initialiser le repository Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit"

# Ajouter le remote GitHub
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git
git push -u origin main
```

### 2. Configuration des Secrets GitHub

Allez sur `https://github.com/VOTRE_USERNAME/VOTRE_REPO/settings/secrets/actions` et ajoutez :

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | URL de votre projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase |
| `VITE_OPENAI_API_KEY` | Clé API OpenAI |
| `VITE_RESEND_API_KEY` | Clé API Resend |
| `VITE_RESEND_FROM_EMAIL` | Email d'envoi Resend |
| `VERCEL_TOKEN` | Token Vercel |
| `VERCEL_ORG_ID` | ID de votre organisation Vercel |
| `VERCEL_PROJECT_ID` | ID de votre projet Vercel |
| `SUPABASE_ACCESS_TOKEN` | Token d'accès Supabase |
| `SUPABASE_PROJECT_REF` | Référence de votre projet Supabase |

## 🐳 Déploiement Docker

### Déploiement Local

```bash
# Déployer uniquement les Edge Functions
docker-compose -f docker-compose.functions-only.yml up -d

# Déployer l'application complète
docker-compose -f docker-compose.desktop.yml up -d

# Vérifier le statut
docker-compose -f docker-compose.desktop.yml ps
```

### URLs de Test

- **Application** : http://localhost:3000
- **Edge Functions** : http://localhost:54321
- **Health Check** : http://localhost:54321/health

### Test des Edge Functions

```bash
# Test de la fonction sync-documents
curl -X POST http://localhost:54321/functions/v1/sync-documents \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test123"}'
```

## 🌐 Déploiement Vercel

### 1. Configuration Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Cliquez sur "Import Project"
3. Sélectionnez votre repository GitHub
4. Configurez les variables d'environnement
5. Activez le déploiement automatique

### 2. Variables d'Environnement Vercel

Ajoutez ces variables dans les paramètres du projet Vercel :

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_key
VITE_RESEND_API_KEY=your_resend_key
VITE_RESEND_FROM_EMAIL=your_from_email
```

### 3. Configuration automatique

Le fichier `vercel.json` est déjà configuré pour :
- Build avec Vite
- Redirection SPA
- Cache des assets
- Headers optimisés

## ⚡ GitHub Actions

### Workflows Disponibles

1. **`docker-build-and-deploy.yml`** : Build Docker + Deploy Vercel
2. **`vercel-deploy.yml`** : Déploiement Vercel uniquement
3. **`docker-compose-deploy.yml`** : Validation Docker Compose

### Déclenchement Automatique

Les workflows se déclenchent automatiquement sur :
- Push vers `main`
- Pull Request vers `main`
- Déclenchement manuel

### Monitoring

```bash
# Voir les runs GitHub Actions
gh run list

# Voir les logs d'un run
gh run view --log

# Voir le statut en temps réel
gh run watch
```

## 🔐 Variables d'Environnement

### Frontend (Vite)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_OPENAI_API_KEY=your_openai_key
VITE_RESEND_API_KEY=your_resend_key
VITE_RESEND_FROM_EMAIL=noreply@yourdomain.com
VITE_APP_NAME=Morocco Host Helper
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_AI_OCR=true
VITE_ENABLE_AIRBNB_SYNC=true
VITE_ENABLE_EMAIL_NOTIFICATIONS=true
```

### Edge Functions (Supabase)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
```

## 🛠️ Commandes Utiles

### Scripts PowerShell

```powershell
# Configuration initiale
.\scripts\setup-github-vercel.ps1

# Déploiement rapide
.\scripts\deploy-to-vercel.ps1

# Déploiement avec message personnalisé
.\scripts\deploy-to-vercel.ps1 -Message "fix: resolve authentication issue"

# Déploiement sans tests
.\scripts\deploy-to-vercel.ps1 -SkipTests
```

### Commandes Docker

```bash
# Build des images
docker build -t morocco-host-app .
docker build -f Dockerfile.functions -t morocco-host-functions .

# Test des containers
docker run -d --name test-functions -p 54321:54321 morocco-host-functions
curl http://localhost:54321/health

# Nettoyage
docker stop test-functions
docker rm test-functions
```

### Commandes Git

```bash
# Déploiement manuel
git add .
git commit -m "feat: add new feature"
git push origin main

# Voir les changements
git status
git diff

# Rollback
git revert HEAD
git push origin main
```

## 🔍 Dépannage

### Problèmes Courants

1. **Container qui redémarre**
   ```bash
   docker logs morocco-host-app
   docker logs morocco-host-functions
   ```

2. **Erreur 401 sur les Edge Functions**
   - Vérifiez les tokens dans `submit-guest-info`
   - Vérifiez les secrets GitHub

3. **Build Vercel échoue**
   - Vérifiez les variables d'environnement
   - Vérifiez les dépendances dans `package.json`

4. **Edge Functions non déployées**
   - Vérifiez `SUPABASE_ACCESS_TOKEN`
   - Vérifiez `SUPABASE_PROJECT_REF`

### Logs et Monitoring

```bash
# Logs Docker
docker-compose -f docker-compose.desktop.yml logs -f

# Logs GitHub Actions
gh run view --log

# Logs Vercel
vercel logs

# Logs Supabase
supabase functions logs
```

## 📊 URLs de Production

Une fois déployé, votre application sera disponible sur :

- **Frontend** : `https://your-project.vercel.app`
- **Edge Functions** : `https://your-project.supabase.co/functions/v1/`
- **Health Check** : `https://your-project.supabase.co/functions/v1/health`

## 🎯 Prochaines Étapes

1. ✅ Configurez les secrets GitHub
2. ✅ Importez le projet sur Vercel
3. ✅ Testez le déploiement automatique
4. ✅ Configurez un domaine personnalisé
5. ✅ Activez les notifications de déploiement
6. ✅ Configurez le monitoring et les alertes

---

**Support** : Pour toute question, consultez les logs ou créez une issue sur GitHub.


