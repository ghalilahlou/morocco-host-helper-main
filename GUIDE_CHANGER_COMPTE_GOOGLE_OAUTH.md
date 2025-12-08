# 🔄 Guide : Changer le compte Google OAuth

Ce guide vous explique comment changer le compte Google utilisé pour l'authentification OAuth de votre application.

---

## 📋 Vue d'ensemble

Pour changer le compte Google OAuth, vous devez :

1. **Créer un nouveau projet OAuth** dans Google Cloud Console (avec le nouveau compte)
2. **Mettre à jour les identifiants** dans Supabase
3. **Mettre à jour les domaines autorisés** dans Google Cloud Console
4. **Tester la nouvelle configuration**

---

## 🔧 Étape 1 : Créer un nouveau projet OAuth dans Google Cloud Console

### 1.1 Se connecter avec le nouveau compte Google

1. Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. **Se déconnecter** du compte actuel (si nécessaire)
3. **Se connecter** avec le **nouveau compte Google** que vous souhaitez utiliser

### 1.2 Créer un nouveau projet (ou utiliser un projet existant)

1. Cliquer sur **"Sélectionner un projet"** en haut
2. Cliquer sur **"NOUVEAU PROJET"**
3. Nom du projet : `Morocco Host Helper` (ou un nom différent si vous préférez)
4. Cliquer sur **"CRÉER"**
5. Attendre que le projet soit créé (quelques secondes)

### 1.3 Activer l'API Google+ (si nécessaire)

1. Dans le menu, aller sur **APIs & Services** → **Library**
2. Rechercher **"Google+ API"** ou **"Google Identity"**
3. Cliquer sur **"ENABLE"** (Activer)

---

## 🔐 Étape 2 : Configurer l'écran de consentement OAuth

1. Aller sur **APIs & Services** → **OAuth consent screen**

2. **Type d'utilisateur** : Sélectionner **External** (pour permettre à tous les utilisateurs de se connecter)

3. **Remplir les informations** :
   - **Nom de l'application** : `Morocco Host Helper` (ou votre nom)
   - **Email d'assistance utilisateur** : Votre email (le nouveau compte Google)
   - **Logo de l'application** : (Optionnel) Télécharger un logo
   - **Domaine de l'application** : `checky.ma`
   - **Email du développeur** : Votre email

4. **Domaines autorisés** :
   - Ajouter : `checky.ma`
   - Ajouter : `www.checky.ma`
   - (Optionnel) Ajouter : `*.vercel.app` pour les preview deployments

5. Cliquer sur **"SAVE AND CONTINUE"**

6. **Scopes** : Laisser par défaut (email, profile, openid)

7. **Utilisateurs de test** : (Optionnel) Ajouter des emails pour tester avant publication

8. Cliquer sur **"SAVE AND CONTINUE"** jusqu'à la fin

---

## 🔑 Étape 3 : Créer les identifiants OAuth

### 3.1 Créer l'ID client OAuth

1. Aller sur **APIs & Services** → **Credentials**

2. Cliquer sur **"+ CREATE CREDENTIALS"**

3. Sélectionner **"OAuth client ID"**

4. **Type d'application** : Sélectionner **Web application**

5. **Nom** : `Morocco Host Helper Web` (ou un nom descriptif)

6. **Origines JavaScript autorisées** (Authorized JavaScript origins) :
   ```
   https://checky.ma
   https://www.checky.ma
   http://localhost:3000
   http://localhost:5173
   ```
   ⚠️ **IMPORTANT** : Ajouter tous vos domaines de production et de développement

7. **URI de redirection autorisés** (Authorized redirect URIs) :
   ```
   https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   ⚠️ **IMPORTANT** : Remplacer `VOTRE_PROJECT_ID` par votre **Project Reference ID Supabase**
   
   **Pour trouver votre Project Reference ID** :
   - Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sélectionner votre projet
   - Dans **Settings** → **General** → **Project URL**
   - C'est la partie avant `.supabase.co`
   - Exemple : Si votre URL est `https://abcdefgh.supabase.co`, votre ID est `abcdefgh`

8. Cliquer sur **"CREATE"**

### 3.2 Copier les identifiants

Après création, vous verrez une popup avec :

- **Client ID** : `123456789-abcdefgh.apps.googleusercontent.com`
- **Client Secret** : `GOCSPX-xxxxxxxxxxxx`

⚠️ **IMPORTANT** : 
- **Copier ces identifiants** immédiatement (le secret ne sera plus visible après)
- **Ne jamais partager** ces identifiants publiquement
- **Les garder en sécurité**

---

## 🔄 Étape 4 : Mettre à jour Supabase

### 4.1 Accéder à la configuration Supabase

1. Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Aller dans **Authentication** → **Providers**
4. Chercher **Google** dans la liste

### 4.2 Mettre à jour les identifiants

1. **Activer Google Provider** (si pas déjà activé) :
   - Activer le toggle **"Enable Google provider"**

2. **Entrer les nouveaux identifiants** :
   - **Client ID (for OAuth)** : Coller le **nouveau Client ID** de Google Cloud Console
   - **Client Secret (for OAuth)** : Coller le **nouveau Client Secret** de Google Cloud Console

3. **Vérifier la Redirect URL** :
   - Elle devrait être : `https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback`
   - Vérifier qu'elle correspond bien à celle configurée dans Google Cloud Console

4. Cliquer sur **"SAVE"**

---

## ✅ Étape 5 : Vérifier la configuration

### 5.1 Vérifier dans Google Cloud Console

1. **Vérifier les domaines autorisés** :
   - APIs & Services → Credentials → Votre OAuth client
   - Vérifier que `checky.ma` est bien dans les "Authorized JavaScript origins"
   - Vérifier que l'URI de redirection Supabase est bien dans les "Authorized redirect URIs"

2. **Vérifier l'écran de consentement** :
   - APIs & Services → OAuth consent screen
   - Vérifier que `checky.ma` est dans les domaines autorisés

### 5.2 Tester la connexion

1. **En développement local** :
   ```bash
   npm run dev
   ```
   - Aller sur `http://localhost:3000/auth` ou `http://localhost:5173/auth`
   - Cliquer sur **"Continuer avec Google"**
   - Vérifier que le nouveau compte Google apparaît dans la sélection

2. **En production** :
   - Aller sur `https://checky.ma/auth`
   - Cliquer sur **"Continuer avec Google"**
   - Vérifier que la connexion fonctionne avec le nouveau compte

---

## 🚨 Résolution de problèmes

### Erreur : "redirect_uri_mismatch"

**Cause** : L'URI de redirection ne correspond pas entre Google Cloud Console et Supabase

**Solution** :
1. Vérifier que l'URI dans Google Cloud Console est **exactement** :
   ```
   https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
2. Vérifier qu'il n'y a pas d'espace ou de caractère supplémentaire
3. **Attendre 5-10 minutes** après modification (propagation Google)
4. Vérifier dans Supabase Dashboard → Authentication → Providers → Google que la Redirect URL est correcte

### Erreur : "Access blocked: This app's request is invalid"

**Cause** : L'écran de consentement OAuth n'est pas configuré ou les domaines ne sont pas autorisés

**Solution** :
1. Dans Google Cloud Console → APIs & Services → OAuth consent screen
2. Vérifier que `checky.ma` est dans les domaines autorisés
3. Compléter toutes les informations requises (nom, email, etc.)
4. Vérifier que l'application est en mode "Testing" ou "Production"

### Erreur : "The Google OAuth provider is disabled"

**Cause** : Google OAuth n'est pas activé dans Supabase

**Solution** :
1. Supabase Dashboard → Authentication → Providers
2. Activer **"Google"** et sauvegarder

### Le bouton Google n'apparaît pas

**Cause** : Le code n'a pas été déployé ou le cache du navigateur

**Solution** :
1. Vider le cache du navigateur (Ctrl+Shift+Delete)
2. Tester en navigation privée
3. Vérifier que le code est bien déployé sur Vercel

---

## 🔒 Sécurité après changement

### Actions recommandées

1. **Désactiver l'ancien projet OAuth** (si vous ne l'utilisez plus) :
   - Dans Google Cloud Console (ancien compte)
   - APIs & Services → Credentials
   - Désactiver ou supprimer l'ancien OAuth client

2. **Vérifier les logs** :
   - Supabase Dashboard → Logs → Auth
   - Vérifier qu'il n'y a pas d'erreurs liées à l'ancien compte

3. **Tester avec plusieurs comptes** :
   - Tester avec le nouveau compte Google
   - Vérifier que les anciens utilisateurs peuvent toujours se connecter (si nécessaire)

---

## 📝 Checklist de migration

- [ ] Nouveau compte Google connecté dans Google Cloud Console
- [ ] Nouveau projet créé (ou projet existant sélectionné)
- [ ] API Google+ activée
- [ ] Écran de consentement OAuth configuré avec `checky.ma`
- [ ] Nouveau OAuth client créé avec les bons domaines
- [ ] Client ID et Client Secret copiés
- [ ] Identifiants mis à jour dans Supabase
- [ ] Redirect URL vérifiée dans Google Cloud Console et Supabase
- [ ] Test en développement local réussi
- [ ] Test en production réussi
- [ ] Ancien projet OAuth désactivé (si nécessaire)

---

## 🎉 C'est terminé !

Une fois toutes les étapes terminées, votre application utilisera le nouveau compte Google pour l'authentification OAuth.

Les utilisateurs pourront :
- ✅ Se connecter avec le nouveau compte Google
- ✅ S'inscrire avec Google
- ✅ Bénéficier de la sécurité Google

---

## 📞 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs** :
   - Supabase Dashboard → Logs → Auth
   - Google Cloud Console → Logs Explorer

2. **Tester en navigation privée** (pour éviter les problèmes de cache)

3. **Vérifier que tous les domaines sont bien configurés** :
   - Google Cloud Console → Credentials → OAuth client
   - Google Cloud Console → OAuth consent screen

4. **Attendre 5-10 minutes** après modification (propagation Google)

---

## 🔄 Retour en arrière

Si vous devez revenir à l'ancien compte Google :

1. Suivre les mêmes étapes mais avec l'ancien compte
2. Remettre les anciens identifiants dans Supabase
3. Tester que tout fonctionne

