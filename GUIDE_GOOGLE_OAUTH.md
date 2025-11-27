# 🔐 Guide de Configuration : Google OAuth

## Vue d'ensemble

L'authentification Google OAuth a été ajoutée à votre application. Les utilisateurs peuvent maintenant se connecter ou s'inscrire avec leur compte Google en un seul clic.

---

## ⚙️ Configuration Supabase (OBLIGATOIRE)

### Étape 1: Créer un projet Google Cloud

1. **Accéder à Google Cloud Console**
   - Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
   - Se connecter avec votre compte Google

2. **Créer un nouveau projet** (si pas déjà fait)
   - Cliquer sur "Sélectionner un projet" en haut
   - Cliquer sur "NOUVEAU PROJET"
   - Nom du projet: `Morocco Host Helper` (ou autre nom)
   - Cliquer sur "CRÉER"

### Étape 2: Activer l'API Google+

1. Dans le menu, aller sur **APIs & Services** → **Library**
2. Rechercher "Google+ API"
3. Cliquer sur "Google+ API"
4. Cliquer sur "ENABLE" (Activer)

### Étape 3: Créer les identifiants OAuth

1. Aller sur **APIs & Services** → **Credentials**
2. Cliquer sur **"+ CREATE CREDENTIALS"**
3. Sélectionner **"OAuth client ID"**

4. **Configurer l'écran de consentement** (si demandé)
   - Type d'utilisateur: **External**
   - Nom de l'application: `Morocco Host Helper`
   - Email d'assistance utilisateur: votre email
   - Domaines autorisés: `vercel.app` et votre domaine custom si vous en avez un
   - Cliquer sur "SAVE AND CONTINUE"

5. **Créer l'ID client OAuth**
   - Type d'application: **Web application**
   - Nom: `Morocco Host Helper Web`
   
   - **Origines JavaScript autorisées** (Authorized JavaScript origins):
     ```
     https://morocco-host-helper-main.vercel.app
     http://localhost:5173
     ```
     (Ajouter aussi votre domaine custom si vous en avez un)
   
   - **URI de redirection autorisés** (Authorized redirect URIs):
     ```
     https://csopyblkfyofwkeqqegd.supabase.co/auth/v1/callback
     ```
     ⚠️ **IMPORTANT**: Remplacer `csopyblkfyofwkeqqegd` par votre **Project Reference ID Supabase**
     
     Pour trouver votre Project Reference ID:
     - Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
     - Sélectionner votre projet
     - Dans Settings → General → Project URL
     - C'est la partie avant `.supabase.co`
     - Exemple: Si votre URL est `https://abcdefgh.supabase.co`, votre ID est `abcdefgh`

6. Cliquer sur **CREATE**

7. **Copier les identifiants**
   - **Client ID**: `123456789-abcdefgh.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxx`
   
   ⚠️ **Garder ces informations secrètes !**

### Étape 4: Configurer Supabase

1. **Aller sur Supabase Dashboard**
   - [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sélectionner votre projet `Morocco Host Helper`

2. **Activer Google Provider**
   - Aller dans **Authentication** → **Providers**
   - Chercher **Google** dans la liste
   - Activer le toggle "Enable Google provider"

3. **Entrer les identifiants**
   - **Client ID (for OAuth)**: Coller le Client ID de Google
   - **Client Secret (for OAuth)**: Coller le Client Secret de Google
   - Cliquer sur **SAVE**

4. **Vérifier la Redirect URL**
   - Dans la même page, copier la **Redirect URL** affichée
   - Elle devrait être: `https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback`
   - Vérifier qu'elle correspond bien à celle configurée dans Google Cloud Console

---

## ✅ Vérification de la configuration

### Test en local (localhost)

1. Lancer l'application en dev:
```bash
npm run dev
```

2. Aller sur [http://localhost:5173/auth](http://localhost:5173/auth)

3. Cliquer sur "Continuer avec Google"

4. Vous devriez voir:
   - Une popup Google demandant de choisir un compte
   - Demande de permissions
   - Redirection vers `/dashboard` après connexion

### Test en production

1. Aller sur [https://morocco-host-helper-main.vercel.app/auth](https://morocco-host-helper-main.vercel.app/auth)

2. Cliquer sur "Continuer avec Google"

3. Même flux qu'en local

---

## 🚨 Résolution de problèmes

### Erreur: "redirect_uri_mismatch"

**Cause**: L'URI de redirection ne correspond pas à celle configurée dans Google Cloud Console

**Solution**:
1. Vérifier que l'URI dans Google Cloud Console est exactement:
   ```
   https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
2. Vérifier qu'il n'y a pas d'espace ou de caractère supplémentaire
3. Attendre 5-10 minutes après modification (propagation Google)

### Erreur: "Access blocked: This app's request is invalid"

**Cause**: L'écran de consentement OAuth n'est pas configuré

**Solution**:
1. Dans Google Cloud Console → APIs & Services → OAuth consent screen
2. Compléter toutes les informations requises
3. Ajouter les scopes nécessaires:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`

### Erreur: "The Google OAuth provider is disabled"

**Cause**: Google OAuth n'est pas activé dans Supabase

**Solution**:
1. Supabase Dashboard → Authentication → Providers
2. Activer "Google" et sauvegarder

### Le bouton Google n'apparaît pas

**Cause**: Le code n'a pas été déployé

**Solution**:
```bash
git add .
git commit -m "feat: Ajout authentification Google OAuth"
git push
```

Attendre que Vercel déploie (1-2 minutes)

---

## 📊 Statistiques d'utilisation

Pour voir les utilisateurs qui se connectent via Google:

1. Supabase Dashboard → **Authentication** → **Users**
2. Colonne "Provider": Filtrer par "google"

---

## 🔒 Sécurité

### Bonnes pratiques

1. **Ne jamais partager**:
   - Client Secret Google
   - Clés API Supabase
   - Tokens de session

2. **Domaines autorisés**:
   - Ajouter UNIQUEMENT vos domaines
   - Ne pas utiliser de wildcards (`*`)

3. **Écran de consentement**:
   - Demander uniquement les permissions nécessaires
   - Avoir une politique de confidentialité claire

4. **Monitoring**:
   - Vérifier régulièrement les logs Supabase Auth
   - Surveiller les tentatives de connexion suspectes

---

## 🎉 C'est prêt !

Une fois la configuration terminée, vos utilisateurs peuvent:

✅ Se connecter avec Google en 1 clic  
✅ S'inscrire avec Google (pas besoin de mot de passe)  
✅ Bénéficier de la sécurité Google  
✅ Accéder instantanément à l'application  

---

## 📞 Support

Si vous rencontrez des problèmes:

1. Vérifier les logs dans:
   - Supabase Dashboard → Logs → Auth
   - Google Cloud Console → Logs Explorer

2. Tester d'abord en navigation privée (pour éviter les problèmes de cache)

3. Vérifier que tous les domaines sont bien configurés

---

## 🚀 Prochaines étapes possibles

- [ ] Ajouter d'autres providers OAuth (Facebook, Apple, Microsoft)
- [ ] Personnaliser l'écran de consentement Google
- [ ] Ajouter un logo à votre application Google
- [ ] Configurer des quotas pour éviter les abus


