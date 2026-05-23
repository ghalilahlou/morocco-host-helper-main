# 🌐 Guide de Configuration DNS pour Vercel

## 📋 Vue d'ensemble

Ce guide vous aidera à configurer votre domaine personnalisé (`checky.ma` ou autre) sur Vercel et à résoudre les problèmes de configuration DNS.

---

## 🔍 Étape 1 : Vérifier la Configuration Actuelle

### Dans Vercel Dashboard :
1. Allez sur votre projet Vercel
2. Cliquez sur **Settings** → **Domains**
3. Vérifiez les domaines configurés :
   - `checky.ma` (domaine principal)
   - `www.checky.ma` (sous-domaine)

### Problème identifié :
- **Status :** "Invalid Configuration" (Configuration invalide)
- **Cause probable :** Les enregistrements DNS ne correspondent pas à ceux requis par Vercel

---

## 🔧 Étape 2 : Configurer les Enregistrements DNS

### Option A : Utiliser les DNS de Vercel (Recommandé)

1. **Dans Vercel Dashboard :**
   - Allez dans **Settings** → **Domains**
   - Cliquez sur votre domaine `checky.ma`
   - Sélectionnez l'onglet **"Vercel DNS"**
   - Vercel vous fournira des serveurs DNS à configurer

2. **Dans votre hébergeur (heberjahiz.com) :**
   - Connectez-vous à votre compte
   - Allez dans **"Mon domaine"** → **"DNS"**
   - Changez de **"DNS de redirection"** à **"Mes propres DNS"**
   - Ajoutez les serveurs DNS fournis par Vercel (généralement sous la forme `ns1.vercel-dns.com`)

### Option B : Utiliser les DNS de votre hébergeur (Configuration manuelle)

1. **Dans Vercel Dashboard :**
   - Allez dans **Settings** → **Domains**
   - Cliquez sur votre domaine `checky.ma`
   - Sélectionnez l'onglet **"DNS Records"**
   - Notez les enregistrements requis :
     ```
     Type: A
     Name: @
     Value: 216.198.79.1
     ```

2. **Dans votre hébergeur (heberjahiz.com) :**
   - Allez dans **"Mon domaine"** → **"DNS"**
   - Assurez-vous que **"DNS de redirection"** est sélectionné
   - Ajoutez/modifiez les enregistrements suivants :

   **Pour le domaine principal (`checky.ma`) :**
   ```
   Type: A
   Nom: @ (ou laissez vide)
   Valeur: 216.198.79.1
   TTL: 3600 (ou par défaut)
   ```

   **Pour le sous-domaine (`www.checky.ma`) :**
   ```
   Type: CNAME
   Nom: www
   Valeur: cname.vercel-dns.com
   TTL: 3600 (ou par défaut)
   ```

   **OU (si CNAME n'est pas supporté pour www) :**
   ```
   Type: A
   Nom: www
   Valeur: 216.198.79.1
   TTL: 3600
   ```

---

## ⏱️ Étape 3 : Attendre la Propagation DNS

1. **Temps de propagation :** 24 à 72 heures (généralement moins de 1 heure)
2. **Vérifier la propagation :**
   - Utilisez des outils en ligne comme :
     - https://dnschecker.org
     - https://www.whatsmydns.net
   - Entrez votre domaine `checky.ma` et vérifiez que l'IP `216.198.79.1` apparaît

---

## ✅ Étape 4 : Vérifier dans Vercel

1. **Dans Vercel Dashboard :**
   - Allez dans **Settings** → **Domains**
   - Cliquez sur **"Refresh"** à côté de votre domaine
   - Le statut devrait passer de **"Invalid Configuration"** à **"Valid"**

2. **Si le statut reste "Invalid Configuration" :**
   - Vérifiez que les enregistrements DNS sont corrects
   - Attendez encore quelques heures pour la propagation
   - Contactez le support Vercel si le problème persiste

---

## 🔄 Étape 5 : Configurer la Redirection www

### Dans Vercel Dashboard :

1. Allez dans **Settings** → **Domains**
2. Cliquez sur `www.checky.ma`
3. Configurez :
   - **Environment Connection :** "Production"
   - **Redirection :** 
     - Option 1 : Laissez connecté à Production (recommandé)
     - Option 2 : Redirigez vers `checky.ma` avec un code 307 ou 308

---

## 📝 Étape 6 : Mettre à Jour la Configuration du Code

Une fois le domaine configuré, mettez à jour les fichiers suivants :

### 1. `src/config/runtime.ts`
Ajoutez votre domaine dans la liste des domaines autorisés :

```typescript
production: [
  'https://*.vercel.app',
  'https://morocco-host-helper.vercel.app',
  'https://checky.ma',           // ✅ Ajoutez votre domaine
  'https://www.checky.ma',       // ✅ Ajoutez le sous-domaine
],
```

### 2. Variables d'environnement Vercel
Dans Vercel Dashboard → Settings → Environment Variables, ajoutez si nécessaire :

```env
VITE_PUBLIC_APP_URL=https://checky.ma
```

---

## 🚨 Résolution des Problèmes Courants

### Problème 1 : "Invalid Configuration" persiste

**Solutions :**
1. Vérifiez que les enregistrements DNS sont exactement comme indiqué dans Vercel
2. Assurez-vous qu'il n'y a pas d'enregistrements DNS en conflit
3. Attendez 24-48 heures pour la propagation complète
4. Utilisez `dig checky.ma` ou `nslookup checky.ma` pour vérifier

### Problème 2 : Le domaine ne se charge pas

**Solutions :**
1. Vérifiez que le domaine est bien connecté à votre projet Vercel
2. Vérifiez que le build Vercel est réussi
3. Vérifiez les logs Vercel pour les erreurs
4. Assurez-vous que le certificat SSL est généré (automatique avec Vercel)

### Problème 3 : www ne fonctionne pas

**Solutions :**
1. Vérifiez que l'enregistrement CNAME pour `www` est correct
2. Si CNAME n'est pas supporté, utilisez un enregistrement A avec la même IP
3. Configurez la redirection dans Vercel Dashboard

---

## 📚 Ressources Utiles

- [Documentation Vercel - Domaines](https://vercel.com/docs/concepts/projects/domains)
- [Vérification DNS](https://dnschecker.org)
- [Support Vercel](https://vercel.com/support)

---

## ✅ Checklist Finale

- [ ] Enregistrements DNS configurés dans votre hébergeur
- [ ] Propagation DNS vérifiée (24-72h)
- [ ] Domaine validé dans Vercel Dashboard
- [ ] Configuration mise à jour dans `src/config/runtime.ts`
- [ ] Variables d'environnement configurées si nécessaire
- [ ] Site accessible via `https://checky.ma`
- [ ] Site accessible via `https://www.checky.ma`
- [ ] Certificat SSL actif (automatique avec Vercel)

---

## 🎯 Prochaines Étapes

Une fois le domaine configuré :
1. Testez toutes les fonctionnalités de votre application
2. Vérifiez que les liens et redirections fonctionnent
3. Configurez le monitoring et les analytics si nécessaire
4. Documentez la configuration pour votre équipe

