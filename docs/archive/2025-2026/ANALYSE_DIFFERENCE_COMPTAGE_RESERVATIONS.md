# 🔍 Analyse de la Différence de Comptage des Réservations

## 📊 Problème Identifié

**Symptôme :**
- Dashboard affiche : **109 Total** et **109 En attente**
- Calendrier affiche : **26 réservations**

**Écart :** 109 - 26 = **83 réservations manquantes dans le calendrier**

---

## 🔎 Analyse de la Logique Complète

### 1. Calcul des Stats dans `PropertyDetail.tsx` (lignes 224-228)

```typescript
const stats = {
  total: propertyBookings.length + airbnbReservationsCount,
  pending: propertyBookings.filter(b => b.status === 'pending').length + airbnbReservationsCount,
  completed: propertyBookings.filter(b => b.status === 'completed').length,
};
```

**Logique :**
- `propertyBookings` = réservations manuelles filtrées par `propertyId` = **26 réservations**
- `airbnbReservationsCount` = nombre de réservations Airbnb = **83 réservations**
- **Total = 26 + 83 = 109** ✅
- **Pending = (26 pending) + 83 = 109** ✅

**✅ Les stats sont correctes** : elles incluent les réservations Airbnb.

---

### 2. Passage des Données au Dashboard (ligne 463)

```typescript
<Dashboard
  bookings={propertyBookings}  // ⚠️ Seulement les réservations manuelles (26)
  ...
  propertyId={property.id}
/>
```

**Problème identifié :**
- Le Dashboard reçoit **seulement** `propertyBookings` (26 réservations manuelles)
- Les réservations Airbnb ne sont **pas** passées au Dashboard

---

### 3. Calcul des Stats dans Dashboard (lignes 79-84)

```typescript
const stats = useMemo(() => ({
  total: bookings.length,  // ⚠️ Seulement les réservations manuelles
  pending: bookings.filter(b => b.status === 'pending').length,
  completed: bookings.filter(b => b.status === 'completed').length,
  archived: bookings.filter(b => b.status === 'archived').length
}), [bookings]);
```

**Logique :**
- `bookings` = `propertyBookings` = **26 réservations**
- **Total = 26** ✅ (mais ne correspond pas aux stats du header)

**✅ Les stats du Dashboard sont correctes** pour les données qu'il reçoit, mais **incohérentes** avec les stats du header.

---

### 4. Passage des Données au CalendarView (ligne 204 dans Dashboard.tsx)

```typescript
<CalendarView
  bookings={filteredBookings}  // ⚠️ Seulement les réservations manuelles filtrées
  propertyId={propertyId}
  ...
/>
```

**Problème identifié :**
- CalendarView reçoit **seulement** les réservations manuelles
- Les réservations Airbnb sont chargées **séparément** dans CalendarView (ligne 107)

---

### 5. Chargement des Réservations Airbnb dans CalendarView

```typescript
const [airbnbReservations, setAirbnbReservations] = useState<AirbnbReservation[]>([]);

// Les réservations Airbnb sont chargées dans un useEffect séparé
useEffect(() => {
  const loadAirbnbReservations = async () => {
    if (!propertyId) return;
    try {
      const reservations = await AirbnbEdgeFunctionService.getReservations(propertyId);
      setAirbnbReservations(reservations);
    } catch (error) {
      console.error('Error loading Airbnb reservations:', error);
    }
  };
  loadAirbnbReservations();
}, [propertyId]);
```

**Logique :**
- Les réservations Airbnb sont chargées **asynchronement** dans CalendarView
- Elles sont combinées avec les réservations manuelles dans `allReservations`

```typescript
const allReservations = useMemo(() => {
  return [...bookings, ...airbnbReservations];
}, [bookings, airbnbReservations]);
```

**Comptage dans CalendarHeader (ligne 976) :**
```typescript
bookingCount={allReservations.length}  // bookings.length + airbnbReservations.length
```

**Problème potentiel :**
- Si les réservations Airbnb ne sont **pas encore chargées** au moment du rendu initial, `allReservations.length = 26`
- Si elles sont chargées, `allReservations.length = 26 + 83 = 109`

---

## 🐛 Anomalies Identifiées

### Anomalie 1 : Incohérence entre Stats Header et Dashboard

**Problème :**
- Header affiche : **109 Total** (inclut Airbnb)
- Dashboard affiche : **26 réservations** (n'inclut pas Airbnb)

**Cause :**
- Les stats du header incluent `airbnbReservationsCount`
- Le Dashboard ne reçoit que `propertyBookings`

**Impact :** Confusion pour l'utilisateur

---

### Anomalie 2 : Chargement Asynchrone des Réservations Airbnb

**Problème :**
- Les réservations Airbnb sont chargées **séparément** dans CalendarView
- Le comptage peut être **incorrect** si les données ne sont pas encore chargées

**Cause :**
- Pas de synchronisation entre le chargement des réservations Airbnb dans PropertyDetail et CalendarView

**Impact :** Comptage incorrect temporaire

---

### Anomalie 3 : Double Chargement des Réservations Airbnb

**Problème :**
- PropertyDetail charge `airbnbReservationsCount` (ligne 60)
- CalendarView charge `airbnbReservations` (ligne 107)

**Cause :**
- Pas de partage de données entre les composants

**Impact :** Requêtes redondantes, performance dégradée

---

## ✅ Solutions Proposées

### Solution 1 : Passer les Réservations Airbnb au Dashboard

**Modification dans `PropertyDetail.tsx` :**

```typescript
// Charger les réservations Airbnb complètes (pas seulement le count)
const [airbnbReservations, setAirbnbReservations] = useState<AirbnbReservation[]>([]);

useEffect(() => {
  const loadAirbnbReservations = async () => {
    if (!property?.id) return;
    try {
      const reservations = await AirbnbEdgeFunctionService.getReservations(property.id);
      setAirbnbReservations(reservations);
      setAirbnbReservationsCount(reservations.length);
    } catch (error) {
      console.error('Error loading Airbnb reservations:', error);
      setAirbnbReservations([]);
      setAirbnbReservationsCount(0);
    }
  };
  loadAirbnbReservations();
}, [property?.id]);

// Passer les réservations Airbnb au Dashboard
<Dashboard
  bookings={propertyBookings}
  airbnbReservations={airbnbReservations}  // ✅ Nouveau prop
  ...
/>
```

**Modification dans `Dashboard.tsx` :**

```typescript
interface DashboardProps {
  ...
  airbnbReservations?: AirbnbReservation[];  // ✅ Nouveau prop
}

// Combiner les réservations
const allBookings = useMemo(() => {
  return [...bookings, ...(airbnbReservations || [])];
}, [bookings, airbnbReservations]);

// Stats incluant Airbnb
const stats = useMemo(() => ({
  total: allBookings.length,
  pending: allBookings.filter(b => b.status === 'pending').length,
  ...
}), [allBookings]);
```

---

### Solution 2 : Utiliser un Contexte pour Partager les Données

**Créer un contexte `PropertyBookingsContext` :**

```typescript
interface PropertyBookingsContextValue {
  propertyBookings: EnrichedBooking[];
  airbnbReservations: AirbnbReservation[];
  isLoading: boolean;
}

export const PropertyBookingsContext = createContext<PropertyBookingsContextValue | undefined>(undefined);
```

**Avantages :**
- ✅ Évite le double chargement
- ✅ Synchronisation automatique
- ✅ Données partagées entre tous les composants

---

### Solution 3 : Afficher les Stats de Manière Cohérente

**Option A : Séparer les Stats**
- Header : "109 Total (26 manuelles + 83 Airbnb)"
- Dashboard : "26 réservations manuelles"

**Option B : Unifier les Stats**
- Header et Dashboard : "109 Total (inclut Airbnb)"

---

## 🎯 Recommandation

**Solution recommandée : Solution 1 + Solution 3 Option B**

1. ✅ Passer les réservations Airbnb au Dashboard
2. ✅ Unifier les stats pour afficher le même total partout
3. ✅ Éviter le double chargement en partageant les données

**Bénéfices :**
- ✅ Cohérence des données
- ✅ Performance améliorée (pas de double chargement)
- ✅ Expérience utilisateur améliorée

---

## 📝 Fichiers à Modifier

1. `src/components/PropertyDetail.tsx`
   - Charger les réservations Airbnb complètes
   - Passer au Dashboard

2. `src/components/Dashboard.tsx`
   - Ajouter prop `airbnbReservations`
   - Combiner avec les réservations manuelles
   - Mettre à jour les stats

3. `src/components/CalendarView.tsx`
   - Utiliser les réservations Airbnb passées en prop (optionnel)
   - Ou continuer à les charger séparément si nécessaire

---

## 🔍 Vérification

Pour vérifier l'anomalie, ajouter des logs :

```typescript
console.log('📊 [PROPERTY DETAIL] Stats:', {
  propertyBookings: propertyBookings.length,
  airbnbReservationsCount,
  total: stats.total,
  pending: stats.pending
});

console.log('📅 [CALENDAR VIEW] Réservations:', {
  bookings: bookings.length,
  airbnbReservations: airbnbReservations.length,
  allReservations: allReservations.length
});
```

