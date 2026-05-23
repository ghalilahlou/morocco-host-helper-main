# 🔧 Diagnostic Complet - Problèmes de Signature

## 📋 Problèmes Identifiés

### **Problème 1** : Signature dans ContractSigning ne fonctionne pas
- Le canvas ne réagit pas aux clics de souris
- Le style n'a pas changé malgré les modifications

### **Problème 2** : Signature du loueur manquante dans le PDF de police
- La section "Signature du loueur" est vide dans les fiches générées
- Le code d'embedding existe mais la signature n'apparaît pas

---

## 🎯 DIAGNOSTIC PROBLÈME 1 : Canvas Signature

### Cause Probable
Les modifications CSS peuvent avoir cassé le canvas. Le problème est probablement lié à la hauteur du canvas qui a été modifiée.

### Vérifications à Faire

1. **Ouvrez la console du navigateur** (F12)
2. **Rafraîchissez** la page de signature
3. **Cherchez** des erreurs JavaScript

### Actions Correctives

#### ✅ **Action 1** : Vérifier le canvas
Regarder dans la console si des erreurs comme :
- `Cannot get context of canvas`
- `Canvas is null`
- `getContext returned null`

#### ✅ **Action 2** : Hard Refresh
Parfois les modifications CSS ne sont pas appliquées :
- **Windows** : `Ctrl + Shift + R`
- **Mac** : `Cmd + Shift + R`

#### ✅ **Action 3** : Vérifier le canvas dans le DOM
1. F12 → Elements
2. Chercher l'élément `<canvas>`
3. Vérifier :
   - `width="565"`
   - `height="172"`
   - La classe CSS appliquée

---

## 🎯 DIAGNOSTIC PROBLÈME 2 : Signature Loueur dans Police

### État Actuel

Le code **EXISTE DÉJÀ** et est **COMPLET** dans :
- `supabase/functions/submit-guest-info-unified/index.ts`
- Fonction : `generatePoliceFormsPDF` (ligne ~5009)

### Code d'Embedding (Existant)

**Récupération** (ligne ~5449) :
\`\`\`typescript
const contractTemplate = property.contract_template || {};
let hostSignature = contractTemplate.landlord_signature;
\`\`\`

**Embedding** (lignes ~5471-5596) :
- ✅ Validation du format (data:image/...)
- ✅ Tentative PNG puis JPEG
- ✅ Redimensionnement intelligent
- ✅ Positionnement correct
- ✅ Gestion d'erreur complète

### 🔍 Étapes de Diagnostic

#### **Étape 1 : Vérifier la Base de Données**

Exécutez le script SQL `VERIFICATION_SIGNATURES_LOUEUR.sql` dans Supabase SQL Editor :

```sql
-- Script 1 : Vue d'ensemble
SELECT 
    id,
    name,
    CASE 
        WHEN contract_template IS NULL THEN '❌ contract_template est NULL'
        WHEN contract_template->'landlord_signature' IS NULL THEN '❌ landlord_signature manquante'
        WHEN contract_template->>'landlord_signature' = '' THEN '⚠️ landlord_signature vide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/%' THEN '✅ Signature présente (data URL valide)'
        ELSE '⚠️ Format inconnu'
    END as signature_status,
    LENGTH(contract_template->>'landlord_signature') as signature_length
FROM properties
ORDER BY name;
```

#### **Résultats Attendus**

| Résultat | Signification | Action |
|----------|---------------|--------|
| `❌ contract_template est NULL` | Le template de contrat n'existe pas | Recréer le bien et signer |
| `❌ landlord_signature manquante` | La signature n'a jamais été ajoutée | Ajouter la signature (voir ci-dessous) |
| `⚠️ landlord_signature vide` | La signature a été supprimée ou corrompue | Réuploader la signature |
| `✅ Signature présente` | La signature est en BDD ✅ | Vérifier l'Edge Function |

#### **Étape 2 : Si Signature Manquante - Comment l'Ajouter**

1. **Interface Web** :
   - Aller dans "Ajouter un bien" ou "Modifier le bien"
   - Onglet "Configuration"
   - Section "Signature / cachet"
   - Utiliser le canvas de signature **OU** uploader une image
   - **Sauvegarder**

2. **Vérifier l'Enregistrement** :
\`\`\`sql
SELECT 
    name,
    LEFT(contract_template->>'landlord_signature', 50) as signature_preview,
    LENGTH(contract_template->>'landlord_signature') as signature_length
FROM properties
WHERE name = 'studio casa'; -- Remplacer par le nom de votre bien
\`\`\`

#### **Étape 3 : Vérifier les Logs de l'Edge Function**

1. **Aller dans** Supabase Dashboard → Edge Functions → Logs
2. **Générer** une nouvelle fiche de police
3. **Chercher** dans les logs :

```
[Police] 🔍 Données propriété COMPLÈTES
```

**Logs à observer** :
- `hasContractTemplate: true/false`
- `hasLandlordSignature: true/false`
- `landlordSignatureLength: XXXX`
- `landlordSignaturePreview: data:image/...`

#### **Cas Possibles**

##### ✅ **Cas 1 : Signature Présente**
```
hasLandlordSignature: true
landlordSignatureLength: 15243
landlordSignaturePreview: data:image/png;base64,iVBORw0KGgo...
```
→ La signature **devrait apparaître** dans le PDF

**Si elle n'apparaît toujours pas**, chercher :
- `[Police] Embedding host signature in police form...`
- `✅ Host signature embedded in police form successfully`
- **OU** erreurs : `⚠️ Failed to embed host signature`

##### ❌ **Cas 2 : Signature Manquante**
```
hasLandlordSignature: false
landlordSignatureLength: 0
landlordSignaturePreview: none
```
→ **Problème de BDD** ! Voir Étape 2.

##### ⚠️ **Cas 3 : contract_template Manquant**
```
hasContractTemplate: false
```
→ La requête ne récupère pas le `contract_template`

**Solution** : Modifier explicitement la requête (normalement déjà corrigé).

---

## 🚀 Plan d'Action Immédiat

### **Pour le Canvas de Signature (Problème 1)**

1. **Hard Refresh** : `Ctrl + Shift + R`
2. **Console** : F12 → Chercher erreurs
3. **Test** : Essayer de dessiner sur le canvas
4. **Screenshot** : Si ça ne marche toujours pas, envoyer screenshot de la console

### **Pour la Signature Loueur dans Police (Problème 2)**

1. ✅ **Exécuter** `VERIFICATION_SIGNATURES_LOUEUR.sql`
2. ✅ **Observer** le résultat :
   - Si `❌ contract_template est NULL` → Recréer
   - Si `❌ landlord_signature manquante` → Ajouter (Étape 2)
   - Si `⚠️ landlord_signature vide` → Réuploader
   - Si `✅ Signature présente` → Passer à l'étape 3

3. ✅ **Générer** une nouvelle fiche de police

4. ✅ **Vérifier** les logs :
   - Supabase Dashboard → Edge Functions → Logs
   - Chercher `[Police] 🔍 Données propriété COMPLÈTES`
   - Observer les valeurs

5. ✅ **Partager** les résultats :
   - Le résultat de la requête SQL
   - Les logs de l'Edge Function
   - Le PDF généré (si possible)

---

## 📊 Checklist de Vérification

### Signature dans BDD
- [ ] `contract_template` existe (`IS NOT NULL`)
- [ ] `landlord_signature` existe (`IS NOT NULL`)
- [ ] `landlord_signature` n'est pas vide (`!= ''`)
- [ ] Format valide (`LIKE 'data:image/%'`)
- [ ] Longueur > 0 (`LENGTH > 0`)

### Logs Edge Function
- [ ] `hasContractTemplate: true`
- [ ] `hasLandlordSignature: true`
- [ ] `landlordSignatureLength > 0`
- [ ] `landlordSignaturePreview: data:image/...`

### PDF Généré
- [ ] Section "Signature du loueur" présente
- [ ] Image de signature visible
- [ ] Pas d'erreur dans les logs

---

## 💡 Notes Importantes

### Format de Signature Valide
- **Type** : Data URL (base64)
- **Formats acceptés** : PNG ou JPEG
- **Exemple** :
  ```
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
  ```

### Taille Recommandée
- **Max width** : 180px
- **Max height** : 60px
- Le code gère automatiquement le redimensionnement

### Logs à Surveiller
- `✅ Landlord signature embedded` : **Succès**
- `⚠️ Skipped landlord signature (invalid format)` : **Format invalide**
- `ℹ️ No landlord signature` : **Signature manquante**
- `⚠️ Signature section error` : **Erreur générale**

---

## 📞 Prochaines Étapes

1. **Exécutez** le script SQL de vérification
2. **Partagez** les résultats (copier/coller la table de résultats)
3. **Générez** une nouvelle fiche de police
4. **Observez** les logs
5. **Partagez** :
   - Les logs de l'Edge Function
   - Le résultat SQL
   - Un screenshot du PDF généré

Avec ces informations, nous saurons **EXACTEMENT** où est le problème ! 🎯
