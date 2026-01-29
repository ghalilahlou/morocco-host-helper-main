# 🔍 ANALYSE - Champs Manquants dans la Fiche de Police

## 📊 État Actuel (d'après l'image)

### Section Locataire / Tenant

| Champ | Valeur Actuelle | Status | Variable dans le Code |
|-------|----------------|--------|----------------------|
| Nom / Last name | TEMSAMANI | ✅ | `lastName` |
| Prénom / First name | MOUHCINE | ✅ | `firstName` |
| Date de naissance | 29/11/1978 | ✅ | `guest.date_of_birth` |
| Lieu de naissance | **VIDE** | ❌ | `guest.place_of_birth` (ligne 463) |
| Nationalité | MAROCAIN | ✅ | `guest.nationality` |
| Type de document | PASSEPORT | ⚠️ | `guest.document_type` (ligne 466) |
| Numéro du document | **VIDE** | ❌ | `guest.document_number` (ligne 468) |
| Date de délivrance | **VIDE** | ❌ | Hardcodé `''` (ligne 469) |
| Date d'entrée au Maroc | **VIDE** | ❌ | Hardcodé `''` (ligne 470) |
| Profession | Etudiant | ✅ | `guest.profession` |
| Adresse | **VIDE** | ❌ | `guest.adresse_personnelle` (ligne 472) |
| Email | ghali@gmail.com | ✅ | `guest.email` |
| Téléphone | **VIDE** | ❌ | `guest.phone` (ligne 474) |

### Section Séjour / Stay

| Champ | Valeur Actuelle | Status | Variable dans le Code |
|-------|----------------|--------|----------------------|
| Date d'arrivée | 21/01/2026 | ✅ | `booking.check_in_date` |
| Date de départ | 24/01/2026 | ✅ | `booking.check_out_date` |
| Motif du séjour | TOURISME | ✅ | `guest.motif_sejour` |
| Nombre de mineurs | 0 | ✅ | Hardcodé `'0'` |
| Lieu de provenance | **VIDE** | ❌ | Hardcodé `''` (ligne 507) |
| Destination | CASABLANCA... | ✅ | `property.city || property.address` |

### Section Loueur / Host

| Champ | Valeur Actuelle | Status | Variable dans le Code |
|-------|----------------|--------|----------------------|
| Adresse du bien loué | CASABLANCA... | ✅ | `property.address` |
| Nom du loueur | studio casa | ✅ | `hostData.full_name || property.name` |
| Email du loueur | **VIDE** | ❌ | `hostData.email` (ligne 542) |
| Téléphone du loueur | **VIDE** | ❌ | `hostData.phone` (ligne 543) |

## 🔍 Diagnostic

### Problème 1: `guest_data` Structure

Les données manquantes suggèrent que `guest_data` ne contient pas toutes les clés attendues.

**Vérification SQL**:
```sql
SELECT 
  guest_data->>'place_of_birth' as place_of_birth,
  guest_data->>'document_number' as document_number,
  guest_data->>'adresse_personnelle' as adresse_personnelle,
  guest_data->>'phone' as phone
FROM guest_submissions
WHERE booking_id = '29195738-087e-4903-a39b-b301e0b80fb8';
```

### Problème 2: `booking.host` Non Récupéré

**Code actuel** (ligne 534):
```typescript
const hostData = booking.host || {};
```

Mais `booking.host` n'est probablement pas récupéré dans la requête!

**Requête actuelle** (ligne 96-106):
```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template
    )
  `)
  .eq('id', bookingId)
  .single();
```

❌ **Manque**: `host:host_profiles(*)`

### Problème 3: Champs Hardcodés Vides

- **Date de délivrance** (ligne 469): `''`
- **Date d'entrée au Maroc** (ligne 470): `''`
- **Lieu de provenance** (ligne 507): `''`

## ✅ Solutions

### Solution 1: Récupérer `host_profiles`

**Modifier la requête** (ligne 96-106):

```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template
    ),
    host:host_profiles(*)  // ✅ AJOUTER
  `)
  .eq('id', bookingId)
  .single();
```

### Solution 2: Ajouter Plus de Clés pour `guest_data`

**Mapping actuel** (ligne 139-175) manque peut-être certaines clés.

**Ajouter**:
```typescript
// Lieu de naissance - PLUS DE VARIANTES
place_of_birth: guestData.place_of_birth || guestData.placeOfBirth || 
                guestData.birth_place || guestData.birthPlace ||
                guestData.lieu_naissance || guestData.lieuNaissance || '',

// Numéro de document - PLUS DE VARIANTES
document_number: guestData.document_number || guestData.documentNumber || 
                guestData.id_number || guestData.idNumber ||
                guestData.numero_document || guestData.numeroDocument ||
                guestData.passport_number || guestData.passportNumber || '',

// Adresse - PLUS DE VARIANTES
adresse_personnelle: guestData.adresse_personnelle || guestData.adressePersonnelle || 
                    guestData.home_address || guestData.homeAddress ||
                    guestData.address || guestData.adresse || '',

// Téléphone - PLUS DE VARIANTES
phone: guestData.phone || guestData.telephone || guestData.phone_number || 
       guestData.phoneNumber || guestData.tel || guestData.mobile || ''
```

### Solution 3: Ajouter des Champs Calculés

**Date d'entrée au Maroc** (ligne 470):
```typescript
// ✅ Utiliser la date d'arrivée comme date d'entrée
const entryDate = formatDate(booking.check_in_date);
yPosition = drawBilingualField(page, 'Date d\\'entrée au Maroc / Date of entry in Morocco', 'تاريخ الدخول إلى المغرب', entryDate, margin, yPosition);
```

**Lieu de provenance** (ligne 507):
```typescript
// ✅ Utiliser la nationalité ou une valeur par défaut
const placeOfProvenance = guest.nationality === 'MAROCAIN' ? 'Maroc' : guest.nationality || '';
yPosition = drawBilingualField(page, 'Lieu de provenance / Place of provenance', 'مكان القدوم', placeOfProvenance, margin, yPosition);
```

### Solution 4: Ajouter des Logs de Diagnostic

**Après la ligne 190**:
```typescript
log('info', '🔍 Données guest complètes', {
  full_name: guests[0]?.full_name,
  place_of_birth: guests[0]?.place_of_birth,
  document_number: guests[0]?.document_number,
  adresse_personnelle: guests[0]?.adresse_personnelle,
  phone: guests[0]?.phone,
  email: guests[0]?.email,
  nationality: guests[0]?.nationality,
  profession: guests[0]?.profession
});
```

**Après la ligne 534**:
```typescript
log('info', '🔍 Données host', {
  hostData,
  hostName,
  hostEmail,
  hostPhone,
  propertyName: property.name,
  propertyAddress: property.address
});
```

## 📋 Checklist des Modifications

- [ ] Ajouter `host:host_profiles(*)` dans la requête booking
- [ ] Ajouter plus de variantes de clés dans le mapping `guest_data`
- [ ] Utiliser `check_in_date` pour "Date d'entrée au Maroc"
- [ ] Calculer "Lieu de provenance" depuis la nationalité
- [ ] Ajouter des logs de diagnostic
- [ ] Tester et vérifier les données dans les logs

## 🧪 Tests

1. **Déployer** l'Edge Function modifiée
2. **Générer** une nouvelle fiche de police
3. **Observer les logs** Supabase pour voir les données récupérées
4. **Vérifier le PDF** généré

## 🎯 Résultat Attendu

Tous les champs de la fiche de police doivent être remplis avec les vraies données!
