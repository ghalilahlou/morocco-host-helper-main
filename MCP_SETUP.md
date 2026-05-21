# Configuration du MCP Supabase pour Claude Code

Le fichier [`.mcp.json`](.mcp.json) configure le **serveur MCP officiel Supabase** en mode **read-only** (lecture seule, pas de modification accidentelle).

## Étape 1 — Générer un Personal Access Token (PAT) Supabase

1. Ouvrir https://supabase.com/dashboard/account/tokens
2. Cliquer sur **"Generate new token"**
3. Nom suggéré : `claude-code-mcp-readonly`
4. Copier le token (commence par `sbp_...`)

> Ce token est différent de l'`anon key`. La clé anon ne donne accès qu'aux données autorisées par RLS ; le PAT donne accès à l'**API d'administration** du projet (lecture du schéma, exécution de SQL, logs, etc.).

## Étape 2 — Injecter le token

Deux options.

### Option A (recommandé) — Variable d'environnement Windows

```powershell
[Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "sbp_VOTRE_TOKEN", "User")
```

Puis dans `.mcp.json`, remplacer la valeur par `"${SUPABASE_ACCESS_TOKEN}"` :

```json
"env": {
  "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
}
```

### Option B — Direct dans `.mcp.json`

Remplacer `REMPLACEZ_PAR_VOTRE_PERSONAL_ACCESS_TOKEN` par le PAT. ⚠️ **NE PAS commiter** ce fichier dans git si vous choisissez cette option — ajouter `.mcp.json` à `.gitignore`.

## Étape 3 — Activer le serveur dans Claude Code

1. Redémarrer Claude Code (`/exit` puis relancer la session)
2. À l'ouverture, Claude Code demandera d'**approuver** le serveur MCP `supabase` (sécurité : nouveau MCP project-level)
3. Vérifier avec `/mcp` que le serveur apparaît comme `connected`

## Étape 4 — Tester

Posez par exemple :

> « Via le MCP Supabase, exécute la section K de `supabase/sql/audit_contract_guest_names.sql` »

Claude pourra alors utiliser l'outil MCP `execute_sql` pour lancer la requête directement.

---

## Sécurité — pourquoi `--read-only`

Le flag `--read-only` :
- Bloque tout `INSERT/UPDATE/DELETE/DROP/ALTER`
- Permet d'inspecter, auditer, debugger **sans risque**
- Pour appliquer des correctifs (section O du SQL d'audit), **enlever** temporairement le flag (ou exécuter dans Supabase SQL Editor)

## Bonus — installer le MCP en CLI

Vous pouvez aussi l'installer via Claude Code directement :

```bash
claude mcp add supabase npx -- -y @supabase/mcp-server-supabase@latest --read-only --project-ref=csopyblkfyofwkeqqegd
# puis exporter le token avant lancement :
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
claude
```

---

## ⚠️ Important — exposition de la clé anon

La **clé anon** partagée dans la conversation est **publique par design** (visible en clair dans toutes les requêtes du front-end web). Elle est protégée par les politiques RLS.

Cependant, l'audit rapide a montré que **les bookings sont lisibles publiquement** avec l'anon key. Vérifiez les policies RLS de `bookings`, `guests`, `generated_documents` — elles sont peut-être trop permissives. À traiter en parallèle du problème contrats.
