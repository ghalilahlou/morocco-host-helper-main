# 🔧 GUIDE DE RÉSOLUTION COMPLET

## 🎯 Problèmes Identifiés

### 1️⃣ **"Michael" apparaît sur les réservations Airbnb**
**Cause** : Le nom "Michael" est enregistré dans la table `airbnb_reservations` et persiste à cause de la synchronisation ICS.

### 2️⃣ **Les liens ne se génèrent pas (404)**
**Cause** : Les Edge Functions ne sont pas déployées sur Supabase ou ne sont pas démarrées localement.

---

## ✅ SOLUTION 1 : Nettoyer "Michael" de la Base de Données

### Étape 1.1 : Se connecter à Supabase

1. Allez sur [app.supabase.com](https://app.supabase.com)
2. Sélectionnez votre projet
3. Cliquez sur **"SQL Editor"** dans le menu de gauche

### Étape 1.2 : Exécuter le script de nettoyage

**Copiez et collez ce SQL dans l'éditeur** :

```sql
-- 🧹 NETTOYAGE DES NOMS DE GUESTS INVALIDES
UPDATE public.airbnb_reservations ar
SET 
  guest_name = NULL,
  summary = CASE 
    WHEN ar.airbnb_booking_id IS NOT NULL 
    THEN 'Airbnb – Réservation ' || ar.airbnb_booking_id
    ELSE 'Airbnb – Réservation'
  END,
  updated_at = NOW()
WHERE 
  ar.guest_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.bookings b
    INNER JOIN public.guests g ON g.booking_id = b.id
    WHERE b.booking_reference = ar.airbnb_booking_id
      AND b.property_id = ar.property_id
      AND g.full_name IS NOT NULL
  );

-- Vérifier combien de lignes ont été nettoyées
SELECT COUNT(*) as reservations_nettoyees
FROM public.airbnb_reservations
WHERE guest_name IS NULL;
```

### Étape 1.3 : Cliquer sur "Run"

**Résultat attendu** :
```
✅ X réservations nettoyées
```

---

## ✅ SOLUTION 2 : Déployer les Edge Functions

### Option A : Production (Déploiement Supabase)

**Ouvrez PowerShell** dans votre dossier de projet et exécutez :

```powershell
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"

# Se connecter à Supabase (si ce n'est pas déjà fait)
supabase login

# Lier le projet
supabase link --project-ref csopyblkfyofwkeqqegd

# Déployer TOUTES les Edge Functions
supabase functions deploy
```

**Résultat attendu** :
```
✅ Deployed issue-guest-link (version: xxx)
✅ Deployed submit-guest-info-unified (version: xxx)
✅ Deployed extract-document-data (version: xxx)
...
```

---

### Option B : Développement Local

**Si vous testez en local** (`http://localhost:3000`), exécutez dans PowerShell :

```powershell
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"

# Démarrer Supabase localement
supabase start

# Dans un AUTRE terminal, servir les Edge Functions
supabase functions serve --env-file ./supabase/.env.local
```

**Résultat attendu** :
```
Serving functions on http://localhost:54321/functions/v1
  - issue-guest-link
  - submit-guest-info-unified
  - extract-document-data
  ...
```

---

## 🧪 SOLUTION 3 : Tester la Résolution

### Test 1 : Vérifier que "Michael" a disparu

1. Allez dans votre application
2. Ouvrez le calendrier
3. Cliquez sur une réservation Airbnb (par exemple HMY2RJABF2)
4. **Vérifiez que le nom "Michael" n'apparaît plus**
5. Il devrait afficher "Réservation HMY2RJABF2" ou être vide

---

### Test 2 : Vérifier que les liens se génèrent

1. Cliquez sur le bouton **"Générer lien"**
2. **Vérifiez qu'il n'y a AUCUNE erreur 404 dans la console**
3. Un toast devrait apparaître : **"✅ Lien copié !"**
4. Collez le lien dans un navigateur pour vérifier qu'il fonctionne

---

### Test 3 : Vérifier la console du navigateur

**Ouvrez la console (F12)** et vérifiez :

✅ **Ce que vous DEVEZ voir** :
```
✅ Generated client verification URL: http://localhost:3000/guest-verification/...
✅ Copié via navigator.clipboard (ou fallback)
```

❌ **Ce que vous ne devez PAS voir** :
```
❌ Failed to load resource: the server responded with a status of 404
❌ Error calling issue-guest-link function
```

---

## 🔍 DIAGNOSTIC SI LE PROBLÈME PERSISTE

### Si "Michael" apparaît toujours

**Exécutez ce SQL de vérification** :

```sql
-- Voir toutes les réservations avec un guest_name
SELECT 
  airbnb_booking_id,
  guest_name,
  start_date,
  end_date,
  updated_at
FROM public.airbnb_reservations
WHERE guest_name IS NOT NULL
ORDER BY updated_at DESC;
```

Si "Michael" apparaît encore, c'est que la requête de nettoyage n'a pas été exécutée correctement.

---

### Si les liens ne fonctionnent toujours pas (404)

**Test manuel de l'Edge Function** :

#### Production :
Ouvrez votre navigateur et allez sur :
```
https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/issue-guest-link
```

#### Local :
```
http://localhost:54321/functions/v1/issue-guest-link
```

**Résultat attendu** :
- ✅ **Bon signe** : `{"error": "Missing required fields"}` ou similaire (pas 404)
- ❌ **Mauvais signe** : `404 Not Found` → Les fonctions ne sont pas déployées/démarrées

---

## 📋 CHECKLIST DE RÉSOLUTION

### Avant de commencer
- [ ] Ouvrir [app.supabase.com](https://app.supabase.com)
- [ ] Ouvrir PowerShell dans le dossier du projet
- [ ] Vider le cache du navigateur (`Ctrl + Shift + R`)

### Étape 1 : Nettoyage Base de Données
- [ ] Aller dans **SQL Editor** sur Supabase
- [ ] Exécuter le script de nettoyage SQL
- [ ] Vérifier que X réservations ont été nettoyées
- [ ] Actualiser le calendrier dans l'application
- [ ] Vérifier que "Michael" a disparu

### Étape 2 : Déploiement Edge Functions
- [ ] Exécuter `supabase login` dans PowerShell
- [ ] Exécuter `supabase link --project-ref csopyblkfyofwkeqqegd`
- [ ] Exécuter `supabase functions deploy`
- [ ] Vérifier que toutes les fonctions sont déployées
- [ ] (OU si local) Exécuter `supabase start` et `supabase functions serve`

### Étape 3 : Tests
- [ ] Ouvrir l'application
- [ ] Ouvrir une réservation Airbnb
- [ ] Cliquer sur "Générer lien"
- [ ] Vérifier qu'il n'y a PAS d'erreur 404 dans la console
- [ ] Vérifier que le toast "✅ Lien copié !" apparaît
- [ ] Coller le lien et vérifier qu'il s'ouvre correctement

---

## 🎉 RÉSULTAT ATTENDU

Après avoir suivi ces étapes :

✅ **"Michael" ne devrait plus apparaître** sur les réservations non validées

✅ **Les liens se génèrent instantanément** (< 1 seconde)

✅ **Aucune erreur 404** dans la console

✅ **Le workflow complet fonctionne** : Génération lien → Upload document → Signature → Contrat

---

## 💬 RETOUR ATTENDU

Après avoir exécuté ces étapes, envoyez-moi :

1. **Résultat du SQL de nettoyage** :
   ```
   X réservations nettoyées
   ```

2. **Résultat du déploiement** :
   ```
   ✅ Deployed issue-guest-link
   ✅ Deployed submit-guest-info-unified
   ...
   ```

3. **Capture d'écran** :
   - Du calendrier sans "Michael"
   - Du toast "✅ Lien copié !"
   - De la console sans erreur 404

---

## 🚀 COMMANDES RAPIDES À COPIER-COLLER

### Nettoyage Base de Données (SQL Editor Supabase) :
```sql
UPDATE public.airbnb_reservations ar
SET guest_name = NULL, summary = 'Airbnb – Réservation ' || ar.airbnb_booking_id, updated_at = NOW()
WHERE ar.guest_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b
    INNER JOIN public.guests g ON g.booking_id = b.id
    WHERE b.booking_reference = ar.airbnb_booking_id
      AND b.property_id = ar.property_id
      AND g.full_name IS NOT NULL
  );
```

### Déploiement Edge Functions (PowerShell) :
```powershell
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"
supabase login
supabase link --project-ref csopyblkfyofwkeqqegd
supabase functions deploy
```

**Maintenant, exécutez ces étapes et confirmez-moi les résultats ! 🎯**

