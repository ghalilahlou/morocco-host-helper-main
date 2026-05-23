# 📄 Correction Police - Gestion des Longues Adresses

## 🎯 Problème Identifié

Dans le document de police, les **longues adresses** dépassaient du cadre et devenaient illisibles :

```
Exemple :
"CASABLANCA BOULVARD MOULY IDRISS 1, 20000, CASABLANCA,المغرب"
```

Le texte débordait sur les labels arabes à droite et n'était pas lisible.

---

## ✅ Solution Appliquée

### 🔧 Amélioration de la Fonction `drawBilingualField`

La fonction a été **complètement réécrite** pour gérer intelligemment les longues valeurs :

#### **Option 1 : Réduction Automatique de la Taille de Police**
```typescript
// Réduire progressivement la taille jusqu'à ce que ça rentre
while (valueWidth > availableWidth && valueSize > 6) {
  valueSize -= 0.3;
  valueWidth = valueFont.widthOfTextAtSize(value, valueSize);
}
```

#### **Option 2 : Découpage Multi-Lignes (Si Option 1 échoue)**
```typescript
// Si même à taille 6, c'est trop long → découper en plusieurs lignes
if (valueWidth > availableWidth && valueSize <= 6) {
  const lines = splitTextIntoLines(value, availableWidth, valueFont, valueSize);
  
  // Dessiner chaque ligne avec espacement de 14px
  lines.forEach((line, index) => {
    const lineY = y - 2 - (index * 14);
    page.drawText(line, { x: lineX, y: lineY, ... });
  });
}
```

#### **Option 3 : Valeur sur Une Ligne (Cas Normal)**
```typescript
// Si ça rentre, centrer la valeur entre les labels
const valueX = Math.max(
  startX + 2,
  Math.min(
    startX + (endX - startX - valueWidth) / 2,
    endX - valueWidth - 2
  )
);
```

---

## 🧮 Algorithme de Découpage Intelligent

```typescript
const splitTextIntoLines = (text: string, maxWidth: number) => {
  const words = text.split(/[\s,]+/); // Découper par espaces et virgules
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);  // Ligne complète
      currentLine = word;       // Nouveau mot sur nouvelle ligne
    } else {
      currentLine = testLine;   // Continuer sur la même ligne
    }
  }
  
  return lines;
};
```

**Exemple avec l'adresse :**
```
Ligne 1: "CASABLANCA BOULVARD MOULY"
Ligne 2: "IDRISS 1 20000"
Ligne 3: "CASABLANCA المغرب"
```

---

## 📊 Paramètres Optimisés

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `fontSize` | 11 | Taille normale |
| `baseFieldHeight` | 20 | Hauteur de base d'un champ |
| `labelSpacing` | 15 | Espacement entre label et ligne |
| `lineSpacing` | 14 | Espacement entre lignes multi-lignes |
| `minSize` | 6 | Taille minimale avant découpage |

---

## 🎨 Rendu Visuel

### Avant (Problème)
```
Adress du bien loué / Rental address     عنوان العقار المؤجر
____________ CASABLANCA BOULVARD MOULY IDRISS 1, 20000, CAS... [DÉBORDE]
```

### Après (Corrigé - Option 1 : Réduction)
```
Adress du bien loué / Rental address     عنوان العقار المؤجر
_______ CASABLANCA BOULVARD MOULY IDRISS 1, 20000, CASABLANCA ______
(Taille de police réduite à ~7-8pt)
```

### Après (Corrigé - Option 2 : Multi-Lignes)
```
Adress du bien loué / Rental address     عنوان العقار المؤجر
_______ CASABLANCA BOULVARD MOULY IDRISS 1
        20000 CASABLANCA المغرب
```

---

## 🧪 Tests à Effectuer

### Test 1 : Adresse Courte
```typescript
"Casablanca"
```
**Attendu** : Centré sur une ligne, taille normale (11pt)

### Test 2 : Adresse Moyenne
```typescript
"123 Rue Mohammed V, Casablanca"
```
**Attendu** : Taille légèrement réduite (~9pt), sur une ligne

### Test 3 : Adresse Longue (votre cas)
```typescript
"CASABLANCA BOULVARD MOULY IDRISS 1, 20000, CASABLANCA,المغرب"
```
**Attendu** : 
- **Option A** : Taille réduite à 6pt sur une ligne
- **Option B** : Découpée sur 2-3 lignes à taille 6-7pt

### Test 4 : Adresse Très Longue
```typescript
"Résidence Al Hana, Bâtiment C, Appartement 45, Boulevard Mohammed VI, Quartier Californie, 20000 Casablanca, Maroc"
```
**Attendu** : Découpée sur 3-4 lignes

---

## 🚀 Déploiement

### Étape 1 : Redéployer la Fonction Edge
```bash
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"
npx supabase functions deploy submit-guest-info-unified
```

### Étape 2 : Tester avec une Nouvelle Soumission

1. Aller sur l'interface de vérification guest
2. Uploader un document d'identité
3. Soumettre le formulaire
4. Télécharger la fiche de police générée
5. **Vérifier que l'adresse est lisible**

---

## 📝 Logs de Débogage

Lors de la génération, vous verrez dans les logs Supabase :

```
[info] Splitting long value into multiple lines: CASABLANCA BOULVARD MOULY IDRISS 1, 20000, CASABL...
```

Cela confirme que le découpage multi-lignes a été activé.

---

## 🔍 Cas Particuliers Gérés

### 1. **Texte Arabe**
Le système détecte automatiquement l'arabe et utilise la police `Noto Sans Arabic`

### 2. **Mélange Français/Arabe**
```typescript
"CASABLANCA,المغرب"
```
La fonction `getFont()` choisit la bonne police selon le contenu

### 3. **Adresses avec Virgules**
Le découpage se fait intelligemment sur les virgules ET les espaces

### 4. **Adresses avec Caractères Spéciaux**
Tous les caractères UTF-8 sont supportés

---

## ⚙️ Configuration Avancée

Si vous voulez ajuster les paramètres :

```typescript
// Dans la fonction drawBilingualField :

const labelSpacing = 15;    // Augmenter pour plus d'espace
const lineSpacing = 14;     // Augmenter pour plus d'espacement vertical
const minSize = 6;          // Diminuer pour autoriser des polices plus petites
```

---

## 📋 Checklist de Validation

- [ ] Adresse courte : affichage normal ✓
- [ ] Adresse moyenne : réduction de police fonctionne ✓
- [ ] Adresse longue : découpage multi-lignes fonctionne ✓
- [ ] Texte arabe : affichage correct ✓
- [ ] Pas de débordement sur les labels ✓
- [ ] Document lisible et professionnel ✓

---

**Date de Correction** : 5 janvier 2025
**Fichier Modifié** : `supabase/functions/submit-guest-info-unified/index.ts`
**Lignes Modifiées** : 3627-3787 (fonction `drawBilingualField`)

