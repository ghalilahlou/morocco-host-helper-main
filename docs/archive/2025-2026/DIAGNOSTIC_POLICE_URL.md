# 🔍 DIAGNOSTIC: Pourquoi la Fiche de Police ne s'affiche pas

## 🎯 Problème Identifié

Dans l'image fournie, on voit:
- ✅ **Contrat signé**: Boutons "Voir" et "Télécharger" présents
- ❌ **Fiche de police**: Seulement le bouton "Générer"
- ❌ **Message d'erreur**: "Documents manquants - Police manquante"

## 🔍 Analyse du Code

### Logique d'Affichage (UnifiedBookingModal.tsx, lignes 1636-1699)

```typescript
{documents.policeUrl ? (
  // ✅ Si policeUrl existe → Afficher "Voir" et "Télécharger"
  <div>
    <Button onClick={() => window.open(documents.policeUrl!, '_blank')}>Voir</Button>
    <Button onClick={() => télécharger}>Télécharger</Button>
  </div>
) : (hasGuestData || docsGeneratedState?.police === true) ? (
  // ❌ Sinon → Afficher "Générer"
  <Button onClick={handleGeneratePolice}>Générer</Button>
) : (
  // ⏳ Sinon → "En attente des informations clients"
  <span>En attente des informations clients</span>
)}
```

### Chargement des Documents (lignes 408-1039)

Le modal charge les documents depuis **5 sources** en parallèle:
1. `uploaded_documents` (table principale)
2. `generated_documents` (table secondaire)
3. `bookings.documents_generated` (champ JSONB)
4. Edge Function `get-guest-documents-unified`
5. `guest_submissions.document_urls`

**Code clé** (lignes 1469-1476):
```typescript
const contractDoc = uploadedDocs.find(doc => doc.document_type === 'contract');
const policeDoc = uploadedDocs.find(doc => doc.document_type === 'police');

setDocuments({
  contractUrl: contractDoc?.document_url || prev.contractUrl,
  policeUrl: policeDoc?.document_url || prev.policeUrl,
  ...
});
```

## 🚨 Causes Possibles

### Cause 1: Fiche de Police Non Sauvegardée dans `uploaded_documents`

**Vérification SQL**:
```sql
SELECT 
  id,
  booking_id,
  document_type,
  document_url,
  created_at
FROM uploaded_documents
WHERE booking_id = 'VOTRE_BOOKING_ID'
  AND document_type = 'police';
```

**Résultat attendu**: Au moins 1 ligne
**Si vide**: La fiche de police n'a jamais été sauvegardée en BDD

### Cause 2: Edge Function `generate-police-form` ne Sauvegarde pas

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Code actuel** (lignes ~700-720):
```typescript
// Upload to Supabase Storage
const fileName = `police-forms/${bookingId}/${Date.now()}.pdf`;
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('documents')
  .upload(fileName, pdfBytes, { ... });

const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(fileName);

// ✅ Sauvegarde dans uploaded_documents
await supabase
  .from('uploaded_documents')
  .insert({
    booking_id: bookingId,
    document_type: 'police',
    document_url: publicUrl,
    file_path: fileName,
    created_at: new Date().toISOString()
  });
```

**Vérification**: Ce code existe-t-il dans la version déployée?

### Cause 3: Génération Automatique ne s'Exécute pas

**Fichier**: `src/components/WelcomingContractSignature.tsx` (lignes 766-786)

**Code**:
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

**Vérification Console**: Chercher ces logs après signature du contrat

### Cause 4: `document_type` Incorrect

**Problème potentiel**: La fiche de police est sauvegardée avec un autre `document_type`

**Vérification SQL**:
```sql
SELECT 
  id,
  booking_id,
  document_type,
  document_url
FROM uploaded_documents
WHERE booking_id = 'VOTRE_BOOKING_ID'
ORDER BY created_at DESC;
```

**Types possibles**:
- `police` ✅ (attendu)
- `police_form` ❌
- `fiche_police` ❌
- `declaration` ❌

## 🔧 Solutions

### Solution 1: Vérifier la Base de Données

```sql
-- 1. Vérifier si la fiche de police existe
SELECT * FROM uploaded_documents 
WHERE booking_id = 'VOTRE_BOOKING_ID' 
  AND document_type = 'police';

-- 2. Si elle existe avec un autre type, la corriger
UPDATE uploaded_documents
SET document_type = 'police'
WHERE booking_id = 'VOTRE_BOOKING_ID'
  AND document_url LIKE '%police%';

-- 3. Vérifier documents_generated dans bookings
SELECT 
  id,
  documents_generated
FROM bookings
WHERE id = 'VOTRE_BOOKING_ID';
```

### Solution 2: Forcer la Régénération

1. Cliquer sur le bouton "Générer" dans le modal
2. Observer les logs dans la console
3. Vérifier que la fiche est bien sauvegardée

### Solution 3: Modifier le Message d'Erreur

**Fichier**: `src/components/UnifiedBookingModal.tsx` (lignes 1408-1442)

**Changement**: Ne pas afficher "Documents manquants" si la génération automatique est prévue

```typescript
{/* ✅ MODIFIÉ : Ne pas afficher si génération automatique en cours */}
{status === 'completed' && !hasAllRequiredDocuments && !documents.loading && !isAutoGenerating && (
  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-3">
    {/* ... message d'erreur ... */}
  </div>
)}
```

### Solution 4: Vérifier le Déploiement de l'Edge Function

```bash
# Vérifier que la fonction est déployée
supabase functions list

# Vérifier les logs
# Supabase Dashboard → Edge Functions → generate-police-form → Logs
```

## 🧪 Plan de Test

### Test 1: Vérification BDD
```sql
SELECT * FROM uploaded_documents 
WHERE booking_id = 'VOTRE_BOOKING_ID';
```

### Test 2: Génération Manuelle
1. Cliquer sur "Générer"
2. Observer console:
   - `📄 [UNIFIED MODAL] Génération fiches police pour booking: ...`
   - `✅ [UNIFIED MODAL] Fiche de police générée: { url: ... }`
3. Vérifier BDD après génération

### Test 3: Génération Automatique
1. Créer nouvelle réservation
2. Signer le contrat
3. Observer console:
   - `📄 [AUTO] Génération automatique de la fiche de police après signature...`
   - `✅ [AUTO] Fiche de police générée automatiquement: [URL]`
4. Rafraîchir le modal
5. Vérifier que "Voir" et "Télécharger" apparaissent

## 📊 Checklist de Diagnostic

- [ ] Vérifier `uploaded_documents` pour `document_type = 'police'`
- [ ] Vérifier que l'Edge Function `generate-police-form` est déployée
- [ ] Vérifier les logs console après signature du contrat
- [ ] Vérifier les logs Edge Function dans Supabase Dashboard
- [ ] Tester la génération manuelle avec le bouton "Générer"
- [ ] Vérifier que `documents.policeUrl` est bien défini dans le state
- [ ] Vérifier que le modal se rafraîchit après génération

## 🎯 Prochaine Étape

**Action immédiate**: Exécuter cette requête SQL pour diagnostiquer

```sql
SELECT 
  b.id as booking_id,
  b.documents_generated,
  ud.id as doc_id,
  ud.document_type,
  ud.document_url,
  ud.created_at
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
WHERE b.id = 'VOTRE_BOOKING_ID'
ORDER BY ud.created_at DESC;
```

Cela nous dira **exactement** où se situe le problème!
