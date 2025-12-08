# Morocco Host Helper - CHECKY

Application de gestion de propriétés et réservations pour hôtes au Maroc. Plateforme complète pour la gestion des check-in, génération de contrats, fiches de police et synchronisation avec Airbnb.

## 📋 Table des matières

- [Technologies](#-technologies)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Développement](#-développement)
- [Déploiement](#-déploiement)
- [Architecture](#-architecture)
- [Guides spécifiques](#-guides-spécifiques)
- [Sécurité](#-sécurité)
- [Dépannage](#-dépannage)

## 🚀 Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Deployment**: Vercel
- **Package Manager**: npm
- **Date Management**: date-fns
- **Animations**: framer-motion

## 📦 Installation

### Prérequis

- Node.js 18+
- npm
- Compte Supabase
- Compte Vercel
- Compte Google Cloud (pour OAuth)

### Installation locale

```bash
# Cloner le repository
git clone <YOUR_GIT_URL>
cd morocco-host-helper-main-main

# Installer les dépendances
npm install --legacy-peer-deps

# Démarrer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## ⚙️ Configuration

### Variables d'environnement locales

Créer un fichier `.env` à partir de `env.example` :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
VITE_PUBLIC_APP_URL=http://localhost:5173
```

### Variables d'environnement Vercel

Dans **Vercel Dashboard** → **Project** → **Settings** → **Environment Variables**, ajouter :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
VITE_PUBLIC_APP_URL=https://checky.ma
PUBLIC_APP_URL=https://checky.ma
```

### Variables d'environnement Supabase (Edge Functions)

Dans **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**, ajouter :

```env
PUBLIC_APP_URL=https://checky.ma
SITE_URL=https://checky.ma
ACCESS_CODE_PEPPER=votre_pepper_secret
```

### Configuration Supabase Auth

Dans **Supabase Dashboard** → **Authentication** → **URL Configuration** :

1. **Site URL**: `https://checky.ma`
2. **Redirect URLs**: 
   - `https://checky.ma/auth/callback`
   - `https://checky.ma/**`
   - `https://www.checky.ma/**`

### Configuration du domaine checky.ma

#### 1. Configuration DNS

Configurer les enregistrements DNS pour pointer vers Vercel :
- **Type A** : `@` → IP Vercel
- **Type CNAME** : `www` → `cname.vercel-dns.com`

#### 2. Configuration Vercel

1. **Settings** → **Domains**
2. Ajouter `checky.ma` et `www.checky.ma`
3. Vérifier que le statut est "Valid Configuration" (✓)

#### 3. Configuration Supabase CORS

Les Edge Functions doivent autoriser `checky.ma` dans `supabase/functions/_shared/cors.ts` :

```typescript
const ALLOWED_ORIGINS = [
  'https://checky.ma',
  'https://www.checky.ma',
  // ...
];
```

## 🛠️ Développement

### Commandes disponibles

```bash
# Développement
npm run dev              # Serveur de développement
npm run preview          # Prévisualisation du build

# Build
npm run build            # Build de production
npm run vercel-build     # Build optimisé pour Vercel

# Qualité de code
npm run lint             # Linter ESLint
npm run typecheck        # Vérification TypeScript
```

### Structure du projet

```
morocco-host-helper/
├── src/
│   ├── components/      # Composants React
│   ├── pages/          # Pages de l'application
│   ├── hooks/          # Hooks personnalisés
│   ├── services/       # Services API
│   ├── types/          # Types TypeScript
│   ├── utils/          # Utilitaires
│   ├── config/         # Configuration
│   └── i18n/           # Internationalisation (fr, en, es)
├── supabase/
│   └── functions/      # Edge Functions
│       ├── submit-guest-info-unified/
│       ├── issue-guest-link/
│       └── _shared/     # Code partagé (CORS, etc.)
├── public/             # Assets statiques
├── scripts/            # Scripts utilitaires
├── vercel.json         # Configuration Vercel
└── vite.config.ts      # Configuration Vite
```

## 🚀 Déploiement

### Déploiement automatique (Vercel)

1. **Connecter le repository GitHub** à Vercel
2. **Configurer les variables d'environnement** (voir section Configuration)
3. **Vérifier le domaine** `checky.ma` dans Vercel
4. **Push vers `main`** déclenche automatiquement le déploiement

### Configuration Vercel recommandée

- **Framework**: Vite
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `dist`
- **Install Command**: `npm install --legacy-peer-deps`

### Déploiement des Edge Functions

#### Option 1 : Via Supabase CLI (recommandé)

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref YOUR_PROJECT_REF

# Déployer une fonction
supabase functions deploy issue-guest-link
supabase functions deploy submit-guest-info-unified
```

#### Option 2 : Via Supabase Dashboard

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. **Edge Functions** → Sélectionner la fonction
3. **Edit** → Copier le code depuis `supabase/functions/[function-name]/index.ts`
4. **Deploy**

## 🏗️ Architecture

### Frontend

- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query) + Context API
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS + shadcn/ui components
- **Internationalisation**: Système i18n custom (fr par défaut)

### Backend

- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth (Email + Google OAuth)
- **Storage**: Supabase Storage (documents, signatures)
- **Edge Functions**: Deno runtime
  - `submit-guest-info-unified`: Génération de documents (contrat, police, ID)
  - `issue-guest-link`: Génération de liens de vérification invités
  - `save-contract-signature`: Sauvegarde des signatures

### Base de données

Tables principales :
- `properties`: Propriétés à louer
- `bookings`: Réservations
- `guests`: Informations des invités
- `uploaded_documents`: Documents générés
- `property_verification_tokens`: Tokens de vérification
- `host_profiles`: Profils des hôtes
- `contract_signatures`: Signatures de contrats

## 📖 Guides spécifiques

### Configuration Google OAuth

#### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API **Google+ API**

#### 2. Configurer l'écran de consentement OAuth

1. **APIs & Services** → **OAuth consent screen**
2. Type d'application : **Externe**
3. Remplir les informations :
   - **Nom de l'application** : CHECKY
   - **Email de support** : votre email
   - **Logo** : Uploader le logo CHECKY (512x512px minimum)
   - **Domaine autorisé** : `checky.ma`
   - **Email de contact développeur** : votre email
4. **Scopes** : `email`, `profile`, `openid`
5. **Test users** : Ajouter les emails de test (si en mode Testing)
6. **Publier l'application** (nécessaire pour que le logo s'affiche)

#### 3. Créer les identifiants OAuth

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Type : **Web application**
3. **Authorized JavaScript origins** :
   ```
   https://checky.ma
   https://www.checky.ma
   https://csopyblkfyofwkeqqegd.supabase.co
   ```
4. **Authorized redirect URIs** :
   ```
   https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback
   ```
   ⚠️ **Important** : Le domaine Supabase (`csopyblkfyofwkeqqegd.supabase.co`) **DOIT** rester car c'est là que Google redirige après l'authentification.

#### 4. Configurer Supabase

1. **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
2. Activer le provider Google
3. Entrer le **Client ID** et **Client Secret** depuis Google Cloud Console
4. **Site URL** : `https://checky.ma`
5. **Redirect URLs** : `https://checky.ma/**`

#### 5. Afficher le logo lors de l'authentification

Le logo ne s'affichera que si :
- ✅ L'application est **publiée** dans Google Cloud Console
- ✅ L'application est **validée** par Google (peut prendre quelques heures/jours)
- ✅ L'application n'est pas en mode "Testing" (ou les utilisateurs sont dans la liste de test)
- ✅ Le logo est uploadé dans l'écran de consentement (512x512px minimum)

### Changer le compte Google OAuth

1. **Google Cloud Console** → Créer un nouveau projet ou utiliser un projet existant
2. Suivre les étapes de configuration OAuth (voir section précédente)
3. **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
4. Mettre à jour le **Client ID** et **Client Secret**
5. Tester la connexion

### Génération de documents

L'application génère automatiquement :
- **Contrats de location** : PDF avec signature électronique
- **Fiches de police** : Format officiel marocain bilingue (FR/AR)
- **Pièces d'identité** : Extraction et stockage des documents d'identité

Les documents sont générés via l'Edge Function `submit-guest-info-unified` et stockés dans Supabase Storage.

### Synchronisation Airbnb

1. **Configurer l'URL ICS** dans les paramètres de la propriété
2. **Synchroniser** via le bouton "Sync Airbnb" dans le calendrier
3. Les réservations Airbnb apparaissent automatiquement dans le calendrier

## 🔐 Sécurité

### Secrets Management

- ❌ **NE JAMAIS** commiter de secrets dans le repository
- ✅ Utiliser les **Environment Variables** de Vercel et Supabase
- ✅ Fichier `.env` est dans `.gitignore`
- ✅ Rotation immédiate des clés si exposées

### Database Security

- **RLS (Row Level Security)** activé sur toutes les tables
- **Policies** basées sur l'owner pour l'isolation des données
- **Indexes** sur les colonnes fréquemment interrogées
- **Validation** des données côté serveur (Edge Functions)

### CORS Configuration

Les Edge Functions autorisent uniquement :
- `https://checky.ma`
- `https://www.checky.ma`
- `*.vercel.app` (pour les preview deployments)

### Validation des tokens

- Tokens de vérification avec expiration (7 jours par défaut)
- Validation des codes Airbnb avec hash SHA-256
- Protection contre les attaques par force brute

## 🐛 Dépannage

### Erreurs de build Vercel

1. Vérifier les variables d'environnement
2. Utiliser `npm install --legacy-peer-deps`
3. Vérifier les logs de build dans Vercel

### Edge Functions retournent 401/403

1. Vérifier les clés Supabase dans les variables d'environnement
2. Vérifier les headers CORS
3. Vérifier les politiques RLS dans Supabase

### Le logo OAuth ne s'affiche pas

1. Vérifier que l'application est **publiée** dans Google Cloud Console
2. Vérifier que le logo est uploadé (512x512px minimum)
3. Attendre la validation Google (peut prendre quelques heures)
4. Vérifier que l'utilisateur est dans la liste de test (si en mode Testing)

### Liens de vérification invalides

1. Vérifier `PUBLIC_APP_URL` dans Supabase Edge Functions
2. Vérifier que la route `/v/:token` existe dans le frontend
3. Vérifier les logs de l'Edge Function `issue-guest-link`

### Signature déborde sur la fiche de police

✅ **Corrigé** : La signature est maintenant limitée à 180px de largeur et 60px de hauteur, avec vérification automatique du débordement.

### Calendrier mobile - Navigation ne fonctionne pas

✅ **Corrigé** : Les boutons de navigation utilisent maintenant `currentDate` et `onDateChange` correctement, avec scroll automatique vers le mois actuel.

### Page de réservation non responsive

✅ **Corrigé** : Tous les CTAs (Voir/Télécharger) sont maintenant alignés et responsive sur mobile.

## 📝 Checklist de déploiement

### Pre-déploiement

- [ ] Variables d'environnement configurées dans Vercel
- [ ] Variables d'environnement configurées dans Supabase (Edge Functions)
- [ ] RLS policies appliquées dans Supabase
- [ ] CORS configuré pour `checky.ma`
- [ ] Domaine `checky.ma` configuré dans Vercel
- [ ] Google OAuth configuré (Client ID, Secret, Redirect URIs)
- [ ] Edge Functions déployées
- [ ] Aucun secret dans le code ou l'historique Git

### Post-déploiement

- [ ] Authentification fonctionnelle (Email + Google)
- [ ] CRUD opérations fonctionnelles
- [ ] Edge Functions répondent correctement
- [ ] Upload de documents fonctionnel
- [ ] Génération de contrats fonctionnelle
- [ ] Génération de fiches de police fonctionnelle
- [ ] Synchronisation Airbnb fonctionnelle
- [ ] Liens de vérification invités fonctionnels
- [ ] Gestion d'erreurs appropriée
- [ ] Responsive design testé (mobile + desktop)

## 📞 Support

Pour toute question ou problème :
1. Vérifier la section [Dépannage](#-dépannage)
2. Consulter les logs dans Vercel et Supabase
3. Vérifier les issues GitHub existantes

## 📄 Licence

Propriétaire - Tous droits réservés

---

**Dernière mise à jour** : Décembre 2025
