# 🚨 PROBLÈME IDENTIFIÉ : Code d'Embedding de Signature MANQUANT !

## 🔍 Investigation Approfondie

J'ai inspecté en profondeur le code de génération du PDF de police et voici ce que j'ai trouvé :

### ✅ Ce qui FONCTIONNE

1. **Stockage de la Signature** :
   - La signature est stockée dans `properties.contract_template.landlord_signature`
   - Format : Data URL base64 (`data:image/png;base64,...`)
   - Source : `CreatePropertyDialog.tsx` ligne 190

2. **Récupération de la Signature** :
   - Le code **RÉCUPÈRE** `contract_template` (ligne 5039-5055)
   - Le code **LOG** la signature (lignes 5065-5068)
   - Logs disponibles montrent si la signature existe

### ❌ Ce qui MANQUE (CRITIQUE)

**Le code pour INSÉRER la signature dans le PDF de police N'EXISTE PAS !**

Voici ce qui devrait être là mais ne l'est pas :

```typescript
// ❌ CE CODE EST MANQUANT dans submit-guest-info-unified/index.ts
// Devrait être autour de la ligne 5400-5500

// Tentative d'ajout de la signature du loueur
try {
  const contractTemplate = property.contract_template || {};
  const landlordSignature = contractTemplate.landlord_signature;
  
  if (landlordSignature && landlordSignature.trim()) {
    log('info', '[Police] Embedding host signature in police form...');
    
    // Vérifier que c'est une data URL valide
    if (!landlordSignature.startsWith('data:image/')) {
      throw new Error('Invalid signature format');
    }
    
    // Nettoyer le base64
    const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
    
    if (!clean || clean.length === 0) {
      throw new Error('Empty base64 data');
    }
    
    // Essayer d'embedder PNG puis JPEG
    let img;
    try {
      img = await pdfDoc.embedPng(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
    } catch {
      try {
        img = await pdfDoc.embedJpg(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
      } catch {
        throw new Error('Failed to decode image');
      }
    }
    
    // Dimensions et positionnement
    const maxWidth = 180;
    const maxHeight = 60;
    
    const aspectRatio = img.width / img.height;
    let finalWidth = maxWidth;
    let finalHeight = maxWidth / aspectRatio;
    
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = maxHeight * aspectRatio;
    }
    
    // Position : en bas à gauche de la section "Signature du loueur"
    const signatureX = margin;
    const signatureY = /* A CALCULER SELON LE LAYOUT */;
    
    // Dessiner la signature sur CHAQUE page
    pages.forEach(page => {
      page.drawImage(img, {
        x: signatureX,
        y: signatureY - finalHeight - 10,
        width: finalWidth,
        height: finalHeight
      });
    });
    
    log('info', '✅ Host signature embedded in police form successfully');
  } else {
    log('info', 'ℹ️ No landlord signature available');
  }
} catch (signatureError) {
  log('warn', '⚠️ Failed to embed host signature:', {
    error: String(signatureError),
    message: signatureError instanceof Error ? signatureError.message : 'Unknown error'
  });
}
```

---

## 📊 Où Insérer le Code

### **Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`

### **Fonction** : `generatePoliceFormsPDF` (ligne 5032)

### **Emplacement Exact** :
Après la génération du contenu du PDF, mais **AVANT** la sauvegarde du PDF (ligne 5018).

**Rechercher** :
```typescript
const pdfBytes = await pdfDoc.save();
```

**Insérer LE CODE CI-DESSUS JUSTE AVANT** cette ligne.

---

## 🎯 Positionnement de la Signature

D'après le PDF de police que vous avez partagé :

### Section "Loueur / Host" المؤجر

```
A Maroc, le 6 janvier 2026
Signature du loueur                  CHECKY
[ICI LA SIGNATURE]
_____________
```

### Coordonnées Approximatives

```typescript
// Calculer la position Y de la section "Signature du loueur"
const signatureSectionY = /* Y de "Signature du loueur" */ - 60;

// Position X : alignée à gauche avec un petit margin
const signatureX = margin;

// Position Y : sous le texte "Signature du loueur"
const signatureY = signatureSectionY;
```

**NOTE** : Il faudra ajuster `signatureY` selon le layout exact de votre PDF. Je peux vous aider à calculer la position exacte une fois que le code est en place.

---

## 🚀 Action Immédiate

### **ÉTAPE 1** : Ajouter le Code d'Embedding

1. **Ouvrir** : `supabase/functions/submit-guest-info-unified/index.ts`

2. **Chercher** la ligne ~5015-5020 :
   ```typescript
   const pdfBytes = await pdfDoc.save();
   ```

3. **Insérer** le code d'embedding de signature **JUSTE AVANT** cette ligne

4. **Ajuster** la position Y selon votre layout exact

### **ÉTAPE 2** : Déployer

```bash
supabase functions deploy submit-guest-info-unified
```

### **ÉTAPE 3** : Tester

1. **Vérifier** que la signature existe en BDD :
   ```sql
   SELECT 
       name,
       LENGTH(contract_template->>'landlord_signature') as sig_length,
       LEFT(contract_template->>'landlord_signature', 50) as sig_preview
   FROM properties;
   ```

2. **Générer** une nouvelle fiche de police

3. **Observer** les logs :
   - `✅ Host signature embedded in police form successfully`
   - **OU** `⚠️ Failed to embed host signature: ...`

4. **Vérifier** le PDF généré

---

## 📝 Code Complet à Insérer

Je vais créer le fichier de code complet pour vous. Une fois ajouté, déployé et testé, la signature du loueur devrait apparaître dans les fiches de police !

---

## ⚠️ Pourquoi Ce Code Manque-t-il ?

D'après vos documents précédents (`RESUME_SIGNATURE_POLICE_FINAL.md`), il semblait que le code existait aux lignes 5471-5596.

**Deux possibilités** :
1. **Le code a été supprimé** accidentellement lors d'une modification
2. **Les documents étaient basés sur une autre version** du code

Quoi qu'il en soit, le code d'embedding de signature **N'EXISTE PAS** actuellement dans le fichier.

---

## 🎯 Résumé

| Élément | État | Action |
|---------|------|--------|
| Stockage signature | ✅ OK | `properties.contract_template.landlord_signature` |
| Récupération signature | ✅ OK | Ligne 5039-5055 |
| Logs de diagnostic | ✅ OK | Ligne 5058-5069 |
| **Embedding dans PDF** | ❌ **MANQUANT** | **À AJOUTER** |

---

## 💡 Prochaines Étapes

1. ✅ Je vais créer le fichier de code complet
2. ✅ Vous l'ajoutez au bon endroit dans `index.ts`
3. ✅ Vous déployez la fonction
4. ✅ Vous testez la génération du PDF

Voulez-vous que je crée le code complet prêt à être inséré ? 🚀
