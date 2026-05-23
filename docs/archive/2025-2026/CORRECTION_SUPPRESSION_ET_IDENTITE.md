# 🔧 Correction : Suppression Réservation & Pièces d'Identité

## Date : 24 Novembre 2025

## 📋 Problèmes Identifiés

### 1. **Suppression ne se reflète pas dans le calendrier**
- ✅ **Symptôme** : Après avoir cliqué sur le bouton de suppression (🗑️), la réservation reste affichée dans le calendrier
- ✅ **Cause** : Le modal se fermait trop rapidement avant que le contexte de réservations ne se propage
- ✅ **Impact** : UX dégradée - l'utilisateur ne voit pas l'effet de son action

### 2. **Pièces d'identité non affichées**
- ✅ **Symptôme** : Les pièces d'identité uploadées lors de la création de réservation n'apparaissent pas dans "Documents enregistrés"
- ✅ **Cause** : 
  - Manque de logs pour diagnostiquer
  - Méthode de résolution d'URL trop complexe (Edge Function)
  - Extraction de données incomplète (plusieurs formats de champs possibles)

---

## 🛠️ Corrections Appliquées

### 1. **Correction de la suppression** (`UnifiedBookingModal.tsx`)

#### Avant :
```typescript
const handleDeleteBooking = async () => {
  // ...
  await deleteBooking(booking.id);
  await refreshBookings();
  setShowDeleteDialog(false);
  onClose(); // ❌ Fermeture immédiate
};
```

#### Après :
```typescript
const handleDeleteBooking = async () => {
  console.log('🗑️ [UNIFIED MODAL] Suppression de la réservation:', booking.id);
  setIsDeleting(true);
  try {
    await deleteBooking(booking.id);
    console.log('✅ [UNIFIED MODAL] Réservation supprimée de la base de données');
    
    // Forcer le rafraîchissement complet
    await refreshBookings();
    console.log('✅ [UNIFIED MODAL] Réservations rafraîchies');
    
    toast({
      title: "Réservation supprimée",
      description: "La réservation a été supprimée avec succès",
    });
    
    setShowDeleteDialog(false);
    
    // ✅ Fermer le modal avec un délai pour que le contexte se propage
    setTimeout(() => {
      onClose();
    }, 100);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la réservation:', error);
    toast({
      title: "Erreur",
      description: "Impossible de supprimer la réservation",
      variant: "destructive"
    });
  } finally {
    setIsDeleting(false);
  }
};
```

**Changements clés :**
- ✅ Ajout de logs détaillés pour traçabilité
- ✅ Délai de 100ms avant fermeture du modal pour propagation du contexte
- ✅ Gestion d'erreur améliorée

---

### 2. **Amélioration résolution URL documents** (`UnifiedBookingModal.tsx`)

#### Avant :
```typescript
const resolveDocumentUrl = async (doc: any) => {
  if (doc?.document_url) return doc.document_url;
  if (doc?.file_path) {
    try {
      // ❌ Appel à une Edge Function (complexe, peut échouer)
      const { data: signed } = await supabase.functions.invoke('storage-sign-url', {
        body: { bucket: 'guest-documents', path: doc.file_path, expiresIn: 3600 }
      });
      return signed?.signedUrl || null;
    } catch (signError) {
      console.warn('⚠️ Impossible de signer le document:', signError);
    }
  }
  return null;
};
```

#### Après :
```typescript
const resolveDocumentUrl = async (doc: any) => {
  console.log('🔍 [RESOLVE URL] Document:', { 
    id: doc?.id, 
    type: doc?.document_type, 
    hasUrl: !!doc?.document_url, 
    hasPath: !!doc?.file_path 
  });
  
  if (doc?.document_url) {
    console.log('✅ [RESOLVE URL] URL directe trouvée');
    return doc.document_url;
  }
  
  if (doc?.file_path) {
    console.log('🔑 [RESOLVE URL] Génération URL signée pour:', doc.file_path);
    try {
      // ✅ Méthode directe avec le SDK Supabase Storage (plus fiable)
      const { data: signed, error: signError } = await supabase.storage
        .from('guest-documents')
        .createSignedUrl(doc.file_path, 3600);
      
      if (signError) {
        console.error('❌ [RESOLVE URL] Erreur signature:', signError);
        return null;
      }
      
      console.log('✅ [RESOLVE URL] URL signée générée:', signed?.signedUrl);
      return signed?.signedUrl || null;
    } catch (signError) {
      console.error('❌ [RESOLVE URL] Exception signature:', signError);
    }
  }
  
  console.warn('⚠️ [RESOLVE URL] Aucune URL trouvée pour ce document');
  return null;
};
```

**Changements clés :**
- ✅ Logs détaillés à chaque étape
- ✅ Utilisation du SDK Supabase Storage directement (plus simple, plus fiable)
- ✅ Gestion d'erreur exhaustive

---

### 3. **Amélioration extraction pièces d'identité** (`UnifiedBookingModal.tsx`)

#### Avant :
```typescript
const identitySources = uploadedDocs
  ?.filter(doc => ['identity', 'identity_upload', 'id-document', 'passport'].includes(doc.document_type)) || [];

const identityDocs = await Promise.all(identitySources.map(async doc => ({
  id: doc.id,
  url: await resolveDocumentUrl(doc),
  guestName: (doc.extracted_data as any)?.guest_name || 
            (doc.guests as any)?.full_name || 
            'Invité',
  documentNumber: (doc.extracted_data as any)?.document_number || 
                 (doc.guests as any)?.document_number || 
                 undefined
})));
```

#### Après :
```typescript
const identitySources = uploadedDocs
  ?.filter(doc => ['identity', 'identity_upload', 'id-document', 'passport'].includes(doc.document_type)) || [];

console.log('🆔 [UNIFIED MODAL] Pièces d\'identité trouvées:', identitySources.length, identitySources);

const identityDocs = await Promise.all(identitySources.map(async doc => {
  const url = await resolveDocumentUrl(doc);
  
  // ✅ Extraction multi-format (plusieurs champs possibles)
  const guestName = (doc.extracted_data as any)?.guest_name || 
                    (doc.extracted_data as any)?.full_name || 
                    (doc.guests as any)?.full_name || 
                    'Invité';
  const documentNumber = (doc.extracted_data as any)?.document_number || 
                        (doc.extracted_data as any)?.id_number || 
                        (doc.guests as any)?.document_number || 
                        undefined;
  
  console.log('🆔 [UNIFIED MODAL] Document traité:', { 
    id: doc.id, 
    type: doc.document_type, 
    hasUrl: !!url, 
    guestName, 
    documentNumber 
  });
  
  return {
    id: doc.id,
    url: url,
    guestName,
    documentNumber
  };
}));
```

**Changements clés :**
- ✅ Logs détaillés pour chaque pièce d'identité trouvée
- ✅ Extraction multi-format : `guest_name` OU `full_name`
- ✅ Extraction multi-format : `document_number` OU `id_number`
- ✅ Logs pour chaque document traité (traçabilité)

---

## 🧪 Test de Vérification

### Test 1 : Suppression
1. Ouvrir le calendrier
2. Cliquer sur une réservation (non-Airbnb)
3. Cliquer sur le bouton 🗑️ (Supprimer)
4. Confirmer la suppression
5. ✅ **Attendu** : La réservation disparaît du calendrier immédiatement

### Test 2 : Pièces d'identité
1. Créer une nouvelle réservation via BookingWizard
2. Uploader une pièce d'identité (avec OCR)
3. Soumettre la réservation
4. Ouvrir la réservation dans le calendrier
5. Scroller jusqu'à "Documents enregistrés"
6. ✅ **Attendu** : 
   - Contrat signé : bouton "Voir"
   - Fiche de police : bouton "Voir"
   - **Pièce d'identité #1** : bouton "Voir" avec nom du guest et numéro de document

---

## 📊 Logs à Surveiller (Console)

### Pour la suppression :
```
🗑️ [UNIFIED MODAL] Suppression de la réservation: <booking-id>
✅ [UNIFIED MODAL] Réservation supprimée de la base de données
✅ [UNIFIED MODAL] Réservations rafraîchies
```

### Pour les pièces d'identité :
```
📄 [UNIFIED MODAL] Documents trouvés dans uploaded_documents: 3 [...]
🆔 [UNIFIED MODAL] Pièces d'identité trouvées: 1 [...]
🔍 [RESOLVE URL] Document: { id: "...", type: "identity_upload", hasUrl: true, hasPath: true }
✅ [RESOLVE URL] URL directe trouvée (ou URL signée générée)
🆔 [UNIFIED MODAL] Document traité: { id: "...", type: "identity_upload", hasUrl: true, guestName: "John Doe", documentNumber: "AB123456" }
✅ [UNIFIED MODAL] Documents finaux: { contractUrl: true, policeUrl: true, identityCount: 1 }
```

---

## ✅ Résultat Attendu

### Vue Calendrier après Suppression
- ✅ La réservation disparaît immédiatement
- ✅ Pas de message d'erreur
- ✅ Toast de confirmation "Réservation supprimée"

### Section "Documents enregistrés" dans UnifiedBookingModal

```
┌─────────────────────────────────────────┐
│ 📄 Documents enregistrés                │
├─────────────────────────────────────────┤
│ 📄 Contrat signé                        │
│    Document contractuel signé           │
│                        [Voir] [Téléch.] │
├─────────────────────────────────────────┤
│ 🛡️ Fiche de police                      │
│    Formulaire de déclaration de police  │
│                        [Voir] [Téléch.] │
├─────────────────────────────────────────┤
│ 💳 Pièce d'identité                     │
│    John Doe • AB123456                  │
│                                  [Voir] │
└─────────────────────────────────────────┘
```

---

## 🔄 Prochaines Étapes

1. ✅ **Test en conditions réelles** :
   - Créer une réservation avec pièce d'identité
   - Vérifier l'affichage dans le calendrier
   - Tester la suppression

2. ⏳ **Déployer l'Edge Function** (si pas encore fait) :
   ```bash
   supabase functions deploy submit-guest-info-unified
   ```

3. ⏳ **Monitoring** :
   - Surveiller les logs de la console pour détecter d'éventuels problèmes de résolution d'URL
   - Vérifier que les pièces d'identité sont bien stockées dans `uploaded_documents` avec `document_type = 'identity_upload'`

---

## 📝 Notes Techniques

### Types de documents reconnus pour les pièces d'identité :
- `'identity'`
- `'identity_upload'` ✅ (type utilisé par BookingWizard)
- `'id-document'`
- `'passport'`

### Champs `extracted_data` pris en compte :
- `guest_name` ou `full_name` → Nom du guest
- `document_number` ou `id_number` → Numéro de document

### Bucket Supabase Storage :
- `guest-documents` (URLs signées valides 1h)

---

## ✅ Status : CORRECTIONS APPLIQUÉES

Les deux problèmes ont été corrigés avec des logs détaillés pour faciliter le diagnostic en cas de problème.

