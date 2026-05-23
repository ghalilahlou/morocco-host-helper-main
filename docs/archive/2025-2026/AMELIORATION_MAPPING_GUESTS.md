# ✅ AMÉLIORATION - Mapping Complet des Données Guests

## 🎯 Problème

Les champs "Nom / Last name" et "Prénom / First name" étaient vides dans la fiche de police générée, ainsi que d'autres champs potentiellement manquants.

## 🔍 Cause

Les données des guests peuvent être stockées dans différentes structures selon:
- La version de l'application utilisée
- La source des données (OCR, saisie manuelle, import)
- Les différentes clés utilisées (`full_name` vs `fullName`, `date_of_birth` vs `dateOfBirth`, etc.)

## ✅ Solution Appliquée

### 1. Mapping Complet des Données

**Fichier**: `supabase/functions/generate-police-form/index.ts` (ligne 125)

**Changement**: Récupération de `guest_data` ET `extracted_data`

```typescript
const { data: submissions, error: submissionsError } = await supabase
  .from('guest_submissions')
  .select('guest_data, extracted_data')  // ✅ AJOUTÉ: extracted_data
  .eq('booking_id', bookingId);
```

### 2. Fusion des Données de Différentes Sources

**Ligne 133**: Mapping intelligent avec support de multiples formats

```typescript
const guests = submissions?.map(s => {
  const guestData = s.guest_data || {};
  const extractedData = s.extracted_data || {};
  
  return {
    // ✅ Nom complet - essayer différentes clés
    full_name: guestData.full_name || guestData.fullName || guestData.name || 
               extractedData.full_name || extractedData.fullName || extractedData.name || '',
    
    // ✅ Nom et prénom séparés (si disponibles)
    first_name: guestData.first_name || guestData.firstName || 
                extractedData.first_name || extractedData.firstName || '',
    last_name: guestData.last_name || guestData.lastName || 
               extractedData.last_name || extractedData.lastName || '',
    
    // ✅ Email
    email: guestData.email || extractedData.email || '',
    
    // ✅ Téléphone
    phone: guestData.phone || guestData.telephone || guestData.phone_number || 
           extractedData.phone || extractedData.telephone || '',
    
    // ✅ Nationalité
    nationality: guestData.nationality || guestData.nationalite || 
                 extractedData.nationality || extractedData.nationalite || '',
    
    // ✅ Document
    document_type: guestData.document_type || guestData.documentType || guestData.id_type ||
                   extractedData.document_type || extractedData.documentType || 'passport',
    document_number: guestData.document_number || guestData.documentNumber || guestData.id_number ||
                    extractedData.document_number || extractedData.documentNumber || '',
    
    // ✅ Date de naissance
    date_of_birth: guestData.date_of_birth || guestData.dateOfBirth || guestData.birth_date ||
                   extractedData.date_of_birth || extractedData.dateOfBirth || '',
    
    // ✅ Lieu de naissance
    place_of_birth: guestData.place_of_birth || guestData.placeOfBirth || guestData.birth_place ||
                    extractedData.place_of_birth || extractedData.placeOfBirth || '',
    
    // ✅ Profession
    profession: guestData.profession || guestData.occupation || 
                extractedData.profession || extractedData.occupation || '',
    
    // ✅ Motif du séjour
    motif_sejour: guestData.motif_sejour || guestData.motifSejour || guestData.purpose ||
                  extractedData.motif_sejour || 'TOURISME',
    
    // ✅ Adresse personnelle
    adresse_personnelle: guestData.adresse_personnelle || guestData.adressePersonnelle || 
                        guestData.home_address || guestData.address ||
                        extractedData.adresse_personnelle || extractedData.address || ''
  };
}) || [];
```

### 3. Amélioration Séparation Nom/Prénom

**Ligne 432**: Utiliser `first_name` et `last_name` s'ils existent

```typescript
if (guest.first_name || guest.last_name) {
  // ✅ Si on a déjà first_name et last_name séparés, les utiliser directement
  firstName = guest.first_name || '';
  lastName = guest.last_name || '';
} else if (fullName) {
  // ✅ Sinon, diviser le full_name
  const nameParts = fullName.trim().split(' ');
  
  if (nameParts.length === 1) {
    lastName = nameParts[0];
  } else if (nameParts.length === 2) {
    firstName = nameParts[0];
    lastName = nameParts[1];
  } else if (nameParts.length > 2) {
    lastName = nameParts[nameParts.length - 1];
    firstName = nameParts.slice(0, -1).join(' ');
  }
}
```

## 📊 Clés Supportées

### Nom Complet
- `full_name` ✅
- `fullName` ✅
- `name` ✅

### Nom et Prénom Séparés
- `first_name` / `last_name` ✅
- `firstName` / `lastName` ✅

### Email
- `email` ✅

### Téléphone
- `phone` ✅
- `telephone` ✅
- `phone_number` ✅

### Nationalité
- `nationality` ✅
- `nationalite` ✅

### Document
- `document_type` / `documentType` / `id_type` ✅
- `document_number` / `documentNumber` / `id_number` ✅

### Date de Naissance
- `date_of_birth` ✅
- `dateOfBirth` ✅
- `birth_date` ✅

### Lieu de Naissance
- `place_of_birth` ✅
- `placeOfBirth` ✅
- `birth_place` ✅

### Profession
- `profession` ✅
- `occupation` ✅

### Motif du Séjour
- `motif_sejour` ✅
- `motifSejour` ✅
- `purpose` ✅
- Défaut: `'TOURISME'` ✅

### Adresse Personnelle
- `adresse_personnelle` ✅
- `adressePersonnelle` ✅
- `home_address` ✅
- `address` ✅

## 🧪 Tests

### Test 1: Vérifier les Logs

Après déploiement, générer une fiche de police et observer les logs:

```
✅ Guests récupérés {
  count: 2,
  firstGuestFullName: "ghali lahlou",
  firstGuestEmail: "ghalilahlou@gmail.com",
  firstGuestPhone: "+212...",
  firstGuestNationality: "MAROCAIN",
  allGuestsData: [...]
}

🔍 Traitement du nom du guest {
  fullName: "ghali lahlou",
  fullNameLength: 12,
  hasFirstName: false,
  hasLastName: false,
  firstName: undefined,
  lastName: undefined
}

✅ Nom séparé {
  firstName: "ghali",
  lastName: "lahlou"
}
```

### Test 2: Vérifier le PDF

Ouvrir la fiche de police générée et vérifier que tous les champs sont remplis:

**Section Locataire / Tenant**:
- ✅ Nom / Last name: `lahlou`
- ✅ Prénom / First name: `ghali`
- ✅ Email: `ghalilahlou@gmail.com`
- ✅ Téléphone: `+212...`
- ✅ Nationalité: `MAROCAIN`
- ✅ Type de document: `CNI / ID CARD`
- ✅ Profession: `Etudiant`
- ✅ Etc.

## 🚀 Déploiement

```bash
supabase functions deploy generate-police-form
```

## 📝 Résumé des Modifications

1. ✅ **Ligne 127**: Ajout de `extracted_data` dans la requête
2. ✅ **Ligne 133-186**: Mapping complet avec support de multiples formats
3. ✅ **Ligne 432-463**: Amélioration de la logique nom/prénom
4. ✅ **Logs détaillés**: Pour diagnostic

## 💡 Avantages

1. **Compatibilité**: Support de différentes versions de données
2. **Robustesse**: Fallback sur plusieurs clés possibles
3. **Flexibilité**: Fonctionne avec OCR, saisie manuelle, import
4. **Diagnostic**: Logs détaillés pour identifier les problèmes
5. **Maintenabilité**: Code clair et bien documenté

## 🎯 Résultat Attendu

**Avant** ❌:
```
Nom / Last name: _____________
Prénom / First name: _____________
```

**Après** ✅:
```
Nom / Last name: lahlou
Prénom / First name: ghali
```

Tous les autres champs devraient également être remplis correctement!
