# 🔧 Guide de Résolution - Erreur SQL USER-DEFINED et Signature Électronique

## 🚨 Problème Identifié

L'erreur `syntax error at or near "USER"` dans votre base de données indique un problème avec la définition de la table `bookings`. Le type `USER-DEFINED` n'est pas une syntaxe SQL valide.

## 📋 Solution Complète

### 1. 🔧 Correction de l'Erreur SQL

**Étapes à suivre :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql

2. **Copiez et exécutez** le contenu de `scripts/fix-sql-syntax-error.sql`

3. **Vérifiez** que toutes les requêtes s'exécutent sans erreur

### 2. 🔍 Diagnostic de la Base de Données

**Après avoir corrigé l'erreur SQL :**

1. **Exécutez** le contenu de `scripts/diagnostic-database.sql`
2. **Analysez** les résultats pour identifier d'autres problèmes

### 3. 🔧 Correction des Problèmes de Base de Données

**Si le diagnostic révèle des problèmes :**

1. **Exécutez** le contenu de `scripts/fix-database-issues.sql`
2. **Vérifiez** que toutes les requêtes s'exécutent sans erreur

### 4. 🔄 Redéploiement des Edge Functions

**Étapes manuelles :**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Pour chaque fonction, cliquez sur "Deploy updates" :**
   - ✅ `save-contract-signature` (CRITIQUE)
   - ✅ `submit-guest-info`
   - ✅ `resolve-guest-link`
   - ✅ `list-guest-docs`
   - ✅ `send-owner-notification`
   - ✅ `storage-sign-url`

### 5. 🌐 Configuration des Allowed Origins

**Étapes :**

1. **Supabase Dashboard** → **Settings** → **Authentication** → **URL Configuration**
2. **Ajoutez** : `http://localhost:3001`
3. **Sauvegardez** les changements

### 6. 🔑 Vérification des Secrets

**Dans Supabase Dashboard** → **Settings** → **Edge Function Secrets :**

- `OPENAI_API_KEY` (si vous utilisez l'OCR)
- `RESEND_API_KEY` (pour les emails)

## 🧪 Test de la Solution

### 1. **Redémarrez l'application :**
```bash
npm run dev
```

### 2. **Testez la signature :**
- Allez sur `http://localhost:3001/`
- Suivez le processus de signature
- Vérifiez que la signature est sauvegardée

### 3. **Vérifiez les logs :**
- Ouvrez la console du navigateur
- Vérifiez qu'il n'y a plus d'erreurs 500

## 🔍 Explication du Problème

### **Erreur SQL :**
```sql
-- ❌ INCORRECT (cause l'erreur)
status USER-DEFINED DEFAULT 'pending'::booking_status,

-- ✅ CORRECT
status booking_status DEFAULT 'pending'::booking_status,
```

### **Solution :**
1. **Créer le type ENUM** `booking_status`
2. **Modifier la colonne** pour utiliser le bon type
3. **Mettre à jour les données** existantes

## 📊 Requêtes de Vérification

### Vérifier que l'erreur SQL est corrigée :
```sql
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
    AND column_name = 'status';
```

### Vérifier la structure de contract_signatures :
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;
```

### Vérifier les données existantes :
```sql
SELECT 
    COUNT(*) as total_bookings,
    COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as valid_status
FROM bookings;
```

## ✅ Vérification Finale

Après avoir appliqué toutes les solutions :

1. ✅ **Erreur SQL USER-DEFINED corrigée**
2. ✅ **Base de données diagnostiquée et corrigée**
3. ✅ **Edge Functions redéployées**
4. ✅ **Allowed Origins configurées**
5. ✅ **Secrets configurés**
6. ✅ **Signature fonctionne sans erreur 500**

## 🆘 Support

Si le problème persiste après avoir suivi ce guide :

1. **Vérifiez** les logs Supabase Edge Functions
2. **Testez** avec un autre navigateur
3. **Vérifiez** votre connexion internet
4. **Contactez** le support si nécessaire

---

**🎯 Objectif :** Résoudre l'erreur SQL USER-DEFINED et l'erreur 500 lors de la signature électronique.
