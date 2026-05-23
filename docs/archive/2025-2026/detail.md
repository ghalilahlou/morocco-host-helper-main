# Analyse détaillée : Calendrier & Cartes (Bookings)

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Liste complète des fichiers](#2-liste-complète-des-fichiers)
3. [Interactions avec la base de données (Supabase)](#3-interactions-avec-la-base-de-données-supabase)
4. [Catalogue des fonctions par fichier](#4-catalogue-des-fonctions-par-fichier)
5. [Flux de données : DB → Affichage](#5-flux-de-données-db--affichage)
6. [Relations entre composants](#6-relations-entre-composants)
7. [Souscriptions temps réel (Realtime)](#7-souscriptions-temps-réel-realtime)
8. [Cache multi-niveaux](#8-cache-multi-niveaux)
9. [Tables Supabase utilisées](#9-tables-supabase-utilisées)

---

## 1. Vue d'ensemble de l'architecture

```
PropertyDetail (hub principal)
  ├── useBookings(propertyId)  ──→  Supabase: bookings, guests, contract_signatures
  │                                   + enrichissement: guest_submissions
  │
  ├── Dashboard / MobileDashboard
  │     ├── CalendarView  ──→  Mode calendrier
  │     │     ├── CalendarHeader
  │     │     ├── CalendarGrid  ──→  CalendarBookingBar (desktop)
  │     │     ├── CalendarMobile (mobile)
  │     │     ├── ConflictModal / ConflictCadran
  │     │     └── UnifiedBookingModal  ──→  Détails réservation
  │     │
  │     └── BookingCard  ──→  Mode cartes (liste)
  │
  └── BookingWizard  ──→  Création / édition de réservation
```

Le point d'entrée n'est **pas** dans `src/pages/` mais dans `src/components/PropertyDetail` qui est monté via la route `property/:propertyId` dans `App.tsx`.

---

## 2. Liste complète des fichiers

### 2.1 Composants Calendrier

| Fichier | Rôle |
|---------|------|
| `src/components/CalendarView.tsx` | Composant principal du calendrier - orchestre tout l'affichage calendrier |
| `src/components/calendar/CalendarHeader.tsx` | En-tête du calendrier (navigation mois, légende, boutons sync) |
| `src/components/calendar/CalendarGrid.tsx` | Grille desktop du calendrier (jours + barres de réservation) |
| `src/components/calendar/CalendarMobile.tsx` | Vue mobile du calendrier (scroll vertical par mois) |
| `src/components/calendar/CalendarBookingBar.tsx` | Barre visuelle d'une réservation dans la grille |
| `src/components/calendar/CalendarUtils.ts` | Fonctions utilitaires pures (génération jours, layout, conflits) |
| `src/components/calendar/ReservationStatusIcons.tsx` | Icônes SVG (checkin non fait, conflit) |
| `src/components/calendar/ConflictCadran.tsx` | Cadran visuel pour les conflits dans la grille |
| `src/components/calendar/AirbnbSyncModal.tsx` | Modal de configuration de la sync Airbnb ICS |
| `src/components/ui/calendar.tsx` | Composant UI de base (DatePicker react-day-picker) |
| `src/components/ui/enhanced-calendar.tsx` | Calendrier amélioré avec animations Framer Motion |

### 2.2 Composants Cartes (BookingCard)

| Fichier | Rôle |
|---------|------|
| `src/components/BookingCard.tsx` | Carte de réservation principale (desktop) - affiche résumé + actions |
| `src/components/optimized/BookingCard.tsx` | Version optimisée/allégée de BookingCard |
| `src/components/mobile/MobileBookingCard.tsx` | Carte de réservation mobile (animations, expansion) |

### 2.3 Modales de réservation

| Fichier | Rôle |
|---------|------|
| `src/components/UnifiedBookingModal.tsx` | Modal principal : détails complets d'une réservation |
| `src/components/BookingDetailsModal.tsx` | Modal alternatif pour détails de réservation |
| `src/components/AirbnbReservationModal.tsx` | Modal pour les réservations Airbnb importées |
| `src/components/BookingPasswordModal.tsx` | Modal mot de passe invité |
| `src/components/ConflictModal.tsx` | Modal affichant les conflits de dates |

### 2.4 Wizard de création

| Fichier | Rôle |
|---------|------|
| `src/components/BookingWizard.tsx` | Assistant multi-étapes de création/édition de réservation |
| `src/components/wizard/BookingDetailsStep.tsx` | Étape 1 : dates, nombre d'invités |
| `src/components/mobile/MobileBookingWizard.tsx` | Version mobile du wizard |

### 2.5 Hooks

| Fichier | Rôle |
|---------|------|
| `src/hooks/useBookings.ts` | Hook principal : CRUD bookings + cache + realtime + enrichissement |
| `src/hooks/useBookingsQuery.ts` | Hook alternatif basé sur React Query (TanStack) |

### 2.6 Services

| Fichier | Rôle |
|---------|------|
| `src/services/airbnbSyncService.ts` | Service de synchronisation Airbnb (stubs dépréciés + couleurs) |
| `src/services/calendarData.ts` | Chargement des événements calendrier (Airbnb + bookings) |
| `src/services/multiLevelCache.ts` | Cache mémoire + IndexedDB avec TTL |
| `src/services/guestSubmissionService.ts` | Enrichissement des bookings avec les soumissions invités |
| `src/services/bookingResolve.ts` | Résolution de réservation par token/code Airbnb |
| `src/services/bookingVerificationService.ts` | Vérification de la complétude d'une réservation |

### 2.7 Utilitaires

| Fichier | Rôle |
|---------|------|
| `src/utils/bookingDisplay.ts` | Fonctions d'affichage : noms invités, titres, initiales |
| `src/utils/bookingAirbnbMatch.ts` | Matching entre réservations manuelles et Airbnb |
| `src/utils/bookingDocuments.ts` | Statut des documents (contrat, police, identité) |
| `src/utils/dateUtils.ts` | Parsing et formatage de dates locales |

### 2.8 Domaine

| Fichier | Rôle |
|---------|------|
| `src/domain/calendarReservationModel.ts` | Logique métier : fusion bookings/Airbnb, labels, badges |
| `src/domain/calendarReservationModel.test.ts` | Tests unitaires du modèle |

### 2.9 Types et constantes

| Fichier | Rôle |
|---------|------|
| `src/types/booking.ts` | Interfaces `Guest`, `Property`, `Booking`, `UploadedDocument` |
| `src/constants/bookingColors.ts` | Couleurs par statut (pending, completed, confirmed, conflict, airbnb) |

### 2.10 Infrastructure Supabase

| Fichier | Rôle |
|---------|------|
| `src/integrations/supabase/client.ts` | Création du client Supabase (URL + clé anonyme) |
| `src/integrations/supabase/types.ts` | Types TypeScript générés depuis le schéma DB |

### 2.11 Admin

| Fichier | Rôle |
|---------|------|
| `src/components/admin/AdminBookings.tsx` | Liste admin des réservations |
| `src/components/admin/AdminBookingDetailModal.tsx` | Détail admin d'une réservation |
| `src/components/admin/AdminBookingActions.tsx` | Actions admin (modifier, supprimer) |

---

## 3. Interactions avec la base de données (Supabase)

### 3.1 Table `bookings`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `useBookings.ts` | **SELECT** | `BOOKINGS_SELECT` (avec joins `guests`, `properties`), filtré par `user_id`, optionnel `property_id`, dates, ordre `check_in_date desc`, limit |
| `useBookings.ts` | **INSERT** | Nouvelle réservation : `user_id, property_id, check_in_date, check_out_date, number_of_guests, booking_reference, guest_name, status, documents_generated` |
| `useBookings.ts` | **UPDATE** | Mise à jour partielle avec concurrence optimiste (`updated_at`), auto-heal `status: 'confirmed'` |
| `useBookings.ts` | **DELETE** | Suppression cascade : `guest_submissions` → `guests` → `uploaded_documents` → `airbnb_reservations` (nullify) → `bookings` |
| `useBookingsQuery.ts` | **SELECT** | Via vue `mv_bookings_enriched` (fallback `bookings` avec joins) |
| `useBookingsQuery.ts` | **INSERT** | Même structure que `useBookings` |
| `useBookingsQuery.ts` | **UPDATE** | Mise à jour partielle (sans concurrence optimiste) |
| `useBookingsQuery.ts` | **DELETE** | Cascade identique à `useBookings` |
| `CalendarView.tsx` | **UPDATE** | `status: 'completed'` ou `'confirmed'` pour les réservations matchées Airbnb |
| `CalendarView.tsx` | **DELETE** | Suppression directe (⚠️ sans cascade des tables liées) |
| `BookingWizard.tsx` | **INSERT** | Création avec ID optionnel, `guest_email`, `status: 'pending'` |
| `BookingWizard.tsx` | **UPDATE** | `documents_generated`, `status`, `guest_name` après génération docs |
| `BookingWizard.tsx` | **RPC** | `check_booking_conflicts(p_property_id, p_check_in_date, p_check_out_date, p_exclude_booking_id)` |
| `BookingWizard.tsx` | **RPC** | `sync_booking_guests(p_booking_id, p_guests)` |
| `UnifiedBookingModal.tsx` | **SELECT** | `documents_generated` uniquement si pas fourni par les props |
| `AdminBookings.tsx` | **SELECT** | Avec joins/filtres admin |
| `AdminBookings.tsx` | **RPC** | `admin_update_booking_status` |
| `AdminBookingActions.tsx` | **UPDATE** | Modification admin |
| `AdminBookingActions.tsx` | **DELETE** | Suppression admin |
| `testBookingUpdate.ts` | **UPDATE** | Test de mise à jour |
| `testBookingUpdate.ts` | **SELECT** | Vérification schéma |

### 3.2 Table `guests`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `useBookings.ts` | **INSERT** | Batch : `booking_id, full_name, date_of_birth, document_number, nationality, place_of_birth, document_type` |
| `useBookings.ts` | **DELETE** | `.eq('booking_id', id)` lors de la suppression d'un booking |
| `useBookingsQuery.ts` | **INSERT** | Identique |
| `useBookingsQuery.ts` | **DELETE** | `.eq('booking_id', id)` |
| `BookingWizard.tsx` | **INSERT** | Via `fetch` REST direct + fallback |
| `BookingWizard.tsx` | **SELECT** | Vérification après création |
| `BookingWizard.tsx` | **DELETE** | `.eq('booking_id', editingBooking.id)` pour re-création |

### 3.3 Table `airbnb_reservations`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `calendarData.ts` | **SELECT** | `airbnb_booking_id, summary, guest_name, start_date, end_date` filtré par `property_id`, overlap dates |
| `useBookings.ts` | **UPDATE** | Nullify `guest_name`, update `summary` lors de la suppression d'un booking lié |
| `CalendarView.tsx` | **Realtime** | `postgres_changes` sur `property_id` → rechargement Airbnb |
| `AirbnbReservationModal.tsx` | **DELETE** | `.eq('id', reservation.id)` |

### 3.4 Table `guest_submissions`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `guestSubmissionService.ts` | **SELECT** | `id, booking_id, guest_data, document_urls, signature_data, status, submitted_at` filtré par booking IDs, limit 200 |
| `useBookings.ts` | **DELETE** | `.eq('booking_id', id)` lors de suppression cascade |
| `useBookingsQuery.ts` | **DELETE** | Identique |
| `UnifiedBookingModal.tsx` | **SELECT** | `id, document_urls, guest_data, submitted_at` pour un booking spécifique |
| `BookingDetailsModal.tsx` | **SELECT** | Appels similaires |

### 3.5 Table `contract_signatures`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `useBookings.ts` | **SELECT** | `booking_id, signer_name, created_at` pour enrichir les bookings avec le nom du signataire |
| `BookingCard.tsx` | **SELECT** | `signer_name` pour un booking (maybeSingle) + `booking_id` pour vérification |
| `UnifiedBookingModal.tsx` | **SELECT** | `signer_name` pour affichage dans le modal |
| `BookingDetailsModal.tsx` | **SELECT** | Similaire |

### 3.6 Table `uploaded_documents`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `BookingCard.tsx` | **SELECT** | `id` filtré par `booking_id` et `document_type` in `['contract','police','identity']` |
| `UnifiedBookingModal.tsx` | **SELECT** | `id, document_url, file_path, document_type, is_signed, extracted_data` avec embed `guests(full_name, document_number)` |
| `useBookings.ts` | **DELETE** | `.eq('booking_id', id)` lors de suppression cascade |
| `useBookingsQuery.ts` | **DELETE** | Identique |
| `AdminBookingDetailModal.tsx` | **SELECT** | Documents pour affichage admin |
| `BookingWizard.tsx` | **UPDATE** | `guest_id` après association |

### 3.7 Table `properties`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `BookingWizard.tsx` | **SELECT** | `id, user_id, name` pour vérification propriétaire |

### 3.8 Table/Vue `generated_documents`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `BookingCard.tsx` | **SELECT** | `id` filtré par `booking_id` et `document_type` |

### 3.9 Vue `mv_bookings_enriched`

| Fichier | Opération | Détails |
|---------|-----------|---------|
| `useBookingsQuery.ts` | **SELECT** | Vue matérialisée avec colonnes enrichies (submissions, counts, etc.) |

### 3.10 Supabase Edge Functions

| Fichier | Fonction Edge | Détails |
|---------|---------------|---------|
| `BookingWizard.tsx` | `submit-guest-info-unified` | Soumission invité directe par l'hôte |
| `BookingWizard.tsx` | `generate-police-form` | Génération du formulaire police |
| `UnifiedBookingModal.tsx` | `get-guest-documents-unified` | Récupération documents invité |
| `BookingDetailsModal.tsx` | `generate-police-form` | Génération police |
| `BookingDetailsModal.tsx` | `submit-guest-info-unified` | Soumission invité |
| `bookingVerificationService.ts` | `get-booking-verification-summary` | Résumé de vérification |

### 3.11 Supabase Storage

| Fichier | Bucket | Opération |
|---------|--------|-----------|
| `UnifiedBookingModal.tsx` | `guest-documents` | `createSignedUrl(file_path, 3600)` |
| `AdminBookingDetailModal.tsx` | `guest-documents` | `getPublicUrl` |
| `BookingWizard.tsx` | `guest-documents` | `createSignedUrl` |

---

## 4. Catalogue des fonctions par fichier

### 4.1 `src/utils/bookingDisplay.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `isDossierValidatedForDisplay` | `(booking: Booking \| AirbnbReservation) => boolean` | Vérifie si le dossier est validé (status completed OU contrat+police générés) |
| `cleanGuestName` | `(name: string \| null) => string` | Nettoie un nom : supprime codes, préfixes Airbnb, normalise espaces |
| `isIcalAirbnbTechnicalUid` | `(s: string \| null) => boolean` | Détecte les UID techniques iCal (@airbnb.com, UUID-style) |
| `humanizeBookingReferenceForDisplay` | `(ref: string \| null) => string` | Convertit une référence en texte humain lisible |
| `isAirbnbCode` | `(name: string \| null) => boolean` | Détecte si un nom est en fait un code Airbnb (HM..., 2 lettres, etc.) |
| `isValidGuestName` | `(name: string) => boolean` | Vérifie qu'un nom est un vrai nom humain (longueur, voyelles, mots interdits) |
| `getFirstName` | `(fullName: string) => string` | Extrait le prénom (premier token après nettoyage) |
| `formatGuestDisplayName` | `(firstName: string, totalGuests?: number) => string` | Formate "Prénom +N" si plusieurs invités |
| `getBookingCode` | `(booking: Booking \| AirbnbReservation) => string` | Récupère le code de réservation (Airbnb ID ou référence ou 8 premiers chars de l'ID) |
| `getUnifiedBookingDisplayText` | `(booking, _isStart?) => string` | Texte d'affichage unifié : priorité noms réels > guest rows > guest_name > code |
| `getBookingDisplayTitle` | `(booking, options?) => string` | Titre affiché avec fallback signerName |
| `getGuestInitials` | `(booking) => string` | Initiales (2 chars max) depuis les noms réels ou guest_name |

**Utilisé par :** `CalendarView`, `CalendarBookingBar`, `CalendarMobile`, `CalendarUtils`, `ConflictModal`, `BookingCard`, `AirbnbReservationModal`, `calendarData`, `calendarReservationModel`

### 4.2 `src/utils/bookingAirbnbMatch.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `isMatchingReservation` | `(manualCheckIn, manualCheckOut, manualRef, airbnbStart, airbnbEnd, airbnbId) => boolean` | Match par dates locales OU par référence croisée |
| `doBookingAndAirbnbMatch` | `(booking: Booking, reservation: AirbnbReservation) => boolean` | Wrapper haut niveau pour matcher un booking avec une réservation Airbnb |
| `isSameReservationByRef` | `(ref1, ref2) => boolean` | Compare deux références (égalité ou inclusion bidirectionnelle) |

**Utilisé par :** `CalendarView`, `CalendarUtils`, `calendarReservationModel`

### 4.3 `src/utils/bookingDocuments.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `getBookingDocumentStatus` | `(booking) => { hasContract, hasPolice, hasGuests, isValidated }` | Statut complet des documents d'un booking |
| `hasValidatedDocuments` | `(booking) => boolean` | Shortcut : documents validés ? |
| `hasAllRequiredDocumentsForCalendar` | `(booking) => boolean` | Vérifie contrat + police + identité + status completed |

**Utilisé par :** `CalendarView`, `CalendarUtils`, `airbnbSyncService`

### 4.4 `src/utils/dateUtils.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `parseLocalDate` | `(dateString: string) => Date` | Parse YYYY-MM-DD en date locale (évite les décalages UTC) |
| `formatLocalDate` | `(date: Date) => string` | Formate une Date en YYYY-MM-DD local |
| `toDateString` | `(date: Date \| string) => string` | Normalise en YYYY-MM-DD |
| `extractDateOnly` | `(dateValue) => string` | Extrait la partie date d'un ISO string |

**Utilisé par :** `CalendarView`, `CalendarMobile`, `calendarData`, `ConflictModal`

### 4.5 `src/domain/calendarReservationModel.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `labelFromAirbnbReservationRow` | `(row: { guest_name?, summary?, airbnb_booking_id? }) => string` | Label humain pour une ligne Airbnb de la DB : nom nettoyé > summary > ID non-technique > label par défaut |
| `isIcsCalendarTechnicalKey` | `(item: Booking \| AirbnbReservation) => boolean` | Détecte si l'item a une clé technique iCal |
| `shouldShowIcalSyncBadge` | `(item, displayTitle) => boolean` | Afficher le badge "sync iCal" ? |
| `mergeBookingsWithAirbnbForCalendar` | `(bookings, airbnbReservations) => CalendarMergeResult` | Fusionne les deux listes en supprimant les doublons Airbnb matchés |

**Utilisé par :** `CalendarView`, `CalendarBookingBar`, `CalendarMobile`

### 4.6 `src/services/calendarData.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `fetchAirbnbCalendarEvents` | `(propertyId, start, end) => Promise<CalendarEvent[]>` | Charge les réservations Airbnb depuis `airbnb_reservations` avec cache mémoire 10s |
| `invalidateAirbnbEventsCache` | `(propertyId?) => void` | Invalide le cache des événements Airbnb |
| `fetchAllCalendarEvents` | `(propertyId, start, end, bookings?) => Promise<CalendarEvent[]>` | Combine événements Airbnb + bookings manuels en CalendarEvents |

**Utilisé par :** `CalendarView`

### 4.7 `src/services/airbnbSyncService.ts`

| Classe/Méthode | Signature | Rôle |
|----------------|-----------|------|
| `AirbnbSyncService.fetchAndParseICS` | `static async (icsUrl) => Promise<AirbnbReservation[]>` | ⚠️ **STUB DÉPRÉCIÉ** - retourne `[]` |
| `AirbnbSyncService.parseICSContent` | `static (icsContent) => AirbnbReservation[]` | ⚠️ **STUB DÉPRÉCIÉ** - retourne `[]` |
| `AirbnbSyncService.syncWithExistingBookings` | `static async (airbnbReservations, existingBookings) => Promise<SyncResult>` | ⚠️ **STUB DÉPRÉCIÉ** - passe-plat |
| `AirbnbSyncService.getBookingStatusColor` | `static (booking, matchedBookings, conflicts) => string` | Retourne la classe Tailwind de couleur selon le statut et les conflits |
| `AirbnbSyncService.getAirbnbReservationColor` | `static (reservation, matchedBookings, conflicts) => string` | Couleur fixe `'bg-[#222222]'` pour les lignes Airbnb |

**Types exportés :** `AirbnbReservation` (interface complète), `SyncResult`

**Utilisé par :** Quasi tous les composants calendrier et cartes comme type

### 4.8 `src/services/guestSubmissionService.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `invalidateSubmissionsCache` | `() => void` | Vide le cache mémoire des soumissions |
| `enrichBookingsWithGuestSubmissions` | `async (bookings: Booking[]) => Promise<EnrichedBooking[]>` | Enrichit les bookings avec les noms réels, le nombre de documents, la signature |

**Type exporté :** `EnrichedBooking` (extends `Booking` avec `realGuestNames`, `realGuestCount`, `hasRealSubmissions`, `submissionStatus`)

**Utilisé par :** `useBookings`, `useBookingsQuery`

### 4.9 `src/services/multiLevelCache.ts`

| Méthode | Signature | Rôle |
|---------|-----------|------|
| `multiLevelCache.get` | `async <T>(key, allowExpired?) => Promise<T \| null>` | Lecture : mémoire (L1) → IndexedDB (L2), respect TTL |
| `multiLevelCache.getExpired` | `async <T>(key) => Promise<T \| null>` | Lecture acceptant les entrées expirées |
| `multiLevelCache.set` | `async <T>(key, data, ttl?) => Promise<void>` | Écriture : mémoire toujours, IDB si TTL > 60s |
| `multiLevelCache.invalidate` | `async (key) => Promise<void>` | Supprime une clé des deux niveaux |
| `multiLevelCache.invalidatePattern` | `async (pattern) => Promise<void>` | Supprime par pattern (contient) |
| `multiLevelCache.cleanup` | `async () => Promise<void>` | Nettoie les entrées expirées (auto toutes les 5 min) |
| `multiLevelCache.clear` | `async () => Promise<void>` | Vide tout |
| `multiLevelCache.getStats` | `() => { memorySize, memoryKeys }` | Statistiques du cache mémoire |

**Utilisé par :** `useBookings`, `useBookingsQuery`, `CalendarView` (invalidation)

### 4.10 `src/components/calendar/CalendarUtils.ts`

| Fonction | Signature | Rôle |
|----------|-----------|------|
| `generateCalendarDays` | `(currentDate: Date) => CalendarDay[]` | Génère les jours du mois pour la grille (avec padding début/fin) |
| `calculateBookingLayout` | `(calendarDays, bookings, colorOverrides?) => BookingLayout` | Calcule la position (row, span, style) de chaque réservation dans la grille |
| `detectBookingConflicts` | `(bookings) => ConflictInfo[]` | Détecte les chevauchements de dates entre réservations |
| `getBookingDisplayText` | `(booking) => string` | Délègue à `getUnifiedBookingDisplayText` |
| `getGuestInitials` | `(booking) => string` | Délègue à `bookingDisplay.getGuestInitials` |
| `getBookingCheckoutDate` | `(booking) => Date \| null` | Parse la date de checkout |
| `isBookingStayPast` | `(booking) => boolean` | Vérifie si le séjour est dans le passé |

**Constantes exportées :** `BAR_GAP_PERCENT`, `BOOKING_COLORS`

**Utilisé par :** `CalendarView`, `CalendarGrid`, `CalendarMobile`, `CalendarBookingBar`

### 4.11 `src/hooks/useBookings.ts`

| Fonction retournée | Signature | Rôle |
|--------------------|-----------|------|
| `bookings` | `EnrichedBooking[]` | Liste enrichie (noms réels, docs, signatures) filtrée par propriété |
| `isLoading` | `boolean` | État de chargement |
| `addBooking` | `(booking: Booking) => Promise<void>` | INSERT booking + guests, invalide cache, recharge |
| `updateBooking` | `(id, updates: Partial<Booking>) => Promise<void>` | UPDATE avec concurrence optimiste (check `updated_at`) |
| `deleteBooking` | `(id: string) => Promise<void>` | Cascade : guest_submissions → guests → uploaded_documents → airbnb_reservations (nullify) → bookings |
| `getBookingById` | `(id: string) => EnrichedBooking \| undefined` | Recherche locale |
| `refreshBookings` | `() => Promise<void>` | Invalidation cache + submissions + rechargement |

**Utilisé par :** `CalendarView`, `BookingCard`, `UnifiedBookingModal`, `BookingWizard`, `PropertyDetail`, `Dashboard`

### 4.12 `src/constants/bookingColors.ts`

| Clé | Hex | Rôle |
|-----|-----|------|
| `pending` | — | Réservation en attente |
| `confirmed` | — | Réservation confirmée |
| `completed` | — | Dossier validé |
| `conflict` | — | Conflit de dates |
| `airbnb` | — | Import Airbnb |
| `manual` | — | Réservation manuelle |
| `default` | — | Par défaut |

Chaque couleur contient : `hex`, `gradient`, `tailwind`, `text`, `shadow`, `hover`

**Utilisé par :** `CalendarView`, `CalendarHeader`, `CalendarGrid`, `CalendarBookingBar`, `CalendarMobile`, `AirbnbSyncModal`, `BookingCard`, `UnifiedBookingModal`, `AirbnbReservationModal`, `airbnbSyncService`

---

## 5. Flux de données : DB → Affichage

### 5.1 Chargement initial des réservations manuelles

```
PropertyDetail
  └── useBookings({ propertyId })
        ├── Supabase SELECT bookings (+ joins guests, properties)
        ├── Supabase SELECT contract_signatures (signer_name)
        ├── enrichBookingsWithGuestSubmissions() ──→ Supabase SELECT guest_submissions
        ├── multiLevelCache.set() ──→ IndexedDB + mémoire
        └── setState(bookings: EnrichedBooking[])
              │
              ▼
        Dashboard / MobileDashboard
              │
        ┌─────┴─────┐
        ▼            ▼
  CalendarView    BookingCard (mode cartes)
```

### 5.2 Chargement des réservations Airbnb (calendrier)

```
CalendarView
  └── loadAirbnbReservations()
        └── fetchAirbnbCalendarEvents(propertyId, start, end)
              └── Supabase SELECT airbnb_reservations
                    ↓
              Cache mémoire (10s TTL)
                    ↓
              Mapping → AirbnbReservation[]
                    ↓
        mergeBookingsWithAirbnbForCalendar(bookings, airbnbReservations)
              ↓ supprime doublons Airbnb déjà matchés
        allReservations = [...bookings, ...uniqueAirbnb]
              ↓
        generateCalendarDays(currentDate)
              ↓
        calculateBookingLayout(calendarDays, allReservations, colorOverrides)
              ↓
        ┌──────────────┬─────────────────┐
        ▼              ▼                 ▼
  CalendarGrid    CalendarMobile    conflictDetails
  (desktop)       (mobile)          (ConflictModal)
```

### 5.3 Affichage d'une barre de réservation

```
CalendarBookingBar / CalendarMobile
  ├── getBookingDisplayTitle(booking) ──→ texte affiché
  ├── getGuestInitials(booking) ──→ initiales dans le cercle
  ├── shouldShowIcalSyncBadge() ──→ badge "sync iCal"
  ├── isDossierValidatedForDisplay() ──→ icône check ✓
  ├── isBookingStayPast() ──→ style passé/futur
  └── BOOKING_COLORS[status] ──→ couleur de la barre
```

### 5.4 Ouverture du détail d'une réservation

```
CalendarGrid/CalendarMobile → onClick
  └── CalendarView.handleBookingClick(booking)
        ├── Si Airbnb et match un booking manuel → ouvre le booking manuel
        ├── Si Airbnb sans match → ouvre AirbnbReservationModal
        └── Sinon → ouvre UnifiedBookingModal
              ├── Supabase SELECT contract_signatures
              ├── Supabase SELECT uploaded_documents (+ embed guests)
              ├── Supabase SELECT guest_submissions
              ├── Edge function: get-guest-documents-unified
              └── Storage: createSignedUrl pour les documents
```

---

## 6. Relations entre composants

### 6.1 Arbre de dépendances des imports

```
CalendarView
  ├── CalendarHeader
  │     └── (UI: boutons navigation, légende couleurs, sync Airbnb)
  │
  ├── CalendarGrid
  │     ├── CalendarBookingBar (×N pour chaque réservation visible)
  │     │     ├── ReservationStatusIcons
  │     │     ├── bookingDisplay (getBookingDisplayTitle, getGuestInitials)
  │     │     └── calendarReservationModel (shouldShowIcalSyncBadge)
  │     │
  │     └── ConflictCadran (×N pour chaque conflit)
  │
  ├── CalendarMobile (alternative mobile)
  │     ├── ReservationStatusIcons
  │     ├── bookingDisplay
  │     └── calendarReservationModel
  │
  ├── UnifiedBookingModal (ouvert au clic)
  │
  └── ConflictModal (ouvert sur alerte conflit)

BookingCard
  ├── bookingDisplay (getBookingDisplayTitle)
  ├── useBookings (updateBooking)
  ├── bookingVerificationService
  ├── unifiedDocumentService
  └── contractService

BookingWizard
  ├── BookingDetailsStep (dates, invités)
  ├── DocumentUploadStep
  ├── ReviewStep
  └── useBookings (addBooking, updateBooking, refreshBookings)
```

### 6.2 Qui utilise quoi

| Fonction utilitaire | Utilisée par |
|---------------------|-------------|
| `getBookingDisplayTitle` | CalendarBookingBar, CalendarMobile, CalendarView, BookingCard, CalendarUtils, calendarData |
| `getGuestInitials` | CalendarBookingBar, CalendarMobile, CalendarUtils |
| `isDossierValidatedForDisplay` | CalendarBookingBar, CalendarMobile, bookingDisplay |
| `cleanGuestName` | bookingDisplay (interne), calendarReservationModel |
| `doBookingAndAirbnbMatch` | CalendarView, calendarReservationModel |
| `getBookingDocumentStatus` | airbnbSyncService, CalendarView, bookingDocuments |
| `mergeBookingsWithAirbnbForCalendar` | CalendarView |
| `labelFromAirbnbReservationRow` | calendarData |
| `generateCalendarDays` | CalendarView |
| `calculateBookingLayout` | CalendarView |
| `detectBookingConflicts` | CalendarView |
| `enrichBookingsWithGuestSubmissions` | useBookings, useBookingsQuery |
| `multiLevelCache` | useBookings, useBookingsQuery, CalendarView |
| `parseLocalDate` | calendarData, CalendarView, CalendarMobile, UnifiedBookingModal |
| `formatLocalDate` | calendarData, CalendarView |
| `BOOKING_COLORS` | CalendarHeader, CalendarGrid, CalendarBookingBar, CalendarMobile, CalendarView, AirbnbSyncModal, UnifiedBookingModal, airbnbSyncService |

---

## 7. Souscriptions temps réel (Realtime)

### 7.1 Dans `useBookings.ts`

Canal : `bookings-rt-{userId}-{propertyId || 'all'}`

| Table | Événements | Filtre | Action |
|-------|-----------|--------|--------|
| `bookings` | INSERT, UPDATE, DELETE | `property_id=eq.{propertyId}` (si fourni) | Optimistic state update + debounced reload |
| `guests` | * | aucun (filtré côté JS) | Debounced reload |
| `guest_submissions` | * | aucun (filtré côté JS) | Debounced reload |
| `contract_signatures` | * | aucun (filtré côté JS) | Debounced reload |

### 7.2 Dans `CalendarView.tsx`

Canal : `airbnb-realtime-{propertyId}`

| Table | Événements | Filtre | Action |
|-------|-----------|--------|--------|
| `airbnb_reservations` | * | `property_id=eq.{propertyId}` | Debounced reload des réservations Airbnb |

---

## 8. Cache multi-niveaux

### 8.1 Architecture

```
Niveau 1 : Mémoire (Map JavaScript)
  - TTL par défaut : 60s
  - Accès instantané
  
Niveau 2 : IndexedDB (morocco-host-cache-v2)
  - TTL configurable (doit être > 60s pour être écrit)
  - Persiste entre les rechargements
  
Nettoyage automatique : toutes les 5 minutes
```

### 8.2 Clés de cache utilisées

| Pattern de clé | Fichier | TTL | Contenu |
|----------------|---------|-----|---------|
| `bookings-{propertyId\|'all'}-{userId}` | useBookings | 120s (IDB) | Liste des bookings avant enrichissement |
| `airbnb-events-{propertyId}-{start}-{end}` | calendarData | 10s (mémoire seule) | Événements Airbnb pour une période |
| `submissions-cache` | guestSubmissionService | 30s (mémoire seule) | Soumissions invités |

### 8.3 Invalidation

| Événement | Action |
|-----------|--------|
| Mutation booking (add/update/delete) | `multiLevelCache.invalidatePattern(propertyId)` + `invalidateSubmissionsCache()` |
| Sync Airbnb réussie | `multiLevelCache.invalidatePattern(propertyId)` + `invalidateAirbnbEventsCache(propertyId)` |
| Refresh manuel | Toutes les invalidations ci-dessus |
| Changement de propriété | `invalidateAirbnbEventsCache()` (tout) |

---

## 9. Tables Supabase utilisées

### 9.1 Résumé des tables

| Table | SELECT | INSERT | UPDATE | DELETE | RPC | Realtime | Storage |
|-------|--------|--------|--------|--------|-----|----------|---------|
| `bookings` | ✅ | ✅ | ✅ | ✅ | ✅ (`check_booking_conflicts`) | ✅ | — |
| `guests` | ✅ | ✅ | — | ✅ | ✅ (`sync_booking_guests`) | ✅ | — |
| `airbnb_reservations` | ✅ | — | ✅ | ✅ | — | ✅ | — |
| `guest_submissions` | ✅ | — | — | ✅ | — | ✅ | — |
| `contract_signatures` | ✅ | — | — | — | — | ✅ | — |
| `uploaded_documents` | ✅ | — | ✅ | ✅ | — | — | — |
| `generated_documents` | ✅ | — | — | — | — | — | — |
| `properties` | ✅ | — | — | — | — | — | — |
| `mv_bookings_enriched` | ✅ | — | — | — | — | — | — |
| `guest-documents` (bucket) | — | — | — | — | — | — | ✅ |

### 9.2 RPCs Supabase

| RPC | Fichier | Paramètres |
|-----|---------|------------|
| `check_booking_conflicts` | BookingWizard | `p_property_id, p_check_in_date, p_check_out_date, p_exclude_booking_id` |
| `sync_booking_guests` | BookingWizard | `p_booking_id, p_guests` |
| `admin_update_booking_status` | AdminBookings | paramètres admin |
| `delete_property_with_reservations` | (types.ts, utilisé ailleurs) | ID propriété |

### 9.3 Edge Functions

| Fonction | Fichier(s) appelants | Rôle |
|----------|---------------------|------|
| `submit-guest-info-unified` | BookingWizard, BookingDetailsModal | Soumission des infos invité |
| `generate-police-form` | BookingWizard, BookingDetailsModal | Génération formulaire police |
| `get-guest-documents-unified` | UnifiedBookingModal | Récupération documents |
| `get-booking-verification-summary` | bookingVerificationService | Résumé de vérification |

---

## Annexe : Points d'attention

1. **Suppression non-cascade dans CalendarView** : Les `DELETE` sur `bookings` dans `CalendarView.tsx` (onDeleteBooking) ne passent pas par `useBookings.deleteBooking()`, donc les tables liées (`guest_submissions`, `guests`, `uploaded_documents`) ne sont **pas** nettoyées. Cela peut créer des données orphelines.

2. **Deux hooks concurrents** : `useBookings` (custom) et `useBookingsQuery` (React Query) coexistent. Seul `useBookings` est activement utilisé par les composants principaux.

3. **AirbnbSyncService quasi-vide** : Les méthodes de parsing ICS sont des stubs dépréciés. La vraie synchronisation passe par les Edge Functions (`AirbnbEdgeFunctionService.syncReservations`).

4. **Cache à 3 niveaux indépendants** : Mémoire (calendarData), Mémoire+IDB (multiLevelCache), Mémoire (guestSubmissionService) — risque de désynchronisation.

5. **Types potentiellement désynchronisés** : `mv_bookings_enriched` et `generated_documents` sont utilisés dans le code mais absents des types générés dans `types.ts`.
