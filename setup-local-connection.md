# Guide de connexion locale à Supabase

## Informations de connexion de votre projet

D'après l'image que vous avez partagée, voici les informations de connexion pour votre projet Supabase :

**Project ID:** `csopyblkfyofwkeqqegd`

## 1. Configuration des variables d'environnement

Créez un fichier `.env` à la racine de votre projet avec le contenu suivant :

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Supabase Service Role Key (pour les edge functions)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SB_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SB_URL=https://csopyblkfyofwkeqqegd.supabase.co

# Configuration pour les Edge Functions locales
SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Connexion directe à la base de données (recommandé pour le développement local)
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.csopyblkfyofwkeqqegd.supabase.co:5432/postgres

# Configuration alternative avec Transaction Pooler (pour les edge functions)
# SUPABASE_DB_URL=postgresql://postgres.csopyblkfyofwkeqqegd:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

POSTGRES_PASSWORD=your_database_password_here
POSTGRES_DB=postgres
DENO_ENV=development
FUNCTIONS_PORT=54321

# Autres configurations...
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_RESEND_API_KEY=your_resend_api_key_here
VITE_RESEND_FROM_EMAIL=notifications@yourdomain.com
```

## 2. Types de connexion disponibles

D'après l'image, vous avez 3 options de connexion :

### Option 1: Connexion Directe (Recommandée pour le développement local)
```
postgresql://postgres:[YOUR-PASSWORD]@db.csopyblkfyofwkeqqegd.supabase.co:5432/postgres
```
- Idéale pour les applications avec des connexions persistantes
- Chaque client a une connexion dédiée à Postgres
- Non compatible IPv4

### Option 2: Transaction Pooler (Recommandée pour les Edge Functions)
```
postgresql://postgres.csopyblkfyofwkeqqegd:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```
- Idéale pour les applications serverless
- Les clients partagent un pool de connexions
- Compatible IPv4
- Ne supporte pas les instructions PREPARE

### Option 3: Session Pooler
```
postgresql://postgres.csopyblkfyofwkeqqegd:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```
- Alternative à la connexion directe
- Compatible IPv4
- Utilisez uniquement sur un réseau IPv4

## 3. Étapes pour obtenir vos clés

1. Allez sur [supabase.com](https://supabase.com)
2. Connectez-vous à votre projet
3. Allez dans Settings > API
4. Copiez :
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Allez dans Settings > Database
6. Copiez votre mot de passe de base de données → `POSTGRES_PASSWORD`

## 4. Test de connexion

Une fois configuré, vous pouvez tester la connexion avec :

```bash
# Démarrer Supabase localement
npx supabase start

# Ou démarrer votre application
npm run dev
```

## 5. Edge Functions locales

Pour tester vos edge functions localement :

```bash
# Démarrer les edge functions
npx supabase functions serve

# Tester une fonction spécifique
curl -X POST 'http://localhost:54321/functions/v1/submit-guest-info' \
  -H 'Content-Type: application/json' \
  -d '{"test": "data"}'
```
