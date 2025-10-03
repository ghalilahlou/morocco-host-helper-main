# Morocco Host Helper

Application de gestion de propriétés et réservations pour hôtes au Maroc.

## 🚀 Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Deployment**: Vercel
- **Package Manager**: npm

## 🔒 Security & Deploy Playbook

### **Secrets Management**
- **NEVER** commit secrets to the repository (`.env` files are ignored)
- Use Vercel Environment Variables for all secrets
- Rotate Supabase keys immediately if exposed

### **Database Security**
- RLS (Row Level Security) enabled on all tables
- Owner-based policies for data isolation
- Public read access only where explicitly needed
- Indexes on frequently queried columns

### **Build & Deploy**
- Single package manager: npm (no bun.lockb)
- CI/CD with GitHub Actions (lint, typecheck, build)
- Security audit on every build
- Source maps enabled for debugging

### **Environment Variables (Vercel)**
Required variables to set in Vercel:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Build for production
npm run build

# Preview build
npm run preview
```

## 🚀 Deployment

1. **Push to GitHub** - Automatic deployment to Vercel
2. **Set Environment Variables** in Vercel dashboard
3. **Configure Supabase** - RLS policies and CORS
4. **Test thoroughly** - Authentication, CRUD operations

## 🔧 Database Setup

Run the RLS security script in Supabase SQL Editor:
```sql
-- Execute: scripts/supabase-rls-safe-defaults.sql
```

## 📋 Checklist

### Pre-deployment
- [ ] Environment variables set in Vercel
- [ ] RLS policies applied in Supabase
- [ ] CORS configured for Vercel domains
- [ ] No secrets in code or history
- [ ] CI/CD pipeline passing

### Post-deployment
- [ ] Authentication working
- [ ] CRUD operations functional
- [ ] Edge Functions responding
- [ ] Storage uploads working
- [ ] Error handling proper

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/1f998fb3-b22b-4218-9b35-a319af13f031) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/1f998fb3-b22b-4218-9b35-a319af13f031) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## 📖 Guide complet (mise à jour)

### ⚙️ Prérequis
- Node.js 18+
- Compte Supabase (URL + clés)
- Compte Vercel (déploiement frontend)

### 🚀 Installation locale rapide
```bash
npm install --legacy-peer-deps
npm run dev
```

### 🔑 Variables d'environnement (Frontend Vercel)
Dans Vercel > Project > Settings > Environment Variables:
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
# Optionnel
VITE_OPENAI_API_KEY=...
VITE_RESEND_API_KEY=...
VITE_RESEND_FROM_EMAIL=notifications@votredomaine.com
```

### 🧩 Variables d'environnement locales (développement)
Créer `.env` à partir de `env.example` et renseigner au minimum:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 🧱 Structure du projet (essentiel)
```
morocco-host-helper/
├── src/                         # Frontend React
├── public/                      # Assets publics
├── supabase/functions/          # Edge Functions (si utilisées)
├── scripts/                     # Outils déploiement/diagnostic
├── vite.config.vercel.ts        # Build Vercel
├── vercel.json                  # Config Vercel (SPA, cache)
└── README.md                    # Guide unique (ce fichier)
```

### 📦 Build & Preview (prod)
```bash
npm run vercel-build   # utilise vite.config.vercel.ts
npm run preview        # prévisualisation locale
```

### 🌐 Déploiement Vercel
Paramètres recommandés (automatique via `vercel.json`):
- Framework: Vite
- Build Command: `npm run vercel-build`
- Output Directory: `dist`
- Install Command: `npm install --legacy-peer-deps`

Étapes:
1. Pousser le code sur GitHub (`main`).
2. Importer le repo sur Vercel et définir les variables d’environnement.
3. Lancer le déploiement et tester l’application.

### 🧭 Edge Functions (Supabase)
Si votre application appelle des fonctions Edge, déployez au besoin via Dashboard Supabase ou CLI. Fonctions typiques: `submit-guest-info`, `generate-contract`, `generate-police-forms`, `generate-id-documents`, `save-contract-signature`, `storage-sign-url`.

### 🔐 Sécurité (rappel)
- Ne jamais commiter de secrets.
- Configurer CORS dans Supabase pour n’autoriser que les domaines Vercel.
- RLS activé sur les tables, valider les stratégies.

### 🧹 Nettoyage & maintenance
- Les fichiers de tests/docs multiples ont été retirés pour simplifier le projet.
- Utiliser ce `README.md` comme source unique de vérité.

### ❗ Dépannage rapide
- Erreur de build Vercel: vérifier variables d’env et `npm install --legacy-peer-deps`.
- Edge Functions 401/403: vérifier clés/headers et politiques RLS.
- Bundles volumineux: utiliser `dynamic import()` ou ajuster `manualChunks` si nécessaire.
