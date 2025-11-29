# 🔧 Solution Complète : Prévisualisation et Stockage des Documents

## 📋 Problèmes Identifiés

### 1. **Erreur de Prévisualisation : URL Blob Expirée**
```
❌ [PREVIEW] Erreur chargement image: blob:http://192.168.0.159:3000/8c91caa7-2905-4877-8d91-5d2d61187272
```

**Cause :** Les URLs blob étaient révoquées prématurément dans le `useEffect` qui se déclenchait à chaque changement de `uploadedDocs`.

### 2. **Erreur removeChild Persistante**
```
NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
```

**Cause :** Conflits de rendu causés par des mises à jour d'état non atomiques et non protégées.

### 3. **Documents Non Stockés Immédiatement**
Les documents restaient uniquement en mémoire avec des URLs blob temporaires au lieu d'être stockés dans Supabase Storage.

---

## ✅ Solutions Implémentées

### 1. **Gestion Améliorée des URLs Blob**

#### A. Référence pour Suivre les URLs Actives
```typescript
const activeBlobUrlsRef = useRef<Set<string>>(new Set());
```

- **Avant :** Les URLs blob étaient révoquées à chaque changement de `uploadedDocs`
- **Après :** Les URLs blob sont suivies dans un `Set` et révoquées uniquement au démontage du composant

#### B. Révocation Uniquement au Démontage
```typescript
useEffect(() => {
  isMountedRef.current = true;
  return () => {
    // Révoquer UNIQUEMENT au démontage, pas à chaque changement
    activeBlobUrlsRef.current.forEach(blobUrl => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        // Ignorer les erreurs
      }
    });
    activeBlobUrlsRef.current.clear();
  };
}, []); // ✅ Pas de dépendance à uploadedDocs
```

#### C. Enregistrement des URLs Blob Créées
```typescript
const preview = URL.createObjectURL(file);
activeBlobUrlsRef.current.add(preview); // ✅ Enregistrer l'URL
```

### 2. **Régénération Automatique des URLs Blob**

#### A. Vérification Avant Affichage
```typescript
onClick={() => {
  if (doc.preview) {
    // Vérifier que l'URL blob est toujours valide
    if (doc.preview.startsWith('blob:') && !activeBlobUrlsRef.current.has(doc.preview)) {
      // Régénérer si nécessaire
      const newPreview = URL.createObjectURL(doc.file);
      activeBlobUrlsRef.current.add(newPreview);
      updateUploadedDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, preview: newPreview } : d
      ));
      setShowPreview(newPreview);
    } else {
      setShowPreview(doc.preview);
    }
  }
}}
```

#### B. Handler d'Erreur sur l'Image
```typescript
onError={(e) => {
  const doc = uploadedDocs.find(d => d.preview === showPreview);
  if (doc && doc.file) {
    // Régénérer l'URL blob depuis le fichier
    const newPreview = URL.createObjectURL(doc.file);
    activeBlobUrlsRef.current.add(newPreview);
    setShowPreview(newPreview);
  }
}}
```

### 3. **Protection Contre les Erreurs removeChild**

#### A. Utilisation de startTransition
```typescript
const updateUploadedDocuments = useCallback((updater) => {
  startTransition(() => { // ✅ Marquer comme non-urgent
    updateFormData(prev => {
      return {
        ...prev, // ✅ Retourner un nouvel objet complet
        uploadedDocuments: newDocs
      };
    });
  });
}, [updateFormData]);
```

#### B. Mises à Jour Atomiques
- Toutes les mises à jour d'état retournent un nouvel objet complet
- Utilisation de `startTransition` pour les mises à jour non-urgentes
- Protection contre les conflits de rendu simultanés

### 4. **Stockage Immédiat des Documents**

#### A. Stockage Après Création de Réservation
```typescript
// Dans BookingWizard.handleSubmit, après création de la réservation
if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
  for (const doc of formData.uploadedDocuments) {
    const storageResult = await DocumentStorageService.storeDocument(doc.file, {
      bookingId: bookingData.id,
      fileName: doc.file.name,
      extractedData: doc.extractedData
    });
    
    if (storageResult.success && storageResult.documentUrl) {
      // Remplacer l'URL blob par l'URL Storage réelle
      updateFormData(prev => ({
        ...prev,
        uploadedDocuments: prev.uploadedDocuments.map(d => 
          d.id === doc.id ? { ...d, preview: storageResult.documentUrl! } : d
        )
      }));
    }
  }
}
```

#### B. Liaison Documents-Guests
```typescript
// Après insertion des guests, lier les documents
if (verifyGuests && formData.uploadedDocuments) {
  for (const doc of formData.uploadedDocuments) {
    const matchingGuest = verifyGuests.find(g => 
      normName(g.full_name) === normName(doc.extractedData?.fullName)
    );
    if (matchingGuest) {
      await supabase
        .from('uploaded_documents')
        .update({ guest_id: matchingGuest.id })
        .eq('booking_id', bookingData.id)
        .eq('file_name', doc.file.name);
    }
  }
}
```

---

## 🎯 Résultats Attendus

### ✅ Prévisualisation
- Les URLs blob ne sont plus révoquées prématurément
- Régénération automatique si l'URL expire
- Gestion d'erreur robuste avec fallback

### ✅ Stockage
- Documents stockés immédiatement après création de réservation
- URLs blob remplacées par URLs Storage permanentes
- Documents liés aux guests correspondants

### ✅ Stabilité
- Plus d'erreurs `removeChild`
- Mises à jour d'état atomiques et protégées
- Transitions React gérées correctement

---

## 📝 Points d'Attention

1. **URLs Blob Temporaires** : Les URLs blob restent valides tant que le composant est monté
2. **Stockage Différé** : Pour les nouvelles réservations, le stockage se fait après création (nécessite un `bookingId`)
3. **Régénération** : Si une URL blob expire, elle est automatiquement régénérée depuis le fichier

---

## 🔍 Tests Recommandés

1. ✅ Upload d'un document → Vérifier que la prévisualisation fonctionne
2. ✅ Fermer/rouvrir la prévisualisation → Vérifier que l'image se charge toujours
3. ✅ Créer une réservation avec documents → Vérifier le stockage dans Supabase Storage
4. ✅ Vérifier que les documents sont liés aux guests dans `uploaded_documents`
5. ✅ Tester la suppression de documents → Vérifier qu'il n'y a plus d'erreurs `removeChild`

---

**Dernière mise à jour :** $(date)

