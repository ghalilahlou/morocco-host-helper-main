# Configuration Vercel pour checky.ma

## ✅ Modifications effectuées dans le code

1. **Domaine corrigé** : `cheki.ma` → `checky.ma` dans tout le code
2. **Route harmonisée** : Edge Function utilise maintenant `/v/` comme le frontend
3. **Routing SPA** : `vercel.json` configuré pour gérer toutes les routes

## 🔧 Configuration requise sur Vercel Dashboard

### 1. Variable d'environnement `PUBLIC_APP_URL`

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. **Settings** → **Environment Variables**
4. Ajoutez/modifiez :
   ```
   PUBLIC_APP_URL = https://checky.ma
   ```
5. Sélectionnez **Production**, **Preview**, et **Development**
6. Cliquez sur **Save**

### 2. Vérification du domaine

1. **Settings** → **Domains**
2. Vérifiez que `checky.ma` est bien configuré en **Production**
3. Le statut doit être "Valid Configuration" (✓)

### 3. Redéploiement

Après avoir ajouté la variable d'environnement :
1. Allez dans **Deployments**
2. Cliquez sur les **3 points** du dernier déploiement
3. Sélectionnez **Redeploy**
4. Ou faites un nouveau commit pour déclencher un déploiement automatique

## 🔧 Configuration Supabase (Edge Functions)

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. **Settings** → **Edge Functions** → **Secrets**
4. Ajoutez/modifiez :
   ```
   PUBLIC_APP_URL = https://checky.ma
   ```
5. Cliquez sur **Save**

## ✅ Test

Après configuration, testez :
- `https://checky.ma/v/[TOKEN]` devrait rediriger vers la page de vérification
- Les liens générés devraient utiliser `checky.ma` au lieu de `vercel.app`

## 🐛 Dépannage

Si la page est vide :
1. Vérifiez que `PUBLIC_APP_URL` est bien configuré sur Vercel
2. Vérifiez que le domaine `checky.ma` pointe vers Vercel (DNS)
3. Vérifiez les logs Vercel pour les erreurs de routing
4. Vérifiez que le build inclut bien `dist/index.html`

