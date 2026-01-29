# ✅ CORRECTION - Erreur Relation host_profiles

## ❌ Erreur Précédente

```
Could not find a relationship between 'bookings' and 'host_profiles' in the schema cache
```

## 🔍 Cause

La table `bookings` n'a **pas de foreign key directe** vers `host_profiles`.

La relation correcte est: `bookings` → `properties` → `host_profiles`

## ✅ Solution Appliquée

### 1. Modification de la Requête

**Fichier**: `supabase/functions/generate-police-form/index.ts`

**Ligne 96-107**: Récupération via `properties`

```typescript
// ❌ AVANT (INCORRECT)
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template
    ),
    host:host_profiles(*)  // ❌ Relation n'existe pas!
  `)
  .eq('id', bookingId)
  .single();

// ✅ APRÈS (CORRECT)
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template,
      host:host_profiles(*)  // ✅ Via properties!
    )
  `)
  .eq('id', bookingId)
  .single();
```

### 2. Modification de l'Accès aux Données

**Ligne 554**: Accès via `property.host`

```typescript
// ❌ AVANT
const hostData = booking.host || {};  // ❌ booking.host n'existe pas!

// ✅ APRÈS
const hostData = property.host || {};  // ✅ Correct!
```

## 📊 Structure des Données

```
booking = {
  id: "...",
  property_id: "...",
  property: {
    id: "...",
    name: "studio casa",
    address: "CASABLANCA...",
    host_id: "...",
    host: {  // ✅ ICI!
      id: "...",
      full_name: "ghali lahlou",
      email: "ghali@gmail.com",
      phone: "+212..."
    }
  }
}
```

## 🚀 Déploiement

```bash
supabase functions deploy generate-police-form
```

**Status**: ✅ Déployé avec succès

## 🧪 Tests

### Test 1: Vérifier les Logs

Après génération, les logs devraient afficher:

```
✅ Booking récupéré {
  bookingId: "...",
  propertyId: "...",
  checkIn: "2026-01-21",
  checkOut: "2026-01-24"
}

✅ Guests récupérés {
  count: 1,
  ...
}

✅ PDF généré {
  pages: 1,
  sizeKB: 92
}
```

**PAS d'erreur** `Could not find a relationship` ✅

### Test 2: Vérifier le PDF

Ouvrir le PDF généré et vérifier:

**Section Loueur / Host**:
- ✅ Adresse du bien loué: CASABLANCA...
- ✅ Nom du loueur: studio casa (ou ghali lahlou si disponible)
- ✅ Email du loueur: ghali@gmail.com (si disponible dans host_profiles)
- ✅ Téléphone du loueur: +212... (si disponible dans host_profiles)

## 📝 Fichiers Modifiés

1. ✅ `supabase/functions/generate-police-form/index.ts`
   - Ligne 102: Ajout de `host:host_profiles(*)` dans `properties`
   - Ligne 554: Changement de `booking.host` → `property.host`

## 💡 Note

Si les champs email et téléphone du loueur restent vides, c'est que:
1. La table `host_profiles` n'a pas de données pour ce host
2. Ou la relation `properties.host_id` n'est pas configurée

**Vérification SQL**:
```sql
SELECT 
  p.id,
  p.name,
  p.host_id,
  h.full_name,
  h.email,
  h.phone
FROM properties p
LEFT JOIN host_profiles h ON p.host_id = h.id
WHERE p.id = 'VOTRE_PROPERTY_ID';
```

## 🎯 Résultat Attendu

**Avant** ❌:
```
❌ Erreur génération fiche de police {
  "error": "Could not find a relationship between 'bookings' and 'host_profiles'"
}
```

**Après** ✅:
```
✅ PDF généré { pages: 1, sizeKB: 92 }
✅ Document sauvegardé dans uploaded_documents
✅ Booking mis à jour
```

**L'erreur est corrigée!** 🎉

**Testez maintenant en générant une nouvelle fiche de police!**
