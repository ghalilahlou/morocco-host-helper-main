# 🎨 Guide : Personnaliser l'Affichage Google OAuth

## 📋 Problème

Actuellement, lors de la connexion Google, l'utilisateur voit :
- **"continuer à csopyblkfyofwkeqqegd.supabase.co"** (URL Supabase)

Vous voulez afficher :
- **Le logo et le nom de votre application** ("Morocco Host Helper" ou votre nom)

---

## ✅ Solution : Configurer l'Écran de Consentement OAuth

### Étape 1 : Accéder à Google Cloud Console

1. Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sélectionner votre projet **"Morocco Host Helper"** (ou le nom de votre projet)

### Étape 2 : Configurer l'Écran de Consentement OAuth

1. **Aller dans le menu** → **APIs & Services** → **OAuth consent screen**

2. **Si c'est la première fois** :
   - Sélectionner **"External"** (pour les utilisateurs externes)
   - Cliquer sur **"CREATE"**

3. **Remplir les informations de l'application** :

   #### **Informations sur l'application**
   - **Nom de l'application** : `Morocco Host Helper` (ou votre nom)
   - **Email d'assistance utilisateur** : Votre email (ex: `ghalilahlou26@gmail.com`)
   - **Logo de l'application** : 
     - Cliquer sur **"UPLOAD"**
     - Télécharger votre logo (format PNG ou JPG, taille recommandée : 120x120 pixels)
     - Le logo apparaîtra à la place de l'URL Supabase
   - **Domaine d'assistance** : (optionnel) Votre domaine si vous en avez un
   - **Email du développeur** : Votre email

   #### **Domaines autorisés**
   - Cliquer sur **"+ ADD DOMAIN"**
   - Ajouter :
     - `morocco-host-helper-main.vercel.app` (votre domaine Vercel)
     - Votre domaine custom si vous en avez un
     - **NE PAS** ajouter `supabase.co` (ce n'est pas nécessaire)

   #### **Informations de contact du développeur**
   - **Email de contact** : Votre email
   - Cliquer sur **"SAVE AND CONTINUE"**

4. **Configurer les Scopes** (permissions) :
   - Cliquer sur **"ADD OR REMOVE SCOPES"**
   - Sélectionner uniquement :
     - ✅ `userinfo.email` (Email de l'utilisateur)
     - ✅ `userinfo.profile` (Informations de profil)
     - ✅ `openid` (Connexion)
   - Cliquer sur **"UPDATE"** puis **"SAVE AND CONTINUE"**

5. **Ajouter des utilisateurs de test** (si l'app est en mode "Testing") :
   - Cliquer sur **"+ ADD USERS"**
   - Ajouter les emails des utilisateurs qui peuvent tester
   - Cliquer sur **"SAVE AND CONTINUE"**

6. **Résumé** :
   - Vérifier toutes les informations
   - Cliquer sur **"BACK TO DASHBOARD"**

---

## 🎨 Préparer le Logo

### Spécifications du Logo

- **Format** : PNG ou JPG
- **Taille recommandée** : 120x120 pixels (minimum)
- **Taille maximale** : 5 MB
- **Format carré** : Préférable (ratio 1:1)
- **Fond transparent** : Recommandé (PNG avec transparence)

### Où trouver/créer un logo ?

1. **Si vous avez déjà un logo** :
   - Le redimensionner à 120x120 pixels
   - Utiliser un outil comme [Canva](https://www.canva.com) ou [GIMP](https://www.gimp.org)

2. **Si vous n'avez pas de logo** :
   - Créer un logo simple avec Canva
   - Utiliser un générateur de logo en ligne
   - Demander à un designer

---

## 🔄 Vérification

### Après Configuration

1. **Attendre 5-10 minutes** pour que les changements se propagent

2. **Tester la connexion** :
   - Aller sur votre application
   - Cliquer sur "Continuer avec Google"
   - Vous devriez maintenant voir :
     - ✅ **Le logo de votre application** (au lieu de l'icône Google générique)
     - ✅ **"continuer à Morocco Host Helper"** (au lieu de l'URL Supabase)

---

## 🚨 Résolution de Problèmes

### Le logo n'apparaît pas

**Causes possibles** :
1. **Cache du navigateur** : Vider le cache ou utiliser la navigation privée
2. **Propagation** : Attendre 10-15 minutes après l'upload
3. **Format du logo** : Vérifier que le logo est au bon format (PNG/JPG, < 5MB)
4. **Taille** : Le logo doit faire au moins 120x120 pixels

**Solution** :
- Vérifier dans Google Cloud Console que le logo est bien uploadé
- Tester en navigation privée
- Attendre un peu plus longtemps

### L'URL Supabase apparaît toujours

**Cause** : L'écran de consentement n'est pas complètement configuré

**Solution** :
1. Vérifier que toutes les étapes sont complétées dans Google Cloud Console
2. Vérifier que le logo est bien uploadé
3. Vérifier que le nom de l'application est bien renseigné
4. Attendre 10-15 minutes pour la propagation

### "Access blocked: This app's request is invalid"

**Cause** : L'écran de consentement n'est pas publié ou mal configuré

**Solution** :
1. Dans Google Cloud Console → OAuth consent screen
2. Vérifier que toutes les sections sont complétées
3. Si l'app est en mode "Testing", ajouter les utilisateurs de test
4. Si l'app est en mode "Production", vérifier que tous les champs requis sont remplis

---

## 📝 Notes Importantes

1. **Propagation** : Les changements peuvent prendre jusqu'à 15 minutes pour être visibles
2. **Mode Testing vs Production** :
   - **Testing** : Seuls les utilisateurs ajoutés peuvent se connecter
   - **Production** : Tous les utilisateurs peuvent se connecter (nécessite une vérification Google)
3. **Logo** : Le logo doit être de bonne qualité pour un rendu optimal
4. **Nom de l'application** : Ce nom apparaîtra partout où Google affiche votre application

---

## 🎯 Résultat Attendu

Après configuration, lors de la connexion Google, l'utilisateur verra :

**AVANT** :
```
Choisissez un compte
continuer à csopyblkfyofwkeqqegd.supabase.co
```

**APRÈS** :
```
Choisissez un compte
continuer à Morocco Host Helper
[Logo de votre application]
```

---

## ✅ Checklist de Configuration

- [ ] Accès à Google Cloud Console
- [ ] Projet sélectionné
- [ ] Écran de consentement OAuth configuré
- [ ] Nom de l'application renseigné
- [ ] Logo uploadé (120x120 pixels minimum)
- [ ] Email d'assistance renseigné
- [ ] Domaines autorisés ajoutés
- [ ] Scopes configurés (email, profile, openid)
- [ ] Changements sauvegardés
- [ ] Test effectué après 10-15 minutes

---

**Date de création** : $(date)
**Statut** : ✅ Guide complet pour personnaliser l'affichage Google OAuth



