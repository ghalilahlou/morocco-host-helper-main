# Guide de Diagnostic et Correction - Problèmes de Sécurité Supabase

Ce guide contient des scripts SQL pour diagnostiquer et corriger les problèmes de sécurité identifiés par le linter Supabase.

## 📋 Problèmes Identifiés

1. **Vue `profiles` expose auth.users** : La vue `public.profiles` expose potentiellement des données de `auth.users` aux rôles `anon` et `authenticated`
2. **RLS désactivé sur des tables avec policies** : Plusieurs tables ont des policies mais RLS n'est pas activé
3. **RLS désactivé sur tables publiques** : Tables publiques sans protection RLS
4. **Vues avec SECURITY DEFINER** : Vues créées avec SECURITY DEFINER au lieu de SECURITY INVOKER

## 🔍 Étapes de Diagnostic

### Étape 1 : Diagnostic des Vues
```bash
# Exécuter dans Supabase SQL Editor ou via psql
psql -f scripts/diagnostic-01-check-views.sql
```
**Ce script vérifie :**
- Si la vue `profiles` existe et expose `auth.users`
- Les permissions sur les vues problématiques
- Les vues avec SECURITY DEFINER

### Étape 2 : Diagnostic RLS des Tables
```bash
psql -f scripts/diagnostic-02-check-rls-tables.sql
```
**Ce script vérifie :**
- Quelles tables ont RLS activé
- Quelles policies existent
- Tables avec policies mais RLS désactivé

### Étape 3 : Diagnostic SECURITY DEFINER
```bash
psql -f scripts/diagnostic-03-check-security-definer.sql
```
**Ce script vérifie :**
- Les fonctions avec SECURITY DEFINER
- Les vues et leurs propriétés de sécurité
- Les dépendances des vues

## 🔧 Étapes de Correction

### Correction 1 : Supprimer la vue profiles
```bash
psql -f scripts/correction-01-drop-profiles-view.sql
```
**Actions :**
- Révoque les permissions sur `public.profiles`
- Supprime la vue avec CASCADE
- Vérifie que la suppression a réussi

### Correction 2 : Activer RLS sur toutes les tables
```bash
psql -f scripts/correction-02-enable-rls.sql
```
**Actions :**
- Active RLS sur `properties`
- Active RLS sur `guests`
- Active RLS sur `guest_submissions`
- Active RLS sur `generated_documents`

### Correction 3 : Ajouter policy pour generated_documents
```bash
psql -f scripts/correction-03-add-policy-generated-documents.sql
```
**Actions :**
- Crée une policy SELECT pour les hôtes
- Les hôtes peuvent lire les documents de leurs propres réservations

### Correction 4 : Recréer les vues sans SECURITY DEFINER
```bash
psql -f scripts/correction-04-recreate-views.sql
```
**Actions :**
- Recrée `v_guest_submissions` sans SECURITY DEFINER
- Recrée `v_booking_health` sans SECURITY DEFINER (si elle existe)

## ✅ Vérification Finale

```bash
psql -f scripts/verification-finale.sql
```
**Ce script vérifie :**
- ✅ Vue `profiles` supprimée
- ✅ RLS activé sur toutes les tables
- ✅ Policies présentes
- ✅ Vues recréées correctement

## 📝 Utilisation avec Supabase CLI

### Option 1 : Via SQL Editor
1. Ouvrir le Supabase Dashboard
2. Aller dans SQL Editor
3. Copier-coller chaque script
4. Exécuter dans l'ordre

### Option 2 : Via psql
```bash
# Se connecter à la base de données
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Exécuter les scripts dans l'ordre
\i scripts/diagnostic-01-check-views.sql
\i scripts/diagnostic-02-check-rls-tables.sql
\i scripts/diagnostic-03-check-security-definer.sql

# Puis les corrections
\i scripts/correction-01-drop-profiles-view.sql
\i scripts/correction-02-enable-rls.sql
\i scripts/correction-03-add-policy-generated-documents.sql
\i scripts/correction-04-recreate-views.sql

# Vérification finale
\i scripts/verification-finale.sql
```

### Option 3 : Via Migration Unique
Une migration complète est disponible dans :
```
supabase/migrations/20251031_fix_linter_security.sql
```

Tu peux l'appliquer directement :
```bash
supabase migration up
```

## ⚠️ Important

1. **Faire une sauvegarde** avant d'exécuter les corrections
2. **Tester en environnement de développement** d'abord
3. **Exécuter les diagnostics** pour comprendre l'état actuel
4. **Exécuter les corrections** dans l'ordre
5. **Vérifier** avec le script de vérification finale

## 🐛 Dépannage

### Erreur : "relation does not exist"
- Normal si une table/vue n'existe pas encore
- Les scripts utilisent `IF EXISTS` pour éviter les erreurs

### Erreur : "permission denied"
- Vérifier que tu as les droits d'administration sur la base
- Utiliser le service role key si nécessaire

### Erreur : "syntax error"
- Vérifier la version de PostgreSQL (nécessite PostgreSQL 12+)
- Certaines fonctions nécessitent PostgreSQL 15+ pour `security_invoker`

## 📊 Résultats Attendus

Après exécution complète :
- ✅ Vue `profiles` supprimée
- ✅ RLS activé sur 4 tables
- ✅ 1+ policies par table
- ✅ Vues recréées sans SECURITY DEFINER
- ✅ Aucune erreur de sécurité dans le linter Supabase

