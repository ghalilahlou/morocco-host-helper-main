# 🔍 Méthodologie Progressive : Correction Signature Guest dans Fiche de Police

## 📌 **Problème Identifié**
La signature du **guest (invité/locataire)** n'apparaît **PAS** dans la fiche de police PDF, contrairement à la signature du loueur qui est bien affichée.

---

## 📊 **Phase 1 : Analyse Comparative avec le Contrat**

### ✅ **Ce qui fonctionne : Le Contrat**

Dans le **contrat de location**, la signature du guest est correctement gérée :

**Fichier concerné :** `submit-guest-info-unified/index.ts`

**Ligne 1599-1602** - Génération du contrat avec signature :
```typescript
const pdfUrl = await generateContractPDF(supabaseClient, ctx, {
  guestSignatureData: signature?.data,
  guestSignedAt: signature?.timestamp
});
```

**Détails techniques :**
- ✅ La signature du guest est passée via `signature?.data`
- ✅ La timestamp est incluse via `signature?.timestamp`
- ✅ Les données proviennent de l'interface `SignatureData` (lignes 49-53)

### ❌ **Ce qui NE fonctionne PAS : La Fiche de Police**

**Ligne 1631-1656** - Génération de la fiche de police :
```typescript
async function generatePoliceFormsInternal(bookingId: string): Promise<string> {
  // Aucune référence à la signature du guest !
  // Seulement la signature du loueur est gérée (lignes 5499-5620)
}
```

**Problème identifié :**
- ❌ La fonction `generatePoliceFormsInternal` ne reçoit **PAS** la signature du guest en paramètre
- ❌ Dans le PDF de police, seule la signature du **loueur** est gérée (lignes 5499-5620)
- ❌ **Aucun code** pour afficher la signature du guest

---

## 🔎 **Phase 2 : Inspection de la Base de Données**

### **Tables à vérifier :**

#### **1. Table `contract_signatures`**
```sql
-- Vérifier si les signatures des guests sont bien enregistrées
SELECT 
  id,
  booking_id,
  signer_name,
  signature_type,
  signature_data IS NOT NULL as has_signature_data,
  LENGTH(signature_data) as signature_length,
  signed_at,
  created_at
FROM contract_signatures
WHERE booking_id = 'VOTRE_BOOKING_ID'
ORDER BY created_at DESC;
```

**Attendu :**
- ✅ `signature_type` = 'guest'
- ✅ `signature_data` contient la signature base64 (data:image/png;base64,...)
- ✅ `signed_at` contient la date de signature

#### **2. Table `guests`**
```sql
-- Vérifier les informations du guest
SELECT 
  id,
  booking_id,
  full_name,
  email,
  phone,
  created_at
FROM guests
WHERE booking_id = 'VOTRE_BOOKING_ID';
```

**Attendu :**
- ✅ Les informations du guest sont bien enregistrées

#### **3. Table `guest_submissions`**
```sql
-- Vérifier les soumissions du guest
SELECT 
  id,
  booking_id,
  status,
  guest_data,
  submitted_at
FROM guest_submissions
WHERE booking_id = 'VOTRE_BOOKING_ID'
ORDER BY created_at DESC;
```

---

## 🛠️ **Phase 3 : Solution Technique Progressive**

### **Étape 1 : Récupérer la signature du guest depuis la base**

**Localisation :** Fonction `generatePoliceFormsInternal` (ligne ~1631)

**Modification à apporter :**

```typescript
async function generatePoliceFormsInternal(bookingId: string): Promise<string> {
  log('info', 'ÉTAPE 4: Démarrage génération fiche de police', { bookingId });

  return await withRetry(async () => {
    const supabaseClient = await getServerClient();

    // ✅ NOUVEAU : Récupérer la signature du guest depuis contract_signatures
    log('info', '[Police] Récupération signature du guest...');
    const { data: guestSignatureData, error: signatureError } = await supabaseClient
      .from('contract_signatures')
      .select('signature_data, signed_at, signer_name')
      .eq('booking_id', bookingId)
      .eq('signature_type', 'guest')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (signatureError) {
      log('warn', '[Police] Erreur récupération signature guest', { error: signatureError });
    }

    const guestSignature = guestSignatureData?.signature_data || null;
    const guestSignedAt = guestSignatureData?.signed_at || null;

    log('info', '[Police] Signature guest récupérée:', {
      hasSignature: !!guestSignature,
      signatureType: guestSignature ? typeof guestSignature : 'none',
      signaturePrefix: guestSignature ? guestSignature.substring(0, 50) : 'none',
      signedAt: guestSignedAt
    });

    // 1. Récupérer les données du booking depuis la base
    // ... (reste du code existant)
```

### **Étape 2 : Passer la signature à la fonction de génération PDF**

**Modification :** Ligne ~1759

```typescript
// 2. Générer le PDF avec pdf-lib intégré
log('info', 'Génération PDF fiche de police');
const pdfUrl = await generatePoliceFormsPDF(
  supabaseClient, 
  booking, 
  false,  // isPreview
  guestSignature,  // ✅ NOUVEAU : Passer la signature du guest
  guestSignedAt    // ✅ NOUVEAU : Passer la date de signature
);
```

### **Étape 3 : Modifier la signature de la fonction `generatePoliceFormsPDF`**

**Ligne 5032 - Modifier la déclaration de fonction :**

```typescript
async function generatePoliceFormsPDF(
  client: any, 
  booking: any, 
  isPreview: boolean = false,
  guestSignatureData?: string | null,  // ✅ NOUVEAU
  guestSignedAt?: string | null         // ✅ NOUVEAU
): Promise<string> {
```

### **Étape 4 : Ajouter la signature du guest dans le PDF**

**Localisation :** Après la section "Signature du loueur" (ligne ~5620)

**Code à ajouter :**

```typescript
    // ✅ NOUVEAU : Section signature du guest/locataire
    yPosition -= 80; // Espacement après signature du loueur
    
    page.drawText('Signature du locataire / Tenant signature', {
      x: pageWidth - margin - 200,
      y: yPosition,
      size: fontSize,
      font: font
    });
    
    // Texte arabe pour "signature du locataire"
    try {
      const arabicGuestSig = 'توقيع المستأجر';
      const arabicGuestSigWidth = arabicFont.widthOfTextAtSize(arabicGuestSig, fontSize);
      page.drawText(arabicGuestSig, {
        x: pageWidth - margin - arabicGuestSigWidth,
        y: yPosition - 15,
        size: fontSize,
        font: arabicFont
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic guest signature label');
    }
    
    yPosition -= 30;
    
    // ✅ INTÉGRATION DE LA SIGNATURE DU GUEST
    if (guestSignatureData && (guestSignatureData.startsWith('data:image/') || guestSignatureData.startsWith('http'))) {
      try {
        log('info', '[Police] Embedding guest signature in police form...', {
          signatureType: guestSignatureData.startsWith('data:image/png') ? 'png' : 
                        guestSignatureData.startsWith('data:image/jpg') || guestSignatureData.startsWith('data:image/jpeg') ? 'jpg' : 
                        guestSignatureData.startsWith('http') ? 'url' : 'unknown',
          signatureLength: guestSignatureData.length
        });
        
        let signatureImageBytes;
        if (guestSignatureData.startsWith('data:')) {
          const base64Data = guestSignatureData.split(',')[1];
          if (!base64Data) {
            throw new Error('Base64 data manquante dans la signature guest');
          }
          signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        } else if (guestSignatureData.startsWith('http')) {
          const response = await fetch(guestSignatureData);
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          signatureImageBytes = new Uint8Array(await response.arrayBuffer());
        }
        
        if (signatureImageBytes && signatureImageBytes.length > 0) {
          let guestSignatureImage;
          try {
            guestSignatureImage = await pdfDoc.embedPng(signatureImageBytes);
            log('info', '[Police] Guest signature PNG embedée avec succès');
          } catch (pngError) {
            try {
              guestSignatureImage = await pdfDoc.embedJpg(signatureImageBytes);
              log('info', '[Police] Guest signature JPG embedée avec succès');
            } catch (jpgError) {
              log('error', '[Police] Échec embedding guest signature', {
                pngError: String(pngError),
                jpgError: String(jpgError)
              });
              throw new Error('Format de signature guest non supporté');
            }
          }
          
          // ✅ Dimensions de la signature du guest (même logique que loueur)
          const maxWidth = 180;
          const maxHeight = 60;
          
          const scale = Math.min(
            maxWidth / guestSignatureImage.width,
            maxHeight / guestSignatureImage.height,
            1.0
          );
          const width = guestSignatureImage.width * scale;
          const height = guestSignatureImage.height * scale;
          
          // Position à droite de la page pour la signature du guest
          const signatureX = pageWidth - margin - width;
          
          page.drawImage(guestSignatureImage, {
            x: signatureX,
            y: yPosition,
            width: width,
            height: height
          });
          
          log('info', '[Police] ✅ Guest signature embedée dans le PDF', {
            width,
            height,
            x: signatureX,
            y: yPosition
          });
          
        }
      } catch (error) {
        log('error', '[Police] ❌ Erreur embedding guest signature', {
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } else {
      log('warn', '[Police] ⚠️ Aucune signature guest disponible', {
        hasGuestSignature: !!guestSignatureData,
        guestSignatureType: guestSignatureData ? typeof guestSignatureData : 'none'
      });
    }
```

---

## 🧪 **Phase 4 : Tests et Validation**

### **Tests à effectuer :**

#### **Test 1 : Vérification Base de Données**
```sql
-- Vérifier qu'une signature existe pour le booking
SELECT * FROM contract_signatures 
WHERE booking_id = 'VOTRE_BOOKING_ID' 
AND signature_type = 'guest';
```

**Résultat attendu :**
- ✅ Une ligne avec `signature_data` non null
- ✅ Format : `data:image/png;base64,...`

#### **Test 2 : Logs de Déploiement**
Après déploiement de la fonction, vérifier dans les logs Supabase :
```
[Police] Récupération signature du guest...
[Police] Signature guest récupérée: { hasSignature: true, ... }
[Police] Embedding guest signature in police form...
[Police] ✅ Guest signature embedée dans le PDF
```

#### **Test 3 : Génération PDF**
1. Soumettre un nouveau guest avec signature
2. Vérifier que le PDF de police contient :
   - ✅ Signature du loueur (en bas à gauche)
   - ✅ Signature du guest (en bas à droite)

---

## 📝 **Phase 5 : Checklist de Déploiement**

### **Avant déploiement :**
- [ ] Backup de la fonction actuelle
- [ ] Test en local/dev si possible
- [ ] Vérification de la présence de signatures en base

### **Modifications à déployer :**
1. [ ] Modification de `generatePoliceFormsInternal` (récupération signature)
2. [ ] Modification de l'appel à `generatePoliceFormsPDF` (passage paramètres)
3. [ ] Modification de la signature de `generatePoliceFormsPDF`
4. [ ] Ajout du code d'affichage de la signature guest dans le PDF

### **Après déploiement :**
- [ ] Vérifier les logs Supabase
- [ ] Tester génération d'une nouvelle fiche de police
- [ ] Vérifier visuellement le PDF généré
- [ ] Tester avec plusieurs guests

---

## 🎯 **Résumé Technique**

### **Root Cause :**
La fonction `generatePoliceFormsInternal` ne récupère **jamais** la signature du guest depuis la table `contract_signatures`, contrairement à la génération du contrat qui la reçoit correctement.

### **Solution :**
1. Récupérer la signature du guest depuis `contract_signatures`
2. Passer cette signature à la fonction de génération PDF
3. Intégrer l'affichage de la signature dans le PDF de police (comme pour le loueur)

### **Impact :**
- ✅ Conformité avec le format officiel des fiches de police
- ✅ Cohérence avec le contrat (qui affiche bien la signature)
- ✅ Aucune modification de la base de données nécessaire

---

## 📚 **Références Code**

### **Fichiers concernés :**
- `submit-guest-info-unified/index.ts`

### **Lignes clés :**
- **Interface SignatureData :** lignes 49-53
- **Génération contrat (référence) :** lignes 1599-1602
- **Génération police (à modifier) :** lignes 1631-1760
- **PDF police (à modifier) :** lignes 5032-5620

### **Tables base de données :**
- `contract_signatures` (source de la signature guest)
- `guests` (informations du guest)
- `bookings` (lien booking)

---

## ⚡ **Actions Immédiates Recommandées**

1. **Vérifier la base de données** - Exécuter les requêtes SQL de la Phase 2
2. **Appliquer les modifications** - Suivre les étapes de la Phase 3
3. **Déployer la fonction** - Utiliser `supabase functions deploy submit-guest-info-unified`
4. **Tester** - Générer une nouvelle fiche de police
5. **Valider** - Vérifier visuellement le PDF

---

**Date de création :** 2026-01-12  
**Auteur :** Antigravity AI Assistant  
**Priorité :** 🔴 HAUTE - Conformité légale fiche de police
