# 🔧 PROBLÈME IDENTIFIÉ : Signature Guest Hors Cadre A4

## ❌ **Problème**

La signature du guest **existe bien** dans le code déployé, mais elle est positionnée **trop bas** et sort du cadre A4 de la fiche de police.

### Cause
La signature guest est ajoutée **après** affichage de la signature du loueur, ce qui la place en dehors du cadre imprimable du PDF.

---

## ✅ **Solution Simple**

Il faut **repositionner** la signature guest pour qu'elle soit **côte à côte** avec la signature du loueur, pas en dessous.

### Modification à apporter

Dans le fichier `submit-guest-info-unified/index.ts`, ligne ~5695 :

**Code ACTUEL (problématique) :**
```typescript
// La signature guest est ajoutée après la signature loueur
// Elle utilise yPosition qui a déjà été décrémenté
let guestSignatureYPosition = yPosition + 50; // ❌ Toujours trop bas
```

**Code CORRIGÉ  (à implémenter) :**
```typescript
// Sauvegarder la position Y AVANT d'afficher les signatures
const signaturesBaselineY = yPosition;

// LOUEUR à gauche
page.drawText('Signature du loueur', { x: margin, y: signaturesBaselineY, ... });

// GUEST à droite (MÊME hauteur Y)
const guestX = pageWidth / 2 + 20;
page.drawText('Signature du locataire', { x: guestX, y: signaturesBaselineY, ... });

// Les deux images de signature utilisent la MÊME baseline Y
```

---

## 🚀 **Actions Recommandées**

### Option 1 : Correction Manuelle Rapide (5 min)

1. Ouvrir `supabase/functions/submit-guest-info-unified/index.ts`
2. Chercher la section "Signature du loueur" (ligne ~5696)
3. Ajouter **avant** cette ligne :
   ```typescript
   const signaturesBaselineY = yPosition - 10;
   ```
4. Changer TOUTES les références à `yPosition` dans les sections signatures par `signaturesBaselineY`
5. Pour la signature guest, utiliser la même `signaturesBaselineY` au lieu de `yPosition + 50`
6. Déployer : `supabase functions deploy submit-guest-info-unified`

### Option 2 : Script Automatique (recommandé)

Je vais créer un script qui fait automatiquement les modifications nécessaires.

---

## 📐 **Explication Technique**

### Format A4
- Hauteur : 841.89 points
- Avec margin de 50 : espace utilisable Y = 50 à 791.89

### Position actuelle (problématique)
```
yPosition après section "Loueur" ≈ 150-200 (bas de page)
guestSignatureYPosition = yPosition + 50 ≈ 200-250

Signature guest Y = 200-250 - heightGuest ≈ 150-200 (OK)
MAIS label "Signature du locataire" Y = 200-250 (déjà bas)
Donc le label est coupé en bas de page ❌
```

### Position corrigée (côte à côte)
```
signaturesBaselineY sauvegardé AVANT affichage ≈ 180-200

Loueur:
  Label Y = 180
  Image Y = 170-180

Guest:
  Label Y = 180 (MÊME hauteur que loueur) ✅
  Image Y = 170-180 (côte à côte) ✅

Les deux restent dans le cadre A4 ✅
```

---

## 🎯 **Résultat Attendu**

```
┌────────────────────────────────────────────┐
│  [Informations locataire]                  │
│  [Informations loueur]                     │
│                                            │
│  A Casablanca, le 12 janvier 2026         │
│                                            │
│  Signature du loue ur   Signature du locataire  │ ← MÊME ligne
│  [IMAGE SIGNATURE]      توقيع المستأجر          │
│  (landlord sig)         [IMAGE SIGNATURE]       │ ← Côte à côte
│                         Signé le 12/01/2026     │
│                                            │
│                               CHECKY       │
└────────────────────────────────────────────┘
```

---

## ⚡ **Prochaine Étape**

Souhaitez-vous que je :
1. ✅ **Crée le script automatique de correction** ?
2. ✅ **Fournisse le code exact à copier-coller** ?
3. ✅ **Applique directement la correction** ?

Dites-moi quelle option vous préférez !

---

**Date :** 2026-01-12  
**Status :** 🔧 EN ATTENTE DE CORRECTION FINALE
