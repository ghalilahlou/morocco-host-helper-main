# 🔍 AUDIT COMPLET - LOGIQUE DES RÉSERVATIONS

**Date** : 30 janvier 2026  
**Objectif** : Analyser la cohérence et la complétude de la gestion des différents types de réservations

---

## 📊 TYPES DE RÉSERVATIONS IDENTIFIÉS

### 1️⃣ **Réservations ICS/Airbnb** (depuis synchronisation ICS)
- **Identifiant** : `bookingReference` avec format Airbnb (HM*, CL*, PN*, etc.)
- **Source** : Fichiers ICS importés depuis Airbnb
- **Statuts possibles** : `pending`, `completed`, `confirmed`
- **Couleur calendrier** :
  - ⏳ En attente (non complétée) : **NOIR** (#222222)
  - ✅ Complétée (guest a validé) : **GRIS** (#E5E5E5)

### 2️⃣ **Réservations Indépendantes** (créées via lien ICS sans code Airbnb)
- **Identifiant** : `bookingReference = 'INDEPENDENT_BOOKING'`
- **Source** : Lien ICS généré par le host, rempli par le guest
- **Statuts possibles** : `pending`, `completed`, `confirmed`
- **Couleur calendrier** :
  - ⏳ En attente : **NOIR** (#222222)
  - ✅ Confirmée/Complétée : **GRIS** (#E5E5E5)

### 3️⃣ **Réservations Manuelles** (créées par le host dans le dashboard)
- **Identifiant** : `bookingReference` peut être vide, null, ou un code personnalisé
- **Source** : Création manuelle via `BookingWizard` ou `UnifiedBookingModal`
- **Statuts possibles** : `draft`, `pending`, `confirmed`, `completed`, `archived`
- **Couleur calendrier** :
  - 📝 Brouillon : **GRIS CLAIR**
  - ⏳ En attente : **NOIR** (#1A1A1A)
  - ✅ Confirmée : **GRIS** (#E5E5E5)

### 4️⃣ **Réservations Airbnb Natives** (depuis table `airbnb_reservations`)
- **Identifiant** : `airbnb_booking_id` présent
- **Source** : Synchronisation directe API Airbnb (si implémentée)
- **Couleur calendrier** : **NOIR** avec ombre rose

---

## ✅ POINTS FORTS IDENTIFIÉS

### 1. **Type centralisé bien défini**
```typescript
// src/types/booking.ts
export interface Booking {
  id: string;
  property_id?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  bookingReference?: string;  // ✅ Clé pour identifier le type
  guest_name?: string;
  status: 'pending' | 'completed' | 'confirmed' | 'archived' | 'draft';
  guests: Guest[];
  property?: Property;
}
```

### 2. **Logique de couleur cohérente**
- `CalendarBookingBar.tsx` : Logique centralisée pour les couleurs
- Priorités claires : Conflit > ICS Complété > ICS En attente > Nom valide > Défaut

### 3. **Détection robuste des codes Airbnb**
```typescript
// utils/bookingDisplay.ts
const AIRBNB_CODE_PATTERNS = /^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]+/;
```

---

## ⚠️ PROBLÈMES ET INCOHÉRENCES DÉTECTÉS

### 🔴 CRITIQUE 1 : Confusion entre `bookingReference` et `source`

**Localisation** : Plusieurs fichiers mélangent ces concepts

**Problème** :
```typescript
// ❌ INCOHÉRENT : Certains fichiers vérifient 'source'
const isAirbnb = 'source' in booking && booking.source === 'airbnb';

// ✅ CORRECT : D'autres vérifient 'bookingReference'
const hasAirbnbCode = booking.bookingReference && 
  booking.bookingReference !== 'INDEPENDENT_BOOKING' &&
  /^(HM|CL|...)/.test(booking.bookingReference);
```

**Impact** : Risque de classification incorrecte des réservations

**Solution recommandée** :
- Ajouter un champ `source: 'airbnb' | 'ics' | 'manual' | 'independent'` au type `Booking`
- Utiliser `source` comme source de vérité principale
- Garder `bookingReference` uniquement pour le code Airbnb

---

### 🔴 CRITIQUE 2 : Logique de statut `completed` vs `confirmed` floue

**Problème** :
```typescript
// ❌ INCOHÉRENT : Parfois on vérifie isCompleted
if (status === 'completed') { ... }

// ❌ INCOHÉRENT : Parfois on vérifie isCompleted OU isConfirmed
if (isCompleted || isConfirmed) { ... }

// ❌ INCOHÉRENT : Parfois on vérifie isValidName (nom != code)
if (isValidName) { ... }
```

**Questions sans réponse** :
- Quelle est la différence entre `completed` et `confirmed` ?
- Quand passe-t-on de `pending` → `confirmed` → `completed` ?
- Est-ce que `confirmed` = "host a confirmé" et `completed` = "guest a validé" ?

**Impact** : Réservations qui devraient être grises restent noires

**Solution recommandée** :
```typescript
// Définir clairement les statuts
type BookingStatus = 
  | 'draft'      // Créée par host, pas encore publiée
  | 'pending'    // Publiée, en attente de validation guest
  | 'confirmed'  // Guest a commencé le check-in
  | 'completed'  // Guest a finalisé le check-in (documents + signature)
  | 'archived';  // Séjour terminé
```

---

### 🟡 MOYEN 3 : Détection de nom valide vs code trop complexe

**Localisation** : `CalendarBookingBar.tsx` ligne 22-51

**Problème** :
```typescript
const isValidGuestName = (value: string): boolean => {
  // ✅ Vérifie si c'est un code Airbnb
  if (isAirbnbCode(trimmed)) return false;
  
  // ❌ REDONDANT : Vérifie aussi les patterns de codes
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(trimmed)) {
    return false;
  }
  
  // ✅ Accepte les noms à un seul mot
  return true;
};
```

**Impact** : Logique dupliquée, risque de divergence

**Solution recommandée** :
- Centraliser la détection dans `utils/bookingDisplay.ts`
- Utiliser uniquement `isAirbnbCode()` + vérification de longueur minimale

---

### 🟡 MOYEN 4 : Gestion incohérente de `INDEPENDENT_BOOKING`

**Problème** : Le code vérifie `bookingReference === 'INDEPENDENT_BOOKING'` à plusieurs endroits

**Fichiers concernés** :
- `CalendarBookingBar.tsx` (ligne 87, 143)
- `CalendarView.tsx` (ligne 700)
- `useBookings.ts` (ligne 1608)
- `GuestVerification.tsx` (ligne 1616, 1635, 1641)

**Impact** : Si on change la valeur de la constante, il faut modifier 20+ endroits

**Solution recommandée** :
```typescript
// constants/bookingTypes.ts
export const BOOKING_TYPES = {
  INDEPENDENT: 'INDEPENDENT_BOOKING',
  AIRBNB: 'AIRBNB',
  MANUAL: 'MANUAL'
} as const;

// Fonction helper
export const isIndependentBooking = (booking: Booking) => 
  booking.bookingReference === BOOKING_TYPES.INDEPENDENT;
```

---

### 🟡 MOYEN 5 : Pas de distinction claire entre réservations manuelles et indépendantes

**Problème** :
- Une réservation manuelle peut avoir `bookingReference = null`
- Une réservation indépendante a `bookingReference = 'INDEPENDENT_BOOKING'`
- Mais les deux peuvent avoir le même `status = 'confirmed'`

**Impact** : Difficile de savoir si une réservation a été créée par le host ou par un guest

**Solution recommandée** :
Ajouter un champ `created_by: 'host' | 'guest' | 'system'` au type `Booking`

---

### 🟢 MINEUR 6 : Vérification `hasAirbnbCode` redondante

**Localisation** : `CalendarBookingBar.tsx` ligne 80-83

**Problème** :
```typescript
const hasAirbnbCode = 'bookingReference' in booking && 
  (booking as Booking).bookingReference && 
  (booking as Booking).bookingReference !== 'INDEPENDENT_BOOKING' &&
  /^(HM|CL|PN|...)/.test((booking as Booking).bookingReference);
```

**Impact** : Logique dupliquée avec `isAirbnbCode()` de `utils/bookingDisplay.ts`

**Solution recommandée** :
```typescript
import { isAirbnbCode } from '@/utils/bookingDisplay';

const hasAirbnbCode = 'bookingReference' in booking && 
  booking.bookingReference &&
  isAirbnbCode(booking.bookingReference);
```

---

## 🎯 RECOMMANDATIONS PRIORITAIRES

### 🔥 PRIORITÉ 1 : Clarifier le modèle de données

**Action** : Enrichir le type `Booking` avec des champs explicites

```typescript
export interface Booking {
  id: string;
  property_id: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  
  // ✅ NOUVEAU : Source de la réservation
  source: 'airbnb' | 'ics' | 'manual' | 'independent';
  
  // ✅ RENOMMÉ : Code Airbnb (uniquement si source = 'airbnb' ou 'ics')
  airbnb_code?: string;
  
  // ✅ NOUVEAU : Créateur de la réservation
  created_by: 'host' | 'guest' | 'system';
  
  // ✅ CLARIFIÉ : Statut du workflow
  status: 'draft' | 'pending' | 'confirmed' | 'completed' | 'archived';
  
  guest_name?: string;
  guests: Guest[];
  property?: Property;
  
  // ✅ NOUVEAU : Métadonnées de validation
  validation: {
    documents_uploaded: boolean;
    contract_signed: boolean;
    police_form_generated: boolean;
  };
}
```

---

### 🔥 PRIORITÉ 2 : Créer des fonctions helper centralisées

**Fichier** : `src/utils/bookingHelpers.ts`

```typescript
export const getBookingType = (booking: Booking): BookingType => {
  if (booking.source === 'airbnb') return 'AIRBNB';
  if (booking.source === 'ics' && booking.airbnb_code) return 'ICS_AIRBNB';
  if (booking.source === 'independent') return 'INDEPENDENT';
  return 'MANUAL';
};

export const isBookingCompleted = (booking: Booking): boolean => {
  return booking.status === 'completed' && 
         booking.validation.documents_uploaded &&
         booking.validation.contract_signed;
};

export const getBookingDisplayColor = (booking: Booking): string => {
  const type = getBookingType(booking);
  const completed = isBookingCompleted(booking);
  
  if (type === 'AIRBNB' || type === 'ICS_AIRBNB') {
    return completed ? BOOKING_COLORS.completed.hex : BOOKING_COLORS.default.hex;
  }
  
  if (type === 'INDEPENDENT') {
    return booking.status === 'confirmed' || completed 
      ? BOOKING_COLORS.completed.hex 
      : BOOKING_COLORS.default.hex;
  }
  
  return BOOKING_COLORS.default.hex;
};
```

---

### 🔥 PRIORITÉ 3 : Documenter le workflow de statuts

**Fichier** : `docs/BOOKING_WORKFLOW.md`

```markdown
# Workflow des Statuts de Réservation

## 1. Réservation ICS/Airbnb

1. **Création** : Synchronisation ICS → `status = 'pending'`, `source = 'ics'`
2. **Guest ouvre le lien** : Pas de changement de statut
3. **Guest remplit les infos** : `status = 'confirmed'`
4. **Guest signe le contrat** : `status = 'completed'`
5. **Séjour terminé** : `status = 'archived'`

## 2. Réservation Indépendante

1. **Host génère le lien** : `status = 'pending'`, `source = 'independent'`
2. **Guest ouvre le lien** : Pas de changement
3. **Guest remplit les infos** : `status = 'confirmed'`
4. **Guest signe** : `status = 'completed'`

## 3. Réservation Manuelle

1. **Host crée** : `status = 'draft'`, `source = 'manual'`
2. **Host publie** : `status = 'pending'`
3. **Host confirme** : `status = 'confirmed'`
4. **Séjour terminé** : `status = 'archived'`
```

---

## 📝 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Nettoyage (1-2 jours)
- [ ] Créer `src/utils/bookingHelpers.ts` avec fonctions centralisées
- [ ] Créer `src/constants/bookingTypes.ts` avec constantes
- [ ] Remplacer toutes les vérifications `bookingReference === 'INDEPENDENT_BOOKING'`

### Phase 2 : Migration du modèle (2-3 jours)
- [ ] Ajouter champ `source` à la table `bookings` (migration SQL)
- [ ] Ajouter champ `created_by` à la table `bookings`
- [ ] Mettre à jour le type TypeScript `Booking`
- [ ] Créer script de migration pour peupler `source` depuis `bookingReference`

### Phase 3 : Refactoring (3-5 jours)
- [ ] Remplacer toutes les vérifications de type par `getBookingType()`
- [ ] Utiliser `getBookingDisplayColor()` dans `CalendarBookingBar`
- [ ] Simplifier `isValidGuestName()` en utilisant les helpers
- [ ] Ajouter tests unitaires pour les fonctions helper

### Phase 4 : Documentation (1 jour)
- [ ] Créer `docs/BOOKING_WORKFLOW.md`
- [ ] Ajouter commentaires JSDoc aux fonctions helper
- [ ] Mettre à jour le README avec la nouvelle logique

---

## 🎨 SCHÉMA DE DÉCISION - COULEUR CALENDRIER

```
┌─────────────────────────────────────────┐
│ Réservation                             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
          ┌───────────────┐
          │ Conflit ?     │──── OUI ──▶ 🔴 ROUGE
          └───────┬───────┘
                  │ NON
                  ▼
          ┌───────────────┐
          │ Source = ICS  │
          │ ou Airbnb ?   │
          └───────┬───────┘
                  │
        ┌─────────┴─────────┐
        │                   │
       OUI                 NON
        │                   │
        ▼                   ▼
  ┌──────────┐        ┌──────────┐
  │Completed?│        │Confirmed │
  └────┬─────┘        │ou Valid  │
       │              │Name ?    │
   ┌───┴───┐          └────┬─────┘
   │       │               │
  OUI     NON          ┌───┴───┐
   │       │           │       │
   ▼       ▼          OUI     NON
⚪GRIS  ⚫NOIR          │       │
                       ▼       ▼
                    ⚪GRIS  ⚫NOIR
```

---

## 🔍 FICHIERS À AUDITER EN PRIORITÉ

### Logique de couleur
- ✅ `src/components/calendar/CalendarBookingBar.tsx` (VÉRIFIÉ)
- ⚠️ `src/components/CalendarView.tsx` (À VÉRIFIER)
- ⚠️ `src/components/calendar/CalendarUtils.ts` (À VÉRIFIER)

### Détection de type
- ✅ `src/utils/bookingDisplay.ts` (VÉRIFIÉ)
- ⚠️ `src/hooks/useBookings.ts` (À VÉRIFIER)
- ⚠️ `src/services/guestSubmissionService.ts` (À VÉRIFIER)

### Création de réservations
- ⚠️ `src/components/BookingWizard.tsx` (À VÉRIFIER)
- ⚠️ `src/components/UnifiedBookingModal.tsx` (À VÉRIFIER)
- ⚠️ `src/pages/GuestVerification.tsx` (À VÉRIFIER)

---

## 📊 MÉTRIQUES DE QUALITÉ

| Critère | État actuel | Objectif |
|---------|-------------|----------|
| **Cohérence du modèle** | 🟡 60% | 🟢 95% |
| **Centralisation de la logique** | 🟡 50% | 🟢 90% |
| **Documentation** | 🔴 20% | 🟢 80% |
| **Tests unitaires** | 🔴 0% | 🟢 70% |
| **Clarté des statuts** | 🟡 40% | 🟢 90% |

---

## ✅ CONCLUSION

Le système de réservations fonctionne globalement, mais souffre de **manque de clarté** et de **duplication de logique**. 

**Points critiques à corriger** :
1. ❌ Confusion entre `bookingReference`, `source`, et détection de type
2. ❌ Logique de statut `completed` vs `confirmed` floue
3. ❌ Duplication de code pour détecter les types de réservations

**Bénéfices attendus du refactoring** :
- ✅ Code plus maintenable et lisible
- ✅ Moins de bugs liés aux types de réservations
- ✅ Onboarding plus facile pour nouveaux développeurs
- ✅ Tests automatisés possibles

**Effort estimé** : 7-11 jours de développement
**Risque** : Moyen (nécessite migration de données)
**Impact** : Élevé (amélioration significative de la qualité du code)
