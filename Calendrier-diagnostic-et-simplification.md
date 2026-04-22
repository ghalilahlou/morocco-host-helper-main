# Calendrier hôte — Diagnostic des conflits, instabilité et logique hardcodée

Ce document complète [Analyse Calendrier.md](./Analyse%20Calendrier.md) en se concentrant sur **pourquoi le calendrier peut « s’emballer »**, **où les logiques se télescopent**, et **comment réduire le hardcode** pour stabiliser le comportement.

---

## Analyse des logs console (session dev) — comportements suspects

> **Contexte** : traces réelles (clics calendrier, modale unifiée, `useGuestVerification`, enrichissement soumissions, navigation dashboard). Les points ci-dessous expliquent le **bruit**, les **re-fetch** et les **incohérences d’état** observables dans la console.

### Criticité haute — statut après correctifs

Les trois points ci-dessous ont été **rétablis / atténués dans le code** (voir colonne « Mesure »).

| Comportement observé | Source dans les logs | Risque initial | Mesure appliquée |
|----------------------|----------------------|----------------|------------------|
| **Enrichissement soumissions en rafale** | `guestSubmissionService.ts` : logs `Fetched…` / `Enriched…` / `[ENRICH] Détails…` | Bruit console et confusion ; requête réseau toujours suivie du mapping (normal), mais logs **à chaque** enrich. | Logs verbeux **uniquement en `import.meta.env.DEV`**. Cache soumissions (30 s) inchangé — les re-fetch métier restent pilotés par `useBookings` / invalidations. |
| **Objet `booking` « sans docs » dans les logs alors que la DB en a** | `UnifiedBookingModal` : `hasDocumentsGenerated: false` dans le premier log alors que le booking a déjà les données | **Bug de log / mauvaise clé** : les props utilisent `documentsGenerated` (camelCase), pas `documents_generated`. | Lecture unifiée : `documentsGenerated ?? documents_generated` pour le fallback instantané ; log debug **uniquement en DEV** et corrigé pour refléter la bonne propriété. |
| **Même séjour, deux identités (Airbnb vs manuel)** | Clic barre avec `bookingId` = code HM… puis flux invité sur UUID | Deux entités pour un séjour ; actions / liens incohérents. | **`handleBookingClick` dans `CalendarView`** : si la ligne cliquée est une réservation Airbnb et qu’un **booking manuel** matche (`doBookingAndAirbnbMatch`), la modale s’ouvre sur ce **booking enrichi (UUID)**. Sinon comportement inchangé (ligne Airbnb seule). |
| **Log layout bruyant** | `CalendarUtils` : `✅ [ANALYSE POSITION] startIndex trouvé` dans une boucle chaude | Spam console à chaque calcul de grille. | **Log supprimé** (diagnostic seulement). |

### Criticité haute — détail historique (référence)

| Comportement observé | Source dans les logs | Risque |
|----------------------|-------------------------|--------|
| *(historique)* **Enrichissement soumissions en rafale** | `guestSubmissionService.ts` : `Fetched guest submissions: (5)` + `Enriched bookings… total: 6` répété **à chaque** ouverture de modale, clic barre, parfois **deux fois d’affilée** | Charge réseau / CPU inutile ; cache soumissions mal réutilisé ou invalidations trop agressives ; possible double montage (React Strict Mode) ou double déclencheur. |
| *(historique)* **Objet `booking` « vide » puis rempli par la DB** | `UnifiedBookingModal` : `Booking complet: { … hasDocumentsGenerated: false }` puis plus tard `documents_generated depuis DB: { contract: true, policeForm: true, … }` | Confusion due en partie à un **nom de propriété incorrect** dans le log (`documents_generated` vs `documentsGenerated`). |
| *(historique)* **Même séjour, deux identités** | Clic avec `bookingType: 'airbnb'` + `bookingId: 'HMYRRHCAYE'` puis plus tard `bookingType: 'manual'` + UUID pour le même code dans `useGuestVerification` (`airbnbCode: 'HMYRRHCAYE'`) | Double modèle mental : barre ICS vs ligne `bookings` ; risque d’actions / liens sur la « mauvaise » entité. |

### Criticité moyenne

| Comportement observé | Source dans les logs | Risque |
|----------------------|------------------------|--------|
| **Plusieurs URL d’invitation pour le même code** | `🔗 [LIEN DE RÉSERVATION]: …/HMYRRHCAYE` avec **segment `/v/…/` différent** à chaque log | Normal si token rotatif / nouveau lien à chaque génération ; sinon bug de multiplication de liens. À tracer côté génération de lien. |
| **Navigation full page** | `Redirigé vers http://…/dashboard/property/…` puis tout le bundle recharge | Remount complet → **nouveau** fetch soumissions + réinitialisation d’état ; amplifie la sensation d’instabilité. |
| **Logs de debug en chemin chaud** | *(partiellement corrigé)* `CalendarView` ne log plus chaque clic ; `CalendarUtils` ne log plus `ANALYSE POSITION`. Reste : autres `console` dans modale / vérif invité. | Pollution console si non gardés sous DEV uniquement. |
| **`useGuestVerification` à chaque ouverture de contexte** | `Dates normalisées avant envoi` + lien synchronisé pour chaque réservation testée | Couplage fort modale ↔ vérif invité ; logs répétitifs si l’utilisateur parcourt plusieurs réservations. |

### Criticité basse / informative

| Comportement observé | Source dans les logs | Note |
|----------------------|------------------------|------|
| Message React DevTools | `chunk-… Download the React DevTools` | Standard en dev, sans impact métier. |
| `runtime.ts` configuration | `Runtime configuration loaded` | Normal au démarrage. |
| Réservation `UID:…@airbnb.com` vs codes `HM…` | Même flux `useGuestVerification` avec `airbnbCode` différent | Cohérent avec deux formats de référence Airbnb ; à traiter uniformément dans le matching (déjà partiellement couvert par `bookingAirbnbMatch`). |

### Synthèse actions recommandées (issues logs)

1. **Réduire les appels `enrichBookingsWithGuestSubmissions`** : ne pas re-enrichir tout le tableau à chaque focus modale si le cache TTL est encore valide et les `bookingIds` inchangés. *(Toujours pertinent côté `useBookings`.)*
2. ~~**Ne pas logger en prod**~~ : fait pour `[ENRICH]`, cache hit, `handleBookingClick` (supprimé), `[ANALYSE POSITION]` (supprimé). Poursuivre pour `UnifiedBookingModal` / `useGuestVerification` si besoin (partiellement : logs modal docs en DEV seulement).
3. ~~**Modale**~~ : fallback `documentsGenerated` corrigé ; chargement async DB inchangé pour URLs détaillées.
4. ~~**Modale sur UUID**~~ : fait quand match Airbnb ↔ manuel dans `CalendarView`.

---

## 1. Symptômes observés (côté produit)

- Re-rendus ou rafraîchissements **en chaîne** après sync ICS ou mise à jour base.
- **Incohérences** entre cartes et barres (noms, couleurs) selon le timing du chargement.
- Comportement **différent desktop / mobile** (ex. modale conflits auto sur mobile).
- Sensation de **complexité** : plusieurs caches, plusieurs enrichissements, abonnement temps réel.

---

## 2. Carte des interfaces (où ça se croise)

| Couche | Rôle | Risque |
|--------|------|--------|
| `useBookings` + `multiLevelCache` | Bookings enrichis (`realGuestNames`, etc.) | TTL 60 s ≠ cache Airbnb |
| `guestSubmissionService` | Enrichissement soumissions | Cache soumissions + timeout requêtes |
| `calendarData.fetchAirbnbCalendarEvents` | Lecture `airbnb_reservations` | Cache mémoire ~10 s |
| `CalendarView` `AirbnbCache` | Cache par plage mois/propriété | TTL ~30 s, autre clé / autre invalidation |
| Temps réel Supabase | `postgres_changes` sur `airbnb_reservations` | Déclenche `debouncedReload` → invalide caches + recharge |
| `allReservations` (useMemo) | Fusion `bookings` + Airbnb « uniques » + enrichissement | Double passage avec `loadAirbnbReservations` |
| `calculateBookingLayout` + barres | Grille, segments, `isStart` | Logique dense (semaines, mois, doublons Airbnb/manuel) |
| `detectBookingConflicts` + `conflictDetails` | Conflits + UI rouge | Doivent rester alignés (filtres validation / ref) |

**Constat** : une même donnée (ex. séjour Airbnb) peut être **touchée par 4 à 5 mécanismes** avant d’arriver à l’écran.

---

## 3. Conflits et fragilités logiques

### 3.1 Double (triple) pipeline « Airbnb »

1. Chargement initial / changement de mois : `loadAirbnbReservations` → `fetchAirbnbCalendarEvents` → objet `AirbnbReservation[]` mis en cache (`AirbnbCache` + état React).
2. Dans le même composant, `allReservations` **ré-enrichit** chaque ligne Airbnb avec `doBookingAndAirbnbMatch` + champs du `booking` lié.

**Conflit** : si `bookingsRef` / `bookings` ne sont pas encore alignés au premier fetch, ou si le cache sert une version **sans** enrichissement, l’UI peut **osciller** au prochain rendu.

### 3.2 Caches aux TTL différents

- `multiLevelCache` (bookings) : ordre de **60 s** (`useBookings`).
- `airbnbEventsCache` (`calendarData.ts`) : **10 s**.
- `AirbnbCache` dans `CalendarView` : **30 s**.

**Conséquence** : pendant une fenêtre de quelques secondes, **cartes** et **calendrier** peuvent ne pas refléter la même vérité, sans bug « évident » dans une seule fonction.

### 3.3 Temps réel + throttle

- Abonnement `airbnb_reservations` avec `debouncedReload` et **intervalle minimum 5 s** entre rechargements.
- À chaque événement : `airbnbCache.clear()` + `loadAirbnbReservations()`.

**Conflit** : forte activité sur la table (sync batch, triggers) → **rafraîchissements répétés** et recalcul de tous les `useMemo` dépendants (`conflicts`, couleurs, `allReservations`, `bookingLayout`).

### 3.4 État dupliqué : `matchedBookings`

- `matchedBookingsIds` est calculé dans un `useMemo`, puis recopié dans un `useState` (`matchedBookings`) via `useEffect`.

**Conflit** : **rendu supplémentaire** inutile ; risque de désynchronisation si une branche oublie de mettre à jour l’état.

### 3.5 Filtre documents « désactivé » par flag

Dans `CalendarView`, `SHOW_ALL_BOOKINGS = true` force l’affichage de **toutes** les réservations manuelles, **sans** appliquer la branche prévue pour `completed` + documents complets.

**Conflit** : la logique commentée (documents requis) et la logique effective divergent ; toute évolution future sur « qui apparaît » doit penser à **deux** chemins (flag vs règle métier).

### 3.6 Desktop vs mobile

- **Desktop** : `CalendarGrid` + `CalendarBookingBar`.
- **Mobile** : `CalendarMobile` reconstruit une carte `allBookings` à partir de `allReservations` **et** d’un fallback sur `bookingLayout`.

**Conflit** : deux chemins de rendu ; un correctif d’affichage peut être appliqué à une seule branche.

### 3.7 Modale conflits (mobile)

Un `useEffect` ouvre la modale de conflits sur mobile lorsque `conflicts.length > 0`.

**Conflit** : interaction utilisateur / perception d’instabilité si les conflits **clignotent** (recalculs ou données qui changent).

---

## 4. Logique hardcodée / magique (à sortir du code ou centraliser)

| Emplacement | Valeur / comportement | Problème |
|-------------|------------------------|----------|
| `CalendarView` `AirbnbCache` | `CACHE_DURATION = 30000`, `MAX_ENTRIES = 50` | Non configurable ; pas aligné avec `calendarData` |
| `calendarData.ts` | `AIRBNB_EVENTS_CACHE_TTL = 10000` | Second niveau de vérité |
| `useBookings.ts` | `CACHE_TTL = 60000`, `BOOKINGS_QUERY_TIMEOUT = 8000`, `DEBOUNCE_MS = 300` | Découplé du calendrier |
| `CalendarView` | `MIN_RELOAD_INTERVAL = 5000` (realtime) | Arbitrage fixe |
| `CalendarView` | `SHOW_ALL_BOOKINGS = true` | **Filtre métier court-circuité** |
| `CalendarView` | Couleurs `'bg-[#222222]'` en dur pour états | Hors `BOOKING_COLORS` pour certains cas |
| `CalendarView` | `window.innerWidth >= 768` pour toast sync | Breakpoint en dur |
| `CalendarView` | `setTimeout(..., 300)` ouverture modale conflit mobile | Timing fragile |
| Logs `console.log` / `console.warn` sur clics / conflits | Bruit et coût en prod | À garder derrière flag debug uniquement |

**Objectif** : une **seule configuration** (fichier `calendarConfig.ts` ou variables d’environnement) pour TTL, throttle realtime, et règles d’affichage (documents obligatoires ou non).

---

## 5. Pourquoi le calendrier « s’emballe » (synthèse technique)

1. **Cascade de dépendances React** : `bookings` ou `airbnbReservations` change → `conflicts` → couleurs → `allReservations` → `bookingLayout` → toute la grille.
2. **Invalidations agressives** : clear cache Airbnb + parfois `multiLevelCache` après sync → tout recharge.
3. **Temps réel** : chaque ligne modifiée sur `airbnb_reservations` peut relancer la chaîne (même avec throttle 5 s).
4. **Pas de debounce global** sur « refresh calendrier » : plusieurs sources (sync, realtime, changement de mois) appellent les mêmes loaders.

---

## 6. Plan de simplification (par étapes)

### Phase A — Stabiliser sans refonte (faible risque)

1. **Supprimer la duplication `matchedBookings`** : utiliser directement `matchedBookingsIds` du `useMemo` (ou un seul état dérivé), pas de `useEffect` de copie.
2. **Retirer ou garder sous `debugCalendar=1`** les `console.log` dans `handleBookingClick` et ailleurs dans `CalendarView`.
3. **Unifier les constantes TTL / throttle** dans un module `src/config/calendarConstants.ts` (valeurs par défaut + commentaire sur la cohérence souhaitée).
4. **Remplacer `SHOW_ALL_BOOKINGS`** par une variable d’environnement `VITE_CALENDAR_SHOW_ALL_BOOKINGS` ou un réglage propriété en base, avec défaut documenté.

### Phase B — Réduire les doubles traitements

1. **Un seul enrichissement Airbnb↔booking** : soit tout dans `allReservations` (et charger Airbnb « bruts »), soit tout dans `loadAirbnbReservations`, pas les deux en série avec risque de divergence cache.
2. **Invalidation unique après sync** : une fonction `invalidateCalendarData(propertyId)` qui vide `AirbnbCache`, `airbnbEventsCache`, et invalide la clé `useBookings` concernée, appelée une fois.

### Phase C — Option architecture (plus lourd, plus stable)

1. **Endpoint (Edge Function ou RPC)** qui renvoie pour une propriété et une plage de dates la liste **déjà fusionnée** `{ type: 'booking' | 'airbnb', display: ..., ... }`, calculée côté serveur avec une seule règle métier.
2. Le client ne fait plus qu’afficher et met à jour par **polling** raisonnable ou **un** canal realtime sur une vue matérialisée.

---

## 7. Fichiers à ouvrir en priorité lors d’un bug « calendrier instable »

| Fichier | Pourquoi |
|---------|----------|
| `src/components/CalendarView.tsx` | Orchestration, caches, realtime, `allReservations`, flags |
| `src/services/calendarData.ts` | Requête `airbnb_reservations` + cache 10 s |
| `src/hooks/useBookings.ts` | Source bookings + cache multi-niveau |
| `src/components/calendar/CalendarUtils.ts` | Layout, chevauchements, filtrage doublons Airbnb |
| `src/utils/bookingDisplay.ts` | Titres barres / cartes (une seule vérité à préserver) |
| `src/utils/bookingAirbnbMatch.ts` | Règle « même réservation » (éviter les doublons logiques) |

---

## 8. Non-objectifs de ce document

- Ne pas dupliquer la cartographie exhaustive des fichiers : voir **Analyse Calendrier.md** section cartographie.
- Les correctifs précis (matching, noms, conflits) ont déjà été itérés dans le code ; ce document sert de **feuille de route** pour la **stabilité** et la **réduction du hardcode**.

---

*Document généré pour cadrer les chantiers « calendrier stable » : configuration centralisée, moins de caches redondants, un pipeline d’enrichissement clair, et moins d’effets de bord en cascade.*
