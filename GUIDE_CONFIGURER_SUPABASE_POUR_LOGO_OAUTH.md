# 🔧 Guide : Configurer Supabase pour afficher le logo OAuth

## Problème identifié

- ✅ Logo CHECKY configuré dans Google Cloud Console
- ✅ Domaines `checky.ma` configurés
- ❌ Logo ne s'affiche pas lors de la connexion
- ❌ Domaine `csopyblkfyofwkeqqegd.supabase.co` toujours visible

## Explication importante

### Pourquoi le domaine Supabase doit rester

Le domaine `csopyblkfyofwkeqqegd.supabase.co` **DOIT** rester dans les domaines autorisés car :
- C'est le domaine que Supabase utilise pour gérer les callbacks OAuth
- C'est là que Google redirige après l'authentification
- **C'est normal et nécessaire** pour que l'authentification fonctionne

**Vous ne pouvez pas le supprimer**, mais vous pouvez améliorer l'affichage.

---

## 🔧 Solution : Configuration dans Supabase

### Étape 1 : Vérifier la configuration Authentication dans Supabase

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **URL Configuration**

### Étape 2 : Configurer les URLs

**Site URL** :
```
https://checky.ma
```

**Redirect URLs** : Ajoutez ces URLs (une par une) :
```
https://checky.ma/auth/callback
https://checky.ma/**
https://www.checky.ma/auth/callback
https://www.checky.ma/**
```

⚠️ **Important** : Ne supprimez PAS les URLs Supabase existantes, ajoutez simplement les nouvelles.

### Étape 3 : Vérifier la configuration Providers

1. Dans **Authentication** → **Providers** → **Google**
2. Vérifiez que :
   - ✅ Google provider est activé
   - ✅ Client ID est correct (celui de Google Cloud Console)
   - ✅ Client Secret est correct
   - ✅ **Redirect URL** affichée est : `https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback`

---

## 🎨 Pourquoi le logo ne s'affiche pas

### Raison principale : Application non publiée/validée

Le logo ne s'affichera que si :
1. ✅ L'application est **publiée** dans Google Cloud Console
2. ✅ L'application est **validée** par Google (peut prendre quelques heures à quelques jours)
3. ✅ L'application n'est pas en mode "Testing" (ou alors les utilisateurs doivent être dans la liste de test)

### Vérifier l'état de publication

1. Allez dans **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**
2. Regardez en haut de la page :
   - **"Testing"** : Le logo ne s'affichera que pour les utilisateurs de test
   - **"In production"** : Le logo s'affichera pour tous les utilisateurs (après validation Google)

### Passer en Production

1. Dans **OAuth consent screen**, vérifiez que tous les champs requis sont remplis :
   - ✅ Nom de l'application
   - ✅ Logo
   - ✅ Email d'assistance
   - ✅ Domaine de l'application
   - ✅ Politique de confidentialité (si demandée)
   - ✅ Conditions d'utilisation (si demandées)

2. Cliquez sur **"PUBLISH APP"** ou **"Publier l'application"**

3. ⚠️ **Validation Google** :
   - Google peut demander une validation manuelle
   - Cela peut prendre **24-48 heures** ou plus
   - Vous recevrez un email de Google une fois validé

---

## 🔍 Vérifications supplémentaires

### Dans Google Cloud Console

1. **OAuth consent screen** :
   - ✅ Nom : `Checky` ou `Checky.ma`
   - ✅ Logo : Logo CHECKY visible dans l'aperçu
   - ✅ Domaine : `checky.ma` ajouté
   - ✅ Page d'accueil : `https://checky.ma`
   - ✅ Politique de confidentialité : `https://www.checky.ma` (ou votre URL)

2. **Credentials** → **OAuth client** :
   - ✅ Origines JavaScript : `https://checky.ma` ajoutée
   - ✅ URI de redirection : `https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback`

### Dans Supabase Dashboard

1. **Authentication** → **URL Configuration** :
   - ✅ Site URL : `https://checky.ma`
   - ✅ Redirect URLs : Inclut `https://checky.ma/auth/callback`

2. **Authentication** → **Providers** → **Google** :
   - ✅ Activé
   - ✅ Client ID correct
   - ✅ Client Secret correct

---

## 🚨 Solutions aux problèmes courants

### Problème 1 : Logo ne s'affiche toujours pas

**Solutions** :
1. Vérifier que l'application est **publiée** (pas seulement en mode Testing)
2. Attendre la **validation Google** (peut prendre 24-48h)
3. Vérifier le format du logo :
   - Format : PNG ou JPG
   - Taille : 120x120 pixels (carré)
   - Poids : < 1 MB
4. Tester en navigation privée (pour éviter le cache)

### Problème 2 : Domaine Supabase toujours visible

**C'est normal !** Le domaine `csopyblkfyofwkeqqegd.supabase.co` :
- ✅ **DOIT** rester dans les domaines autorisés
- ✅ **DOIT** être dans l'URI de redirection
- ✅ C'est le domaine que Supabase utilise pour les callbacks

**Ce que vous pouvez faire** :
- Le nom "Checky" et le logo apparaîtront en haut de l'écran
- Le domaine `checky.ma` sera visible dans les informations de l'application
- L'expérience sera plus professionnelle même si le domaine Supabase est visible

### Problème 3 : Application en mode Testing

Si votre application est en mode "Testing" :
1. Le logo ne s'affichera que pour les **utilisateurs de test**
2. Pour que tous les utilisateurs voient le logo :
   - Publiez l'application
   - Attendez la validation Google
   - Passez en "Production"

---

## ✅ Checklist complète

### Google Cloud Console
- [ ] Logo CHECKY téléchargé et visible dans l'aperçu
- [ ] Nom de l'application : `Checky` ou `Checky.ma`
- [ ] Domaine `checky.ma` ajouté
- [ ] Page d'accueil : `https://checky.ma`
- [ ] Politique de confidentialité : `https://www.checky.ma`
- [ ] Application **publiée** (pas seulement en Testing)
- [ ] OAuth client créé avec les bons domaines

### Supabase Dashboard
- [ ] Site URL : `https://checky.ma`
- [ ] Redirect URLs : `https://checky.ma/auth/callback` ajoutée
- [ ] Google Provider activé
- [ ] Client ID et Client Secret corrects

### Test
- [ ] Aller sur `https://checky.ma/auth`
- [ ] Cliquer sur "Continuer avec Google"
- [ ] Vérifier que le logo CHECKY apparaît (après validation Google)
- [ ] Vérifier que le nom "Checky" est visible

---

## 📝 Résumé

1. **Le domaine Supabase doit rester** : C'est normal et nécessaire
2. **Le logo apparaîtra** : Une fois l'application publiée et validée par Google
3. **Configuration Supabase** : Vérifiez les URLs dans Authentication → URL Configuration
4. **Patience** : La validation Google peut prendre 24-48 heures

---

## 🎯 Action immédiate

1. **Dans Supabase** : Vérifiez Authentication → URL Configuration
2. **Dans Google Cloud Console** : Publiez l'application si ce n'est pas déjà fait
3. **Attendez** : La validation Google (24-48h)
4. **Testez** : Le logo devrait apparaître après validation

