# 🚨 CORRECTION DE LA DOUBLE LOGIQUE DE CRÉATION DE RÉSERVATIONS

## 📋 PROBLÈME IDENTIFIÉ

Il y a **deux logiques de création de réservations** qui s'exécutent en parallèle, créant des doublons :

### **🔴 PREMIÈRE LOGIQUE : `submit-guest-info`**
- **Déclencheur** : Soumission des informations invité
- **Résultat** : Réservation **AVEC** documents d'identité
- **Problème** : Crée une réservation complète

### **🔴 DEUXIÈME LOGIQUE : `create-booking-for-signature`**
- **Déclencheur** : Affichage de la page de signature
- **Résultat** : Réservation **SANS** documents d'identité
- **Problème** : Crée une réservation vide

## 🎯 CAUSE RACINE

Dans `WelcomingContractSignature.tsx` et `ContractSignature.tsx` :

```typescript
// ❌ PROBLÉMATIQUE : Création d'une nouvelle réservation si pas d'ID
if (!bookingId) {
  console.log('📝 No booking ID found, creating booking before signature...');
  
  const { data: bookingResult, error: bookingError } = await supabase.functions.invoke('create-booking-for-signature', {
    body: {
      propertyId: propertyData?.id,
      checkInDate: bookingData?.checkInDate,
      checkOutDate: bookingData?.checkOutDate,
      // ... autres données
    }
  });
  
  bookingId = bookingResult.bookingId; // ❌ NOUVELLE RÉSERVATION !
}
```

## 🛠️ SOLUTION : CORRECTION DE LA LOGIQUE

### **ÉTAPE 1 : CORRECTION DES COMPOSANTS FRONTEND**

#### **1.1 WelcomingContractSignature.tsx**
```typescript
// ✅ CORRECTION : Ne jamais créer de nouvelle réservation
const handleSubmitSignature = async () => {
  if (!signature || !isAgreed) return;

  setIsSubmitting(true);
  try {
    // ✅ CORRECTION : Utiliser l'ID existant ou échouer
    const bookingId = bookingData?.id;
    if (!bookingId) {
      throw new Error('ID de réservation manquant. Impossible de signer le contrat.');
    }

    console.log('✅ Utilisation de la réservation existante:', bookingId);
    
    // ... reste de la logique de signature
  } catch (error) {
    console.error('Error saving signature:', error);
    // ... gestion d'erreur
  }
};
```

#### **1.2 ContractSignature.tsx**
```typescript
// ✅ CORRECTION : Même logique
const handleSubmitSignature = async () => {
  if (!signature || !isAgreed) return;

  setIsSubmitting(true);
  try {
    // ✅ CORRECTION : Utiliser l'ID existant ou échouer
    const bookingId = bookingData?.id;
    if (!bookingId) {
      throw new Error('ID de réservation manquant. Impossible de signer le contrat.');
    }

    console.log('✅ Utilisation de la réservation existante:', bookingId);
    
    // ... reste de la logique de signature
  } catch (error) {
    console.error('Error saving signature:', error);
    // ... gestion d'erreur
  }
};
```

### **ÉTAPE 2 : MODIFICATION DE L'EDGE FUNCTION `create-booking-for-signature`**

#### **2.1 Logique de Vérification**
```typescript
// ✅ CORRECTION : Vérifier si une réservation existe déjà
const { data: existingBooking, error: checkError } = await server
  .from("bookings")
  .select("id, status")
  .eq("property_id", body.propertyId)
  .eq("check_in_date", body.checkInDate)
  .eq("check_out_date", body.checkOutDate)
  .maybeSingle();

if (existingBooking) {
  console.log('✅ Réservation existante trouvée:', existingBooking.id);
  return ok({ 
    bookingId: existingBooking.id,
    propertyId: body.propertyId,
    guestName: body.guestName,
    checkInDate: body.checkInDate,
    checkOutDate: body.checkOutDate,
    numberOfGuests: body.numberOfGuests || 1,
    status: existingBooking.status,
    message: "Existing booking found and reused"
  });
}

// ✅ CORRECTION : Créer seulement si aucune réservation n'existe
console.log('💾 Creating new booking...');
const { data: booking, error: bookingError } = await server
  .from("bookings")
  .insert({
    property_id: body.propertyId,
    user_id: property.user_id,
    check_in_date: body.checkInDate,
    check_out_date: body.checkOutDate,
    number_of_guests: body.numberOfGuests || 1,
    status: 'pending',
    booking_reference: `SIGN-${Date.now()}`,
    documents_generated: {
      policeForm: false,
      contract: false
    }
  })
  .select("id, property_id, check_in_date, check_out_date, number_of_guests, status")
  .single();
```

### **ÉTAPE 3 : AMÉLIORATION DE `submit-guest-info`**

#### **3.1 Vérification des Doublons**
```typescript
// ✅ CORRECTION : Vérifier si une réservation existe déjà
const { data: existingBooking, error: checkError } = await supabase
  .from('bookings')
  .select('id, status')
  .eq('property_id', propertyId)
  .eq('check_in_date', checkInDate)
  .eq('check_out_date', checkOutDate)
  .maybeSingle();

if (existingBooking) {
  console.log('✅ Réservation existante trouvée, mise à jour:', existingBooking.id);
  
  // Mettre à jour la réservation existante au lieu d'en créer une nouvelle
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      number_of_guests: bookingData?.numberOfGuests ?? guestData?.guests?.length ?? 1,
      submission_id: submissionId,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingBooking.id);

  if (updateError) {
    console.error('❌ Failed to update existing booking:', updateError);
    return new Response(JSON.stringify({
      success: false,
      message: 'Échec de la mise à jour de la réservation existante'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  bookingId = existingBooking.id;
} else {
  // ✅ CORRECTION : Créer seulement si aucune réservation n'existe
  console.log('📅 Creating new booking...');
  const payload = {
    property_id: propertyId,
    user_id: propertyData.user_id,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    number_of_guests: bookingData?.numberOfGuests ?? guestData?.guests?.length ?? 1,
    status: 'pending',
    submission_id: submissionId
  };

  const { data: newBooking, error: newErr } = await supabase
    .from('bookings')
    .insert(payload)
    .select('id')
    .single();

  if (newErr || !newBooking) {
    console.error('❌ Failed to create booking:', newErr);
    return new Response(JSON.stringify({
      success: false,
      message: 'Échec de la création de la réservation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  bookingId = newBooking.id;
}
```

## 🔧 IMPLÉMENTATION DE LA CORRECTION

### **1. Nettoyage des Doublons Existants**
```sql
-- Script de nettoyage des doublons créés par la double logique
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as booking_ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates,
    ARRAY_AGG(submission_id IS NOT NULL ORDER BY created_at) as has_submission
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  'DOUBLONS DÉTECTÉS:' as message,
  property_id,
  check_in_date,
  check_out_date,
  user_id,
  duplicate_count,
  booking_ids,
  created_dates,
  has_submission
FROM duplicate_bookings
ORDER BY duplicate_count DESC, check_in_date;
```

### **2. Stratégie de Nettoyage Intelligente**
```sql
-- Garder la réservation avec submission_id (plus complète)
-- Supprimer les réservations sans submission_id (créées par erreur)
CREATE TEMP TABLE bookings_to_keep AS
WITH ranked_bookings AS (
  SELECT 
    id,
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    submission_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY property_id, check_in_date, check_out_date, user_id 
      ORDER BY 
        -- Priorité 1: Réservations avec submission_id (plus complètes)
        CASE WHEN submission_id IS NOT NULL THEN 1 ELSE 2 END,
        -- Priorité 2: Réservations les plus récentes
        created_at DESC,
        -- Priorité 3: ID le plus petit
        id
    ) as rn
  FROM public.bookings
)
SELECT id FROM ranked_bookings WHERE rn = 1;

-- Supprimer les doublons
DELETE FROM public.bookings 
WHERE id NOT IN (SELECT id FROM bookings_to_keep);
```

## ✅ RÉSULTAT ATTENDU

Après la correction :
- ✅ **Une seule réservation** créée par séjour
- ✅ **Documents d'identité** correctement associés
- ✅ **Pas de duplication** lors de la signature
- ✅ **Système robuste** et prévisible

## 🚀 DÉPLOIEMENT DE LA CORRECTION

1. **Nettoyer les doublons existants**
2. **Modifier les composants frontend**
3. **Mettre à jour les Edge Functions**
4. **Tester la création de réservations**
5. **Vérifier qu'il n'y a plus de duplication**

## 🔍 VÉRIFICATION POST-CORRECTION

```sql
-- Vérifier qu'il n'y a plus de doublons
WITH duplicate_check AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as count
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ AUCUN DOUBLON - Correction réussie !'
    ELSE '❌ DOUBLONS ENCORE PRÉSENTS: ' || COUNT(*) || ' groupes'
  END as verification_result
FROM duplicate_check;
```

## 📝 MODIFICATIONS APPORTÉES

### **Composants Frontend Corrigés :**

1. **`WelcomingContractSignature.tsx`** ✅
   - Supprimé l'appel à `
   
   create-booking-for-signature`
   - Ajouté une vérification stricte de l'existence de `bookingId`
   - Message d'erreur explicite si l'ID est manquant

2. **`ContractSignature.tsx`** ✅
   - Supprimé l'appel à `create-booking-for-signature`
   - Ajouté une vérification stricte de l'existence de `bookingId`
   - Message d'erreur explicite si l'ID est manquant

### **Logique de Flux Corrigée :**

- **Avant** : Création automatique de réservation lors de la signature
- **Après** : Utilisation exclusive de la réservation existante
- **Gestion d'erreur** : Échec explicite si pas d'ID de réservation

### **Architecture Maintenue :**

- **`submit-guest-info`** : Seule source de création de réservations
- **Composants de signature** : Utilisent uniquement les IDs existants
- **Pas de duplication** : Une seule logique de création

---

**⚠️ IMPORTANT** : Cette correction résout le problème à la racine en éliminant la double logique de création de réservations.

**🎯 PROCHAINES ÉTAPES :**
1. Déployer les composants corrigés
2. Nettoyer les doublons existants en base
3. Tester le flux complet de réservation
4. Vérifier l'absence de nouvelles duplications
