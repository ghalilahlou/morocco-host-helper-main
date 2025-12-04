# Déploiement de l'Edge Function issue-guest-link

## Problème actuel

Les logs montrent que l'Edge Function génère encore :
- ❌ `https://cheki.ma/verify/...` (ancien)
- ✅ Devrait être : `https://checky.ma/v/...` (nouveau)

## Solution : Déployer la fonction mise à jour

### Option 1 : Via Supabase CLI (recommandé)

```bash
# 1. Installer Supabase CLI si pas déjà fait
npm install -g supabase

# 2. Se connecter à Supabase
supabase login

# 3. Lier le projet (si pas déjà fait)
supabase link --project-ref YOUR_PROJECT_REF

# 4. Déployer la fonction
supabase functions deploy issue-guest-link
```

### Option 2 : Via Supabase Dashboard

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. **Edge Functions** → **issue-guest-link**
4. Cliquez sur **Edit**
5. Copiez le contenu de `supabase/functions/issue-guest-link/index.ts`
6. Collez-le dans l'éditeur
7. Cliquez sur **Deploy**

### Option 3 : Via Git (si configuré)

Si votre projet Supabase est lié à Git, un push vers la branche principale devrait déclencher un déploiement automatique.

## Configuration de la variable d'environnement

**IMPORTANT** : Après le déploiement, configurez la variable d'environnement :

1. **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Ajoutez/modifiez :
   ```
   PUBLIC_APP_URL = https://checky.ma
   ```
3. Cliquez sur **Save**

## Vérification

Après déploiement et configuration, testez en générant un nouveau lien. Les logs devraient montrer :
```
🔗 Lien invité généré: https://checky.ma/v/[TOKEN]
```

Au lieu de :
```
🔗 Lien invité généré: https://cheki.ma/verify/[TOKEN]
```

