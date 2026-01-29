# 🔍 DIAGNOSTIC COMPLET - Fiche de Police

## Date : 2026-01-26

## 🎯 Problèmes identifiés

### 1. **Signature du guest n'apparaît pas dans la fiche de police**
- ❌ La signature n'est pas visible dans le PDF généré
- ❌ Les logs montrent : `hasSignature: false`, `signatureLength: 0`

### 2. **Fiches de police ne s'affichent pas dans les cartes**
- ❌ `policeFormsCount: 0` dans DocumentsViewer
- ❌ Les fiches ne sont pas sauvegardées après génération

---

## 📊 ANALYSE DES TABLES

### Tables impliquées dans la génération de fiche de police :

1. **`bookings`** - Réservation principale
2. **`guests`** - Informations des invités
3. **`contract_signatures`** - Signatures des contrats
4. **`generated_documents`** - Documents générés (contrats, fiches de police)
5. **`uploaded_documents`** - Documents uploadés par les guests

---

## 🔍 DIAGNOSTIC ÉTAPE PAR ÉTAPE

### Étape 1 : Vérification de la signature dans `contract_signatures`

**Requête SQL à exécuter :**
```sql
SELECT 
  id,
  booking_id,
  signer_name,
  signer_email,
  signature_data,
  signed_at,
  created_at
FROM contract_signatures
WHERE booking_id = 'VOTRE_BOOKING_ID'
ORDER BY created_at DESC;
```

**Résultat attendu :**
- ✅ Au moins 1 ligne avec `signature_data` non null
- ✅ `signature_data` commence par `data:image/`

**Résultat actuel (d'après les logs) :**
- ❌ `signaturesCount: 0` - AUCUNE signature trouvée !

**🚨 PROBLÈME IDENTIFIÉ :**
La signature du guest n'est **PAS sauvegardée** dans `contract_signatures` lors de la signature du contrat.

---

### Étape 2 : Vérification de la génération de la fiche de police

**Requête SQL à exécuter :**
```sql
SELECT 
  id,
  booking_id,
  document_type,
  file_url,
  file_name,
  created_at
FROM generated_documents
WHERE booking_id = 'VOTRE_BOOKING_ID'
  AND document_type = 'police'
ORDER BY created_at DESC;
```

**Résultat attendu :**
- ✅ Au moins 1 ligne par guest avec `document_type = 'police'`
- ✅ `file_url` pointe vers un PDF valide

**Résultat probable :**
- ❌ Aucune ligne OU `file_url` est null/invalide

---

### Étape 3 : Vérification du statut de génération dans `bookings`

**Requête SQL à exécuter :**
```sql
SELECT 
  id,
  guest_name,
  documents_generated,
  created_at,
  updated_at
FROM bookings
WHERE id = 'VOTRE_BOOKING_ID';
```

**Résultat attendu :**
```json
{
  "documents_generated": {
    "policeForm": true,
    "contract": true
  }
}
```

---

## 🛠️ SOLUTIONS PROPOSÉES

### Solution 1 : Corriger la sauvegarde de la signature

**Problème :** La signature n'est pas sauvegardée dans `contract_signatures`

**Localisation du code :** Fonction qui gère la signature du contrat (probablement dans le frontend ou dans une Edge Function)

**Action requise :**
1. Trouver où le guest signe le contrat
2. S'assurer que la signature est sauvegardée dans `contract_signatures`
3. Vérifier que `signature_data` contient bien l'image en base64

---

### Solution 2 : Modifier la logique de récupération de la signature

**Problème actuel :** La fiche de police cherche la signature dans `contract_signatures` mais elle n'y est pas

**Options :**

#### Option A : Récupérer depuis une autre table
```typescript
// Au lieu de chercher dans contract_signatures
// Chercher dans uploaded_documents ou guest_submissions
const { data: guestDocs } = await supabase
  .from('uploaded_documents')
  .select('file_url, metadata')
  .eq('booking_id', bookingId)
  .eq('document_type', 'signature')
  .single();
```

#### Option B : Passer la signature en paramètre lors de la génération
```typescript
// Lors de l'appel à generate_police_only
const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
  body: { 
    bookingId: booking.id,
    action: 'generate_police_only',
    guestSignature: signatureDataFromContract // Récupérer depuis le contrat signé
  }
});
```

---

### Solution 3 : Sauvegarder les fiches de police générées

**Problème :** Les fiches de police ne sont pas sauvegardées dans `generated_documents`

**Localisation :** `submit-guest-info-unified/index.ts` - Fonction `generatePoliceFormsInternal`

**Code à ajouter après la génération du PDF :**
```typescript
// Après avoir généré le PDF de la fiche de police
const policeUrl = await uploadPoliceFormToStorage(pdfBytes, booking.id, guest.full_name);

// Sauvegarder dans generated_documents
const { error: saveError } = await supabaseClient
  .from('generated_documents')
  .insert({
    booking_id: bookingId,
    document_type: 'police',
    file_url: policeUrl,
    file_name: `Police_${guest.full_name}.pdf`,
    metadata: {
      guest_name: guest.full_name,
      generated_at: new Date().toISOString()
    }
  });
```

---

## 📝 PLAN D'ACTION

### Priorité 1 : Diagnostic des données existantes

1. ✅ Exécuter les requêtes SQL ci-dessus pour vérifier l'état des tables
2. ✅ Identifier où la signature devrait être sauvegardée
3. ✅ Vérifier si les fiches de police sont générées mais non sauvegardées

### Priorité 2 : Corriger la sauvegarde de la signature

1. 🔧 Trouver le code de signature du contrat
2. 🔧 Ajouter la sauvegarde dans `contract_signatures`
3. 🔧 Tester la signature

### Priorité 3 : Corriger la génération et sauvegarde des fiches de police

1. 🔧 Modifier `generatePoliceFormsInternal` pour sauvegarder dans `generated_documents`
2. 🔧 Ajouter la récupération de la signature depuis le bon endroit
3. 🔧 Tester la génération complète

---

## 🔍 PROCHAINES ÉTAPES

1. **Exécuter le diagnostic SQL** pour confirmer les hypothèses
2. **Identifier la source de la signature** (où est-elle actuellement sauvegardée ?)
3. **Modifier le code** selon les solutions proposées
4. **Tester** la génération complète avec signature

---

## 📌 NOTES IMPORTANTES

- La validation a été assouplie pour permettre la génération même sans `document_number`
- Les logs de diagnostic ont été ajoutés pour tracer le problème
- Le format des cartes a été corrigé pour afficher le nom du guest

