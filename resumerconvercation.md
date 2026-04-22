# Résumé de la conversation — calendrier, UID iCal, cache et affichage des invités

Ce document regroupe les **problématiques** que tu as soumises et les **orientations de solution** mises en œuvre dans le dépôt (hooks, utilitaires d’affichage, calendrier, modal, tests).

---

## 1. Noms d’invités / barres du calendrier après suppression (persistance fantôme)

### Symptôme
Après **suppression** d’une réservation, les **noms** continuaient d’apparaître sur les **barres du calendrier** (données « fantômes »).

### Cause principale
- Le cache multi-niveaux (**IndexedDB** / clés du type `bookings-v3-…`) était utilisé avec des **clés différentes** selon le contexte (vue par bien vs liste globale).
- Après une mutation (suppression / mise à jour), **seule une partie** du cache était invalidée.
- Au rechargement, **`mergeEnrichmentFromCache`** et la logique **`preserveSubmissionEnrichment`** pouvaient **réinjecter** d’anciennes données enrichies (`realGuestNames`, etc.) pour des lignes qui n’existaient plus ou n’étaient plus à jour côté serveur.

### Correctifs (côté code)
- **`invalidateBookingCachesAfterMutation`** dans `useBookings.ts` : invalide la clé du hook, la clé « tous les biens », et utilise **`invalidatePattern(propertyId)`** pour balayer les variantes de clés (y compris avec plage de dates).
- Appel systématique après **add / update / delete** (+ `invalidateSubmissionsCache` à la suppression).
- **`preserveSubmissionEnrichment`** resserré : on ne conserve les anciens `realGuestNames` que lorsque c’est **cohérent** (chargement enrichissement en cours, soumissions présentes mais noms non parsables, erreur d’enrichissement, timeout des soumissions) — **pas** lorsque le serveur indique clairement l’absence de soumissions (évite les noms obsolètes après suppression).

---

## 2. Affichage du « nom » avec un UID iCal (`UID:…@airbnb.com`)

### Symptôme
Libellés **illisibles** dans le modal et sur le calendrier : chaîne technique type **`UID:7f66…@airbnb.com`** au lieu d’un nom ou d’un libellé produit.

### Contexte métier (rappel)
- Ce n’est **pas** un code de confirmation court type **HM…**, mais un **identifiant unique iCalendar (RFC 5545)** fourni par Airbnb dans le flux **.ics / iCal**.
- Il sert à la **synchronisation** entre plateformes (création / mise à jour / suppression sans doublon), **pas** comme nom d’invité.

### Correctifs
- **`bookingDisplay.ts`** : détection **`isIcalAirbnbTechnicalUid`**, libellé de remplacement **`ICAL_AIRBNB_DISPLAY_LABEL`** (« Import calendrier Airbnb »), **`humanizeBookingReferenceForDisplay`**, intégration dans **`isAirbnbCode`** et dans **`getUnifiedBookingDisplayText`** / **`getBookingDisplayTitle`**.
- **`UnifiedBookingModal`** : titre et « code réservation » passent par **`getBookingDisplayTitle`** + **`humanizeBookingReferenceForDisplay`**, chargement du **nom signataire** (comme sur la carte booking) quand `guest_name` est un code / ICS.
- **`calendarData.ts`** + **`domain/calendarReservationModel.ts`** : **`labelFromAirbnbReservationRow`** pour ne **jamais** utiliser le UID brut comme titre d’événement issu de `airbnb_reservations`.

---

## 3. Noms d’invités qui ne s’affichent pas (ou reviennent souvent) sur le calendrier / cartes

### Symptôme
Les **noms réels** (soumissions, fiche invité) **n’apparaissaient pas** de façon fiable sur le **calendrier** et les **cartes**, malgré des correctifs partiels.

### Causes liées (non exhaustives)
- Enrichissement **asynchrone** : première passe « base » sans noms, puis enrichissement ; risque de **flash** ou d’**écrasement** si la logique de fusion est trop agressive ou trop laxiste.
- **`preserveSubmissionEnrichment`** : garde-fou utile contre le flash, mais pouvait **trop conserver** l’ancien état (voir §1).
- Réservations **ICS** : pas de nom riche dans le flux ; il faut **signataire**, **guests** en base, ou **`realGuestNames`** issus des soumissions — chemins multiples à aligner (`getBookingDisplayTitle`, enrichissement, cache).

### Correctifs
- Même couche d’affichage **`getBookingDisplayTitle`** partout (calendrier, cartes, modal quand c’est branché ainsi).
- Ajustements **`preserveSubmissionEnrichment`** + invalidation de cache après mutations (§1).
- Enrichissement **`useBookings`** : récupération **signataire** (`contract_signatures`) quand les noms manquent encore (logique déjà présente ; cohérente avec les UID / codes ICS).

---

## 4. Vue calendrier : fusion manuel / Airbnb et cache après synchro ICS

### Symptômes possibles
- Doublons ou incohérences entre **booking manuel** et **ligne Airbnb** (même séjour).
- Après **synchronisation** ICS, données **périmées** si le cache des réservations ne correspondait pas aux vraies clés.

### Correctifs
- **`mergeBookingsWithAirbnbForCalendar`** (`domain/calendarReservationModel.ts`) : une seule **source de vérité** pour la fusion (masquer la ligne ICS si un booking manuel **matche**).
- **`CalendarView`** : invalidation **`multiLevelCache.invalidatePattern(propertyId)`** après sync (les clés réelles sont du type **`bookings-v3-{uuid}…`**, pas `bookings-${id}` seul sans préfixe version).

---

## 5. UX : badge « iCal » et textes traduits

### Objectif
Indiquer visuellement une réservation **portée par la synchro calendrier / UID**, sans confondre avec un code HM court.

### Correctifs
- **`shouldShowIcalSyncBadge`** : affiche le badge surtout quand le libellé est **générique** (`Import calendrier Airbnb`) ou que la **clé** est un UID **sans** nom invité « valide » déjà affiché (évite un badge inutile quand un **vrai prénom** est montré).
- **`CalendarBookingBar`** / **`CalendarMobile`** : badge + infobulle.
- **i18n** : clés `calendar.icalBadge.short` et `calendar.icalBadge.tooltip` (FR / EN / ES).

---

## 6. Tests automatisés

- **`vitest`** + fichier **`src/domain/calendarReservationModel.test.ts`** : couverture des règles de libellé, de détection UID, de fusion, et (selon version du fichier) des règles de badge.

---

## 7. Déploiement Git

- Les changements ont été **commités** et **poussés** sur **`main`** du dépôt GitHub (opération réalisée depuis l’environnement de développement ; authentification GitHub requise côté machine).

---

## Fichiers souvent concernés (référence rapide)

| Zone | Fichiers |
|------|-----------|
| Cache & enrichissement | `src/hooks/useBookings.ts`, `src/services/guestSubmissionService.ts`, `src/services/multiLevelCache.ts` |
| Affichage noms / UID | `src/utils/bookingDisplay.ts` |
| Calendrier & données | `src/components/CalendarView.tsx`, `src/services/calendarData.ts`, `src/domain/calendarReservationModel.ts` |
| Barres UI | `src/components/calendar/CalendarBookingBar.tsx`, `src/components/calendar/CalendarMobile.tsx` |
| Modal | `src/components/UnifiedBookingModal.tsx` |
| i18n | `src/i18n/fr.ts`, `en.ts`, `es.ts` |
| Types Airbnb | `src/services/airbnbSyncService.ts` |

---

## Limites connues

- Les barres issues **uniquement** du flux ICS (sans ligne `bookings` correspondante) peuvent **rester** tant que la source iCal / `airbnb_reservations` les porte : ce n’est pas le même objet qu’une réservation **manuelle** supprimée dans l’app.
- Un **libellé produit** du type « Import calendrier Airbnb » reste un **placeholder** : le **vrai** nom arrive après **check-in invité**, **fiche**, ou **soumissions** selon ton flux métier.

---

*Document généré pour synthétiser les échanges sur la persistance des données, l’UID iCal, l’affichage des invités et la refonte progressive du calendrier.*
