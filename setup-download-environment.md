# Guide de téléchargement des Edge Functions Supabase

## 🎯 Objectif
Télécharger toutes vos edge functions Supabase et leurs fichiers `index.ts` pour sauvegarde ou migration.

## 📋 Prérequis

### 1. Variables d'environnement
Créez un fichier `.env` avec vos credentials Supabase :

```bash
# Supabase Configuration
SUPABASE_URL=https://csopyblkfyofwkeqqegd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role_ici
SUPABASE_ANON_KEY=votre_cle_anon_ici

# Pour Docker
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
```

### 2. Installation des outils

#### Option A: Node.js
```bash
npm install @supabase/supabase-js
```

#### Option B: Supabase CLI
```bash
npm install -g supabase
# ou
winget install Supabase.CLI
```

#### Option C: Docker
```bash
docker --version
docker-compose --version
```

## 🚀 Méthodes de téléchargement

### Méthode 1: Script Node.js (Recommandée)
```bash
# 1. Configurer les variables d'environnement
cp env.example .env
# Éditer .env avec vos vraies clés

# 2. Exécuter le script
node download-edge-functions.js
```

### Méthode 2: Script PowerShell (Windows)
```powershell
# 1. Configurer les variables d'environnement
$env:SUPABASE_SERVICE_ROLE_KEY = "votre_cle_ici"

# 2. Exécuter le script
.\download-edge-functions.ps1
```

### Méthode 3: Supabase CLI
```bash
# 1. Se connecter à Supabase
supabase login

# 2. Lier le projet
supabase link --project-ref csopyblkfyofwkeqqegd

# 3. Exécuter le script CLI
node download-with-cli.js
```

### Méthode 4: Docker
```bash
# 1. Configurer les variables d'environnement
cp env.example .env
# Éditer .env avec vos vraies clés

# 2. Exécuter avec Docker Compose
docker-compose -f docker-download-functions.yml up --build

# 3. Nettoyer après usage
docker-compose -f docker-download-functions.yml down
```

## 📁 Structure des fichiers téléchargés

```
downloaded-functions/
├── extract-document-data/
│   ├── response.json
│   └── metadata.json
├── sync-airbnb-reservations/
│   ├── response.json
│   └── metadata.json
├── generate-contract/
│   ├── response.json
│   └── metadata.json
├── download-report.json
└── functions-index.txt
```

## 🔧 Dépannage

### Erreur: "SUPABASE_SERVICE_ROLE_KEY is required"
- Vérifiez que votre fichier `.env` contient la bonne clé
- Assurez-vous que la variable d'environnement est définie

### Erreur: "API Management non accessible"
- Certaines fonctions peuvent ne pas être accessibles via l'API publique
- Utilisez la méthode CLI ou Docker comme alternative

### Erreur: "Docker not running"
- Démarrez Docker Desktop
- Vérifiez que Docker est accessible depuis le terminal

### Erreur: "Supabase CLI not found"
- Installez Supabase CLI: `npm install -g supabase`
- Ou utilisez une autre méthode de téléchargement

## 📊 Fonctions à télécharger

Voici la liste complète de vos edge functions :

1. `extract-document-data`
2. `sync-airbnb-calendar`
3. `sync-airbnb-reservations`
4. `get-airbnb-reservation`
5. `send-owner-notification`
6. `submit-guest-info`
7. `resolve-guest-link`
8. `storage-sign-url`
9. `save-contract-signature`
10. `issue-guest-link`
11. `list-guest-docs`
12. `get-guest-docs`
13. `get-booking-verification-summary`
14. `execute-sql`
15. `get-admin-users`
16. `get-admin-stats`
17. `verify-admin-status`
18. `suspend-user`
19. `delete-user`
20. `get-performance-stats`
21. `save-contract-signature-v2`
22. `create-storage-bucket`
23. `generate-documents-simple`
24. `save-contract-signature-simple`
25. `save-contract-signature-final`
26. `save-signature-radical`
27. `save-signature-sans-rfs`
28. `save-contract-signature-fixed`
29. `create-booking-for-signature`
30. `add-admin-user`
31. `generate-documents-fixed`
32. `generate-id-documents`
33. `get-all-users`
34. `sync-documents`
35. `generate-contract`
36. `generate-police-forms`
37. `document-utils`

## 🎉 Après le téléchargement

1. **Vérifiez le rapport** : `downloaded-functions/download-report.json`
2. **Consultez l'index** : `downloaded-functions/functions-index.txt`
3. **Sauvegardez** les fichiers importants
4. **Nettoyez** les conteneurs Docker si utilisé

## 💡 Conseils

- Commencez par la **Méthode 1** (Node.js) qui est la plus simple
- Utilisez **Docker** si vous avez des problèmes de permissions
- La **sauvegarde locale** est toujours disponible dans `supabase/functions/`
- Gardez vos clés Supabase sécurisées et ne les commitez jamais
