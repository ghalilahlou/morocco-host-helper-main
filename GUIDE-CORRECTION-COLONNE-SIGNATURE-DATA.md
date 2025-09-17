# Guide de Correction - Erreur Colonne signature_data

## 🚨 Problème Identifié

**Erreur :** `Could not find the 'signature_data' column of 'generated_documents' in the schema cache`

**Cause :** La fonction `generate-contract` essayait d'insérer des données dans des colonnes qui n'existent pas dans la table `generated_documents`.

## ✅ Solution Appliquée

### Structure Correcte de la Table `generated_documents`

La table `generated_documents` a seulement ces colonnes :
- `id` (PK)
- `booking_id` (FK)
- `document_type` (VARCHAR)
- `file_name` (VARCHAR)
- `file_path` (VARCHAR)
- `document_url` (TEXT)
- `is_signed` (BOOLEAN)
- `signature_id` (FK → contract_signatures.id)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Structure Correcte de la Table `contract_signatures`

Les signatures sont stockées dans la table `contract_signatures` :
- `id` (PK)
- `booking_id` (FK)
- `signature_data` (TEXT)
- `contract_content` (TEXT)
- `signed_at` (TIMESTAMP)
- `signer_name` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## 🔧 Corrections Apportées

### 1. Fonction `saveDocumentToDatabase`

**Avant (❌ Incorrect) :**
```typescript
.insert({
  booking_id: bookingId,
  document_type: documentType,
  file_name: fileName,
  document_url: documentUrl,
  is_signed: isSigned,
  signature_data: signatureData || null,  // ❌ Colonne n'existe pas
  signed_at: signedAt || (isSigned ? new Date().toISOString() : null),  // ❌ Colonne n'existe pas
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
})
```

**Après (✅ Correct) :**
```typescript
// Sauvegarder la signature dans contract_signatures si nécessaire
if (signatureData && isSigned) {
  const { data: signatureRecord } = await client
    .from('contract_signatures')
    .insert({
      booking_id: bookingId,
      signature_data: signatureData,
      signed_at: signedAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  signatureId = signatureRecord.id;
}

// Sauvegarder le document avec les bonnes colonnes
.insert({
  booking_id: bookingId,
  document_type: documentType,
  file_name: fileName,
  document_url: documentUrl,
  is_signed: isSigned,
  signature_id: signatureId,  // ✅ Référence vers contract_signatures
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
})
```

### 2. Fonction `signContract`

**Avant (❌ Incorrect) :**
```typescript
.update({
  document_url: signedDocumentUrl,
  is_signed: true,
  signature_data: guestSignatureUrl,  // ❌ Colonne n'existe pas
  signed_at: signedAt || signerInfo?.signed_at || new Date().toISOString(),  // ❌ Colonne n'existe pas
  updated_at: new Date().toISOString()
})
```

**Après (✅ Correct) :**
```typescript
// Sauvegarder la signature dans contract_signatures
const { data: signatureRecord } = await client
  .from('contract_signatures')
  .insert({
    booking_id: booking.id,
    signature_data: guestSignatureUrl,
    signed_at: signedAt || signerInfo?.signed_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .select()
  .single();

// Mettre à jour le document avec les bonnes colonnes
.update({
  document_url: signedDocumentUrl,
  is_signed: true,
  signature_id: signatureRecord.id,  // ✅ Référence vers contract_signatures
  updated_at: new Date().toISOString()
})
```

### 3. Fonction `regenerateContract`

Même logique appliquée : sauvegarder les signatures dans `contract_signatures` et référencer via `signature_id`.

## 🚀 Déploiement

### Étape 1: Vérifier les Corrections
```bash
# Vérifier que le fichier corrigé existe
ls -la supabase/functions/generate-contract/index.ts

# Vérifier le contenu (optionnel)
grep -n "CORRECTION" supabase/functions/generate-contract/index.ts
```

### Étape 2: Déployer la Fonction Corrigée
```bash
# Déployer la fonction corrigée
supabase functions deploy generate-contract

# Ou forcer le déploiement
supabase functions deploy generate-contract --no-verify-jwt
```

### Étape 3: Vérifier le Déploiement
```bash
# Lister les fonctions déployées
supabase functions list

# Vérifier les logs de déploiement
supabase functions logs generate-contract --follow
```

## 🧪 Test de la Correction

### Test 1: Génération de Contrat
```bash
curl -X POST 'https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/generate-contract' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "bookingId": "26f72966-6229-45c5-a0b8-f3c2ef4564cd",
    "action": "generate"
  }'
```

### Test 2: Vérifier les Logs
```bash
supabase functions logs generate-contract --follow
```

### Logs Attendus (Succès)
```
🚀 generate-contract function started
📥 Request data: { bookingId: "...", action: "generate" }
🔍 Fetching booking from database: ...
✅ Booking found: { id: "...", property: "..." }
📄 Generating contract...
📄 Creating contract PDF...
✅ Contract generated successfully
```

### Logs d'Erreur (Problèmes)
```
❌ Error in generate-contract: Error: Failed to save document to database: Could not find the 'signature_data' column
```

## 📊 Vérification de la Base de Données

### Vérifier la Table `generated_documents`
```sql
SELECT * FROM generated_documents 
WHERE booking_id = '26f72966-6229-45c5-a0b8-f3c2ef4564cd' 
ORDER BY created_at DESC 
LIMIT 1;
```

### Vérifier la Table `contract_signatures`
```sql
SELECT * FROM contract_signatures 
WHERE booking_id = '26f72966-6229-45c5-a0b8-f3c2ef4564cd' 
ORDER BY created_at DESC 
LIMIT 1;
```

## 🎯 Résultats Attendus

Après le déploiement, vous devriez voir :

1. **✅ Plus d'erreur "Could not find the 'signature_data' column"**
2. **✅ Génération de contrats fonctionnelle**
3. **✅ Signatures sauvegardées dans `contract_signatures`**
4. **✅ Documents sauvegardés dans `generated_documents` avec `signature_id`**
5. **✅ Relations correctes entre les tables**

## 🚨 En Cas de Problème

Si vous rencontrez encore des erreurs :

1. **Vérifiez les logs :**
   ```bash
   supabase functions logs generate-contract --follow
   ```

2. **Vérifiez la structure de la base de données :**
   ```sql
   \d generated_documents
   \d contract_signatures
   ```

3. **Redéployez si nécessaire :**
   ```bash
   supabase functions deploy generate-contract --no-verify-jwt
   ```

4. **Vérifiez les permissions :**
   ```bash
   supabase status
   ```

## 📞 Support

Si vous avez besoin d'aide supplémentaire, fournissez :
- Les logs d'erreur complets
- Le `bookingId` utilisé pour le test
- La réponse de la fonction
- Les résultats des requêtes SQL de vérification
