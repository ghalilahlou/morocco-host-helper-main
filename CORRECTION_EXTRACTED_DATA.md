# ✅ CORRECTION - Erreur "column extracted_data does not exist"

## 🎯 Problème

```
⚠️ Erreur récupération submissions {
  "error": "column guest_submissions.extracted_data does not exist"
}

❌ Erreur génération fiche de police {
  "error": "Aucun guest trouvé pour ce booking"
}
```

## 🔍 Cause

La colonne `extracted_data` n'existe pas dans la table `guest_submissions`. 

La requête SQL essayait de sélectionner:
```sql
SELECT guest_data, extracted_data  -- ❌ extracted_data n'existe pas!
FROM guest_submissions
WHERE booking_id = 'xxx';
```

## ✅ Solution Appliquée

### 1. Edge Function `generate-police-form`

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Ligne 126**: Retrait de `extracted_data`

```typescript
// ❌ AVANT
const { data: submissions, error: submissionsError } = await supabase
  .from('guest_submissions')
  .select('guest_data, extracted_data')  // ❌ extracted_data n'existe pas
  .eq('booking_id', bookingId);

// ✅ APRÈS
const { data: submissions, error: submissionsError } = await supabase
  .from('guest_submissions')
  .select('guest_data')  // ✅ CORRIGÉ
  .eq('booking_id', bookingId);
```

**Ligne 133**: Suppression de `extractedData`

```typescript
// ❌ AVANT
const guests = submissions?.map(s => {
  const guestData = s.guest_data || {};
  const extractedData = s.extracted_data || {};  // ❌
  
  return {
    full_name: guestData.full_name || guestData.fullName || 
               extractedData.full_name || extractedData.fullName || '',  // ❌
    // ...
  };
}) || [];

// ✅ APRÈS
const guests = submissions?.map(s => {
  const guestData = s.guest_data || {};
  
  return {
    full_name: guestData.full_name || guestData.fullName || guestData.name || '',  // ✅
    // ...
  };
}) || [];
```

### 2. Frontend `WelcomingContractSignature`

**Fichier**: `src/components/WelcomingContractSignature.tsx`

**Ligne 185**: Retrait de `extracted_data`

```typescript
// ❌ AVANT
const { data: submissions, error } = await supabase
  .from('guest_submissions')
  .select('guest_data, extracted_data')  // ❌
  .eq('booking_id', bookingId);

// ✅ APRÈS
const { data: submissions, error } = await supabase
  .from('guest_submissions')
  .select('guest_data')  // ✅
  .eq('booking_id', bookingId);
```

**Ligne 200**: Suppression de `extractedData`

```typescript
// ❌ AVANT
const guestData = firstSubmission.guest_data || {};
const extractedData = firstSubmission.extracted_data || {};  // ❌

const mappedData = {
  fullName: guestData.full_name || guestData.fullName || 
           extractedData.full_name || extractedData.fullName || '',  // ❌
  // ...
};

// ✅ APRÈS
const guestData = firstSubmission.guest_data || {};

const mappedData = {
  fullName: guestData.full_name || guestData.fullName || guestData.name || '',  // ✅
  // ...
};
```

## 📊 Mapping des Données

Le code supporte maintenant uniquement `guest_data` avec les clés suivantes:

### Nom Complet
- `guest_data.full_name` ✅
- `guest_data.fullName` ✅
- `guest_data.name` ✅

### Nom et Prénom Séparés
- `guest_data.first_name` / `guest_data.firstName` ✅
- `guest_data.last_name` / `guest_data.lastName` ✅

### Email
- `guest_data.email` ✅

### Téléphone
- `guest_data.phone` ✅
- `guest_data.telephone` ✅
- `guest_data.phone_number` ✅

### Nationalité
- `guest_data.nationality` ✅
- `guest_data.nationalite` ✅

### Document
- `guest_data.document_type` / `documentType` / `id_type` ✅
- `guest_data.document_number` / `documentNumber` / `id_number` ✅

### Date de Naissance
- `guest_data.date_of_birth` / `dateOfBirth` / `birth_date` ✅

### Lieu de Naissance
- `guest_data.place_of_birth` / `placeOfBirth` / `birth_place` ✅

### Profession
- `guest_data.profession` / `occupation` ✅

### Motif du Séjour
- `guest_data.motif_sejour` / `motifSejour` / `purpose` ✅
- Défaut: `'TOURISME'`

### Adresse Personnelle
- `guest_data.adresse_personnelle` / `adressePersonnelle` ✅
- `guest_data.home_address` / `address` ✅

## 🚀 Déploiement

```bash
supabase functions deploy generate-police-form
```

**Status**: ✅ Déployé

## 🧪 Tests

### Test 1: Vérifier les Logs Supabase

Après génération, les logs devraient afficher:

```
✅ 👥 Récupération des guests...
✅ Guests récupérés {
  count: 2,
  firstGuestFullName: "MOUHCINE TEMSAMANI",
  firstGuestEmail: "...",
  allGuestsData: [...]
}
✅ PDF généré
✅ Document sauvegardé dans uploaded_documents
```

**PAS d'erreur** `column extracted_data does not exist` ✅

### Test 2: Générer la Fiche de Police

1. Ouvrir le modal d'une réservation
2. Cliquer sur "Générer" pour la fiche de police
3. **Vérifier**: Pas d'erreur, PDF généré avec succès
4. **Vérifier**: Tous les champs sont remplis

### Test 3: Vérifier le Récapitulatif

1. Ouvrir la page de signature du contrat
2. **Vérifier**: "MOUHCINE TEMSAMANI + X autres" s'affiche
3. **Vérifier**: Pas d'erreur dans la console

## 📝 Fichiers Modifiés

1. ✅ `supabase/functions/generate-police-form/index.ts`
   - Ligne 126: Retrait de `extracted_data` dans le SELECT
   - Ligne 133-175: Suppression de toutes les références à `extractedData`

2. ✅ `src/components/WelcomingContractSignature.tsx`
   - Ligne 185: Retrait de `extracted_data` dans le SELECT
   - Ligne 200-205: Suppression de toutes les références à `extractedData`

## 🎯 Résultat Attendu

### Avant ❌
```
⚠️ Erreur récupération submissions {
  "error": "column guest_submissions.extracted_data does not exist"
}
❌ Erreur génération fiche de police {
  "error": "Aucun guest trouvé pour ce booking"
}
```

### Après ✅
```
✅ 👥 Récupération des guests...
✅ Guests récupérés { count: 2, ... }
✅ PDF généré { pages: 2, sizeKB: 95 }
✅ Document sauvegardé dans uploaded_documents
```

## 💡 Note

La colonne `extracted_data` n'existe pas dans votre schéma de base de données. Toutes les données sont stockées dans `guest_data` avec différentes structures possibles (camelCase, snake_case).

Le code supporte maintenant toutes ces variations sans avoir besoin de `extracted_data`.

**L'erreur est corrigée!** 🎉
