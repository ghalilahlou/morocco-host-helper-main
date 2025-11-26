# 🔒 Protection : Empêcher la Suppression des Réservations ICS

## Date : 26 Novembre 2025

## 📋 Problème Identifié

### **Réservations ICS supprimables par erreur**
- ❌ **Symptôme** : Les réservations issues de fichiers ICS Airbnb peuvent être supprimées manuellement
- ❌ **Cause** : Aucune protection contre la suppression de ces réservations
- ❌ **Impact** : 
  - Perte de données de synchronisation Airbnb
  - Réservations recréées lors de la prochaine synchronisation ICS
  - Confusion dans le calendrier

---

## 🛠️ Solution Implémentée

### **Détection des Réservations ICS**

Une réservation est identifiée comme issue d'un fichier ICS si :
1. ✅ **Status** : `'pending'`
2. ✅ **Booking Reference** : Existe et n'est pas `'INDEPENDENT_BOOKING'` (code Airbnb présent)
3. ✅ **Guests** : Pas de guests complets (pas de `full_name`, `document_number`, `nationality` pour tous les guests)

**Logique :**
```typescript
const hasCompleteGuestsForICS = bookingTyped?.guests && bookingTyped.guests.length > 0 && 
  bookingTyped.guests.every(guest => 
    guest.fullName && 
    guest.documentNumber && 
    guest.nationality
  );

const isICSReservation = !isAirbnb && 
  bookingTyped && 
  status === 'pending' && 
  bookingTyped.bookingReference && 
  bookingTyped.bookingReference !== 'INDEPENDENT_BOOKING' &&
  !hasCompleteGuestsForICS;
```

---

## 🔒 Protections Ajoutées

### 1. **Masquage du Bouton de Suppression**

#### Avant :
```typescript
{!isAirbnb && 'id' in booking && (
  <Button onClick={() => setShowDeleteDialog(true)}>
    <Trash2 />
  </Button>
)}
```

#### Après :
```typescript
{!isAirbnb && !isICSReservation && 'id' in booking && (
  <Button onClick={() => setShowDeleteDialog(true)}>
    <Trash2 />
  </Button>
)}
```

**Résultat :** Le bouton poubelle n'apparaît pas pour les réservations ICS.

---

### 2. **Protection dans `handleDeleteBooking`**

#### Avant :
```typescript
const handleDeleteBooking = async () => {
  if (!booking || isAirbnb || !('id' in booking)) {
    toast({ title: "Erreur", description: "Impossible de supprimer cette réservation" });
    return;
  }
  // ... suppression ...
};
```

#### Après :
```typescript
const handleDeleteBooking = async () => {
  if (!booking || isAirbnb || !('id' in booking)) {
    toast({ title: "Erreur", description: "Impossible de supprimer cette réservation" });
    return;
  }
  
  // ✅ PROTECTION : Empêcher la suppression des réservations issues de fichiers ICS
  if (isICSReservation) {
    toast({
      title: "Suppression impossible",
      description: "Cette réservation provient d'un fichier ICS Airbnb et ne peut pas être supprimée manuellement. Elle sera synchronisée automatiquement.",
      variant: "destructive"
    });
    return;
  }
  
  // ... suppression ...
};
```

**Résultat :** Même si quelqu'un essaie de supprimer programmatiquement, une erreur est affichée.

---

## 📊 Comportement par Type de Réservation

### **Réservation Airbnb (table `airbnb_reservations`)**
- ✅ Bouton suppression : **MASQUÉ** (déjà protégé par `isAirbnb`)
- ✅ Suppression : **IMPOSSIBLE**

### **Réservation ICS (table `bookings` avec `booking_reference` Airbnb)**
- ✅ Bouton suppression : **MASQUÉ** (protégé par `isICSReservation`)
- ✅ Suppression : **IMPOSSIBLE** (protection dans `handleDeleteBooking`)

### **Réservation Manuelle (table `bookings` sans `booking_reference` ou avec `INDEPENDENT_BOOKING`)**
- ✅ Bouton suppression : **VISIBLE**
- ✅ Suppression : **AUTORISÉE**

### **Réservation Complétée (avec guests complets)**
- ✅ Bouton suppression : **VISIBLE** (même si `booking_reference` existe)
- ✅ Suppression : **AUTORISÉE** (car ce n'est plus une réservation ICS "vide")

---

## 🔍 Identification des Réservations ICS

### **Caractéristiques :**
1. **Source** : Fichier ICS importé depuis Airbnb
2. **Table** : `bookings` (pas `airbnb_reservations`)
3. **Status** : `'pending'`
4. **Booking Reference** : Code Airbnb (ex: `HMY2RJABF2`)
5. **Guests** : Aucun ou incomplets (pas de `full_name`, `document_number`, `nationality`)
6. **Pièces d'identité** : Aucune uploadée

### **Exemple :**
```typescript
{
  id: "uuid-123",
  status: "pending",
  booking_reference: "HMY2RJABF2", // Code Airbnb
  guests: [], // Vide ou incomplets
  check_in_date: "2025-11-13",
  check_out_date: "2025-11-15"
}
```

---

## ✅ Résultat Final

### **Avant :**
- ❌ Toutes les réservations `pending` pouvaient être supprimées
- ❌ Risque de suppression accidentelle des réservations ICS
- ❌ Perte de synchronisation avec Airbnb

### **Après :**
- ✅ Réservations ICS protégées contre la suppression
- ✅ Bouton poubelle masqué pour les réservations ICS
- ✅ Message d'erreur clair si tentative de suppression
- ✅ Seules les réservations manuelles peuvent être supprimées

---

## 📝 Fichiers Modifiés

1. ✅ `src/components/UnifiedBookingModal.tsx`
   - Ajout de la détection `isICSReservation`
   - Masquage du bouton de suppression pour les réservations ICS
   - Protection dans `handleDeleteBooking`

---

## 🚀 Tests à Effectuer

1. **Réservation ICS en attente** :
   - ✅ Vérifier que le bouton poubelle n'est pas visible
   - ✅ Vérifier qu'une tentative de suppression affiche un message d'erreur

2. **Réservation manuelle** :
   - ✅ Vérifier que le bouton poubelle est visible
   - ✅ Vérifier que la suppression fonctionne normalement

3. **Réservation complétée (avec guests)** :
   - ✅ Vérifier que le bouton poubelle est visible (même si `booking_reference` existe)
   - ✅ Vérifier que la suppression fonctionne normalement

---

## 🎯 Conclusion

Les réservations issues de fichiers ICS sont maintenant **protégées contre la suppression**. Elles ne peuvent être supprimées que :
- Automatiquement lors de la synchronisation ICS (si la réservation n'existe plus dans Airbnb)
- Après avoir été complétées avec des guests et pièces d'identité (devient une réservation normale)

Cela garantit l'intégrité des données synchronisées depuis Airbnb.

