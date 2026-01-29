# 📋 PLAN DE REFONTE COMPLÈTE - GÉNÉRATION FICHE DE POLICE

## 🎯 Objectifs

1. ✅ **Format correct** : Utiliser le même format que `submit-guest-info-unified`
2. ✅ **Signature visible** : Intégrer correctement la signature du guest dans le PDF
3. ✅ **Génération automatique** : Après signature du contrat, sans bouton manuel
4. ✅ **Visualisation dans le dashboard** : Bouton "Voir" ouvre le PDF sans quitter le dashboard
5. ✅ **Sauvegarde en DB** : Stocker dans `uploaded_documents` au lieu de téléchargement automatique

## 📊 État Actuel (Problèmes)

### ❌ Problème 1: Format PDF Incorrect
- **Actuel**: `generate-police-form` utilise un format simplifié
- **Attendu**: Format officiel marocain bilingue (FR/AR) avec sections structurées
- **Solution**: Copier le code complet de `generatePoliceFormsPDF` depuis `submit-guest-info-unified`

### ❌ Problème 2: Signature Guest Manquante
- **Actuel**: La signature n'apparaît pas dans le PDF généré
- **Cause**: Récupération ou embedding incorrect de la signature
- **Solution**: Utiliser le même code de récupération et d'embedding que l'ancienne fonction

### ❌ Problème 3: Bouton Manuel Requis
- **Actuel**: Nécessite de cliquer sur "Générer" dans `UnifiedBookingModal`
- **Attendu**: Génération automatique après signature du contrat
- **Solution**: Déjà implémenté dans `WelcomingContractSignature.tsx` (ligne 763)

### ❌ Problème 4: Téléchargement Automatique
- **Actuel**: `unifiedDocumentService.ts` télécharge automatiquement le PDF
- **Attendu**: Juste sauvegarder en DB, afficher bouton "Voir"
- **Solution**: Modifier le service pour ne pas télécharger

## 🔧 Actions à Réaliser

### 1️⃣ Remplacer le Code de Génération PDF dans `generate-police-form`

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Actions**:
- Copier intégralement la fonction `generatePoliceFormsPDF` (lignes 5129-5850) depuis `submit-guest-info-unified`
- Inclure:
  - ✅ Chargement de la police arabe (Noto Sans Arabic)
  - ✅ Helper `drawBilingualField` pour les champs FR/AR
  - ✅ Sections: Locataire, Séjour, Loueur
  - ✅ Récupération de `contract_template` pour la signature du landlord (si nécessaire)
  - ✅ Embedding correct de la signature du guest depuis `contract_signatures`
  - ✅ Footer "CHECKY"

### 2️⃣ Corriger la Récupération de la Signature

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Code actuel** (lignes ~40-50):
```typescript
const { data: signatureData } = await supabase
  .from('contract_signatures')
  .select('signature_data, signed_at')
  .eq('booking_id', bookingId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

**Vérifications à ajouter**:
```typescript
console.log('🔍 Signature récupérée:', {
  hasSignature: !!signatureData,
  signatureLength: signatureData?.signature_data?.length,
  signaturePreview: signatureData?.signature_data?.substring(0, 50),
  signedAt: signatureData?.signed_at
});
```

### 3️⃣ Sauvegarder dans `uploaded_documents` au lieu de `generated_documents`

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Code actuel**: Sauvegarde dans `generated_documents`
**Nouveau**: Sauvegarder dans `uploaded_documents` avec `document_type = 'police'`

```typescript
// Upload du PDF vers Supabase Storage
const fileName = `police-forms/${bookingId}/${Date.now()}.pdf`;
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('documents')
  .upload(fileName, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true
  });

// Sauvegarder dans uploaded_documents
const { data: publicUrlData } = supabase.storage
  .from('documents')
  .getPublicUrl(fileName);

await supabase
  .from('uploaded_documents')
  .insert({
    booking_id: bookingId,
    document_type: 'police',
    document_url: publicUrlData.publicUrl,
    file_path: fileName,
    created_at: new Date().toISOString()
  });
```

### 4️⃣ Supprimer le Téléchargement Automatique

**Fichier**: `src/services/unifiedDocumentService.ts`

**Code actuel** (lignes 366-372):
```typescript
// Télécharger automatiquement le PDF
const link = document.createElement('a');
link.href = policeUrl;
link.download = `fiche-police-${booking.id}-${Date.now()}.pdf`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
```

**Nouveau**: Supprimer ce code, juste retourner l'URL

```typescript
// Ne pas télécharger, juste retourner l'URL
console.log('✅ Fiche de police générée:', policeUrl);
return policeUrl;
```

### 5️⃣ Modifier `UnifiedBookingModal` pour Afficher le Bouton "Voir"

**Fichier**: `src/components/UnifiedBookingModal.tsx`

**Logique actuelle**:
- Si `policeUrl` existe → Boutons "Voir" et "Télécharger"
- Sinon → Bouton "Générer"

**Nouveau comportement**:
- **Après signature du contrat**: La fiche de police est générée automatiquement
- **Dans le modal**: 
  - Si `policeUrl` existe → Boutons "Voir" (ouvre dans nouvel onglet) et "Télécharger"
  - Sinon → Message "En cours de génération..." ou "Signature requise"

### 6️⃣ Vérifier la Génération Automatique

**Fichier**: `src/components/WelcomingContractSignature.tsx`

**Code déjà implémenté** (lignes 766-786):
```typescript
// ✅ NOUVEAU : Générer automatiquement la fiche de police après la signature
Promise.resolve().then(async () => {
  try {
    console.log('📄 [AUTO] Génération automatique de la fiche de police après signature...');
    
    const { data: policeData, error: policeError } = await supabase.functions.invoke('generate-police-form', {
      body: {
        bookingId: bookingId
      }
    });
    
    if (policeError) {
      console.warn('⚠️ Erreur lors de la génération automatique de la fiche de police:', policeError);
      return;
    }
    
    if (policeData?.success && policeData?.policeUrl) {
      console.log('✅ [AUTO] Fiche de police générée automatiquement:', policeData.policeUrl);
    }
  } catch (policeGenerateError) {
    console.error('⚠️ Failed to auto-generate police form:', policeGenerateError);
  }
});
```

**Vérification**: Ce code est correct, il appelle déjà la nouvelle fonction automatiquement

## 📝 Ordre d'Exécution

1. ✅ **Étape 1**: Remplacer le code de génération PDF dans `generate-police-form/index.ts`
2. ✅ **Étape 2**: Ajouter les logs de debug pour la signature
3. ✅ **Étape 3**: Modifier la sauvegarde pour utiliser `uploaded_documents` + Storage
4. ✅ **Étape 4**: Supprimer le téléchargement automatique dans `unifiedDocumentService.ts`
5. ✅ **Étape 5**: Tester le workflow complet:
   - Upload pièce d'identité
   - Signature du contrat
   - Vérifier génération automatique de la fiche de police
   - Vérifier que le bouton "Voir" apparaît dans le modal
   - Vérifier que le PDF contient la signature du guest

## 🧪 Tests à Effectuer

### Test 1: Génération Automatique
1. Créer une nouvelle réservation
2. Uploader une pièce d'identité
3. Signer le contrat
4. **Vérifier**: Console affiche "✅ [AUTO] Fiche de police générée automatiquement"
5. **Vérifier**: Fiche de police apparaît dans `uploaded_documents`

### Test 2: Format PDF
1. Ouvrir la fiche de police générée
2. **Vérifier**: Format bilingue FR/AR
3. **Vérifier**: Sections: Locataire, Séjour, Loueur
4. **Vérifier**: Signature du guest visible et centrée
5. **Vérifier**: Footer "CHECKY" en bas à droite

### Test 3: Visualisation Dashboard
1. Ouvrir le modal de réservation
2. **Vérifier**: Bouton "Voir" présent pour la fiche de police
3. Cliquer sur "Voir"
4. **Vérifier**: PDF s'ouvre dans un nouvel onglet
5. **Vérifier**: Dashboard reste ouvert en arrière-plan

## 🎯 Résultat Final Attendu

### Workflow Complet
```
1. Guest uploade pièce d'identité
   ↓
2. Guest remplit les informations
   ↓
3. Guest signe le contrat
   ↓
4. 🤖 AUTOMATIQUE: Génération fiche de police
   ├─ Récupération signature depuis contract_signatures
   ├─ Génération PDF format officiel marocain
   ├─ Upload vers Supabase Storage
   └─ Sauvegarde dans uploaded_documents
   ↓
5. Host voit le bouton "Voir" dans le dashboard
   ↓
6. Clic sur "Voir" → PDF s'ouvre dans nouvel onglet
```

### Caractéristiques du PDF
- ✅ Format A4 officiel marocain
- ✅ Bilingue FR/AR avec police Noto Sans Arabic
- ✅ Sections: Locataire, Séjour, Loueur
- ✅ Signature du guest visible et centrée
- ✅ Date de signature affichée
- ✅ Footer "CHECKY" en turquoise

### Interface Dashboard
- ✅ Pas de bouton "Générer" manuel
- ✅ Bouton "Voir" ouvre le PDF dans nouvel onglet
- ✅ Bouton "Télécharger" pour sauvegarder localement
- ✅ Indicateur "Documents manquants" si pas encore généré
