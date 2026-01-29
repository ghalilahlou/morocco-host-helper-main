# ✅ CORRECTION FINALE - Champ `file_name` Manquant

## 🎯 Problème Identifié

L'erreur dans les logs Supabase:
```
❌ ERREUR CRITIQUE: Impossible de sauvegarder dans uploaded_documents
"error": "null value in column \"file_name\" of relation \"uploaded_documents\" violates not-null constraint"
"code": "23502"
```

## 🔍 Cause

La table `uploaded_documents` a une colonne `file_name` avec contrainte **NOT NULL**, mais notre code d'insertion ne fournissait pas cette valeur.

**Code problématique** (ligne 665-673):
```typescript
const { error: insertError } = await supabase
  .from('uploaded_documents')
  .insert({
    booking_id: bookingId,
    document_type: 'police',
    document_url: publicUrl,
    file_path: fileName,  // ✅ Chemin complet: "police-forms/xxx/123.pdf"
    // ❌ MANQUANT: file_name
    created_at: new Date().toISOString()
  });
```

## ✅ Solution Appliquée

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Ligne 665**: Extraction du nom de fichier et ajout du champ `file_name`

```typescript
// Extraire le nom du fichier depuis le chemin complet
const fileNameOnly = fileName.split('/').pop() || `police-${bookingId}.pdf`;

const { error: insertError } = await supabase
  .from('uploaded_documents')
  .insert({
    booking_id: bookingId,
    document_type: 'police',
    document_url: publicUrl,
    file_path: fileName,        // "police-forms/xxx/1769688748796.pdf"
    file_name: fileNameOnly,    // ✅ AJOUTÉ: "1769688748796.pdf"
    created_at: new Date().toISOString()
  });
```

## 📊 Différence

| Champ | Avant | Après |
|-------|-------|-------|
| `file_path` | `police-forms/643b.../1769688748796.pdf` | `police-forms/643b.../1769688748796.pdf` |
| `file_name` | ❌ NULL (erreur) | ✅ `1769688748796.pdf` |

## 🚀 Déploiement

```bash
supabase functions deploy generate-police-form
```

**Status**: ✅ Commande exécutée

## 🧪 Test

### Test 1: Génération Manuelle

1. Ouvrir le modal d'une réservation
2. Cliquer sur "Générer" pour la fiche de police
3. **Vérifier logs Supabase**:
   ```
   ✅ PDF uploadé vers Storage
   💾 Sauvegarde dans uploaded_documents...
   ✅ Document sauvegardé dans uploaded_documents  ← Devrait apparaître!
   ```
4. **Vérifier BDD**:
   ```sql
   SELECT 
     id,
     booking_id,
     file_name,
     file_path,
     document_type,
     document_url
   FROM uploaded_documents
   WHERE booking_id = 'VOTRE_BOOKING_ID'
     AND document_type = 'police'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   **Résultat attendu**:
   - `file_name`: `1769688748796.pdf` (ou similaire)
   - `file_path`: `police-forms/643b.../1769688748796.pdf`
   - `document_url`: URL publique Supabase Storage

5. **Rafraîchir le modal** (fermer et rouvrir)
6. **Vérifier**: Les boutons "Voir" et "Télécharger" doivent apparaître

### Test 2: Génération Automatique

1. Créer une nouvelle réservation
2. Uploader pièce d'identité
3. Signer le contrat
4. **Observer console**:
   ```
   📄 [AUTO] Génération automatique de la fiche de police après signature...
   ✅ [AUTO] Fiche de police générée automatiquement: [URL]
   ```
5. Attendre 2-3 secondes
6. Ouvrir le modal
7. **Vérifier**: Les boutons "Voir" et "Télécharger" doivent apparaître

## 📋 Résumé des Modifications

### Fichier Modifié

`supabase/functions/generate-police-form/index.ts`

### Changements

1. **Ligne 665**: Extraction du nom de fichier
   ```typescript
   const fileNameOnly = fileName.split('/').pop() || `police-${bookingId}.pdf`;
   ```

2. **Ligne 672**: Ajout du champ `file_name` dans l'insertion
   ```typescript
   file_name: fileNameOnly,
   ```

## 🎯 Résultat Attendu

### Avant ❌
```
❌ ERREUR CRITIQUE: Impossible de sauvegarder dans uploaded_documents
"error": "null value in column \"file_name\" violates not-null constraint"
```

### Après ✅
```
✅ PDF uploadé vers Storage
💾 Sauvegarde dans uploaded_documents...
✅ Document sauvegardé dans uploaded_documents
✅ Booking mis à jour
```

### Dans le Modal

**Avant** ❌:
```
[Fiche de police]  [Générer]
❌ Police manquante
```

**Après** ✅:
```
[Fiche de police]  [Voir] [Télécharger]
```

## 🔍 Vérification

### SQL pour Vérifier l'Insertion

```sql
SELECT 
  id,
  booking_id,
  file_name,
  file_path,
  document_type,
  document_url,
  created_at
FROM uploaded_documents
WHERE document_type = 'police'
ORDER BY created_at DESC
LIMIT 5;
```

**Colonnes importantes**:
- ✅ `file_name` ne doit PAS être NULL
- ✅ `file_path` doit contenir le chemin complet
- ✅ `document_url` doit être une URL publique Supabase

## 💡 Notes

- Le `file_name` est extrait du `fileName` complet en utilisant `.split('/').pop()`
- Si l'extraction échoue, on utilise un fallback: `police-${bookingId}.pdf`
- Cette correction résout définitivement l'erreur de contrainte NOT NULL

## 🎉 Prochaines Étapes

1. ✅ **Déploiement**: Fait
2. ⏳ **Test**: À effectuer
3. ⏳ **Vérification BDD**: À effectuer
4. ⏳ **Vérification UI**: À effectuer

**Testez maintenant et vérifiez que la fiche de police s'affiche correctement!** 🚀
