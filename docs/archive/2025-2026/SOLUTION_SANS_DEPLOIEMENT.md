# ⚠️ Problème de Déploiement : Docker Non Disponible

## 🚨 Erreur Rencontrée

```
WARNING: Docker is not running
Bundle generation timed out
```

**Cause** : Le déploiement Supabase Edge Functions nécessite Docker Desktop en cours d'exécution.

---

## 🎯 PLAN D'ACTION ALTERNATIF

Puisque nous ne pouvons pas déployer immédiatement, concentrons-nous sur **identifier le problème à la racine** via la base de données.

### ✅ ÉTAPE 1 : Diagnostic Base de Données (URGENT)

J'ai créé le fichier **`DIAGNOSTIC_SIGNATURE_BDD.sql`** avec 4 requêtes SQL.

#### **Action** :
1. **Ouvrir** Supabase Dashboard → SQL Editor
2. **Copier/Coller** le contenu de `DIAGNOSTIC_SIGNATURE_BDD.sql`
3. **Exécuter** les 4 requêtes
4. **Partager** les résultats ici

#### **Résultats Attendus** :

**ÉTAPE 1** : Liste de toutes les propriétés
```
name        | has_template | has_sig | format    | sig_length
------------|--------------|---------|-----------|------------
studio casa | true         | true    | ✅ PNG    | 15243
```

**ÉTAPE 4** : Statistiques
```
total_properties | has_template | has_signature_field | has_valid_signature
-----------------|--------------|---------------------|---------------------
5                | 5            | 3                   | 2
```

---

### 📊 Interprétation des Résultats

#### ✅ **Scénario 1** : Signature Existe
```
has_sig: true
format: ✅ PNG ou ✅ JPEG
sig_length: > 10000
```
→ **La signature EST en BDD** !  
→ Le problème est dans le **code ou les logs**  
→ Pas besoin de déployer, il faut juste observer les logs actuels

#### ❌ **Scénario 2** : Signature Manquante
```
has_sig: false
format: ❌ NULL ou ❌ VIDE
sig_length: 0 ou NULL
```
→ **La signature N'EST PAS en BDD** !  
→ **ACTION IMMÉDIATE** : Aller ajouter la signature dans l'interface

#### ⚠️ **Scénario 3** : Format SVG
```
has_sig: true
format: ❌ SVG (non supporté)
```
→ La signature existe mais **format non supporté** par pdf-lib  
→ **ACTION** : Réuploader en PNG ou JPEG

---

## 🚀 ÉTAPE 2 : Solution Selon le Résultat

### Si Scénario 1 (Signature Existe) ✅

**Pas besoin de déployer !** Le code est déjà en production.

**Action** :
1. Générer une **nouvelle** fiche de police
2. Observer les **logs actuels** dans Supabase Dashboard
3. Chercher :
   ```
   [Police] 🔍 Données propriété COMPLÈTES
   hasLandlordSignature: true/false
   ```
4. Partager les logs

---

### Si Scénario 2 (Signature Manquante) ❌

**La signature n'a jamais été ajoutée !**

**Action** :
1. **Aller dans** l'interface web de votre app
2. **Naviguer** : "Modifier le bien" → Sélectionner "studio casa"
3. **Trouver** la section "Signature / Cachet"
4. **Deux options** :
   - 🖊️ Dessiner avec le canvas
   - 📤 Uploader un PNG/JPEG (180x60px recommandé)
5. ⚠️ **CLIQUER** sur "SAUVEGARDER" !

**Vérification** :
```sql
-- Réexécuter cette requête après sauvegarde
SELECT 
    name,
    contract_template->'landlord_signature' IS NOT NULL as saved,
    LEFT(contract_template->>'landlord_signature', 50) as preview
FROM properties
WHERE LOWER(name) LIKE '%studio%casa%';
```

**Résultat Attendu** :
```
name        | saved | preview
------------|-------|----------------------------------------
studio casa | true  | data:image/png;base64,iVBORw0KGgo...
```

---

### Si Scénario 3 (Format SVG) ⚠️

**Le format SVG n'est PAS supporté par pdf-lib.**

**Action** :
1. Aller dans "Modifier le bien" → "studio casa"
2. **Supprimer** la signature SVG actuelle
3. **Réuploader** en PNG ou JPEG
4. **Sauvegarder**

---

## 🔧 Pour Déployer Plus Tard (Si Nécessaire)

### **Option 1** : Démarrer Docker Desktop

1. **Ouvrir** Docker Desktop
2. **Attendre** qu'il démarre complètement
3. **Réessayer** :
   ```bash
   supabase functions deploy submit-guest-info-unified
   ```

### **Option 2** : Déployer via Supabase Dashboard

1. **Aller** dans Supabase Dashboard → Edge Functions
2. **Créer/Modifier** la fonction `submit-guest-info-unified`
3. **Copier/Coller** le code du fichier `index.ts`
4. **Déployer** via l'interface web

### **Option 3** : GitHub Actions CI/CD (Si configuré)

1. **Commit** les changements
2. **Push** vers GitHub
3. Le déploiement se fera automatiquement

---

## 💡 Pourquoi le Diagnostic BDD est Prioritaire ?

**Avant de déployer**, nous devons savoir :

1. ✅ La signature **existe-t-elle** en BDD ?
2. ✅ Le **format** est-il supporté (PNG/JPEG) ?
3. ✅ La **longueur** est-elle > 0 ?

**Si la signature n'existe PAS** :
- Déployer ne servira à RIEN
- Il faut d'abord AJOUTER la signature

**Si la signature existe** :
- Le problème est dans le code/logs
- On peut analyser les logs actuels SANS déployer

---

## 🎯 Résumé en 30 Secondes

1. ✅ **Exécuter** `DIAGNOSTIC_SIGNATURE_BDD.sql` dans Supabase SQL Editor
2. ✅ **Partager** les résultats ici
3. ✅ **Selon le résultat** :
   - Signature existe → Observer les logs actuels
   - Signature manquante → Ajouter via l'interface
   - Format SVG → Réuploader en PNG
4. ⏸️ **Déploiement en attente** jusqu'à ce que Docker soit disponible

---

## 📞 Prochaines Étapes

**IMMÉDIATEMENT** :
1. Exécuter le script SQL de diagnostic
2. Partager les résultats (copier/coller les 4 tables de résultats)

**Avec les résultats**, je pourrai vous dire **EXACTEMENT** :
- ✅ Si la signature existe ou pas
- ✅ Quelle action prendre
- ✅ Si le déploiement est vraiment nécessaire

Prêt pour le diagnostic BDD ! 🔍
