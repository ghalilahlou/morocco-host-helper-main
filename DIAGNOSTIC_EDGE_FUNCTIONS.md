# 🔍 Diagnostic des Edge Functions - Problème d'écrasement des réservations

## ⚠️ PROBLÈMES IDENTIFIÉS DANS LES EDGE FUNCTIONS

### 1. `create-booking-for-signature/index.ts`

**Ligne 63** : Vérification d'existence par `property_id + check_in_date + check_out_date`
```typescript
const { data: existingBooking } = await server
  .from("bookings")
  .select("id, status, submission_id")
  .eq("property_id", body.propertyId)
  .eq("check_in_date", body.checkInDate)
  .eq("check_out_date", body.checkOutDate)
  .maybeSingle();
```

**PROBLÈME** : Si plusieurs réservations ont les mêmes dates, seule la première sera trouvée et réutilisée. Les autres seront ignorées ou écrasées.

**SOLUTION** : Ajouter un filtre supplémentaire (guest_name ou booking_reference) pour identifier de manière unique la réservation.

---

### 2. `submit-guest-info-unified/index.ts`

**Lignes 2520-2521 et 2530-2531** : Suppression de réservations temporaires
```typescript
await supabaseClient.from('guests').delete().eq('booking_id', tempBookingId);
await supabaseClient.from('bookings').delete().eq('id', tempBookingId);
```

**PROBLÈME** : Ces suppressions sont dans un contexte de nettoyage d'erreur, mais il faut vérifier qu'elles ne suppriment pas des réservations valides.

**CONTEXTE** : Ces suppressions semblent être dans un bloc `catch` pour nettoyer les réservations temporaires en cas d'erreur. Vérifier que `tempBookingId` est bien une réservation temporaire et non une réservation existante.

---

### 3. `submit-guest-info-unified/index.ts`

**Lignes 3426-3445** : Recherche de réservation existante

**Pour INDEPENDENT_BOOKING** :
```typescript
.eq('property_id', booking.propertyId)
.eq('booking_reference', 'INDEPENDENT_BOOKING')
.eq('guest_name', `${requestBody.guestInfo.firstName} ${requestBody.guestInfo.lastName}`)
.eq('check_in_date', booking.checkIn)
.maybeSingle();
```

**PROBLÈME** : Si deux réservations indépendantes ont le même nom de guest et les mêmes dates, seule la première sera trouvée.

**Pour réservations Airbnb** :
```typescript
.eq('property_id', booking.propertyId)
.eq('booking_reference', booking.airbnbCode)
.maybeSingle();
```

**PROBLÈME** : Si plusieurs réservations ont le même `booking_reference` (code Airbnb), seule la première sera trouvée et mise à jour.

---

### 4. `issue-guest-link/index.ts`

**Lignes 540-545** : Recherche de réservation existante par `property_id + booking_reference`
```typescript
const { data: existingBooking } = await server
  .from('bookings')
  .select('id, status')
  .eq('property_id', propertyId)
  .eq('booking_reference', reservationData.airbnbCode)
  .maybeSingle();
```

**PROBLÈME** : Même problème - si plusieurs réservations ont le même `booking_reference`, seule la première sera trouvée.

---

## ✅ RECOMMANDATIONS

### 1. Améliorer la recherche de réservations existantes

Au lieu de chercher uniquement par `property_id + booking_reference`, ajouter un filtre par `status` pour ne récupérer que les réservations actives :

```typescript
.eq('property_id', booking.propertyId)
.eq('booking_reference', booking.airbnbCode)
.in('status', ['pending', 'completed', 'confirmed']) // Seulement les réservations actives
.maybeSingle();
```

### 2. Utiliser l'ID de réservation quand disponible

Si `booking.bookingId` est disponible, l'utiliser directement au lieu de chercher par `booking_reference`.

### 3. Vérifier les suppressions

S'assurer que les suppressions aux lignes 2520-2531 ne suppriment que des réservations temporaires créées dans la même transaction, pas des réservations existantes.

### 4. Ajouter des logs pour traçabilité

Ajouter des logs détaillés avant chaque mise à jour/suppression pour comprendre ce qui se passe.

---

## 🔍 COMMANDES SQL POUR VÉRIFIER

```sql
-- Vérifier s'il y a des réservations avec le même booking_reference
SELECT 
  booking_reference,
  property_id,
  COUNT(*) as count,
  array_agg(id) as booking_ids,
  array_agg(status) as statuses
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference IS NOT NULL
GROUP BY booking_reference, property_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Vérifier les réservations INDEPENDENT_BOOKING avec mêmes dates et nom
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  guest_name,
  COUNT(*) as count,
  array_agg(id) as booking_ids
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference = 'INDEPENDENT_BOOKING'
GROUP BY property_id, check_in_date, check_out_date, guest_name
HAVING COUNT(*) > 1
ORDER BY count DESC;
```
