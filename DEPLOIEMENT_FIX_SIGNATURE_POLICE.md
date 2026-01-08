# 🔧 Déploiement et Test : Correction Signature Fiche de Police

## ✅ Modification Effectuée

**Fichier** : `supabase/functions/generate-police-forms/index.ts`

**Changement** : Ajout de logs détaillés pour diagnostiquer pourquoi la signature n'apparaît pas.

### Logs Ajoutés

```
🔍 Début de la section signature du loueur
📋 contract_template exists: true/false
📋 contract_template keys: [...]
🖊️ landlordSignature exists: true/false
🖊️ landlordSignature type: string
🖊️ landlordSignature length: XXX
🖊️ landlordSignature preview: data:image/...
✅ Signature trouvée, tentative d'embedding...
✅ Format data:image/ validé
🧹 Base64 nettoyé, longueur: XXX
✅ Base64 non vide
🖼️ Tentative embedPng...
✅ Signature PNG embedded
📐 Image dimensions: { width: XX, height: XX }
📏 Dimensions calculées: { width: XX, height: XX }
🎨 Position signature: { x: XX, y: XX, width: XX, height: XX }
✅✅✅ Landlord signature embedded successfully!
```

### Logs d'Erreur Possibles

```
❌ Format invalide : ne commence pas par data:image/
❌ Base64 vide après nettoyage
⚠️ PNG failed, tentative JPEG...
❌ PNG et JPEG ont échoué
❌ ERREUR lors de l'embedding de la signature
❌ Stack trace: ...
ℹ️ No landlord signature (empty or null)
❌ ERREUR CRITIQUE dans la section signature
```

## 🚀 Étapes de Déploiement

### 1. Déployer l'Edge Function Modifiée

```bash
# Dans le terminal, à la racine du projet
supabase functions deploy generate-police-forms
```

**Résultat attendu** :
```
Deploying function generate-police-forms...
✓ Function deployed successfully
```

### 2. Tester la Génération de Fiche de Police

#### Option A : Via l'Interface Utilisateur

1. Ouvrir votre application
2. Aller sur une réservation avec des invités
3. Générer une fiche de police
4. Observer les logs

#### Option B : Via Supabase Client (Test Direct)

```typescript
const { data, error } = await supabase.functions.invoke('generate-police-forms', {
  body: { 
    bookingId: 'VOTRE_BOOKING_ID_ICI'  // Remplacer par un vrai ID
  }
});

console.log('Result:', data);
console.log('Error:', error);
```

### 3. Observer les Logs

#### Dans Supabase Dashboard

1. Aller sur **Supabase Dashboard**
2. **Edge Functions** → **Logs**
3. Filtrer par **`generate-police-forms`**
4. Observer les messages en temps réel

#### Ce qu'il faut chercher :

**Si la signature apparaît ✅** :
```
✅ Signature trouvée, tentative d'embedding...
✅ Format data:image/ validé
✅ Base64 non vide
✅ Signature PNG embedded (ou JPEG)
📐 Image dimensions: { width: 500, height: 200 }
📏 Dimensions calculées: { width: 180, height: 72 }
🎨 Position signature: { x: 40, y: 150, width: 180, height: 72 }
✅✅✅ Landlord signature embedded successfully!
```

**Si la signature ne s'affiche pas ❌** :

Chercher un de ces messages :
- `ℹ️ No landlord signature (empty or null)` → Signature manquante en BDD
- `❌ Format invalide : ne commence pas par data:image/` → Format incorrect
- `❌ Base64 vide après nettoyage` → Données corrompues
- `❌ PNG et JPEG ont échoué` → Image invalide
- `❌ ERREUR lors de l'embedding de la signature` → Erreur de PDF

## 🔍 Diagnostic Basé sur les Logs

### Scénario 1 : `ℹ️ No landlord signature`

**Cause** : La signature n'existe pas dans `property.contract_template.landlord_signature`

**Solution** :
1. Vérifier la base de données avec `VERIFICATION_SIGNATURES_LOUEUR.sql`
2. Si manquante, ajouter via "Modifier le bien" → "Configuration" → "Signature"

### Scénario 2 : `❌ Format invalide`

**Cause** : La signature n'est pas au format `data:image/...`

**Solution** :
```sql
-- Vérifier le format
SELECT 
    name,
    LEFT(contract_template->>'landlord_signature', 50) as format
FROM properties;

-- Réuploader la signature si nécessaire
```

### Scénario 3 : `❌ Base64 vide`

**Cause** : La signature est au bon format mais les données base64 sont vides

**Solution** : Réuploader une nouvelle signature

### Scénario 4 : `❌ PNG et JPEG ont échoué`

**Cause** : L'image ne peut pas être décodée (corrompue ou format non supporté)

**Solution** : 
- Vérifier que l'image source est bien PNG ou JPEG
- Réuploader une signature au bon format
- Taille recommandée : 500x200px ou moins

### Scénario 5 : Signature embedded mais pas visible

**Cause** : Position hors page ou dimensions nulles

**Solution** : Observer les logs `🎨 Position signature:` et vérifier que :
- `x` et `y` sont positifs
- `width` et `height` sont > 0
- La position ne dépasse pas les limites de la page

## 📊 Résultat Attendu

### Si Tout Fonctionne ✅

**Logs** :
```
🔍 Début de la section signature du loueur
📋 contract_template exists: true
📋 contract_template keys: ['landlord_name', 'landlord_email', 'landlord_signature', ...]
🖊️ landlordSignature exists: true
🖊️ landlordSignature type: string
🖊️ landlordSignature length: 15243
🖊️ landlordSignature preview: data:image/png;base64,iVBORw0KGgoAAAANSUhE...
✅ Signature trouvée, tentative d'embedding...
✅ Format data:image/ validé
🧹 Base64 nettoyé, longueur: 15180
✅ Base64 non vide
🖼️ Tentative embedPng...
✅ Signature PNG embedded
📐 Image dimensions: { width: 500, height: 200 }
📏 Dimensions calculées: { width: 180, height: 72 }
🎨 Position signature: { x: 40, y: 150, width: 180, height: 72 }
✅✅✅ Landlord signature embedded successfully!
```

**Fiche de Police** :
- Section "Signature du loueur" visible
- Image de la signature affichée
- Position correcte en bas de page

## 🎯 Prochaines Actions

1. **Déployer** l'Edge Function mise à jour
2. **Générer** une nouvelle fiche de police
3. **Observer** les logs dans Supabase Dashboard
4. **Analyser** les messages pour identifier le problème exact
5. **Corriger** selon le scénario identifié
6. **Tester** à nouveau jusqu'à ce que `✅✅✅ Landlord signature embedded successfully!` apparaisse

## 💡 Note Importante

Les logs détaillés peuvent être **supprimés** une fois le problème résolu pour éviter de polluer les logs en production. Pour cela, il suffira de supprimer ou commenter les lignes `console.log()` ajoutées.

## 📞 Support

Si le problème persiste après ces étapes :
1. Copier les logs complets
2. Vérifier que `contract_template` et `landlord_signature` existent bien en BDD
3. Vérifier que le format de la signature est `data:image/png;base64,...`
4. Essayer de réuploader une nouvelle signature
