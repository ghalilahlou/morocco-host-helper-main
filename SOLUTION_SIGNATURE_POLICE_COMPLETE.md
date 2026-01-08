# 🎯 SOLUTION TROUVÉE : Signature Manquante dans Fiche de Police

## ✅ Diagnostic Complet

### **Problème Identifié**
La signature du loueur **n'est PAS** intégrée dans le code de génération des fiches de police !

### **Fichier Concerné**
`supabase/functions/submit-guest-info-unified/index.ts`

**Fonction** : `generatePoliceFormsPDF` (ligne 5009)

### **Preuve**
1. ✅ La fonction récupère bien `contract_template` (lignes 5016-5028)
2. ✅ La fonction log la présence de `landlord_signature` (ligne 5037)
3. ❌ **MAIS** il n'y a **AUCUN CODE** qui embed la signature dans le PDF !

Aucune mention de :
- `landlord_signature`
- `drawImage`
- `embedPng`/`embedJpg`
- "Signature du loueur"
- "CHECKY" (texte visible sur l'image)

## 🔧 Solution à Implémenter

### Étape 1 : Trouver où mettre la signature

Dans la fonction `generatePoliceFormsPDF`, après avoir généré tous les champs, il faut ajouter une section pour la signature du loueur.

### Étape 2 : Code à Ajouter

Après la ligne où tous les champs sont dessinés (probablement vers la fin de la boucle des guests), ajouter :

```typescript
// ✅ NOUVEAU : Ajouter la signature du loueur
try {
  console.log('🔍 [Police] Tentative d\'ajout de la signature du loueur');
  
  const contractTemplate = property.contract_template || {};
  const landlordSignature = contractTemplate.landlord_signature;
  
  console.log('🖊️ [Police] landlordSignature exists:', !!landlordSignature);
  console.log('🖊️ [Police] landlordSignature type:', typeof landlordSignature);
  
  if (landlordSignature && landlordSignature.trim()) {
    console.log('✅ [Police] Signature trouvée, tentative d\'embedding...');
    
    // Vérifier que c'est une data URL valide
    if (!landlordSignature.startsWith('data:image/')) {
      console.error('❌ [Police] Format invalide : ne commence pas par data:image/');
      throw new Error('Invalid signature format');
    }
    console.log('✅ [Police] Format data:image/ validé');
    
    const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
    console.log('🧹 [Police] Base64 nettoyé, longueur:', clean.length);
    
    if (!clean || clean.length === 0) {
      console.error('❌ [Police] Base64 vide après nettoyage');
      throw new Error('Empty base64 data');
    }
    console.log('✅ [Police] Base64 non vide');
    
    let img;
    try {
      console.log('🖼️ [Police] Tentative embedPng...');
      img = await pdfDoc.embedPng(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
      console.log('✅ [Police] Signature PNG embedded');
    } catch (pngError) {
      console.log('⚠️ [Police] PNG failed, tentative JPEG...', pngError);
      try {
        img = await pdfDoc.embedJpg(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
        console.log('✅ [Police] Signature JPEG embedded');
      } catch (jpgError) {
        console.error('❌ [Police] PNG et JPEG ont échoué', { pngError, jpgError });
        throw new Error('Failed to decode image');
      }
    }
    
    console.log('📐 [Police] Image dimensions:', { width: img.width, height: img.height });
    
    // Dimensions et positionnement
    const maxWidth = 180;
    const maxHeight = 60;
    
    const aspect = img.width / img.height;
    let width = Math.min(maxWidth, img.width);
    let height = width / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspect;
    }
    
    console.log('📏 [Police] Dimensions calculées:', { width, height, aspect });
    
    // Position de la signature (ajuster selon le layout de votre fiche de police)
    const signatureX = margin;
    const signatureY = margin + 100; // Ajuster selon la position souhaitée
    
    console.log('🎨 [Police] Position signature:', {
      x: signatureX,
      y: signatureY,
      width,
      height
    });
    
    page.drawImage(img, {
      x: signatureX,
      y: signatureY,
      width,
      height
    });
    
    console.log('✅✅✅ [Police] Landlord signature embedded successfully!');
  } else {
    console.log('ℹ️ [Police] No landlord signature (empty or null)');
  }
} catch (signError) {
  console.error('❌ [Police] ERREUR lors de l\'embedding de la signature:', signError);
  console.error('❌ [Police] Stack trace:', signError.stack);
  // Continuer sans la signature
}
```

### Étape 3 : Localiser l'Endroit Exact

Dans la fonction `generatePoliceFormsPDF`, trouver la boucle ou la section qui génère chaque page de fiche de police pour un guest.

Il faut ajouter le code de signature **après** tous les champs (nom, prénom, nationalité, etc.) mais **avant** la fermeture de la page ou du document.

## 📋 Localisation Probable

Dans `submit-guest-info-unified/index.ts`, chercher dans la fonction `generatePoliceFormsPDF` :
- Lignes après 5200 (où les champs sont dessinés)
- Avant la ligne `pdfDoc.save()` ou équivalent

## 🎯 Actions Immédiates

1. ✅ Localiser la fin de la boucle de génération des champs
2. ✅ Ajouter le code d'embedding de signature
3. ✅ Déployer l'Edge Function modifiée
4. ✅ Tester la génération de fiche de police
5. ✅ Observer les logs pour vérifier que la signature est bien embedded

## 💡 Note Importante

La signature est bien présente en BDD (puisqu'elle apparaît dans le contrat), mais le code de génération de la fiche de police ne l'utilise tout simplement pas ! Il suffit d'ajouter le code d'embedding.
