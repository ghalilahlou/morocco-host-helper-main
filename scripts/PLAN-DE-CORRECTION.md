# 📋 Plan de Correction - Basé sur les Résultats du Diagnostic

## ✅ Résultats du Diagnostic

D'après ton diagnostic, tu as identifié :
- ✅ Vue `profiles` : **1 vue** (à supprimer - expose auth.users)
- ✅ Vue `v_guest_submissions` : **1 vue** (à recréer sans SECURITY DEFINER)
- ✅ Vue `v_booking_health` : **1 vue** (à recréer sans SECURITY DEFINER)

## 🔧 Ordre d'Exécution des Corrections

Exécute ces scripts **DANS L'ORDRE** dans Supabase SQL Editor :

### Étape 1 : Supprimer la vue profiles
```sql
-- Script : scripts/correction-01-drop-profiles-view.sql
-- Action : Supprime la vue profiles qui expose auth.users
```

### Étape 2 : Activer RLS sur toutes les tables
```sql
-- Script : scripts/correction-02-enable-rls.sql
-- Action : Active RLS sur properties, guests, guest_submissions, generated_documents
```

### Étape 3 : Ajouter policy pour generated_documents
```sql
-- Script : scripts/correction-03-add-policy-generated-documents.sql
-- Action : Crée une policy SELECT pour les hôtes
```

### Étape 4 : Recréer les vues sans SECURITY DEFINER
```sql
-- Script : scripts/correction-04-recreate-views.sql
-- Action : Recrée v_guest_submissions et v_booking_health sans SECURITY DEFINER
```

### Étape 5 : Vérification finale
```sql
-- Script : scripts/verification-finale.sql
-- Action : Vérifie que tous les problèmes sont résolus
```

## 🚀 Option Rapide : Migration Unique

Si tu préfères une solution en une seule fois, utilise directement :

```sql
-- Fichier : supabase/migrations/20251031_fix_linter_security.sql
-- Contient TOUTES les corrections en une seule migration
```

## 📝 Commandes pour Supabase SQL Editor

1. **Ouvre Supabase Dashboard → SQL Editor**
2. **Copie-colle chaque script un par un**
3. **Exécute et vérifie le résultat**
4. **Passe au script suivant**

## ⚠️ Important

- Fais une **sauvegarde** avant de commencer
- Exécute les scripts dans l'ordre
- Vérifie chaque résultat avant de passer au suivant
- La dernière étape (vérification) confirme que tout est OK

## 🎯 Résultat Attendu

Après toutes les corrections :
- ✅ Vue `profiles` : **supprimée**
- ✅ Vue `v_guest_submissions` : **recréée sans SECURITY DEFINER**
- ✅ Vue `v_booking_health` : **recréée sans SECURITY DEFINER**
- ✅ RLS activé sur **4 tables**
- ✅ Policy créée pour `generated_documents`

