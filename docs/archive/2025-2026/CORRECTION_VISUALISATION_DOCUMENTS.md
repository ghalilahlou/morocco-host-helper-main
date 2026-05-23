# 🔧 Correction - Visualisation des Documents dans le Calendrier

## ❌ Problème Identifié

**Symptôme** : Quand on ouvre une réservation depuis le calendrier, les documents (contrat et fiche de police) affichent "Générer" au lieu de "Voir", même s'ils ont déjà été générés.

**Preuve dans les logs** :
```
contractService.ts:120 Edge function response (UNSIGNED) for #6f0664: {data: {...}, error: null}
```
→ Le contrat EST généré, mais l'interface ne le sait pas.

## 🔍 Analyse de la Cause

### Problème 1 : Chargement incomplet des documents

Le `useEffect` dans `UnifiedBookingModal.tsx` charge les documents depuis `uploaded_documents`, mais :
1. Aucun log pour suivre le chargement
2. La lecture de `documents_generated` ne récupérait pas les bonnes clés (`contractUrl` vs `contract.url`)

### Problème 2 : Pas de rechargement après génération

Quand on génère un document via les boutons "Générer" :
1. Le document est créé en base de données
2. Mais l'interface n'est pas mise à jour immédiatement
3. Il faut fermer et rouvrir le modal pour voir le document

## ✅ Solution Appliquée

### Modification 1 : Ajout de logs détaillés pour le débogage

**Fichier** : `src/components/UnifiedBookingModal.tsx`

**Au chargement** (ligne 283) :
```typescript
console.log('📄 [UNIFIED MODAL] Chargement des documents pour booking:', booking.id);
// ...
console.log('📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents:', uploadedDocs?.length || 0, uploadedDocs);
```

**Si aucun document dans `uploaded_documents`** (ligne 350) :
```typescript
console.log('⚠️ [UNIFIED MODAL] Aucun document dans uploaded_documents, vérification dans documents_generated...');
console.log('📄 [UNIFIED MODAL] documents_generated:', bookingData?.documents_generated);
```

**Documents finaux** (ligne 365) :
```typescript
console.log('✅ [UNIFIED MODAL] Documents finaux:', {
  contractUrl: !!contractUrl,
  policeUrl: !!policeUrl,
  identityCount: identityDocs.filter(doc => doc.url).length
});
```

### Modification 2 : Correction de la lecture de `documents_generated`

**Avant** (ligne 346-350) :
```typescript
const docs = bookingData.documents_generated as any;
setDocuments({
  contractUrl: docs.contract?.url || null,  // ❌ Mauvaise clé
  policeUrl: docs.police?.url || null,       // ❌ Mauvaise clé
  //...
});
```

**Après** :
```typescript
const docs = bookingData.documents_generated as any;
setDocuments({
  contractUrl: docs.contractUrl || docs.contract?.url || null,  // ✅ Essaie les deux formats
  policeUrl: docs.policeUrl || docs.police?.url || null,        // ✅ Essaie les deux formats
  //...
});
console.log('✅ [UNIFIED MODAL] Documents chargés depuis documents_generated:', {
  hasContract: !!(docs.contractUrl || docs.contract?.url),
  hasPolice: !!(docs.policeUrl || docs.police?.url)
});
```

### Modification 3 : Ajout de logs et rechargement après génération

#### Pour `handleGenerateContract` (ligne 393-443) :

**Ajouts** :
```typescript
console.log('📄 [UNIFIED MODAL] Génération du contrat pour booking:', bookingTyped.id);
// ... génération ...
console.log('✅ [UNIFIED MODAL] Contrat généré avec succès:', result.contractUrl);

// Attendre un peu pour que la base de données soit à jour
await new Promise(resolve => setTimeout(resolve, 1000));

// Recharger les documents
const { data: uploadedDocs } = await supabase...
console.log('📄 [UNIFIED MODAL] Contrat rechargé depuis BD:', uploadedDocs);
```

#### Pour `handleGeneratePolice` (ligne 446-487) :

**Mêmes ajouts** :
```typescript
console.log('📄 [UNIFIED MODAL] Génération de la fiche de police pour booking:', bookingTyped.id);
// ... génération ...
console.log('✅ [UNIFIED MODAL] Fiche de police générée avec succès');

// Attendre un peu pour que la base de données soit à jour
await new Promise(resolve => setTimeout(resolve, 1000));

// Recharger les documents
const { data: uploadedDocs } = await supabase...
console.log('📄 [UNIFIED MODAL] Fiche de police rechargée depuis BD:', uploadedDocs);
```

## 🧪 Tests à Effectuer

### Test 1 : Ouvrir la réservation et vérifier les logs

1. Ouvrir la console (F12)
2. Dans le calendrier, cliquer sur la réservation `CA0CBE6F0664`
3. **Vérifier dans la console** :
   ```
   📄 [UNIFIED MODAL] Chargement des documents pour booking: 8d131c51-be28-40fc-a359-ca0cbe6f0664
   📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents: X
   ```
4. **Si X = 0**, regarder le log suivant :
   ```
   ⚠️ [UNIFIED MODAL] Aucun document dans uploaded_documents, vérification dans documents_generated...
   📄 [UNIFIED MODAL] documents_generated: {...}
   ```
5. **Vérifier le log final** :
   ```
   ✅ [UNIFIED MODAL] Documents finaux: {contractUrl: true, policeUrl: true, identityCount: 1}
   ```

### Test 2 : Si les documents sont trouvés mais pas affichés

**Cause probable** : Le champ `documents_generated` n'est pas à jour

**Solution** : Déployer l'Edge Function avec la correction `updateFinalStatus` :
```bash
supabase functions deploy submit-guest-info-unified
```

### Test 3 : Générer le contrat à la demande

1. Si le bouton "Générer" est affiché pour le contrat, cliquer dessus
2. **Vérifier dans la console** :
   ```
   📄 [UNIFIED MODAL] Génération du contrat pour booking: 8d131c51...
   ✅ [UNIFIED MODAL] Contrat généré avec succès: https://...
   📄 [UNIFIED MODAL] Contrat rechargé depuis BD: [{...}]
   ```
3. **Vérifier dans l'interface** : Le bouton "Générer" devient "Voir" + "Télécharger"
4. Cliquer sur "Voir" → Le PDF s'ouvre dans un nouvel onglet

### Test 4 : Générer la fiche de police à la demande

1. Si le bouton "Générer" est affiché pour la police, cliquer dessus
2. **Vérifier dans la console** :
   ```
   📄 [UNIFIED MODAL] Génération de la fiche de police pour booking: 8d131c51...
   ✅ [UNIFIED MODAL] Fiche de police générée avec succès
   📄 [UNIFIED MODAL] Fiche de police rechargée depuis BD: [{...}]
   ```
3. **Vérifier dans l'interface** : Le bouton "Générer" devient "Voir" + "Télécharger"
4. Cliquer sur "Voir" → Le PDF s'ouvre dans un nouvel onglet

### Test 5 : Fermer et rouvrir le modal

1. Fermer le modal de la réservation
2. Rouvrir la même réservation depuis le calendrier
3. **Vérifier** : Les boutons "Voir" et "Télécharger" sont affichés (pas "Générer")
4. **Vérifier** : Les documents se chargent immédiatement

## 📊 Flux de Données

### Au chargement du modal (useEffect)

```
1. Modal s'ouvre avec booking.id
   ↓
2. useEffect se déclenche
   ↓
3. Query sur uploaded_documents
   WHERE booking_id = '8d131c51...'
   AND document_type IN ('contract', 'police', 'identity', ...)
   ↓
4a. Si documents trouvés → Afficher "Voir" + "Télécharger"
4b. Si aucun document → Query sur bookings.documents_generated
   ↓
5. Si documents_generated contient contractUrl/policeUrl
   → Afficher "Voir" + "Télécharger"
   Sinon → Afficher "Générer"
```

### Lors de la génération (handleGenerateContract/Police)

```
1. Clic sur "Générer"
   ↓
2. Appel ContractService ou UnifiedDocumentService
   ↓
3. Edge Function génère le document
   ↓
4. Document sauvegardé dans uploaded_documents
   ↓
5. Attente de 1 seconde (pour synchronisation BD)
   ↓
6. Query sur uploaded_documents pour recharger
   ↓
7. setDocuments() met à jour l'état
   ↓
8. Interface affiche "Voir" + "Télécharger"
```

## 🔧 Diagnostic Si Problème Persiste

### Scénario 1 : Bouton "Générer" affiché mais le document existe

**Logs à chercher** :
```
📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents: 0
⚠️ [UNIFIED MODAL] Aucun document dans uploaded_documents...
📄 [UNIFIED MODAL] documents_generated: null (ou vide)
```

**Cause** : Le champ `documents_generated` n'est pas rempli

**Solution** : Déployer l'Edge Function avec la correction `updateFinalStatus`

### Scénario 2 : Documents trouvés mais pas affichés

**Logs à chercher** :
```
📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents: 2
✅ [UNIFIED MODAL] Documents finaux: {contractUrl: true, policeUrl: true, ...}
```
Mais l'interface affiche quand même "Générer"

**Cause** : Problème de rendu React

**Solution** : Vérifier que `documents.contractUrl` et `documents.policeUrl` sont bien utilisés dans le JSX

### Scénario 3 : Génération réussie mais interface pas mise à jour

**Logs à chercher** :
```
✅ [UNIFIED MODAL] Contrat généré avec succès: https://...
📄 [UNIFIED MODAL] Contrat rechargé depuis BD: []  ← VIDE !
```

**Cause** : Le document n'est pas encore visible dans la BD après 1 seconde

**Solution** : Augmenter le délai d'attente à 2 secondes :
```typescript
await new Promise(resolve => setTimeout(resolve, 2000));  // 2 secondes au lieu de 1
```

## 📝 Fichiers Modifiés

- ✅ `src/components/UnifiedBookingModal.tsx`
  - Ajout de logs détaillés pour le chargement
  - Correction de la lecture de `documents_generated`
  - Ajout de logs et rechargement après génération

## 🎯 Résultat Attendu

Après ces modifications :

| Situation | Comportement Attendu |
|-----------|---------------------|
| Réservation avec documents générés | Boutons "Voir" + "Télécharger" affichés immédiatement |
| Réservation sans documents | Boutons "Générer" affichés |
| Après clic sur "Générer" | Document généré → Interface mise à jour automatiquement |
| Fermer/Rouvrir modal | Documents toujours affichés avec "Voir" + "Télécharger" |

## 🚀 Actions Requises

1. **Tester immédiatement** : Ouvrir la réservation `CA0CBE6F0664` et vérifier les logs
2. **Si documents non trouvés** : Déployer l'Edge Function
3. **Si tout fonctionne** : Les documents devraient être visibles avec "Voir" et "Télécharger" !

Les logs nous permettront de diagnostiquer précisément où se situe le problème. 🔍

