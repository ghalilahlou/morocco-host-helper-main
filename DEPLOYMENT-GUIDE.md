# Guide de Déploiement des Corrections

## 🎯 Objectif
Déployer les corrections appliquées aux Edge Functions vers Supabase.

## ✅ Corrections Appliquées
- **Génération de contrats** : Amélioration de la récupération des données d'invités
- **Système de signature** : Harmonisation des noms de champs et validation
- **Enregistrement des réservations** : Logique de création/mise à jour robuste

## 🚀 Méthodes de Déploiement

### Méthode 1: Supabase CLI (Recommandée)
```bash
# 1. Lier le projet
supabase link --project-ref csopyblkfyofwkeqqegd

# 2. Déployer les fonctions
supabase functions deploy generate-contract
supabase functions deploy save-contract-signature
supabase functions deploy submit-guest-info
supabase functions deploy resolve-guest-link
supabase functions deploy generate-police-forms

# 3. Vérifier le déploiement
supabase functions list
```

### Méthode 2: PowerShell Script
```powershell
# Exécuter le script automatique
.\deploy-functions.ps1
```

### Méthode 3: Déploiement Manuel
1. Allez sur https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. Pour chaque fonction, cliquez sur "Edit"
3. Copiez le code depuis `manual-deploy-instructions.md`
4. Sauvegardez

## 🧪 Tests Post-Déploiement
```bash
# Tester les corrections
node test-fixes-simple.js
```

## 📋 Fonctions Corrigées
- `generate-contract` : Génération de contrats avec fallback robuste
- `save-contract-signature` : Sauvegarde de signatures avec validation
- `submit-guest-info` : Enregistrement de réservations avec logique find-or-create
- `resolve-guest-link` : Résolution de liens invités
- `generate-police-forms` : Génération de formulaires de police

## 🔧 Corrections Détailées

### generate-contract/index.ts
- ✅ Amélioration de `fetchBookingFromDatabase()` avec fallback
- ✅ Gestion robuste des données d'invités
- ✅ Rétrocompatibilité des réponses

### save-contract-signature/index.ts
- ✅ Harmonisation des noms de champs
- ✅ Validation du format de signature
- ✅ Gestion des signatures existantes

### submit-guest-info/index.ts
- ✅ Logique "find or update/create" améliorée
- ✅ Gestion des invités avec suppression/recréation
- ✅ Statut des réservations correct

### Frontend (ContractService.ts, WelcomingContractSignature.tsx, ContractSigning.tsx)
- ✅ Gestion robuste des réponses
- ✅ Récupération d'ID de réservation avec fallbacks
- ✅ Validation des signatures
- ✅ Messages d'erreur informatifs

## 🎉 Résultat Attendu
Après déploiement, le système devrait :
- ✅ Générer des contrats sans erreur
- ✅ Sauvegarder les signatures correctement
- ✅ Enregistrer les réservations de manière fiable
- ✅ Gérer les cas d'erreur gracieusement

## 📞 Support
En cas de problème, vérifiez :
1. Les logs des Edge Functions dans le Dashboard
2. Les erreurs dans la console du navigateur
3. La configuration des variables d'environnement
