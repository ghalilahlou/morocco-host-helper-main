# 🎨 Guide : Personnaliser l'écran de connexion Google OAuth

## Problème actuel

L'écran de connexion Google affiche :
- ❌ "continuer à csopyblkfyofwkeqqegd.supabase.co" (peu professionnel)
- ❌ Pas de logo CHECKY visible
- ❌ Nom d'application générique

## Solution : Configuration complète

---

## 🔧 Étape 1 : Configurer l'écran de consentement OAuth dans Google Cloud Console

### 1.1 Accéder à l'écran de consentement

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** → **OAuth consent screen**

### 1.2 Configurer les informations de l'application

**Type d'utilisateur** : External (pour permettre à tous les utilisateurs de se connecter)

**Informations de l'application** :
- **Nom de l'application** : `Checky` (ou `Checky.ma`)
- **Email d'assistance utilisateur** : Votre email professionnel
- **Logo de l'application** : 
  - Cliquez sur "Modifier le logo"
  - Téléchargez votre logo CHECKY
  - Format : PNG ou JPG
  - Taille recommandée : 120x120 pixels minimum
  - Taille maximale : 1 MB

**Domaine de l'application** :
- Ajoutez : `checky.ma`
- Ajoutez : `www.checky.ma`

**Email du développeur** : Votre email

### 1.3 Configurer les scopes (permissions)

Laissez les scopes par défaut :
- ✅ `userinfo.email`
- ✅ `userinfo.profile`
- ✅ `openid`

### 1.4 Ajouter des utilisateurs de test (si en mode Testing)

Si votre application est en mode "Testing", ajoutez les emails des utilisateurs qui peuvent tester :
- Votre email
- Emails de test

### 1.5 Publier l'application

1. Vérifiez que tous les champs requis sont remplis
2. Cliquez sur **"PUBLISH APP"** ou **"Publier l'application"**
3. ⚠️ **Important** : La publication peut prendre quelques heures à être approuvée par Google

---

## 🔧 Étape 2 : Configurer le domaine personnalisé dans Supabase (Optionnel mais recommandé)

### 2.1 Vérifier si Supabase Auth supporte les domaines personnalisés

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **URL Configuration**

### 2.2 Configurer les URLs

- **Site URL** : `https://checky.ma`
- **Redirect URLs** : Ajoutez `https://checky.ma/auth/callback`

⚠️ **Note** : Supabase utilise toujours son propre domaine pour les callbacks OAuth (`csopyblkfyofwkeqqegd.supabase.co`), mais vous pouvez personnaliser l'affichage.

---

## 🔧 Étape 3 : Personnaliser l'affichage dans le code (Frontend)

### 3.1 Vérifier la configuration OAuth dans Auth.tsx

Le code actuel utilise déjà `urls.app.base` qui pointe vers `checky.ma` en production. C'est correct.

### 3.2 Améliorer le message de connexion

Vous pouvez personnaliser le texte du bouton Google dans `src/pages/Auth.tsx` :

```typescript
// Le bouton devrait afficher quelque chose comme :
"Continuer avec Google"
// ou
"Se connecter avec Checky"
```

---

## 🎯 Solution principale : Configurer correctement l'écran de consentement

Le texte "continuer à csopyblkfyofwkeqqegd.supabase.co" vient de l'écran de consentement OAuth de Google. Pour le changer :

### Option 1 : Utiliser un domaine personnalisé (Recommandé)

1. **Dans Google Cloud Console** → **OAuth consent screen** :
   - **Nom de l'application** : `Checky` (cela apparaîtra dans le texte)
   - **Domaine de l'application** : `checky.ma`
   - **Logo** : Logo CHECKY

2. **Dans Google Cloud Console** → **Credentials** → **OAuth client** :
   - **Authorized JavaScript origins** : `https://checky.ma`
   - **Authorized redirect URIs** : `https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback`

### Option 2 : Personnaliser le texte via les paramètres OAuth

Dans `src/pages/Auth.tsx`, vous pouvez ajouter des paramètres personnalisés :

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${urls.app.base}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
      // Personnalisation supplémentaire
      hd: 'checky.ma', // Si vous voulez limiter à un domaine spécifique
    },
    // Personnaliser le texte (si supporté)
    scopes: 'email profile',
  }
});
```

---

## ✅ Checklist de personnalisation

- [ ] **Google Cloud Console - OAuth consent screen** :
  - [ ] Nom de l'application : `Checky` ou `Checky.ma`
  - [ ] Logo CHECKY téléchargé et visible
  - [ ] Domaine `checky.ma` ajouté
  - [ ] Application publiée (Testing ou Production)

- [ ] **Google Cloud Console - OAuth client** :
  - [ ] Origines JavaScript : `https://checky.ma` ajoutée
  - [ ] URI de redirection : `https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback`

- [ ] **Supabase Dashboard** :
  - [ ] Site URL : `https://checky.ma`
  - [ ] Redirect URLs : `https://checky.ma/auth/callback` ajoutée

- [ ] **Test** :
  - [ ] Aller sur `https://checky.ma/auth`
  - [ ] Cliquer sur "Continuer avec Google"
  - [ ] Vérifier que le logo CHECKY apparaît
  - [ ] Vérifier que le texte affiche "Checky" ou "checky.ma"

---

## 🚨 Limitations importantes

### Ce que vous pouvez personnaliser :
- ✅ Nom de l'application (apparaît dans le texte)
- ✅ Logo (apparaît sur l'écran de consentement)
- ✅ Domaine de l'application

### Ce que vous ne pouvez pas changer :
- ❌ Le domaine `csopyblkfyofwkeqqegd.supabase.co` dans l'URL de redirection (c'est le domaine Supabase)
- ⚠️ Le texte "continuer à [domaine]" est généré par Google et utilise le domaine de redirection

### Solution de contournement :

Le texte "continuer à csopyblkfyofwkeqqegd.supabase.co" est normal car c'est le domaine Supabase qui gère l'authentification. Cependant :

1. **Le nom de l'application** que vous configurez dans l'écran de consentement apparaîtra en haut
2. **Le logo** apparaîtra à côté du nom
3. **Le domaine** `checky.ma` sera visible dans les informations de l'application

---

## 🎨 Améliorer l'expérience utilisateur

### Dans votre application (Frontend)

Personnalisez le message avant la redirection :

```typescript
// Dans Auth.tsx, avant la redirection OAuth
toast({
  title: "Connexion avec Checky",
  description: "Vous allez être redirigé vers Google pour vous connecter",
});
```

---

## 📝 Résumé

Pour que le logo CHECKY et le nom "Checky" apparaissent :

1. ✅ **Google Cloud Console** → **OAuth consent screen** :
   - Nom : `Checky`
   - Logo : Logo CHECKY
   - Domaine : `checky.ma`

2. ✅ **Publier l'application** dans Google Cloud Console

3. ✅ **Attendre la validation** (peut prendre quelques heures)

4. ✅ **Tester** : Le logo et le nom apparaîtront sur l'écran de consentement Google

Le texte "continuer à csopyblkfyofwkeqqegd.supabase.co" est normal car Supabase gère l'authentification, mais le nom "Checky" et le logo apparaîtront en haut de l'écran de consentement.

