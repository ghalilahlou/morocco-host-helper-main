# 🎯 PLAN D'IMPLÉMENTATION DÉTAILLÉ
## Signature dans Fiche de Police

**Date :** 2026-01-26  
**Objectif :** Faire apparaître la signature du guest dans la fiche de police

---

## 📋 ÉTAT DES LIEUX

### ✅ CE QUI FONCTIONNE DÉJÀ

1. **Sauvegarde de la signature** ✅
   - **Fichier :** `supabase/functions/save-contract-signature/index.ts`
   - **Lignes :** 133-147
   - **Action :** Insère la signature dans `contract_signatures`
   - **Statut :** **FONCTIONNEL** ✅

2. **Récupération de la signature** ✅
   - **Fichier :** `supabase/functions/submit-guest-info-unified/index.ts`
   - **Lignes :** 1676-1733
   - **Action :** Cherche la signature dans `contract_signatures`
   - **Statut :** **FONCTIONNEL** ✅

### ❌ CE QUI NE FONCTIONNE PAS

1. **Signature non trouvée** ❌
   - **Problème :** `signaturesCount: 0` dans les logs
   - **Cause probable :** La signature est sauvegardée APRÈS la génération de la fiche de police

2. **Fiches de police non sauvegardées** ❌
   - **Problème :** Pas visible dans DocumentsViewer
   - **Cause :** Pas d'insertion dans `generated_documents`

3. **Action manquante** ❌
   - **Problème :** `regenerate_police_with_signature` n'existe pas
   - **Fichier :** `save-contract-signature/index.ts` ligne 301
   - **Impact :** La fiche de police n'est pas régénérée après signature

---

## 🚀 PLAN D'ACTION

### 📌 PRIORITÉ 1 : Créer l'action `regenerate_police_with_signature`

**Objectif :** Permettre la régénération de la fiche de police après signature du contrat

#### Étape 1.1 : Ajouter l'action dans le switch principal

**Fichier :** `supabase/functions/submit-guest-info-unified/index.ts`  
**Ligne :** ~2400 (dans le switch des actions)

**Code à ajouter :**

```typescript
case 'regenerate_police_with_signature': {
  log('info', '🔄 Action: Régénération fiche de police avec signature guest');
  
  const bookingId = body.bookingId;
  
  if (!bookingId) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'bookingId requis pour régénérer la fiche de police' 
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
  
  try {
    // Récupérer la signature depuis contract_signatures
    const { data: signatureData, error: signatureError } = await supabaseClient
      .from('contract_signatures')
      .select('signature_data, signed_at, signer_name')
      .eq('booking_id', bookingId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (signatureError) {
      log('error', '❌ Erreur récupération signature:', signatureError);
      throw signatureError;
    }
    
    if (!signatureData) {
      log('warn', '⚠️ Aucune signature trouvée pour ce booking');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Aucune signature trouvée pour cette réservation',
          hasSignature: false
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    log('info', '✅ Signature trouvée, régénération de la fiche de police...', {
      hasSignature: !!signatureData.signature_data,
      signedAt: signatureData.signed_at
    });
    
    // Appeler la génération de fiche de police avec la signature
    const policeResult = await generatePoliceFormsInternal(supabaseClient, bookingId, {
      signature: {
        data: signatureData.signature_data,
        timestamp: signatureData.signed_at
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fiche de police régénérée avec signature',
        hasGuestSignature: true,
        documentUrls: policeResult.documentUrls || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
    
  } catch (error: any) {
    log('error', '❌ Erreur régénération fiche de police:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erreur lors de la régénération de la fiche de police' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
```

---

### 📌 PRIORITÉ 2 : Sauvegarder les fiches de police dans `generated_documents`

**Objectif :** Rendre les fiches de police visibles dans DocumentsViewer

#### Étape 2.1 : Modifier `generatePoliceFormsInternal`

**Fichier :** `supabase/functions/submit-guest-info-unified/index.ts`  
**Ligne :** ~5750 (après la génération du PDF)

**Code à ajouter :**

```typescript
// Après la génération du PDF (ligne ~5750)
// Juste après : const pdfBytes = await pdfDoc.save();

// ✅ NOUVEAU : Sauvegarder la fiche de police dans generated_documents
try {
  // Convertir le PDF en base64 pour le stockage
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
  
  log('info', '[Police] 💾 Sauvegarde de la fiche de police dans generated_documents...', {
    guestName: guest.full_name,
    hasSignature: !!guestSignatureData,
    pdfSize: pdfBytes.length
  });
  
  // Vérifier si une fiche existe déjà pour ce guest
  const { data: existingPolice } = await supabaseClient
    .from('generated_documents')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('document_type', 'police')
    .eq('metadata->>guest_name', guest.full_name)
    .maybeSingle();
  
  if (existingPolice) {
    // Mettre à jour la fiche existante
    const { error: updateError } = await supabaseClient
      .from('generated_documents')
      .update({
        file_url: pdfDataUrl,
        file_name: `Police_${guest.full_name}.pdf`,
        metadata: {
          guest_name: guest.full_name,
          guest_id: guest.id,
          generated_at: new Date().toISOString(),
          has_signature: !!guestSignatureData,
          signature_timestamp: guestSignedAt || null
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', existingPolice.id);
    
    if (updateError) {
      log('warn', '[Police] ⚠️ Erreur mise à jour fiche de police:', updateError);
    } else {
      log('info', '[Police] ✅ Fiche de police mise à jour dans generated_documents');
    }
  } else {
    // Créer une nouvelle fiche
    const { error: insertError } = await supabaseClient
      .from('generated_documents')
      .insert({
        booking_id: bookingId,
        document_type: 'police',
        file_url: pdfDataUrl,
        file_name: `Police_${guest.full_name}.pdf`,
        metadata: {
          guest_name: guest.full_name,
          guest_id: guest.id,
          generated_at: new Date().toISOString(),
          has_signature: !!guestSignatureData,
          signature_timestamp: guestSignedAt || null
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (insertError) {
      log('warn', '[Police] ⚠️ Erreur sauvegarde fiche de police:', insertError);
    } else {
      log('info', '[Police] ✅ Fiche de police sauvegardée dans generated_documents');
    }
  }
  
  // Mettre à jour le statut dans bookings
  const { error: bookingUpdateError } = await supabaseClient
    .from('bookings')
    .update({
      documents_generated: {
        ...booking.documents_generated,
        policeForm: true
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);
  
  if (bookingUpdateError) {
    log('warn', '[Police] ⚠️ Erreur mise à jour statut booking:', bookingUpdateError);
  } else {
    log('info', '[Police] ✅ Statut booking mis à jour (policeForm: true)');
  }
  
} catch (saveError: any) {
  log('error', '[Police] ❌ Erreur critique sauvegarde:', {
    error: saveError.message,
    stack: saveError.stack
  });
  // Ne pas faire échouer la génération pour cette erreur
}
```

---

### 📌 PRIORITÉ 3 : Vérifier le flux complet

**Objectif :** S'assurer que tout fonctionne de bout en bout

#### Étape 3.1 : Vérifier le flux de signature

```
1. Guest remplit le formulaire
   ↓
2. submit-guest-info-unified génère le contrat (SANS signature)
   ↓
3. Guest signe le contrat (WelcomingContractSignature)
   ↓
4. save-contract-signature sauvegarde la signature ✅
   ↓
5. save-contract-signature appelle regenerate_police_with_signature ✅ (NOUVEAU)
   ↓
6. regenerate_police_with_signature récupère la signature ✅ (NOUVEAU)
   ↓
7. generatePoliceFormsInternal génère la fiche AVEC signature ✅
   ↓
8. Fiche sauvegardée dans generated_documents ✅ (NOUVEAU)
   ↓
9. Fiche visible dans DocumentsViewer ✅
```

---

## 📝 CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Ajouter l'action `regenerate_police_with_signature`

- [ ] 1. Ouvrir `submit-guest-info-unified/index.ts`
- [ ] 2. Trouver le switch des actions (ligne ~2400)
- [ ] 3. Ajouter le case `regenerate_police_with_signature`
- [ ] 4. Tester l'appel de l'action

### Phase 2 : Sauvegarder les fiches de police

- [ ] 1. Ouvrir `submit-guest-info-unified/index.ts`
- [ ] 2. Trouver `generatePoliceFormsInternal` (ligne ~5750)
- [ ] 3. Ajouter la sauvegarde dans `generated_documents`
- [ ] 4. Ajouter la mise à jour du statut dans `bookings`

### Phase 3 : Tests complets

- [ ] 1. Déployer les modifications sur Supabase
- [ ] 2. Créer une nouvelle réservation test
- [ ] 3. Remplir le formulaire guest
- [ ] 4. Signer le contrat
- [ ] 5. Vérifier la signature dans `contract_signatures`
- [ ] 6. Vérifier que la fiche de police est régénérée
- [ ] 7. Vérifier que la signature apparaît dans le PDF
- [ ] 8. Vérifier que la fiche est dans `generated_documents`
- [ ] 9. Vérifier que la fiche est visible dans les cartes

---

## 🔧 COMMANDES DE DÉPLOIEMENT

```bash
# Déployer la fonction modifiée
supabase functions deploy submit-guest-info-unified

# Vérifier les logs
supabase functions logs submit-guest-info-unified --tail

# Tester l'action
curl -X POST https://VOTRE_URL/functions/v1/submit-guest-info-unified \
  -H "Authorization: Bearer VOTRE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"regenerate_police_with_signature","bookingId":"BOOKING_ID"}'
```

---

## 📊 RÉSULTAT ATTENDU

### Avant :
```
❌ Signature : Sauvegardée mais fiche déjà générée SANS
❌ Fiche de police : Sans signature
❌ Affichage : Pas visible dans les cartes
```

### Après :
```
✅ Signature : Sauvegardée dans contract_signatures
✅ Régénération : Fiche de police régénérée automatiquement
✅ Fiche de police : Avec signature visible
✅ Sauvegarde : Fiche dans generated_documents
✅ Affichage : Visible dans les cartes (DocumentsViewer)
```

---

## ⚠️ POINTS D'ATTENTION

1. **Performance**
   - La régénération de la fiche de police peut prendre quelques secondes
   - Ne pas bloquer la réponse de `save-contract-signature`

2. **Gestion des erreurs**
   - Si la régénération échoue, la signature est quand même sauvegardée
   - Logger toutes les erreurs pour faciliter le debug

3. **Doublons**
   - Vérifier si une fiche existe déjà avant d'insérer
   - Mettre à jour au lieu de créer un doublon

4. **Format de la signature**
   - Doit commencer par `data:image/png;base64,`
   - Vérifier la taille (ne pas dépasser la limite de la base de données)

---

## 📄 FICHIERS À MODIFIER

1. **`supabase/functions/submit-guest-info-unified/index.ts`**
   - Ligne ~2400 : Ajouter case `regenerate_police_with_signature`
   - Ligne ~5750 : Ajouter sauvegarde dans `generated_documents`

2. **`supabase/functions/save-contract-signature/index.ts`**
   - ✅ Déjà fonctionnel (appelle `regenerate_police_with_signature`)

3. **`src/components/DocumentsViewer.tsx`**
   - ✅ Déjà corrigé (format des policeForms)

---

## 🎯 ORDRE D'EXÉCUTION

1. **Implémenter Priorité 1** (30 min)
   - Ajouter l'action `regenerate_police_with_signature`

2. **Implémenter Priorité 2** (20 min)
   - Ajouter la sauvegarde des fiches de police

3. **Déployer** (5 min)
   - Déployer sur Supabase

4. **Tester** (15 min)
   - Test complet du flux

**TEMPS TOTAL ESTIMÉ : 70 minutes**

