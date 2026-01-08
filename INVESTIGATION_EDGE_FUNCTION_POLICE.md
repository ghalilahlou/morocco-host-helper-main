# 🔍 Investigation : Edge Function Réelle pour la Fiche de Police

## ✅ Résultat de l'Investigation

La fonction Edge réellement utilisée est **`submit-guest-info-unified`** et **NON** `generate-police-forms` !

### 📍 Preuve dans le Code

**Fichier** : `src/services/unifiedDocumentService.ts`  
**Ligne** : 340  
**Fonction** : `downloadPoliceFormsForAllGuests`

```typescript
// Appeler l'Edge Function submit-guest-info-unified avec l'action generate_police_only
const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
  body: {
    action: 'generate_police_only',
    bookingId: booking.id
  }
});
```

### 📊 Flux d'Appel Complet

1. **Frontend** : `UnifiedBookingModal.tsx` (ligne 1106)
   ```typescript
   await UnifiedDocumentService.downloadPoliceFormsForAllGuests(bookingTyped);
   ```

2. **Service** : `unifiedDocumentService.ts` (ligne 340)
   ```typescript
   const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
     body: {
       action: 'generate_police_only',
       bookingId: booking.id
     }
   });
   ```

3. **Edge Function** : `supabase/functions/submit-guest-info-unified/index.ts`
   - Action : `generate_police_only`
   - Génère la fiche de police
   - Retourne `policeUrl`

## 🎯 Fichiers à Modifier

### ❌ Fichier Incorrect (ne pas modifier)
- `supabase/functions/generate-police-forms/index.ts`
- Cette fonction existe mais **n'est PAS utilisée** actuellement

### ✅ Fichier Correct (à modifier)
- **`supabase/functions/submit-guest-info-unified/index.ts`**
- Cette fonction gère l'action `generate_police_only`
- C'est ici qu'il faut ajouter les logs et corriger la signature

## 📋 Actions à Réaliser

### 1. Localiser la Logique de Génération Police

Dans `submit-guest-info-unified/index.ts`, trouver :
- Le code qui gère l'action `generate_police_only`
- L'appel à la fonction de génération de PDF
- L'embedding de la signature du loueur

### 2. Ajouter des Logs Détaillés

Ajouter les mêmes logs que ceux ajoutés à `generate-police-forms` :
- 🔍 Vérification de `contract_template`
- 🖊️ Vérification de `landlordSignature`
- ✅ Validation du format
- 🧹 Nettoyage du base64
- 🖼️ Tentative PNG/JPEG
- 📐 Dimensions
- 🎨 Position
- ✅ Embedding réussi

### 3. Vérifier la Requête Property

S'assurer que la fonction récupère bien :
```typescript
.select(`
  *,
  property:properties(
    id,
    name,
    address,
    contract_template  // ← Vérifier que c'est bien inclus
  )
`)
```

## 🔎 Logs Backend à Chercher

Dans **Supabase Dashboard** → **Edge Functions** → **Logs**, chercher :
- ✅ Messages de `submit-guest-info-unified`
- ✅ Action `generate_police_only`
- ⚠️ Erreurs ou warnings liés à la signature

## 📝 Prochaines Étapes

1. **Examiner** `submit-guest-info-unified/index.ts`
2. **Trouver** le code de génération de la fiche de police
3. **Ajouter** les logs détaillés pour la signature
4. **Déployer** l'Edge Function modifiée
5. **Tester** et observer les logs
6. **Corriger** selon les résultats

## 💡 Hypothèse

La signature est probablement disponible en base de données (puisqu'elle apparaît dans le contrat), mais la fonction `submit-guest-info-unified` ne l'utilise peut-être pas ou la perd en cours de route.

Les logs détaillés nous permettront de voir exactement où le processus échoue.

## 🚨 Important

**NE PAS déployer** les modifications sur `generate-police-forms` car cette fonction n'est pas utilisée !

**CONCENTRER** les efforts sur `submit-guest-info-unified` !
