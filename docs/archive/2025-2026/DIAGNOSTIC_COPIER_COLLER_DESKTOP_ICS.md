# Diagnostic : Copier-coller desktop / réservations ICS

## Problèmes signalés

1. **Desktop recevait le comportement "mobile"** : en copiant le lien d’une propriété (lien guest) sur desktop, l’interface se comportait comme sur mobile (ouverture du ShareModal au lieu d’une simple copie dans le presse-papiers).
2. **Réservations issues de liens ICS** : impossible de copier le lien pour ces réservations.

---

## Causes identifiées

### 1. Détection mobile : userAgent vs viewport

- La décision **« ouvrir le ShareModal ou seulement copier »** utilisait **`isMobile()`** de `@/lib/shareUtils`, basée sur le **userAgent** (Android, iPhone, iPad, etc.).
- Conséquences :
  - En **mode appareil** dans les DevTools, ou avec un userAgent type tablette, le desktop pouvait être considéré comme mobile et ouvrir le ShareModal.
  - Comportement incohérent avec le reste de l’app, qui utilise le **viewport** (breakpoint 768px) via `useIsMobile()` pour l’UI.

### 2. Réservations ICS : mauvais identifiant envoyé au backend

- Pour générer le lien guest, l’app envoyait **`booking.id`** (UUID de la table `bookings`) comme **`airbnbCode`** à l’edge function `issue-guest-link`.
- Les réservations **ICS/Airbnb** sont identifiées côté backend par **`booking_reference`** (ex. `HM12345678`), pas par l’UUID.
- En envoyant l’UUID, le backend ne retrouvait pas la bonne réservation ICS, ce qui pouvait faire échouer la génération du lien ou produire un lien non associé à la bonne résa.

### 3. Dates en réservations ICS

- Dans `BookingDetailsModal`, les dates étaient passées via **`new Date(booking.checkInDate)`**.
- Pour une chaîne **YYYY-MM-DD**, `new Date("YYYY-MM-DD")` est interprétée en **UTC minuit**, ce qui peut décaler la date d’un jour selon le fuseau. Utiliser **`parseLocalDate`** (comme ailleurs dans l’app) évite ce décalage.

---

## Corrections appliquées

### 1. Desktop = copie seule, mobile = ShareModal (viewport)

- **PropertyDetail** : `isMobileDevice()` remplacé par **`useIsMobile()`** (viewport &lt; 768px).  
  → Sur desktop (largeur ≥ 768px) : copie dans le presse-papiers + toast, pas de ShareModal.
- **BookingDetailsModal** : idem, **`useIsMobile()`** à la place de **`isMobileDevice()`**.
- **UnifiedBookingModal** : dans `handleGenerateGuestLink`, utilisation de **`isMobile`** du hook **`useIsMobile()`** (déjà présent) au lieu de **`isMobileDevice()`**.  
  → Comportement aligné sur la largeur d’écran ; le texte d’aide sous le bouton « Copier le lien » utilise aussi **`isMobile`**.

### 2. ICS : envoyer le code réservation au backend

- **UnifiedBookingModal** (réservations manuelles / ICS) :  
  `generatePropertyVerificationUrl(propertyId, manualBooking.bookingReference || manualBooking.id, { ... })`.  
  → Quand une résa a un **bookingReference** (ex. ICS/Airbnb), c’est ce code qui est envoyé comme **airbnbCode**.
- **BookingDetailsModal** :  
  `generatePropertyVerificationUrl(propertyId, booking.bookingReference || booking.id, { ... })`.  
  → Même logique pour les réservations ouvertes depuis ce modal.

### 3. Dates avec parseLocalDate (BookingDetailsModal)

- **BookingDetailsModal** :  
  - Import de **`parseLocalDate`** depuis **`@/utils/dateUtils`**.  
  - Pour **startDate** / **endDate** dans **reservationData** : si la valeur est une chaîne, utilisation de **`parseLocalDate(...)`**, sinon **`new Date(...)`**.  
  → Pas de décalage de jour lié au fuseau pour les liens générés depuis ce modal.

---

## Fichiers modifiés

| Fichier | Modifications |
|--------|----------------|
| `src/components/PropertyDetail.tsx` | `useIsMobile()` à la place de `isMobileDevice()` pour ouvrir ou non le ShareModal. |
| `src/components/UnifiedBookingModal.tsx` | Utilisation de `isMobile` (hook) dans le handler + passage de `manualBooking.bookingReference \|\| manualBooking.id` pour la génération du lien. Suppression de l’import `isMobileDevice`. |
| `src/components/BookingDetailsModal.tsx` | `useIsMobile()`, `parseLocalDate` pour les dates, et `booking.bookingReference \|\| booking.id` pour l’appel à `generatePropertyVerificationUrl`. |

---

## Comportement attendu après correctifs

- **Desktop (viewport ≥ 768px)** : clic sur « Copier le lien » (propriété ou réservation) → copie dans le presse-papiers + toast ; **pas** d’ouverture du ShareModal.
- **Mobile (viewport &lt; 768px)** : clic sur « Copier le lien » → copie + ouverture du ShareModal (partage WhatsApp, SMS, etc.).
- **Réservations ICS** : génération du lien avec le bon **booking_reference** envoyé au backend ; le lien doit s’associer correctement à la réservation ICS et la copie doit fonctionner comme pour les autres réservations.
