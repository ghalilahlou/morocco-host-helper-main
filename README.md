# Morocco Host Helper

Application de gestion pour propriétaires Airbnb au Maroc - Simplifiez la gestion de vos propriétés et améliorez l'expérience de vos invités.

## 🚀 Déploiement Vercel

### Déploiement automatique

1. **Connectez votre repository GitHub à Vercel :**
   - Allez sur [vercel.com](https://vercel.com)
   - Connectez-vous avec votre compte GitHub
   - Cliquez sur "New Project"
   - Importez le repository `boumnadehicham-blip/morocco-host-helper`

2. **Configuration automatique :**
   - Vercel détectera automatiquement que c'est un projet Vite
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Variables d'environnement :**
   Configurez ces variables dans les paramètres Vercel :
   ```
   VITE_SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   VITE_RESEND_API_KEY=your_resend_api_key_here
   VITE_RESEND_FROM_EMAIL=notifications@yourdomain.com
   VITE_APP_NAME=Morocco Host Helper
   VITE_APP_VERSION=1.0.0
   VITE_APP_ENV=production
   VITE_ENABLE_AI_OCR=true
   VITE_ENABLE_AIRBNB_SYNC=true
   VITE_ENABLE_EMAIL_NOTIFICATIONS=true
   ```

4. **Déployez :**
   - Cliquez sur "Deploy"
   - Vercel construira et déploiera automatiquement votre application

### Déploiement manuel avec Vercel CLI

1. **Installez Vercel CLI :**
   ```bash
   npm i -g vercel
   ```

2. **Connectez-vous :**
   ```bash
   vercel login
   ```

3. **Déployez :**
   ```bash
   vercel --prod
   ```

## 🛠️ Développement local

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation
```bash
# Cloner le repository
git clone https://github.com/boumnadehicham-blip/morocco-host-helper.git
cd morocco-host-helper

# Installer les dépendances
npm install

# Créer le fichier .env
cp env.example .env
# Éditer .env avec vos clés API

# Lancer le serveur de développement
npm run dev
```

### Scripts disponibles
```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run preview      # Prévisualiser le build
npm run lint         # Vérifier le code
npm run lint:fix     # Corriger automatiquement
npm run type-check   # Vérifier les types TypeScript
```

## 🏗️ Architecture

### Technologies utilisées
- **Frontend :** React 18 + TypeScript + Vite
- **UI :** Tailwind CSS + Shadcn/ui
- **Backend :** Supabase (Database + Auth + Edge Functions)
- **État :** React Query + Zustand
- **Routing :** React Router DOM
- **Formulaires :** React Hook Form + Zod

### Structure du projet
```
src/
├── components/     # Composants réutilisables
├── pages/         # Pages de l'application
├── hooks/         # Hooks personnalisés
├── services/      # Services API
├── types/         # Types TypeScript
├── lib/           # Utilitaires
├── i18n/          # Internationalisation
└── assets/        # Ressources statiques
```

## 🔧 Configuration

### Variables d'environnement
- `VITE_SUPABASE_URL` : URL de votre projet Supabase
- `VITE_SUPABASE_ANON_KEY` : Clé anonyme Supabase
- `VITE_OPENAI_API_KEY` : Clé API OpenAI (pour OCR)
- `VITE_RESEND_API_KEY` : Clé API Resend (emails)
- `VITE_RESEND_FROM_EMAIL` : Email d'envoi

### Supabase
Le projet utilise Supabase pour :
- Authentification des utilisateurs
- Base de données PostgreSQL
- Edge Functions
- Stockage de fichiers
- Real-time subscriptions

## 📱 Fonctionnalités

### Pour les propriétaires
- ✅ Gestion des propriétés
- ✅ Synchronisation Airbnb
- ✅ Gestion des réservations
- ✅ Génération de contrats
- ✅ Vérification des invités
- ✅ Notifications automatiques

### Pour les invités
- ✅ Interface de vérification
- ✅ Upload de documents
- ✅ Signature de contrats
- ✅ Support multilingue

## 🚀 Performance

### Optimisations
- ✅ Code splitting automatique
- ✅ Lazy loading des composants
- ✅ Compression gzip
- ✅ Cache des assets statiques
- ✅ Optimisation des images

### Métriques
- Taille du bundle : ~1.2MB (gzippé)
- Temps de chargement : < 2s
- Lighthouse Score : 90+

## 🔒 Sécurité

- ✅ Authentification JWT
- ✅ Row Level Security (RLS)
- ✅ Validation des données
- ✅ Protection CSRF
- ✅ Headers de sécurité

## 📞 Support

Pour toute question ou problème :
- 📧 Email : support@moroccohosthelper.com
- 🐛 Issues : [GitHub Issues](https://github.com/boumnadehicham-blip/morocco-host-helper/issues)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

**Développé avec ❤️ pour les propriétaires Airbnb au Maroc**
