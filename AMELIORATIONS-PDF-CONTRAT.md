# Améliorations PDF - Contrat de Location

## Problèmes Identifiés et Solutions

### ❌ **Problème 1 : Pas de Sauts de Page**
**Symptôme :** Le contrat s'affiche sur une seule page avec du texte qui se chevauche

**Solution Appliquée :**
```typescript
// Fonction pour créer une nouvelle page
function newPage() {
  if (pageNumber > 1) {
    pdfInstructions += 'ET\n';
  }
  pageNumber++;
  currentY = 750;
  pdfInstructions += 'BT\n';
  
  // Ajouter le numéro de page
  addText(`Page ${pageNumber}`, pageWidth - 100, 30, 8);
}

// Fonction pour vérifier si on a besoin d'une nouvelle page
function checkPageBreak(requiredSpace: number = lineHeight) {
  if (currentY - requiredSpace < bottomMargin) {
    newPage();
    return true;
  }
  return false;
}
```

### ❌ **Problème 2 : Section Signatures Manquante/Mal Formatée**
**Symptôme :** La signature de l'hôte n'apparaît pas, section signatures incomplète

**Solution Appliquée :**
```typescript
// Section Signatures
else if (line.includes('SIGNATURES')) {
  checkPageBreak(30);
  currentY -= 10;
  addText(line, leftMargin, currentY, 12, true);
  currentY -= 20;
  
  // Ajouter les lignes de signature
  checkPageBreak(40);
  addText('Le Bailleur :', leftMargin, currentY, 10, true);
  addText('Le Locataire :', leftMargin + 250, currentY, 10, true);
  currentY -= 15;
  
  // Lignes de signature
  drawLine(leftMargin, currentY, leftMargin + 200, currentY);
  drawLine(leftMargin + 250, currentY, leftMargin + 450, currentY);
  currentY -= 20;
  
  // Noms
  addText(bailleurName || 'Proprietaire', leftMargin, currentY, 10);
  addText(locataireName || 'Locataire', leftMargin + 250, currentY, 10);
  currentY -= 20;
  
  // Dates
  addText('Date : _______________', leftMargin, currentY, 10);
  addText('Date : _______________', leftMargin + 250, currentY, 10);
  currentY -= 30;
}
```

### ❌ **Problème 3 : Mise en Page Non Professionnelle**
**Symptôme :** Texte mal aligné, pas de numérotation de pages, formatage incohérent

**Solutions Appliquées :**

#### A. Numérotation des Pages
```typescript
// Ajouter le numéro de page de la première page
addText('Page 1', pageWidth - 100, 30, 8);

// Dans newPage()
addText(`Page ${pageNumber}`, pageWidth - 100, 30, 8);
```

#### B. Formatage Amélioré
```typescript
// Titre principal
if (line.includes('CONTRAT DE LOCATION SAISONNIERE')) {
  checkPageBreak(30);
  addText(line, leftMargin, currentY, 16, true);
  currentY -= 25;
  drawLine(leftMargin, currentY, rightMargin, currentY);
  currentY -= 20;
}

// Articles
else if (line.startsWith('ARTICLE')) {
  checkPageBreak(20);
  addText(line, leftMargin, currentY, 12, true);
  currentY -= 18;
}
```

#### C. Gestion des Lignes Longues
```typescript
// Gérer les lignes trop longues
if (line.length > 70) {
  const words = line.split(' ');
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + word).length > 70) {
      checkPageBreak();
      addText(currentLine, leftMargin, currentY, 10);
      currentY -= lineHeight;
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine.trim()) {
    checkPageBreak();
    addText(currentLine, leftMargin, currentY, 10);
    currentY -= lineHeight;
  }
}
```

## Nouvelles Fonctionnalités

### ✅ **1. Sauts de Page Automatiques**
- Détection automatique quand le contenu dépasse la page
- Création de nouvelles pages avec numérotation
- Préservation de la mise en page entre les pages

### ✅ **2. Section Signatures Professionnelle**
- Lignes de signature clairement définies
- Noms du bailleur et locataire affichés
- Espaces pour les dates de signature
- Formatage côte à côte

### ✅ **3. Numérotation des Pages**
- Numéro de page en bas à droite
- Mise à jour automatique lors des sauts de page

### ✅ **4. Formatage Hiérarchique**
- Titre principal en gras (16pt)
- Articles en gras (12pt)
- Texte normal (10pt)
- Lignes de séparation

## Structure du PDF Améliorée

```
Page 1:
┌─────────────────────────────────────┐
│ CONTRAT DE LOCATION SAISONNIERE     │ ← Titre (16pt, gras)
│ ─────────────────────────────────── │ ← Ligne de séparation
│                                     │
│ Entre les soussignés :              │
│                                     │
│ LE BAILLEUR (PROPRIÉTAIRE/HOST)     │
│ Nom et prénom : Propriétaire        │
│ Adresse : Mon Adresse, Casablanca   │
│                                     │
│ ET                                  │
│                                     │
│ LE LOCATAIRE (VOYAGEUR/GUEST)       │
│ Nom et prénom : Maëlis-Gaëlle...    │
│ Nationalité : FRANÇAIS              │
│ N° de pièce d'identité : D2H6862M2  │
│                                     │
│ ARTICLE 1 - OBJET DU CONTRAT        │ ← Article (12pt, gras)
│                                     │
│ Le présent contrat a pour objet...  │ ← Texte normal (10pt)
│                                     │
│ [Contenu continue...]               │
│                                     │
│                          Page 1     │ ← Numéro de page
└─────────────────────────────────────┘

Page 2 (si nécessaire):
┌─────────────────────────────────────┐
│ [Suite du contenu...]               │
│                                     │
│ SIGNATURES                          │ ← Section signatures (12pt, gras)
│                                     │
│ Le Bailleur :    Le Locataire :     │ ← Labels (10pt, gras)
│ Propriétaire     Maëlis-Gaëlle...   │ ← Noms (10pt)
│ ────────────     ───────────────    │ ← Lignes de signature
│                                     │
│ Date : _______   Date : _______     │ ← Dates (10pt)
│                                     │
│                          Page 2     │ ← Numéro de page
└─────────────────────────────────────┘
```

## Fichiers Modifiés

1. **`supabase/functions/generate-contract/index.ts`**
   - Fonction `createSimplePDF` complètement refaite (lignes 793-976)
   - Gestion des sauts de page automatiques
   - Section signatures professionnelle
   - Numérotation des pages
   - Formatage hiérarchique

2. **Scripts de Test Créés**
   - `test-pdf-page-breaks.js` - Test des sauts de page et signatures

## Résultat Attendu

- ✅ **Sauts de page automatiques** quand le contenu dépasse une page
- ✅ **Section signatures claire** avec lignes pour signer
- ✅ **Numérotation des pages** en bas à droite
- ✅ **Formatage professionnel** avec hiérarchie visuelle
- ✅ **Signature de l'hôte visible** et bien formatée
- ✅ **Mise en page cohérente** sur toutes les pages

## Prochaine Étape

Déployer les corrections :
```bash
npx supabase functions deploy generate-contract
```

Le contrat généré aura maintenant une apparence professionnelle avec des sauts de page appropriés et une section signatures complète.

