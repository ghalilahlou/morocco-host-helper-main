# Correction des Couleurs de Réservation - Calendrier

## Problème Identifié

Les barres de réservation dans le calendrier (desktop et mobile) n'affichaient pas les bonnes couleurs selon le design Figma :
- Les réservations **validées** avec des noms de guests (comme "Mouhcine", "Zaineb") devaient être en **GRIS**
- Les réservations **en attente** avec des codes Airbnb (comme "HM52S5FSAZ", "HMKNEJMCRM") devaient être en **NOIR**

## Solution Appliquée

### Logique de Coloration Finale

La logique détermine la couleur des barres de réservation selon **3 critères** :

1. **🔴 ROUGE** (#FF5A5F) : Réservations en **conflit** (priorité absolue)
   - Toute réservation dont les dates se chevauchent avec une autre

2. **⚫ NOIR** (#222222) : Réservations **en attente** avec **code Airbnb**
   - Exemples : "HM52S5FSAZ", "HMKNEJMCRM", "HMKZDDC2QN", "HMYHSJW2CW"
   - Critère : `hasAirbnbCode && !isValidated`
   - Ces réservations ont un `bookingReference` au format Airbnb (HM, CL, PN, etc.) mais ne sont pas encore validées

3. **⚪ GRIS** (#E5E5E5) : Réservations **validées** avec **nom de guest**
   - Exemples : "Mouhcine", "Zaineb +1", "Jean Dupont"
   - Critère : `isValidated` (status='completed' + documents complets + guests)
   - Ces réservations ont des guests enregistrés avec documents complets

### Ordre de Priorité (Important !)

L'ordre de vérification est crucial pour éviter les faux positifs :

```typescript
if (isConflict) {
  return ROUGE; // Priorité 1
} else if (hasAirbnbCode && !isValidated) {
  return NOIR; // Priorité 2 - Codes en attente
} else if (isValidated) {
  return GRIS; // Priorité 3 - Noms validés
} else {
  return NOIR; // Par défaut
}
```

### Fichiers Modifiés

#### 1. `src/components/CalendarView.tsx`
- **Lignes 661-695** : Correction de la logique `colorOverrides`
  - Vérification D'ABORD si c'est un code Airbnb non validé → NOIR
  - ENSUITE si c'est validé → GRIS
  - Commentaires clarifiés sur la logique

#### 2. `src/services/airbnbSyncService.ts`
- **Ligne 73** : Modification de `getAirbnbReservationColor()`
  - Retourne maintenant `'bg-[#222222]'` (NOIR) au lieu de `BOOKING_COLORS.pending.tailwind` (GRIS)
  - Pour que les réservations Airbnb avec codes soient en noir

#### 3. `src/components/calendar/CalendarBookingBar.tsx` (Desktop)
- **Lignes 105-163** : Logique de coloration alignée avec CalendarView
  - Priorité aux codes Airbnb (NOIR) avant les noms validés (GRIS)

#### 4. `src/components/calendar/CalendarMobile.tsx` (Mobile)
- **Lignes 218-237** : Même logique appliquée pour la cohérence mobile

## Validation de la Logique

### Critères de Validation

**Pour qu'une réservation soit en GRIS (validée)** :
- `status === 'completed'`
- `hasContract === true` (contrat généré)
- `hasPolice === true` (police d'assurance)
- `hasGuests === true` (guests enregistrés avec documents)

**Pour qu'une réservation soit en NOIR (code en attente)** :
- `bookingReference` match le pattern `/^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9]+/`
- ET `!isValidated` (pas encore validée)

### Exemples Concrets

| Réservation | Code Airbnb | Validée | Couleur Attendue |
|-------------|-------------|---------|------------------|
| HM52S5FSAZ | ✅ Oui | ❌ Non | ⚫ NOIR |
| HMKNEJMCRM | ✅ Oui | ❌ Non | ⚫ NOIR |
| Mouhcine | ❌ Non | ✅ Oui | ⚪ GRIS |
| Zaineb +1 | ❌ Non | ✅ Oui | ⚪ GRIS |

## Résultat Attendu

Après ces corrections, le calendrier doit afficher :

1. **Codes Airbnb en attente** → **Barres NOIRES** ⚫
   - HM52S5FSAZ, HMKNEJMCRM, HMKZDDC2QN, etc.
   
2. **Noms de guests validés** → **Barres GRISES** ⚪
   - Mouhcine, Zaineb +1, Jean Dupont, etc.
   
3. **Conflits** → **Barres ROUGES** 🔴
   - Toujours prioritaire sur les autres couleurs

## Test de Validation

Pour vérifier que la correction fonctionne :

1. Ouvrir le calendrier (desktop et mobile)
2. Vérifier que **HM52S5FSAZ**, **HMKNEJMCRM** sont en **NOIR** ⚫
3. Vérifier que **Mouhcine**, **Zaineb +1** sont en **GRIS** ⚪
4. Vérifier que les conflits restent en **ROUGE** 🔴

## Notes Techniques

- La logique est maintenant **cohérente** entre desktop, mobile, et CalendarView
- Les `colorOverrides` dans CalendarView définissent les couleurs qui sont ensuite appliquées par CalendarBookingBar
- La priorité est donnée aux **codes Airbnb** (NOIR) avant les **noms validés** (GRIS) pour éviter les faux positifs
- La fonction `getBookingDocumentStatus()` détermine si une réservation est validée (documents complets)

## Résultat Attendu

Après ces corrections :

1. **Réservations validées** (avec noms de guests) → **Barres GRISES** ⚪
   - Exemple : "Mouhcine", "Zaineb"
   
2. **Réservations non validées** (avec codes ICS/Airbnb) → **Barres NOIRES** ⚫
   - Exemple : "HM8548HWET", "CLXYZ123"
   
3. **Réservations en conflit** → **Barres ROUGES** 🔴
   - Toujours prioritaire sur les autres couleurs

## Test de Validation

Pour vérifier que la correction fonctionne :

1. Ouvrir le calendrier (desktop et mobile)
2. Vérifier que les réservations avec des noms (Mouhcine, Zaineb) sont en **gris**
3. Vérifier que les réservations avec des codes (HM..., CL...) sont en **noir**
4. Vérifier que les conflits restent en **rouge**

## Notes Techniques

- La logique est maintenant **cohérente** entre desktop et mobile
- La détermination de la couleur se base sur le **displayLabel** (texte affiché) et non sur le status de la réservation
- La fonction `isValidGuestName()` a été assouplie pour accepter les noms simples (un seul mot) comme "Mouhcine" ou "Zaineb"
