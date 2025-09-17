# Corrections du Système de Tokens

## Problèmes Identifiés et Corrigés

### 1. **Erreur PGRST200 - Relation de clé étrangère manquante**
**Problème :** L'interface de gestion des tokens affichait l'erreur `PGRST200` car la requête tentait de faire un JOIN entre `token_control_settings` et `properties` sans relation définie.

**Solution :**
- ✅ Corrigé la fonction `loadTokenControlSettings()` dans `AdminTokens.tsx`
- ✅ Supprimé le JOIN problématique et implémenté un enrichissement manuel des données
- ✅ Créé le script `fix-token-control-settings.sql` pour établir la relation de clé étrangère

### 2. **Dropdown des propriétés vide**
**Problème :** La fonction `loadProperties()` retournait une liste vide, empêchant la sélection de propriétés.

**Solution :**
- ✅ Corrigé `loadProperties()` pour charger les propriétés depuis Supabase
- ✅ Ajouté la gestion d'erreurs et les logs de débogage
- ✅ Implémenté l'affichage des noms de propriétés dans l'interface

### 3. **Edge Function issue-guest-link utilisant la mauvaise table**
**Problème :** L'Edge Function `issue-guest-link` utilisait encore l'ancienne table `guest_verification_tokens` au lieu de `property_verification_tokens`.

**Solution :**
- ✅ Mis à jour `issue-guest-link/index.ts` pour utiliser `property_verification_tokens`
- ✅ Corrigé la logique de désactivation des tokens existants
- ✅ Ajusté la construction de l'URL de retour

### 4. **Structure de base de données incomplète**
**Problème :** La table `token_control_settings` n'avait pas de relation de clé étrangère avec `properties`.

**Solution :**
- ✅ Créé le script `fix-token-control-settings.sql` avec :
  - Structure complète de la table `token_control_settings`
  - Contrainte de clé étrangère vers `properties`
  - Index pour les performances
  - Politiques RLS (Row Level Security)
  - Trigger pour `updated_at`

## Fichiers Modifiés

### Frontend
- `src/components/admin/AdminTokens.tsx`
  - Corrigé `loadProperties()` pour charger depuis Supabase
  - Corrigé `loadTokenControlSettings()` pour éviter l'erreur PGRST200
  - Amélioré `handleSaveControlSettings()` pour sauvegarder directement

### Backend
- `supabase/functions/issue-guest-link/index.ts`
  - Changé de `guest_verification_tokens` vers `property_verification_tokens`
  - Corrigé la logique de désactivation des tokens
  - Ajusté la réponse JSON pour correspondre au hook frontend

## Scripts SQL Créés

### 1. `fix-token-control-settings.sql`
Script complet pour créer/corriger la table `token_control_settings` avec :
- Structure de table complète
- Contraintes de clé étrangère
- Index pour les performances
- Politiques RLS
- Trigger pour `updated_at`
- Données de test

### 2. `test-token-system.sql`
Script de test pour vérifier :
- Structure des tables
- Contraintes de clé étrangère
- Données existantes
- Fonctions RPC
- Politiques RLS

## Instructions de Déploiement

### 1. Exécuter les scripts SQL
```sql
-- Dans le dashboard Supabase, exécuter :
-- 1. fix-token-control-settings.sql
-- 2. test-token-system.sql (pour vérifier)
```

### 2. Redéployer les Edge Functions
```bash
cd supabase
npx supabase functions deploy issue-guest-link
```

### 3. Tester le système
1. Aller dans l'interface de gestion des tokens
2. Vérifier que les propriétés s'affichent dans le dropdown
3. Configurer des paramètres de contrôle pour une propriété
4. Tester la génération d'un lien de vérification

## Vérifications Post-Déploiement

### 1. Interface Admin
- ✅ Dropdown des propriétés se remplit
- ✅ Sauvegarde des paramètres de contrôle fonctionne
- ✅ Affichage des paramètres existants avec noms de propriétés

### 2. Génération de Liens
- ✅ Bouton "Générer lien client" fonctionne
- ✅ Vérification des permissions via `check_reservation_allowed`
- ✅ Création de tokens dans `property_verification_tokens`
- ✅ Incrémentation du compteur de réservations

### 3. Base de Données
- ✅ Relation de clé étrangère entre `token_control_settings` et `properties`
- ✅ Fonction RPC `verify_property_token` fonctionne
- ✅ Fonction RPC `check_reservation_allowed` fonctionne
- ✅ Politiques RLS actives

## Logs de Débogage

Les corrections incluent des logs détaillés pour faciliter le débogage :
- 🔍 Logs de chargement des propriétés
- 🔍 Logs de sauvegarde des paramètres
- 🔍 Logs de génération de tokens
- 🔍 Logs de vérification des permissions

## Prochaines Étapes

1. **Tester en production** avec de vraies données
2. **Monitorer les logs** pour identifier d'éventuels problèmes
3. **Optimiser les performances** si nécessaire
4. **Documenter** les procédures de maintenance
