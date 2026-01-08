# 🎯 SOLUTION TROUVÉE : Problème de Récupération `contract_template`

## 📋 Comparaison Contrat vs Police

### ✅ Ce qui FONCTIONNE (Contrat)

**Fichier** : `submit-guest-info-unified/index.ts`  
**Fonction** : `buildContractContext` (ligne 3757)

```typescript
const { data: b, error } = await client
  .from('bookings')
  .select(`
    *,
    property:properties(*),    // ✅ RÉCUPÈRE TOUT
    guests(*) 
  `)
  .eq('id', bookingId)
  .maybeSingle();

// Ligne 3832-3838
const contract_template = prop.contract_template ?? {};
const contractTemplate = prop.contract_template || {};

// Ligne 3849 - LOG
hasLandlordSignature: !!(contractTemplate as any)?.landlord_signature
```

### ⚠️ Ce qui EST IDENTIQUE (Police)

**Fichier** : `submit-guest-info-unified/index.ts`  
**Fonction** : `generatePoliceFormsInternal` (ligne 1639)

```typescript
const { data: booking, error } = await supabaseClient
  .from('bookings')
  .select(`
    *,
    property:properties(*),    // ✅ RÉCUPÈRE TOUT (IDENTIQUE)
    guests(*)
  `)
  .eq('id', bookingId)
  .single();
```

**Ensuite** (ligne 1909) :
```typescript
const policeUrl = await generatePoliceFormsPDF(supabaseClient, booking);
```

**Dans generatePoliceFormsPDF** (ligne 5035-5055) :
```typescript
const guests = booking.guests || [];
let property = booking.property || {};

// ✅ FALLBACK : Si contract_template manquant, le récupérer
if (!property.contract_template && property.id) {
  const { data: propertyData } = await client
    .from('properties')
    .select('contract_template')
    .eq('id', property.id)
    .single();
  property.contract_template = propertyData.contract_template;
}

// Ligne 5480
const contractTemplate = property.contract_template || {};
let hostSignature = contractTemplate.landlord_signature;
```

---

## 🔍 DIAGNOSTIC : Pourquoi `contract_template` Pourrait Manquer

### **Hypothèse 1** : Colonne JSONB Non Sélectionnée par `*`

Postgres peut ne **PAS** inclure automatiquement les colonnes JSONB complexes avec `properties(*)`.

**Test** : Modifier la requête pour être **EXPLICITE** :

```typescript
.select(`
  *,
  property:properties(
    id,
    name,
    address,
    city,
    postal_code,
    country,
    property_type,
    max_occupancy,
    description,
    photo_url,
    house_rules,
    contact_info,
    contract_template,    // ✅ EXPLICITE
    owner_identity,
    user_id,
    is_active,
    created_at,
    updated_at
  ),
  guests(*)
`)
```

---

### **Hypothèse 2** : RLS (Row Level Security) Bloque l'Accès

Les politiques RLS de Supabase peuvent bloquer l'accès à `contract_template` selon l'utilisateur.

**Test** : Vérifier les politiques RLS sur la table `properties` :

```sql
-- Dans Supabase SQL Editor
SELECT * FROM pg_policies
WHERE tablename = 'properties';
```

**Solution** : Utiliser le client service_role au lieu du client auth :

```typescript
const supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // ✅ SERVICE ROLE
  { auth: { persistSession: false } }
);
```

---

### **Hypothèse 3** : JSONB `contract_template` Nul ou Vide

La colonne existe mais est `NULL` ou `{}` dans la BDD.

**Test** : Exécutez ce SQL :

```sql
SELECT 
    id,
    name,
    contract_template IS NOT NULL as has_template,
    contract_template::text as template_raw,
    jsonb_typeof(contract_template) as template_type,
    contract_template->'landlord_signature' IS NOT NULL as has_sig
FROM properties;
```

**Si `has_template: false`** :  
→ Il faut ajouter `contract_template` dans la BDD

**Si `has_sig: false`** :  
→ Il faut ajouter la signature dans l'interface

---

## 🚀 SOLUTION PROPOSÉE

### **Solution 1** : Requête Explicite (RECOMMANDÉE)

Modifier `generatePoliceFormsInternal` ligne 1641-1645 :

```typescript
const { data: booking, error } = await supabase Client
  .from('bookings')
  .select(`
    *,
    property:properties(
      id,
      name,
      address,
      city,
      contact_info,
      contract_template,    // ✅ EXPLICITE
      house_rules,
      user_id
    ),
    guests(*)
  `)
  .eq('id', bookingId)
  .single();
```

**Avantages** :
- ✅ Garantit que `contract_template` est récupéré
- ✅ Plus performant (sélectionne seulement ce qui est nécessaire)
- ✅ Évite les surprises

---

### **Solution 2** : Forcer le Fallback à S'exécuter

Si la requête explicite ne résout pas le problème, **forcer** la récupération explicite en retirant la condition :

Ligne 5039 **AVANT** :
```typescript
if (!property.contract_template && property.id) {
  // Récupérer contract_template
}
```

Ligne 5039 **APRÈS** :
```typescript
// ✅ TOUJOURS récupérer contract_template pour debug
if (property.id) {
  log('info', '[Police] Force fetch contract_template for debug...');
  const { data: propertyData, error: propertyError } = await client
    .from('properties')
    .select('contract_template')
    .eq('id', property.id)
    .single();
  
  if (propertyError) {
    log('error', '[Police] ❌ Erreur récupération contract_template:', { 
      error: propertyError,
      propertyId: property.id 
    });
  } else {
    log('info', '[Police] ✅ contract_template récupéré:', {
      hasContractTemplate: !!propertyData?.contract_template,
      contractTemplateKeys: propertyData?.contract_template ? Object.keys(propertyData.contract_template) : [],
      hasLandlordSignature: !!(propertyData?.contract_template as any)?.landlord_signature
    });
    property.contract_template = propertyData.contract_template;
  }
}
```

**Avantages** :
- ✅ Garantit que le code de récupération s'exécute TOUJOURS
- ✅ Logs détaillés pour debug
- ✅ Révèle si le problème vient de la requête initiale ou de la BDD

---

## 🎯 Plan d'Action Immédiat

### **ÉTAPE 1** : Vérifier la BDD (SQL)

```sql
SELECT 
    id,
    name,
    contract_template IS NOT NULL as has_template,
    contract_template->'landlord_signature' IS NOT NULL as has_sig,
    CASE 
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/png%' THEN '✅ PNG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpeg%' THEN '✅ JPEG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/svg%' THEN '❌ SVG'
        ELSE '❌ AUTRE'
    END as format,
    LENGTH(contract_template->>'landlord_signature') as sig_length
FROM properties
ORDER BY name;
```

**Résultat Attendu** :
```
name        | has_template | has_sig | format    | sig_length
------------|--------------|---------|-----------|------------
studio casa | true         | true    | ✅ PNG    | 15243
```

**Si `has_template: false`** → Problème de BDD  
**Si `has_sig: false`** → Signature manquante  
**Si `format: ❌ SVG`** → Format non supporté

---

### **ÉTAPE 2** : Appliquer la Solution 2 (Force Fetch)

**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`  
**Ligne** : 5039

**REMPLACER** :
```typescript
if (!property.contract_template && property.id) {
```

**PAR** :
```typescript
if (property.id) {  // ✅ TOUJOURS exécuter
  log('info', '[Police] Force fetch contract_template...');
```

---

### **ÉTAPE 3** : Déployer et Tester

```bash
supabase functions deploy submit-guest-info-unified
```

---

### **ÉTAPE 4** : Observer les Logs

1. **Générer** une nouvelle fiche de police
2. **Observer** les logs Supabase Dashboard → Edge Functions
3. **Chercher** :

```
[Police] Force fetch contract_template...
[Police] ✅ contract_template récupéré:
{
  "hasContractTemplate": true,
  "hasLandlordSignature": true,
  "contractTemplateKeys": ["landlord_name", "landlord_signature", ...]
}
```

**ET**

```
[Police] Recherche signature du loueur:
{
  "hasLandlordSignature": true,
  "landlordSignaturePrefix": "data:image/png;base64,..."
}
```

**ET**

```
✅ Host signature embedded in police form successfully
```

---

## 📊 Checklist

- [ ] Script SQL exécuté
- [ ] Résultat : `has_template: true` et `has_sig: true`
- [ ] Code modifié (ligne 5039)
- [ ] Edge Function déployée
- [ ] Nouvelle fiche générée
- [ ] Logs observés
- [ ] Log `hasLandlordSignature: true` visible
- [ ] Log `✅ Host signature embedded` visible
- [ ] PDF téléchargé
- [ ] Signature visible dans le PDF

---

## 💡 Conclusion

Le problème n'est **PAS** dans la logique d'embedding (qui est complète), mais probablement dans :

1. ❌ `contract_template` **N'EST PAS** récupéré correctement depuis la BDD
2. **OU** ❌ La signature **N'EST PAS** dans `contract_template.landlord_signature`

La **Solution 2** (Force Fetch) va nous dire **EXACTEMENT** où est le problème grâce aux logs détaillés.

---

## 🎯 Résumé en 30 Secondes

1. ✅ Exécuter le script SQL
2. ✅ Modifier ligne 5039 pour forcer le fetch
3. ✅ Déployer
4. ✅ Observer les logs
5. ✅ Partager les résultats

Avec ces étapes, nous trouverons le problème ! 🚀
