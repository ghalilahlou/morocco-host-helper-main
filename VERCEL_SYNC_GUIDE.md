# 🔄 Guide de Synchronisation Vercel

## 🔍 Problème Identifié

Vercel n'utilise pas les dernières mises à jour locales. Voici comment résoudre :

---

## ✅ Solution 1 : Vérifier la Branche Vercel

Vercel peut surveiller la branche **"principal"** (français) au lieu de **"main"** (anglais).

### Étape 1 : Vérifier dans Vercel Dashboard
1. Aller sur https://vercel.com/dashboard
2. Sélectionner votre projet
3. Aller dans **Settings** → **Git**
4. Vérifier la **Production Branch** :
   - ✅ Doit être `main` (pas `principal`)
   - Si c'est `principal`, changer pour `main`

### Étape 2 : Vérifier les Branches GitHub
```bash
# Vérifier toutes les branches
git branch -a

# Si vous voyez "principal" et "main", vérifier laquelle est à jour
git log --oneline principal -5
git log --oneline main -5
```

---

## ✅ Solution 2 : Forcer Synchronisation Complète

### Étape 1 : Vérifier que Tout est Committé
```bash
git status
```

Si vous voyez des fichiers modifiés :
```bash
# Ajouter tous les fichiers modifiés
git add .

# Créer un commit
git commit -m "chore: Synchronisation complète avec Vercel"

# Pousser vers GitHub
git push origin main
```

### Étape 2 : Vérifier que GitHub est à Jour
1. Aller sur https://github.com/ghalilahlou/morocco-host-helper-main
2. Vérifier que le dernier commit est `0d98d1a` ou plus récent
3. Vérifier que la branche affichée est `main` (pas `principal`)

### Étape 3 : Forcer Redéploiement Vercel
1. Dans Vercel Dashboard → **Deployments**
2. Cliquer sur **"..."** (3 points) sur le dernier déploiement
3. Sélectionner **"Redeploy"**
4. Choisir **"Use existing Build Cache"** = **OFF**
5. Cliquer sur **"Redeploy"**

---

## ✅ Solution 3 : Vérifier la Configuration Vercel

### Vérifier vercel.json
Le fichier `vercel.json` doit être présent à la racine :
```json
{
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Vérifier package.json
Le script `vercel-build` doit exister :
```json
{
  "scripts": {
    "vercel-build": "VITE_PUBLIC_APP_URL=$VERCEL_URL vite build --config vite.config.vercel.ts --mode production"
  }
}
```

---

## ✅ Solution 4 : Créer un Commit Vide pour Forcer

Si rien ne fonctionne, créer un commit vide :

```bash
# Créer un commit vide
git commit --allow-empty -m "chore: Force Vercel sync - $(date +%Y%m%d-%H%M%S)"

# Pousser
git push origin main
```

Attendre 1-2 minutes, Vercel devrait détecter automatiquement.

---

## 🔍 Diagnostic

### Vérifier les Commits Locaux vs GitHub
```bash
# Voir les commits locaux non poussés
git log origin/main..HEAD

# Voir les commits GitHub non récupérés
git log HEAD..origin/main
```

### Vérifier les Branches
```bash
# Lister toutes les branches
git branch -a

# Vérifier quelle branche est active
git branch
```

---

## 🚨 Problèmes Courants

### 1. Vercel Surveille "principal" au lieu de "main"
**Solution** : Changer dans Vercel Settings → Git → Production Branch

### 2. Commits Locaux Non Poussés
**Solution** : `git push origin main`

### 3. Branche Locale Différente
**Solution** : `git checkout main && git pull origin main`

### 4. Cache Vercel
**Solution** : Redéployer avec "Use existing Build Cache" = OFF

---

## 📋 Checklist Rapide

- [ ] ✅ Vérifier que vous êtes sur `main` : `git branch`
- [ ] ✅ Vérifier que tout est committé : `git status`
- [ ] ✅ Pousser vers GitHub : `git push origin main`
- [ ] ✅ Vérifier sur GitHub que le commit est présent
- [ ] ✅ Vérifier dans Vercel que la branche est `main`
- [ ] ✅ Forcer un redeploy dans Vercel
- [ ] ✅ Attendre 2-3 minutes pour que Vercel détecte

---

**Dernière mise à jour** : 5 janvier 2025

