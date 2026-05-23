# 🔍 Analyse : Signature du loueur manquante dans les fiches de police

## 📋 Problème Identifié

La signature du loueur n'apparaît pas sur les fiches de police générées, alors que le code de l'Edge Function `generate-police-forms` est prévu pour l'afficher.

## 🎯 Localisation du Code

**Fichier** : `supabase/functions/generate-police-forms/index.ts`

**Lignes concernées** : 410-493

### Code de Gestion de la Signature

```typescript
// Try to add landlord signature image if available
try {
  const contractTemplate = property.contract_template || {};
  const landlordSignature = contractTemplate.landlord_signature;
  if (landlordSignature && landlordSignature.trim()) {
    try {
      // Vérifier que c'est une data URL valide
      if (!landlordSignature.startsWith('data:image/')) {
        throw new Error('Invalid signature format');
      }
      
      const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
      
      // Vérifier que le base64 est valide
      if (!clean || clean.length === 0) {
        throw new Error('Empty base64 data');
      }
      
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
      const maxWidth = Math.min(180, availableWidth * 0.8);
      const maxHeight = 60;
      
      // ... code de dimensionnement et placement ...
      
      page.drawImage(img, {
        x: signatureX,
        y: yPosition - finalHeight - 10,
        width: finalWidth,
        height: finalHeight
      });
      console.log('✅ Landlord signature embedded');
    } catch (signatureError) {
      console.warn('⚠️ Skipped landlord signature (invalid format):', signatureError.message);
    }
  } else {
    console.log('ℹ️ No landlord signature');
  }
} catch (e) {
  console.warn('⚠️ Signature section error:', e.message);
}
```

## 🔎 Points de Vérification

### 1. Structure de Données
La signature est cherchée dans : `property.contract_template.landlord_signature`

**Chemin d'accès** :
```typescript
const contractTemplate = property.contract_template || {};
const landlordSignature = contractTemplate.landlord_signature;
```

### 2. Requête SQL (ligne 201-207)
```typescript
const { data: dbBooking, error: bookingError } = await client
  .from('bookings')
  .select(`
    *,
    property:properties(*),
    guests(*)
  `)
  .eq('id', bookingId)
  .single();
```

✅ La requête récupère bien `properties(*)` qui devrait inclure `contract_template`

### 3. Validations de la Signature

Le code vérifie :
- ✅ Que `landlordSignature` existe et n'est pas vide
- ✅ Que c'est une data URL (`data:image/...`)
- ✅ Que le base64 n'est pas vide après nettoyage
- ✅ Que l'image est PNG ou JPEG

### 4. Logs de Diagnostic

Le code produit ces logs :
- `✅ Landlord signature embedded` : Signature ajoutée avec succès
- `⚠️ Skipped landlord signature (invalid format): ...` : Format invalide
- `ℹ️ No landlord signature` : Aucune signature trouvée
- `⚠️ Signature section error: ...` : Erreur générale

## 🛠️ Diagnostic à Effectuer

### Étape 1 : Vérifier la Base de Données

Exécuter `VERIFICATION_SIGNATURES_LOUEUR.sql` pour :

1. ✅ Vérifier que les propriétés ont bien un `contract_template`
2. ✅ Vérifier que `landlord_signature` existe dans ce template
3. ✅ Vérifier le format de la signature (data URL valide)
4. ✅ Vérifier la longueur (non vide)

### Étape 2 : Vérifier les Logs de l'Edge Function

Observer les logs lors de la génération d'une fiche de police :

```bash
# Dans Supabase Dashboard > Edge Functions > Logs
# Rechercher : "generate-police-forms"
# Observer les messages liés à la signature
```

### Étape 3 : Test Manuel

Tester la génération de fiche pour une réservation spécifique :

```typescript
// Dans la console Supabase ou un client
const { data, error } = await supabase.functions.invoke('generate-police-forms', {
  body: { bookingId: 'VOTRE_BOOKING_ID' }
});

console.log('Result:', data);
console.log('Error:', error);
```

## 🔧 Solutions Potentielles

### Solution 1 : Signature Manquante en BDD

**Problème** : `contract_template.landlord_signature` est `NULL` ou vide

**Solution** :
1. Aller dans "Ajouter un bien" ou "Modifier le bien"
2. Onglet "Configuration" → "Signature / cachet"
3. Signer ou uploader une signature
4. Sauvegarder

### Solution 2 : Format Invalide

**Problème** : La signature n'est pas au format `data:image/...;base64,...`

**Solution** :
```sql
-- Vérifier le format
SELECT 
    name,
    LEFT(contract_template->>'landlord_signature', 50) as signature_start
FROM properties
WHERE contract_template-&gt;&gt;'landlord_signature' IS NOT NULL;

-- Si format incorrect, réuploader
```

### Solution 3 : Problème de Récupération

**Problème** : Les données `properties(*)` ne récupèrent pas `contract_template`

**Solution** : Modifier la requête pour être explicite :
```typescript
.select(`
  *,
  property:properties(
    id,
    name,
    address,
    contract_template
  ),
  guests(*)
`)
```

### Solution 4 : Logs Silencieux

**Problème** : Les erreurs sont interceptées sans être propagées

**Solution** : Activer les logs dans Supabase Dashboard et surveiller :
- `console.log('✅ Landlord signature embedded')`
- `console.warn('⚠️ Skipped landlord signature...')`
- `console.log('ℹ️ No landlord signature')`

## 📊 Résultat Attendu

Une fois la signature correctement configurée :

1. **Dans la BDD** :
   ```json
   {
     "contract_template": {
       "landlord_signature": "data:image/png;base64,iVBORw0KGgo...",
       "landlord_name": "Mohammed Alaoui",
       "landlord_email": "...",
       ...
     }
   }
   ```

2. **Dans la Fiche de Police** :
   - Section "Signature du loueur" avec l'image de la signature
   - Positionnée à gauche, sous la date
   - Dimensions max : 180x60px

3. **Dans les Logs** :
   ```
   ✅ Landlord signature embedded
   ```

## 🎯 Action Immédiate

1. **Exécuter** `VERIFICATION_SIGNATURES_LOUEUR.sql`
2. **Observer** les résultats :
   - Si `❌ landlord_signature manquante` → Aller ajouter la signature
   - Si `⚠️ landlord_signature vide` → Réuploader la signature
   - Si `✅ Signature présente` → Vérifier les logs de l'Edge Function
3. **Tester** la génération d'une nouvelle fiche de police
4. **Vérifier** visuellement si la signature apparaît

## 📝 Notes Importantes

- La signature doit être au format **data URL** (base64)
- Formats acceptés : **PNG** ou **JPEG**
- Taille recommandée : **180x60px maximum**
- Le code gère automatiquement le redimensionnement si trop grande
- Les erreurs sont loggées mais n'empêchent pas la génération du PDF
