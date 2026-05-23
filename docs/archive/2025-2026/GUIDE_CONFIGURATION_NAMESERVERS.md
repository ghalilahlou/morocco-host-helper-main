# 🔧 Guide : Configuration des Nameservers Vercel dans heberjahiz.com

## 📋 Informations Vercel

D'après votre dashboard Vercel, vous devez configurer ces **nameservers** pour `checky.ma` :

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

---

## 🎯 Étapes Détaillées dans heberjahiz.com

### **Étape 1 : Se connecter à heberjahiz.com**

1. Allez sur https://heberjahiz.com
2. Connectez-vous à votre compte
3. Accédez à votre **Espace clients**

---

### **Étape 2 : Accéder à la gestion DNS**

1. Cliquez sur l'onglet **"Mon domaine"** (déjà sélectionné d'après votre capture)
2. Dans la barre de navigation secondaire, cliquez sur **"DNS"** (icône liste)
3. Vous devriez voir la section **"Serveurs dns"**

---

### **Étape 3 : Changer vers "Mes propres DNS"**

1. Dans la section **"Serveurs dns"**, vous verrez deux options :
   - ⚪ **"DNS de redirection"** (actuellement sélectionné)
   - ⚪ **"Mes propres DNS"**

2. **Sélectionnez "Mes propres DNS"** (cliquez sur le bouton radio)

---

### **Étape 4 : Configurer les Nameservers Vercel**

Une fois **"Mes propres DNS"** sélectionné, vous devriez voir des champs pour entrer les serveurs DNS.

**Configurez comme suit :**

**Serveur DNS 1 :**
```
Nom : ns1.vercel-dns.com
Adresse IP : (laissez vide ou mettez l'IP si demandée)
```

**Serveur DNS 2 :**
```
Nom : ns2.vercel-dns.com
Adresse IP : (laissez vide ou mettez l'IP si demandée)
```

**Note :** Si heberjahiz demande des adresses IP pour les nameservers, vous pouvez les trouver avec :
```bash
nslookup ns1.vercel-dns.com
nslookup ns2.vercel-dns.com
```

Ou utilisez ces IPs (peuvent changer, vérifiez-les) :
- `ns1.vercel-dns.com` → généralement résout vers une IP Vercel
- `ns2.vercel-dns.com` → généralement résout vers une IP Vercel

---

### **Étape 5 : Valider la Configuration**

1. Cliquez sur le bouton **"Valider"** (bouton vert en bas à droite)
2. Une confirmation devrait apparaître
3. **Important :** Les changements peuvent prendre **24 à 72 heures** pour se propager

---

## ⏱️ Après la Configuration

### **Vérification Immédiate (dans quelques minutes) :**

1. **Dans Vercel Dashboard :**
   - Allez dans **Settings** → **Domains**
   - Cliquez sur **"Refresh"** à côté de `checky.ma`
   - Le statut devrait progressivement passer de **"Invalid Configuration"** à **"Valid"**

2. **Vérification DNS en ligne :**
   - Utilisez https://dnschecker.org
   - Entrez `checky.ma`
   - Vérifiez que les nameservers `ns1.vercel-dns.com` et `ns2.vercel-dns.com` apparaissent

---

## 🚨 Points Importants

### ✅ **Avantages d'utiliser Vercel DNS :**
- Gestion automatique des enregistrements DNS
- Pas besoin de configurer manuellement les enregistrements A/CNAME
- Vercel gère automatiquement les certificats SSL
- Configuration simplifiée

### ⚠️ **Ce qui va changer :**
- Les DNS seront maintenant gérés par Vercel au lieu de heberjahiz
- Vous devrez configurer les sous-domaines et autres enregistrements dans Vercel Dashboard
- Les changements DNS futurs se feront dans Vercel, pas dans heberjahiz

### 📝 **Note sur le temps de propagation :**
- **Minimum :** 1-2 heures
- **Typique :** 24-48 heures
- **Maximum :** 72 heures

Pendant ce temps, votre site peut être temporairement inaccessible ou pointer vers l'ancienne configuration.

---

## 🔍 Vérification des Nameservers

### **Via ligne de commande :**
```bash
# Windows PowerShell
nslookup -type=NS checky.ma

# Linux/Mac
dig NS checky.ma
```

### **Résultat attendu :**
```
checky.ma nameserver = ns1.vercel-dns.com
checky.ma nameserver = ns2.vercel-dns.com
```

---

## ✅ Checklist de Configuration

- [ ] Connecté à heberjahiz.com
- [ ] Accédé à "Mon domaine" → "DNS"
- [ ] Sélectionné "Mes propres DNS"
- [ ] Entré `ns1.vercel-dns.com` comme premier serveur DNS
- [ ] Entré `ns2.vercel-dns.com` comme deuxième serveur DNS
- [ ] Cliqué sur "Valider"
- [ ] Attendu la confirmation
- [ ] Vérifié dans Vercel Dashboard après quelques heures
- [ ] Vérifié la propagation DNS avec dnschecker.org

---

## 🆘 En Cas de Problème

### **Problème : Les nameservers ne sont pas acceptés**
- Vérifiez que vous avez bien copié les noms exacts (sans espaces)
- Assurez-vous que vous avez sélectionné "Mes propres DNS"
- Contactez le support heberjahiz si nécessaire

### **Problème : Le statut reste "Invalid Configuration" après 48h**
- Vérifiez la propagation DNS avec dnschecker.org
- Vérifiez que les nameservers sont bien configurés dans heberjahiz
- Contactez le support Vercel avec une capture d'écran de votre configuration

---

## 📞 Support

- **Vercel Support :** https://vercel.com/support
- **heberjahiz Support :** Via votre espace client

---

Une fois les nameservers configurés, Vercel gérera automatiquement tous les enregistrements DNS nécessaires pour votre domaine ! 🎉

