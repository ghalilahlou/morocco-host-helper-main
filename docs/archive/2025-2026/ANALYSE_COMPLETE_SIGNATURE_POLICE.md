# 🔬 Analyse Complète: Signature du Loueur Manquante dans la Fiche de Police

## 📊 Résumé Exécutif

**Problème**: La signature du loueur (landlord) n'apparaît pas sur les fiches de police générées.

**Cause Racine Probable**: La signature n'est pas stockée dans la base de données dans `properties.contract_template.landlord_signature`.

**Impact**: Les fiches de police générées sont incomplètes et ne respectent pas les exigences légales marocaines.

---

## 🔍 Analyse du Flux de Génération

### Étape 1: Point d'Entrée - `submit-guest-info-unified`

Fichier: `supabase/functions/submit-guest-info-unified/index.ts`

#### Ligne 1631-1991: `generatePoliceFormsInternal()`

Cette fonction:
1. **Récupère le booking** depuis la base de données (lignes 1642-1650)
2. **Récupère la signature du guest** depuis `contract_signatures` (lignes 1676-1726)
3. **Appelle `generatePoliceFormsPDF()`** pour générer le PDF (ligne 1976)

```typescript
const policeUrl = await generatePoliceFormsPDF(
  supabaseClient, 
  booking, 
  false, 
  guestSignature,  // ✅ Signature du GUEST
  guestSignedAt
);
```

⚠️ **Note Importante**: La signature du **guest** est passée, mais pas celle du **loueur** (landlord).

---

### Étape 2: Génération du PDF - `generatePoliceFormsPDF()`

Fichier: `supabase/functions/submit-guest-info-unified/index.ts`  
Lignes: 5101-5912

#### Phase 1: Récupération Explicite du `contract_template` (lignes 5116-5153)

```typescript
// ✅ AMÉLIORATION : TOUJOURS récupérer contract_template explicitement pour debug
if (property.id) {
  log('info', '[Police] Force fetch contract_template for debug...', {
    propertyId: property.id,
    hasContractTemplateBefore: !!property.contract_template
  });
  
  const { data: propertyData, error: propertyError } = await client
    .from('properties')
    .select('contract_template')
    .eq('id', property.id)
    .single();
  
  if (propertyError) {
    log('error', '[Police] ❌ Erreur récupération contract_template:', { 
      error: propertyError,
      propertyId: property.id
    });
  } else {
    log('info', '[Police] ✅ contract_template récupéré:', {
      hasContractTemplate: !!propertyData?.contract_template,
      contractTemplateKeys: propertyData?.contract_template ? Object.keys(propertyData.contract_template) : [],
      hasLandlordSignature: !!(propertyData?.contract_template as any)?.landlord_signature,
      landlordSignatureLength: (propertyData?.contract_template as any)?.landlord_signature ? (propertyData.contract_template as any).landlord_signature.length : 0
    });
    
    property.contract_template = propertyData.contract_template;
  }
}
```

✅ **Bonne pratique**: Le code fait une requête **explicite** pour récupérer `contract_template`.

---

#### Phase 2: Récupération de la Signature du Loueur (lignes 5604-5626)

```typescript
// ✅ NOUVEAU : Intégrer la signature du loueur dans la fiche de police
// ✅ AMÉLIORATION : Récupérer la signature depuis plusieurs sources possibles
const contractTemplate = property.contract_template || {};
let hostSignature = contractTemplate.landlord_signature;

// ✅ FALLBACK : Si pas de signature dans contract_template, essayer depuis host_profiles
if (!hostSignature && booking.host) {
  hostSignature = booking.host.signature_svg || booking.host.signature_image_url || null;
}

// ✅ DIAGNOSTIC : Log détaillé pour comprendre pourquoi la signature n'apparaît pas
log('info', '[Police] Recherche signature du loueur:', {
  hasProperty: !!property,
  hasContractTemplate: !!contractTemplate,
  contractTemplateKeys: Object.keys(contractTemplate),
  hasLandlordSignature: !!contractTemplate.landlord_signature,
  landlordSignatureType: contractTemplate.landlord_signature ? typeof contractTemplate.landlord_signature : 'none',
  landlordSignaturePrefix: contractTemplate.landlord_signature ? contractTemplate.landlord_signature.substring(0, 50) : 'none',
  hasHost: !!booking.host,
  hostSignatureSvg: !!booking.host?.signature_svg,
  hostSignatureImage: !!booking.host?.signature_image_url,
  finalHostSignature: !!hostSignature
});
```

✅ **Stratégie de fallback**:
1. **Source principale**: `property.contract_template.landlord_signature`
2. **Fallback 1**: `booking.host.signature_svg`
3. **Fallback 2**: `booking.host.signature_image_url`

---

#### Phase 3: Embedding de la Signature (lignes 5628-5751)

Le code vérifie si la signature existe et l'intègre dans le PDF:

```typescript
if (hostSignature && (hostSignature.startsWith('data:image/') || hostSignature.startsWith('http') || hostSignature.startsWith('data:image/svg'))) {
  try {
    // Conversion base64 → Uint8Array
    const base64Data = hostSignature.split(',')[1];
    const signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Tentative PNG, puis JPG
    let signatureImage;
    try {
      signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    } catch (pngError) {
      signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
    }
    
    // Calcul dimensions et positionnement
    const maxWidth = Math.min(180, availableWidth * 0.8);
    const maxHeight = 60;
    const scale = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height, 1.0);
    
    // Dessin de l'image
    page.drawImage(signatureImage, {
      x: margin,
      y: yPosition - finalHeight,
      width: finalWidth,
      height: finalHeight
    });
    
    log('info', '✅ Host signature embedded in police form successfully');
  } catch (signatureError) {
    log('warn', '⚠️ Failed to embed host signature in police form (will continue without):', {
      error: String(signatureError)
    });
  }
} else {
  log('warn', '[Police] Pas de signature du loueur ou format invalide');
}
```

⚠️ **Point Critique**: Si `hostSignature` est `null`, `undefined` ou ne commence pas par `data:image/` ou `http`, la signature **ne sera pas intégrée**.

---

## 🎯 Diagnostic: Où est le Problème?

### Hypothèse 1: Signature Manquante en Base de Données ⭐ **PROBABLE**

**Cause**: `properties.contract_template.landlord_signature` est `NULL` ou vide.

**Comment vérifier**:

```sql
-- Vérifier la présence de la signature
SELECT 
    id,
    name,
    contract_template->>'landlord_signature' as landlord_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    LEFT(contract_template->>'landlord_signature', 50) as sig_preview
FROM properties
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410'; -- studio casa
```

**Si la signature est `NULL`**:
→ Vous devez ajouter la signature via l'interface ou SQL.

---

### Hypothèse 2: Format Invalide

**Cause**: La signature existe mais n'est pas au format `data:image/png;base64,...` ou `data:image/jpeg;base64,...`

**Comment vérifier**:

```sql
SELECT 
    name,
    CASE 
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/png%' THEN 'PNG ✅'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpeg%' THEN 'JPEG ✅'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpg%' THEN 'JPG ✅'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/svg%' THEN 'SVG ⚠️ (Non supporté)'
        WHEN contract_template->>'landlord_signature' LIKE 'http%' THEN 'URL ✅'
        ELSE 'Format invalide ❌'
    END as format_status
FROM properties
WHERE contract_template->>'landlord_signature' IS NOT NULL;
```

**Si format SVG**:
→ Le code ne supporte pas SVG. Il faut convertir en PNG/JPEG.

---

### Hypothèse 3: Erreur de Récupération

**Cause**: La requête SQL ne récupère pas `contract_template` correctement.

**Logs à vérifier** (dans Supabase Edge Functions Logs):

```
[Police] Force fetch contract_template for debug...
[Police] ✅ contract_template récupéré:
  - hasContractTemplate: true/false
  - hasLandlordSignature: true/false
  - landlordSignatureLength: X
```

Si `hasLandlordSignature: false`, le problème vient de la base de données.

---

## 🛠️ Solutions Proposées

### Solution 1: Ajouter la Signature via SQL (Temporaire - Pour Test)

```sql
-- 1. Générer une signature test (carré noir simple en PNG base64)
UPDATE properties
SET contract_template = jsonb_set(
  COALESCE(contract_template, '{}'::jsonb),
  '{landlord_signature}',
  '"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"'::jsonb
)
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';
```

⚠️ **Note**: Ceci est une signature test (carré noir 10x10). **À remplacer par la vraie signature**.

---

### Solution 2: Ajouter la Signature via l'Interface (Recommandé)

1. Aller dans **Dashboard → Propriétés**
2. Sélectionner la propriété "studio casa"
3. Onglet **"Configuration"** ou **"Contrat"**
4. Section **"Signature du loueur"**
5. **Dessiner** ou **uploader** votre signature
6. **Sauvegarder**

Le frontend devrait enregistrer automatiquement la signature dans:
```
properties.contract_template.landlord_signature
```

---

### Solution 3: Vérifier et Corriger le Frontend

Si l'interface ne sauvegarde pas la signature:

**Fichier à vérifier**: Composant de configuration de propriété (probablement dans `src/components/properties/` ou `src/pages/properties/`)

**Code attendu** (exemple):

```typescript
const handleSignatureSave = async (signatureDataUrl: string) => {
  const { error } = await supabase
    .from('properties')
    .update({
      contract_template: {
        ...currentContractTemplate,
        landlord_signature: signatureDataUrl  // ✅ Format: data:image/png;base64,...
      }
    })
    .eq('id', propertyId);
  
  if (error) {
    console.error('Erreur sauvegarde signature:', error);
  }
};
```

---

## 📋 Plan d'Action Recommandé

### Étape 1: Diagnostic (5 min)

Exécuter le script SQL de vérification:

```sql
-- Fichier: VERIFICATION_SIGNATURES_LOUEUR.sql (déjà créé)
\i VERIFICATION_SIGNATURES_LOUEUR.sql
```

**Observer**:
- ✅ Signature présente (data URL valide) → Passer à l'Étape 3
- ❌ landlord_signature manquante → Aller à l'Étape 2
- ⚠️ landlord_signature vide → Aller à l'Étape 2

---

### Étape 2: Ajouter la Signature (10 min)

**Option A** (Interface - Recommandé):
1. Aller dans l'interface de gestion des propriétés
2. Modifier "studio casa"
3. Ajouter la signature du loueur
4. Sauvegarder

**Option B** (SQL - Temporaire):
```sql
-- Remplacer par votre vraie signature en base64
UPDATE properties
SET contract_template = jsonb_set(
  COALESCE(contract_template, '{}'::jsonb),
  '{landlord_signature}',
  '"data:image/png;base64,VOTRE_SIGNATURE_BASE64_ICI"'::jsonb
)
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';
```

---

### Étape 3: Tester la Génération (5 min)

#### 3.1 Supprimer l'ancienne fiche de police

```sql
DELETE FROM uploaded_documents 
WHERE booking_id = '99b22159-ac08-4cc6-9cbf-251463ad0df6' 
  AND document_type = 'police';
```

#### 3.2 Régénérer via l'Edge Function

**Méthode 1** (Depuis Supabase Dashboard):
```bash
POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/submit-guest-info-unified
Body: {
  "action": "regenerate_police",
  "bookingId": "99b22159-ac08-4cc6-9cbf-251463ad0df6"
}
```

**Méthode 2** (Depuis le frontend):
- Aller dans le booking
- Cliquer sur "Régénérer fiche de police"

---

### Étape 4: Vérifier les Logs (2 min)

Aller dans **Supabase Dashboard → Edge Functions → Logs**

**Rechercher**:
```
[Police] Force fetch contract_template
[Police] Recherche signature du loueur
[Police] Embedding host signature
✅ Host signature embedded in police form successfully
```

**Si vous voyez** ❌:
```
[Police] Pas de signature du loueur ou format invalide
```
→ Retour à l'Étape 1.

---

### Étape 5: Télécharger et Vérifier le PDF (1 min)

1. Télécharger la fiche de police générée
2. Ouvrir le PDF
3. Vérifier visuellement si la signature du loueur apparaît en bas à gauche

---

## 📊 Logs Actuels à Analyser

D'après vos logs (de l'historique):

```
✅ [2026-01-12T12:00:52.686Z] [submit-guest-info-unified] [generateContractPDF] Contract template usage: {
  "hasContractTemplate": true,
  "contractTemplateKeys": [
    "landlord_name",
    "landlord_email",
    "landlord_phone",
    "landlord_status",
    "landlord_address",
    "landlord_company",
    "landlord_signature",  ← ✅ LA CLÉ EXISTE
    "landlord_registration"
  ],
  "landlordName": "ghali lahlou ",
  "landlordEmail": "ghalilahlou26@gmail.com",
  "landlordPhone": "+212701863685"
}
```

✅ **BONNE NOUVELLE**: `landlord_signature` **existe** dans `contract_template`.

**Mais**: Les logs ne montrent **PAS** si `landlord_signature` a une **valeur** (peut être `null`).

---

## 🔍 Prochaine Étape Immédiate

Exécutez cette requête SQL pour voir la **valeur réelle** de la signature:

```sql
SELECT 
    name,
    contract_template->>'landlord_signature' IS NOT NULL as has_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    LEFT(contract_template->>'landlord_signature', 100) as sig_preview
FROM properties
WHERE name LIKE '%studio%casa%' OR name LIKE '%casa%studio%';
```

**Interprétation**:
- `has_signature: false` ou `sig_length: NULL` → **Signature manquante** → Aller à Solution 2
- `has_signature: true` + `sig_length > 0` + `sig_preview` commence par `data:image/` → **Signature OK** → Problème ailleurs
- `has_signature: true` + `sig_preview` = autre chose → **Format invalide** → Corriger le format

---

## 📞 Support Supplémentaire

Si après ces étapes le problème persiste, fournir:

1. **Résultat de la requête SQL** ci-dessus
2. **Logs complets** de la génération (depuis Supabase Dashboard → Edge Functions → Logs)
3. **Screenshot** de l'interface de configuration de la propriété

---

## ✅ Checklist de Résolution

- [ ] Exécuter `VERIFICATION_SIGNATURES_LOUEUR.sql`
- [ ] Vérifier si `landlord_signature` existe et n'est pas `NULL`
- [ ] Vérifier le format (doit commencer par `data:image/png` ou `data:image/jpeg`)
- [ ] Si manquante: Ajouter via interface ou SQL
- [ ] Supprimer l'ancienne fiche de police
- [ ] Régénérer via Edge Function
- [ ] Vérifier les logs pour `✅ Host signature embedded`
- [ ] Télécharger et ouvrir le PDF
- [ ] Confirmer visuellement la présence de la signature

---

**Date d'analyse**: 2026-01-12T13:07  
**Version du code**: `submit-guest-info-unified` (234 KB)  
**Auteur**: Antigravity AI Assistant
