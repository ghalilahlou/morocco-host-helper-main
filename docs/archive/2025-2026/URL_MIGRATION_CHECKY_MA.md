# Migration complète vers checky.ma

## ✅ Corrections effectuées

### 1. Configuration CORS (Edge Functions)
**Fichier**: `supabase/functions/_shared/cors.ts`
- ✅ Ajout de `https://checky.ma` et `https://www.checky.ma` dans `ALLOWED_ORIGINS`
- ✅ Remplacement de `https://morocco-host-helper.vercel.app` par `https://checky.ma` dans les headers par défaut
- ✅ Conservation de `*.vercel.app` comme fallback pour les preview deployments

### 2. Composants React
**Fichiers corrigés**:
- ✅ `src/components/ContractSignature.tsx`
  - Remplacement de `window.location.origin` par `urls.app.base` (checky.ma en production)
- ✅ `src/components/WelcomingContractSignature.tsx`
  - Remplacement de `window.location.origin` par `urls.app.base` (checky.ma en production)

### 3. Authentification
**Fichier**: `src/pages/Auth.tsx`
- ✅ `emailRedirectTo` utilise maintenant `urls.app.base` au lieu de `vercel.app`
- ✅ `redirectTo` pour Google OAuth utilise `urls.app.base`

### 4. Configuration centralisée
**Fichier**: `src/config/runtime.ts`
- ✅ `APP_URL` forcé à `https://checky.ma` en production
- ✅ `corsConfig.production` inclut `checky.ma` et `www.checky.ma`

### 5. Edge Functions
**Fichier**: `supabase/functions/issue-guest-link/index.ts`
- ✅ Utilise `PUBLIC_APP_URL` ou `SITE_URL` avec fallback vers `https://checky.ma`
- ✅ Génère des liens avec la route `/v/` (ex: `https://checky.ma/v/[TOKEN]`)

## 📋 Configuration requise

### Variables d'environnement Supabase
Dans le **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**, configurez :

```
PUBLIC_APP_URL = https://checky.ma
SITE_URL = https://checky.ma
```

### Configuration Supabase Auth
Dans le **Supabase Dashboard** → **Authentication** → **URL Configuration** :

1. **Site URL**: `https://checky.ma`
2. **Redirect URLs**: Ajoutez `https://checky.ma/auth/callback`

### Configuration Vercel
Le fichier `vercel.json` est déjà configuré avec les rewrites SPA nécessaires.

## 🔍 Vérifications

### URLs générées
Toutes les URLs générées doivent maintenant utiliser `checky.ma` :
- ✅ Liens de vérification invités : `https://checky.ma/v/[TOKEN]`
- ✅ Liens de redirection email : `https://checky.ma/auth/callback`
- ✅ URLs de dashboard : `https://checky.ma/dashboard/...`

### CORS
Les Edge Functions acceptent maintenant les requêtes depuis :
- ✅ `https://checky.ma`
- ✅ `https://www.checky.ma`
- ✅ `*.vercel.app` (preview deployments uniquement)

## 🚀 Déploiement

1. **Déployer le code frontend** sur Vercel
2. **Mettre à jour les Edge Functions** sur Supabase :
   ```bash
   supabase functions deploy issue-guest-link
   ```
3. **Vérifier les variables d'environnement** dans Supabase Dashboard
4. **Tester** :
   - Création de compte → Email de confirmation
   - Génération de lien invité → URL doit être `checky.ma/v/...`
   - Partage de lien → Doit fonctionner sur mobile

## 📝 Notes

- Les URLs `localhost` sont conservées pour le développement local
- Les URLs `vercel.app` sont conservées comme fallback pour les preview deployments
- Tous les liens en production utilisent maintenant `checky.ma` exclusivement

