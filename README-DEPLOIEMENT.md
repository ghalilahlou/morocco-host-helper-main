# 🚀 Guide de Déploiement - Morocco Host Helper

## 📋 Vue d'Ensemble

Ce projet est un système complet de gestion de réservations pour hôtes au Maroc, avec 4 types de documents :
- 🛡️ **Fiche de Police** - Déclaration d'arrivée
- 📄 **Contrat** - Contrat de location
- 🆔 **Pièces ID** - Documents uploadés par invités
- 👥 **Fiches ID** - Documents formatés générés

## 🎯 Déploiement Rapide

### Option 1 : Script Automatique (Recommandé)

**Windows (PowerShell) :**
```powershell
.\scripts\deploy-to-github-vercel.ps1
```

**Linux/macOS (Bash) :**
```bash
chmod +x scripts/deploy-to-github-vercel.sh
./scripts/deploy-to-github-vercel.sh
```

### Option 2 : Déploiement Manuel

## 📤 Étape 1 : GitHub

### 1.1 Préparation
```bash
# Nettoyer le projet
node scripts/cleanup-for-deployment.js

# Vérifier le statut
git status
```

### 1.2 Commit et Push
```bash
# Ajouter les fichiers
git add .

# Créer le commit
git commit -m "feat: Déploiement complet - 4 types de documents + corrections"

# Pousser vers GitHub
git push -u origin main
```

## 🌐 Étape 2 : Vercel

### 2.1 Créer le Projet
1. Aller sur [Vercel.com](https://vercel.com)
2. Se connecter avec GitHub
3. Cliquer sur "New Project"
4. Importer votre repository

### 2.2 Configuration Vercel
```json
{
  "Framework Preset": "Vite",
  "Root Directory": "./",
  "Build Command": "npm run vercel-build",
  "Output Directory": "dist",
  "Install Command": "npm install --legacy-peer-deps"
}
```

### 2.3 Variables d'Environnement
Dans Vercel Dashboard > Settings > Environment Variables :

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 Étape 3 : Supabase Edge Functions

### 3.1 Via Dashboard (Recommandé)
1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Edge Functions > Deploy
4. Uploader les fonctions :

**Fonctions à déployer :**
- ✅ `submit-guest-info`
- ✅ `generate-contract`
- ✅ `generate-police-forms`
- ✅ `generate-id-documents`
- ✅ `save-contract-signature`
- ✅ `storage-sign-url`

### 3.2 Via CLI (Optionnel)
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

## 🧪 Étape 4 : Tests

### 4.1 Test Frontend
1. Aller sur l'URL Vercel
2. Tester la connexion Supabase
3. Vérifier l'affichage des 4 types de documents

### 4.2 Test Edge Functions
```bash
# Tester la fonction generate-id-documents
curl -X POST https://VOTRE_PROJECT_REF.supabase.co/functions/v1/generate-id-documents \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "test", "guestName": "Test User"}'
```

## 📊 Structure du Projet

```
morocco-host-helper/
├── src/
│   ├── components/
│   │   ├── BookingDetailsModal.tsx    # Modal avec 4 boutons
│   │   └── DocumentsViewer.tsx        # Affichage des documents
│   └── services/
│       └── documentSynchronizationService.ts
├── supabase/
│   └── functions/
│       ├── submit-guest-info/         # Soumission invités
│       ├── generate-contract/         # Génération contrats
│       ├── generate-police-forms/     # Génération fiches police
│       └── generate-id-documents/     # Génération fiches ID
├── scripts/
│   ├── cleanup-for-deployment.js      # Nettoyage
│   ├── deploy-edge-functions.js       # Déploiement fonctions
│   ├── deploy-to-github-vercel.ps1    # Script Windows
│   └── deploy-to-github-vercel.sh     # Script Linux/macOS
├── vercel.json                        # Configuration Vercel
├── vite.config.vercel.ts              # Configuration Vite
└── .gitignore                         # Fichiers ignorés
```

## 🔒 Sécurité

### Variables d'Environnement
- ✅ Ne jamais commiter les clés
- ✅ Utiliser les variables Vercel
- ✅ Rotation régulière des clés

### RLS (Row Level Security)
- ✅ Vérifier les politiques RLS
- ✅ Tester les permissions
- ✅ Auditer l'accès

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

## 🎉 Félicitations !

Votre application est maintenant déployée et accessible au monde entier !

**URLs importantes :**
- 🌐 **Frontend** : `https://votre-projet.vercel.app`
- 🔧 **Supabase Dashboard** : `https://supabase.com/dashboard/project/VOTRE_PROJECT_REF`
- 📊 **Vercel Dashboard** : `https://vercel.com/dashboard`

---

## 📚 Documentation Complète

- 📖 **GUIDE-DEPLOIEMENT-COMPLET.md** - Guide détaillé
- 🔧 **GUIDE-CORRECTION-FICHE-ID.md** - Correction des documents
- 🏗️ **GUIDE-ARCHITECTURE-EDGE-FUNCTIONS.md** - Architecture

**Développé avec ❤️ pour les hôtes au Maroc**
