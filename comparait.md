# Comparaison : chargement des données — **Cartes** vs **Calendrier**

Ce document résume **comment** les informations (dont les **guests** et les **noms**) sont chargées pour la vue **cartes** et pour la vue **calendrier**, puis liste les **écarts** notables entre les deux flux.

---

## 1. Vue d’ensemble (d’où viennent les données ?)

| Aspect | Vue **Cartes** (`Dashboard` → `BookingCard`) | Vue **Calendrier** (`CalendarView` → barres) |
|--------|---------------------------------------------|---------------------------------------------|
| **Source principale** | Table Supabase **`bookings`** (+ relation **`guests`**) via `useBookings` | **Même** liste `bookings` enrichie **+** lignes **`airbnb_reservations`** (ICS) via `calendarData.fetchAirbnbCalendarEvents` |
| **Enrichissement « noms réels »** | `enrichBookingsWithGuestSubmissions` dans `useBookings` → `realGuestNames`, `hasRealSubmissions`, etc. | **Réutilise** les mêmes `EnrichedBooking` ; pour les lignes Airbnb, **fusion** dans `allReservations` (match dates/ref → copie `realGuestNames`, `guests`, etc. sur l’objet Airbnb) |
| **Filtrage UI** | Recherche + filtre statut « effectif » (docs contrat+police ⇒ `completed`) | Mois visible + `SHOW_ALL_BOOKINGS = true` (toutes les réservations manuelles affichées côté calendrier, sans le filtre « docs complets » prévu dans le code mort) |
| **Second fetch réseau par élément** | **Oui** : chaque **carte** lance des requêtes au montage (voir § 3) | **Non** pour les barres : tout vient du **state** déjà chargé (`bookings` + `airbnbReservations` + `useMemo`) |

---

## 2. Flux détaillé — **Cartes**

### 2.1 Chaîne de chargement

1. **`PropertyDetail`** appelle **`useBookings({ propertyId })`**.
2. **`loadBookings`** :
   - lit le cache **`multiLevelCache`** (clé par propriété / plage) ;
   - requête Supabase **`bookings`** avec `BOOKINGS_SELECT` incluant **`guests (id, full_name, …)`** ;
   - **`transformBooking`** : mappe chaque ligne SQL vers `Booking` (camelCase), dont **`guests[]`** avec `id`, `fullName`, etc. ;
   - affichage rapide avec `documentsLoading: true` puis **`enrichBookingsWithGuestSubmissions`** (soumissions invités) ;
   - optionnel : noms depuis **`contract_signatures.signer_name`** si `guest_name` est un placeholder.

3. **`Dashboard`** reçoit **`bookings: EnrichedBooking[]`** en props, applique **`filteredBookings`** (recherche, statut dérivé des docs).

4. **`BookingCard`** reçoit **une** réservation **`booking`**.

### 2.2 Affichage guest / titre sur la carte

| Information | Origine |
|-------------|---------|
| **Titre** | **`getUnifiedBookingDisplayText(booking, true)`** ; repli **`signerName`** (état local rempli async si `guest_name` vide) puis « Réservation sans nom » |
| **Liste « Clients enregistrés »** | **`booking.guests`** uniquement (lignes issues de la table **`guests`** liée au booking) |
| **Compteur « X client(s) »** | **`numberOfGuests`** (champ réservation), avec affichage **`guests.length / numberOfGuests`** si incohérent |
| **Documents / badges** | **`booking.documentsGenerated`** + requêtes **async** dans la carte (`BookingVerificationService`, `uploaded_documents`, `generated_documents`, `contract_signatures`) |

**Point clé** : la carte affiche les **guests enregistrés en base** (`guests`). Les **noms issus des soumissions** (`realGuestNames`) servent surtout le **titre** via `getUnifiedBookingDisplayText`, pas une liste séparée « soumissions » sur la carte.

---

## 3. Flux détaillé — **Calendrier**

### 3.1 Chaîne de chargement

1. **Même** **`useBookings`** → mêmes **`EnrichedBooking`** pour la propriété.

2. **`CalendarView`** en plus :
   - **`loadAirbnbReservations`** : pour le mois courant, **`fetchAirbnbCalendarEvents(propertyId, start, end)`** sur **`airbnb_reservations`** ;
   - cache **`AirbnbCache`** + cache **`airbnbEventsCache`** dans `calendarData.ts` ;
   - enrichissement inline avec **`bookingsRef` / `bookings`** (match) ;
   - abonnement realtime **`airbnb_reservations`** → rechargement throttlé.

3. **`allReservations` (`useMemo`)** :
   - pour chaque ligne Airbnb : si **`doBookingAndAirbnbMatch`** avec un booking → **fusion** (`realGuestNames`, `guest_name`, `guestName`, `guests`, `numberOfGuests`) ;
   - **`uniqueAirbnbReservations`** : Airbnb **sans** booking manuel associé ;
   - **`filteredBookings`** : ici toutes les réservations manuelles si `SHOW_ALL_BOOKINGS` ;
   - résultat : **`[...filteredBookings, ...uniqueAirbnbReservations]`**.

4. **`calculateBookingLayout`** positionne les barres ; **`CalendarBookingBar` / `CalendarMobile`** affichent le libellé.

### 3.2 Affichage guest / titre sur la barre

| Information | Origine |
|-------------|---------|
| **Texte sur la barre** | **`getUnifiedBookingDisplayText(réservation, true)`** sur un objet **`Booking` _ou_ `AirbnbReservation`** (éventuellement **enrichi** avec les champs du booking manuel) |
| **Liste détaillée des guests** | **Pas** sur la barre : seulement **prénom tronqué** / code / « Réservation » selon les priorités de **`bookingDisplay.ts`** |
| **Compteur +N** | **`numberOfGuests`** ou **`guests.length`** selon le type d’objet passé à la barre |

**Point clé** : le calendrier peut représenter un séjour soit comme **ligne `bookings`** (UUID), soit comme **ligne Airbnb** (`airbnb_booking_id`). Après match, les **mêmes** champs enrichis que la carte sont **injectés** sur l’objet Airbnb pour que **`getUnifiedBookingDisplayText`** se comporte comme sur une carte.

---

## 4. Tableau comparatif — chargement d’information

| Thème | Cartes | Calendrier |
|-------|--------|------------|
| **Table `bookings`** | Toujours la source des cartes | Toujours une des deux sources des barres |
| **Table `guests` (lignes enregistrées)** | Lu dans **`useBookings`** ; affiché en liste sur la carte | Repris sur l’objet **`Booking`** ; copié sur l’Airbnb **enrichi** si match |
| **Soumissions (`guest_submissions`)** | Agrégé dans **`realGuestNames`** via **`enrichBookingsWithGuestSubmissions`** | Même enrichissement ; réutilisé sur la barre via **`getUnifiedBookingDisplayText`** |
| **Réservations ICS seules (`airbnb_reservations`)** | **N’apparaissent pas** comme cartes séparées (pas de ligne `bookings` dédiée) — sauf si une ligne `bookings` existe avec la même ref | **Apparaissent** comme barres ; nom selon ICS / code / enrichissement si match |
| **Caches** | `multiLevelCache` (bookings), cache soumissions 30 s | + `AirbnbCache`, `airbnbEventsCache` (10 s) |
| **Requêtes Supabase supplémentaires** | **Par carte** au montage (vérification, docs, signatures) | **Par mois / sync** pour Airbnb ; pas de requête par barre |
| **Fonction d’affichage du nom** | **`getUnifiedBookingDisplayText`** + exception **`signerName`** sur la carte | **`getUnifiedBookingDisplayText`** uniquement (pas de `signerName` séparé sur la barre) |

---

## 5. Différences qui peuvent surprendre (résumé)

1. **Double nature calendrier** : une réservation peut être vue comme **booking UUID** ou comme **code Airbnb** ; les cartes ne montrent que des **bookings**. D’où l’importance du **match** et de l’ouverture de modale sur le **booking** quand il existe.

2. **Guest list** : la **carte** montre explicitement **`guests[]`** en base. Le **calendrier** ne montre qu’un **libellé court** (priorités soumissions → `guest_name` → `guests[0]` → code). Une incohérence « nom sur la barre vs liste sur la carte » peut venir de là.

3. **`signerName`** : utilisé comme repli sur la **carte** seulement ; pas dans **`getUnifiedBookingDisplayText`** par défaut — le titre peut différer légèrement du libellé calendrier si le nom vient uniquement des **signatures**.

4. **Charge réseau** : les **cartes** multiplient les appels (N cartes × plusieurs tables). Le **calendrier** concentre le coût sur le **chargement global** + ICS.

5. **Filtre « qui apparaît »** : le **dashboard cartes** filtre par **statut effectif** (docs). Le **calendrier** affiche (aujourd’hui) **toutes** les réservations manuelles du flag `SHOW_ALL_BOOKINGS` — pas le même critère que les commentaires du code pour « completed + tous les docs ».

---

## 6. Fichiers utiles pour aller plus loin

| Fichier | Rôle |
|---------|------|
| `src/hooks/useBookings.ts` | Chargement `bookings` + `guests`, enrichissement soumissions |
| `src/services/guestSubmissionService.ts` | `realGuestNames`, cache soumissions |
| `src/components/Dashboard.tsx` | Filtre vue cartes |
| `src/components/BookingCard.tsx` | Titre, liste guests, requêtes async par carte |
| `src/components/CalendarView.tsx` | Fusion bookings + Airbnb, `allReservations` |
| `src/services/calendarData.ts` | `airbnb_reservations` + cache événements |
| `src/utils/bookingDisplay.ts` | **`getUnifiedBookingDisplayText`** (point commun d’affichage du nom) |
| `src/utils/bookingAirbnbMatch.ts` | Match booking ↔ Airbnb |

---

*Document de synthèse : **comparait.md** — aligné sur le code du dépôt à la date de rédaction.*
