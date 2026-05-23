# Guide de Diagnostic - Erreur 404 (Not Found)

## 🔍 Comprendre l'erreur 404

L'erreur **404 (Not Found)** signifie que le serveur ne peut pas trouver la ressource demandée. Dans le contexte de votre application, cela peut concerner :

1. **Edge Functions Supabase** - Les fonctions serveurless ne sont pas trouvées
2. **Fichiers Storage** - Les documents dans le bucket Supabase Storage
3. **Routes API** - Les endpoints de l'application

## 🎯 Causes Possibles

### 1. Edge Function non déployée

**Symptôme** : L'erreur apparaît lors de l'appel à `get-guest-documents-unified`

**Causes** :
- La fonction n'a jamais été déployée sur Supabase
- La fonction a été supprimée ou renommée
- Le déploiement a échoué silencieusement

**Vérification** :
```bash
# Vérifier si Supabase CLI est installé
supabase --version

# Lister les fonctions déployées
supabase functions list

# Vérifier le statut de déploiement
supabase functions list --project-ref YOUR_PROJECT_REF
```

### 2. Fonction appelée par une autre fonction non déployée

**Symptôme** : L'erreur apparaît dans les logs de `get-guest-documents-unified`

**Cause** : `get-guest-documents-unified` appelle `submit-guest-info-unified` (lignes 596 et 641), qui pourrait ne pas être déployée.

**Vérification** :
- Ouvrir la console du navigateur (F12)
- Regarder l'onglet Network pour voir quelle URL exacte retourne 404
- Vérifier les logs Supabase Dashboard → Edge Functions → Logs

### 3. URL de fonction incorrecte

**Symptôme** : L'erreur apparaît uniquement en production ou en développement

**Causes** :
- Variable d'environnement `VITE_SUPABASE_URL` incorrecte
- Configuration différente entre dev et prod

**Vérification** :
```typescript
// Dans la console du navigateur
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Functions URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`);
```

### 4. Fichier Storage introuvable

**Symptôme** : L'erreur apparaît lors de la génération d'URL signée pour un document

**Cause** : Le fichier n'existe pas dans le bucket `guest-documents`

**Vérification** :
- Supabase Dashboard → Storage → `guest-documents`
- Vérifier que les fichiers existent aux chemins attendus :
  - `contract/{bookingId}/contract-{bookingId}.pdf`
  - `police/{bookingId}/police-{bookingId}.pdf`
  - `identity/{bookingId}/identity-{bookingId}.pdf`

## 🔧 Solutions

### Solution 1 : Déployer la fonction manquante

#### Via Supabase CLI (Recommandé)

```bash
# 1. Installer Supabase CLI si nécessaire
npm install -g supabase

# 2. Se connecter à Supabase
supabase login

# 3. Lier le projet
supabase link --project-ref YOUR_PROJECT_REF

# 4. Déployer la fonction
supabase functions deploy get-guest-documents-unified

# 5. Vérifier que submit-guest-info-unified est aussi déployée
supabase functions deploy submit-guest-info-unified
```

#### Via Supabase Dashboard

1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. **Edge Functions** → **Create Function** ou **Edit**
4. Nom : `get-guest-documents-unified`
5. Copier le contenu de `supabase/functions/get-guest-documents-unified/index.ts`
6. Cliquer sur **Deploy**

### Solution 2 : Vérifier la configuration des variables d'environnement

**En développement** :
```bash
# Vérifier le fichier .env.local ou .env
cat .env.local | grep SUPABASE
```

**En production** :
- Vérifier les variables d'environnement dans Vercel/Netlify
- Vérifier les secrets dans Supabase Dashboard → Settings → Edge Functions → Secrets

### Solution 3 : Vérifier les logs pour identifier la ressource manquante

1. **Console du navigateur** (F12) :
   - Onglet **Network** → Filtrer par "404"
   - Regarder l'URL exacte qui retourne 404
   - Regarder les headers de la requête

2. **Logs Supabase** :
   - Dashboard → Edge Functions → `get-guest-documents-unified` → Logs
   - Chercher les erreurs avec "404" ou "Not Found"

3. **Logs de l'application** :
   - Chercher dans la console les messages avec `❌` ou `⚠️`

### Solution 4 : Tester la fonction directement

```bash
# Tester avec curl
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-guest-documents-unified \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "YOUR_BOOKING_ID"}'
```

**Résultat attendu** :
- `200 OK` : La fonction fonctionne
- `404 Not Found` : La fonction n'est pas déployée
- `500 Internal Server Error` : La fonction est déployée mais a une erreur

## 📋 Checklist de Diagnostic

- [ ] Vérifier que `get-guest-documents-unified` est déployée
- [ ] Vérifier que `submit-guest-info-unified` est déployée
- [ ] Vérifier la variable `VITE_SUPABASE_URL` dans l'environnement
- [ ] Vérifier les logs du navigateur (Network tab)
- [ ] Vérifier les logs Supabase (Edge Functions → Logs)
- [ ] Tester la fonction directement avec curl
- [ ] Vérifier que les fichiers Storage existent
- [ ] Vérifier les permissions du bucket `guest-documents`

## 🐛 Exemple de Diagnostic Complet

### Étape 1 : Identifier l'URL qui retourne 404

Dans la console du navigateur (F12 → Network) :
```
❌ GET https://xxxxx.supabase.co/functions/v1/get-guest-documents-unified → 404
```

### Étape 2 : Vérifier le déploiement

```bash
supabase functions list --project-ref xxxxx
```

Si la fonction n'apparaît pas :
```bash
supabase functions deploy get-guest-documents-unified
```

### Étape 3 : Vérifier les dépendances

La fonction `get-guest-documents-unified` appelle `submit-guest-info-unified`. Vérifier qu'elle est aussi déployée :

```bash
supabase functions list
```

### Étape 4 : Vérifier les logs

Dans Supabase Dashboard → Edge Functions → Logs, chercher :
```
❌ Error: Function not found
❌ 404 Not Found
```

## 🔗 Ressources Utiles

- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Troubleshooting Edge Functions](https://supabase.com/docs/guides/functions/troubleshooting)

## 💡 Conseils Préventifs

1. **Déployer toutes les fonctions** avant de tester
2. **Vérifier les dépendances** entre fonctions
3. **Utiliser des variables d'environnement** pour les URLs
4. **Tester en local** avec Supabase CLI avant de déployer
5. **Monitorer les logs** régulièrement

## 🆘 Si le problème persiste

1. Vérifier que vous êtes connecté au bon projet Supabase
2. Vérifier les permissions de votre compte Supabase
3. Vérifier que le projet Supabase est actif (pas suspendu)
4. Contacter le support Supabase si nécessaire

