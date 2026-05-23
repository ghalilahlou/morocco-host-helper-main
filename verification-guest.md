# Plan de modification — Refonte UX `/guest-verification/`

> Analyse chirurgicale du workflow d'auto-checkin invité et plan d'amélioration point par point.
> Objectif : fluidifier l'expérience, éliminer les blocages, accélérer la soumission, garantir un parcours sans décrochage.

---

## 0. Inventaire du workflow actuel

### 0.1 Carte du parcours invité
```
Lien hôte → /guest-verification/:propertyId/:token[/:airbnbBookingId]
   │
   ├── Étape 1 : Réservation (booking)
   │      ├── Affichage propriété (read-only)
   │      ├── Calendrier de séjour (EnhancedCalendar, range)
   │      └── Compteurs Adultes / Enfants
   │
   ├── Étape 2 : Documents (documents)
   │      ├── Zone d'upload (drag & drop ou bouton)
   │      ├── OCR via Edge `extract-document-data` (OpenAI Vision)
   │      ├── 1 carte voyageur par document (champs : nom, DOB, nationalité,
   │      │    type/numéro/expiration document, profession, motif, adresse, email)
   │      └── Bouton « Suivant » qui DÉCLENCHE la soumission complète
   │
   └── Étape 3 : Signature (en réalité page externe /contract-signing/)
          ├── Affichage stepper "Signature" → mais navigation vers autre page
          └── Génération contrat + fiche police côté serveur
```

### 0.2 Fichiers concernés (références)
- [src/pages/GuestVerification.tsx](src/pages/GuestVerification.tsx) — composant unique de **4 184 lignes** (mobile + desktop dans un même fichier)
- [src/components/guest/GuestVerificationPage.tsx](src/components/guest/GuestVerificationPage.tsx) — wrapper ErrorBoundary
- [src/components/guest/GuestHybridDateField.tsx](src/components/guest/GuestHybridDateField.tsx) — input `type="date"` pour DOB et expiration
- [src/components/ui/enhanced-calendar.tsx](src/components/ui/enhanced-calendar.tsx) — calendrier range séjour
- [src/services/documentServiceUnified.ts](src/services/documentServiceUnified.ts) — submit unifié
- [src/services/openaiDocumentService.ts](src/services/openaiDocumentService.ts) — OCR client
- [src/components/mobile/MobileGuestVerification.tsx](src/components/mobile/MobileGuestVerification.tsx) — **orphelin** (jamais monté)
- [src/utils/dateUtils.ts](src/utils/dateUtils.ts) — utilitaires dates locales

---

## 1. Problèmes critiques — Logique qui bloque

### P1. Étape Documents : tous les champs sont grisés tant que l'OCR n'est pas terminé
**Constat** — [GuestVerification.tsx:854-879](src/pages/GuestVerification.tsx#L854-L879) `identityUnlockedForGuest()` retourne `false` si `uploadedDocuments[i]` est `undefined` ou en `processing`. Conséquence : `fieldsLocked = true` sur les 9 champs (nom, DOB, nationalité, type doc, n° doc, expiration, profession, motif, adresse, email).
L'invité regarde un formulaire entièrement grisé pendant 10-15 s (durée OCR). Il croit que la page est cassée.

**Action**
- Découpler verrouillage : ne verrouiller QUE les champs que l'OCR remplit (`fullName`, `nationality`, `documentNumber`, `documentType`, `documentIssueDate`, `dateOfBirth`).
- Laisser saisissable immédiatement : `profession`, `motifSejour`, `adressePersonnelle`, `email`.
- Ajouter un bandeau ARIA-live « OCR en cours — vous pouvez commencer à compléter vos coordonnées » avec spinner inline.
- Si l'OCR retourne `null` / `error`, ne PAS laisser le formulaire verrouillé : afficher CTA « Saisir manuellement les informations du document » qui débloque tout.

### P2. Le bouton « Suivant » de l'étape Documents est en réalité un « Soumettre »
**Constat** — [GuestVerification.tsx:4038-4082](src/pages/GuestVerification.tsx#L4038-L4082) : le clic appelle `handleSubmit()` qui fait l'appel Edge `submit-guest-info-unified` PUIS `navigate('/contract-signing/...')`. Le stepper affiche 3 étapes mais l'étape 3 est une autre page. L'utilisateur ne sait pas si « Suivant » l'amène à un récapitulatif ou termine la procédure.

**Action**
- Renommer le bouton selon l'état : « Vérifier et continuer » au lieu de « Suivant » sur l'étape Documents.
- Insérer une **mini-étape récapitulative inline** avant la soumission (modal ou panneau) qui affiche : dates, voyageurs avec leurs infos OCRées, documents joints. CTA « Confirmer et envoyer ».
- Tant que la soumission n'a pas réussi, garder l'utilisateur sur la page (déjà le cas via `submissionError`) — mais en cas de succès, afficher d'abord un état « ✓ Informations enregistrées » avant la navigation, pour que l'invité comprenne que la moitié 1 est terminée.

### P3. Validation `uploadedDocuments.length !== guests.length` rigide
**Constat** — [GuestVerification.tsx:1782-1798](src/pages/GuestVerification.tsx#L1782-L1798) impose strictement 1 doc = 1 voyageur. Impossible de joindre recto + verso de CIN. Impossible d'ajouter un mineur sans pièce.

**Action**
- Permettre N documents par voyageur via un mapping explicite `documentToGuestIndex: number[]`.
- Ajouter une zone « Documents complémentaires » non liée à un voyageur (verso CIN, justificatif).
- Pour un mineur (< 18 ans calculés depuis DOB) : pièce d'identité optionnelle, juste DOB + nom + lien parental (champ « accompagné de »).

### P4. Bouton « X » sur un document supprime aussi le voyageur entier
**Constat** — [GuestVerification.tsx:2842-2859](src/pages/GuestVerification.tsx#L2842-L2859) (sidebar desktop) et [3677-3691](src/pages/GuestVerification.tsx#L3677-L3691) (mobile) :
```
setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
setGuests(prev => prev.filter((_, i) => i !== index));
setNumberOfGuests(prev => Math.max(1, prev - 1));
```
L'invité qui veut juste re-prendre une photo perd tous les champs déjà remplis du voyageur.

**Action**
- Découpler suppression document ↔ suppression voyageur.
- Bouton « ✕ » sur le document → ne supprime QUE le doc + reset des seuls champs OCR du voyageur.
- Bouton dédié sur la carte voyageur pour supprimer un voyageur entier (déjà présent ligne 3766 mais peu visible).

### P5. Dédoublonnage agressif fusionne deux voyageurs homonymes
**Constat** — [GuestVerification.tsx:243-320](src/pages/GuestVerification.tsx#L243-L320) `deduplicatedGuests` fusionne deux entrées si `fullName` OU `documentNumber` correspondent. Pour une famille « Dupont père / Dupont fils » avec nom identique, la 2e carte disparaît silencieusement.

**Action**
- Ne dédoublonner QUE sur `documentNumber` non vide ET identique (le nom seul n'est pas un identifiant).
- Logguer un warning visible (toast) au lieu de supprimer silencieusement.
- Ajouter une clé interne UUID par voyageur dès la création — la dédoublonnage devient inutile car chaque carte a son identité stable.

### P6. Garde `runningWorkflows` peut rester verrouillée après échec serveur
**Constat** — [documentServiceUnified.ts:72-96](src/services/documentServiceUnified.ts#L72-L96) : `Map` globale qui marque la clé `${token}-${airbnbCode}` comme « en cours ». Le `finally` la nettoie, mais en cas de timeout réseau / déchargement de l'onglet pendant l'appel, la map garde l'état stale dans la mémoire d'un autre flow.

**Action**
- Ajouter un TTL : 60 s max. Stocker `{ startedAt: number }` et purger les entrées > 60 s avant de bloquer.
- Réinitialiser proactivement la map sur navigation page leave.

### P7. Conversion en base64 dans le body JSON = payload x1.37 + risque timeout
**Constat** — [GuestVerification.tsx:1985-2066](src/pages/GuestVerification.tsx#L1985-L2066) convertit chaque fichier en `data:image/...;base64,...` puis envoie via JSON. 5 photos × 2 Mo → ~13 Mo de body JSON.

**Action**
- Upload direct vers Supabase Storage via `supabase.storage.from('guest-documents').upload(...)` côté client, AVANT l'appel Edge.
- L'Edge function reçoit alors uniquement les `storagePath[]` (chaînes courtes).
- Avantages : payload Edge réduit à < 50 Ko, retry/reprise possible, progress bar utilisable par fichier.

---

## 2. Calendriers — Analyse des 3 instances

### Calendrier 1 — EnhancedCalendar (dates de séjour)
**Constat** — [src/components/ui/enhanced-calendar.tsx](src/components/ui/enhanced-calendar.tsx)

| Problème | Localisation | Impact |
|---|---|---|
| Pas de `minDate` par défaut | ligne 66 `minDate = undefined` | Invité peut choisir date passée sans avertissement |
| `useEffect` re-saute toujours au mois du `rangeStart` | ligne 82-94 | Utilisateur navigue 6 mois en avant, ferme/rouvre → retour brutal |
| Animation framer-motion par cellule | ligne 432-462 (`delay: index * 0.01`) | 42 cellules × 10 ms = 420 ms par changement de mois |
| `motion.select` avec `key={currentMonth.getTime()}` | ligne 327-352 | Re-mount à chaque sélection → perte focus, flicker |
| Plage hover invisible sur mobile | ligne 443 (`onMouseEnter`) | Mobile sans feedback visuel de la plage |
| Largeur fixe 360 px | ligne 299 `width: '360px'` | Sur écran 320 px (iPhone SE) overflow horizontal |

**Action**
- Ajouter `minDate={new Date()}` par défaut côté `GuestVerification.tsx` lors de l'appel (ligne 3560), avec override possible si l'hôte autorise dates passées.
- Retirer le re-sync `currentMonth` quand l'utilisateur a déjà navigué : ne synchroniser qu'au premier mount.
- Supprimer le `staggerChildren` framer-motion sur les cellules (gain visible : 400 ms).
- Remplacer `motion.select` par `<select>` natif + ne supprimer le `key` que sur changement de range, pas de mois.
- Sur touch : remplacer hover par un **mode « tap pour preview »** : 1er tap = date arrivée, 2e tap = preview de la plage avec confirmation, 3e tap = valider.
- Width responsive : `min(360px, calc(100vw - 32px))`.

### Calendrier 2 — Date de naissance (`GuestHybridDateField` variant=`birth`)
**Constat** — [src/components/guest/GuestHybridDateField.tsx](src/components/guest/GuestHybridDateField.tsx)

| Problème | Détail | Impact |
|---|---|---|
| `<input type="date">` natif | UX désastreuse sur mobile pour naviguer 30+ ans | Invité abandonne |
| `min=1900-01-01` rigide | ligne 39 `birthFromYear = 1900` | OK pour la plupart, mais OCR à 1899 figerait |
| Pas de placeholder visible | ligne 76+ | L'invité voit un champ vide gris |
| Verrouillé tant qu'OCR pas fini | ligne 84 `disabled` | Cf. P1 |

**Action**
- Remplacer par un composant à 3 selects (jour / mois / année) — UX universelle desktop/mobile.
- Auto-focus passe au champ suivant après saisie complète.
- Validation âge : âge < 0 ou > 120 ans → erreur inline.
- Conserver le `type="date"` natif en fallback accessible via un toggle « Préférer le calendrier ».
- Garantir que la date OCR pré-remplit les 3 selects correctement, même si hors plage par défaut (étendre bornes dynamiquement, comme `boundsIncludingValue` actuel).

### Calendrier 3 — Date d'expiration du document (`GuestHybridDateField` variant=`expiry`)
**Constat**

| Problème | Détail | Impact |
|---|---|---|
| Stocké dans `documentIssueDate` mais nommé `documentExpiryDate` | [GuestVerification.tsx:217](src/pages/GuestVerification.tsx#L217) commentaire « ✅ Date d'expiration du document (alignée fiche de police) » | Sémantique trompeuse |
| Bornes `min = yNow - 35`, `max = yNow + 30` | [GuestHybridDateField.tsx:41-42](src/components/guest/GuestHybridDateField.tsx#L41-L42) | Trop large vers le passé (date d'émission acceptée) + parfois trop court vers le futur (passeport diplomatique 40 ans) |
| OCR retourne `documentIssueDate` (clef ambiguë) | [openaiDocumentService.ts:12](src/services/openaiDocumentService.ts#L12) commentaire « stockée sous ce champ pour compatibilité » | Risque que l'IA renvoie la date d'émission au lieu de l'expiration |

**Action**
- Renommer côté front + back en `documentExpiryDate` (alias rétrocompatible 1 mois en lecture).
- Ajuster bornes : `min = today` (un document expiré n'est pas valide), `max = today + 20 ans`.
- Bandeau d'avertissement si OCR retourne une date < aujourd'hui : « Votre document semble expiré, veuillez vérifier ».
- Mettre à jour le prompt OCR pour distinguer explicitement émission vs expiration et privilégier l'expiration (MRZ ligne 2 caractères 22-27 pour passeports).
- 3 selects également (comme P pour DOB).

---

## 3. Prise d'identité et extraction OCR

### P8. OCR séquentiel sur upload multiple
**Constat** — [GuestVerification.tsx:1408-1640](src/pages/GuestVerification.tsx#L1408-L1640) `handleFileUpload` boucle `for` séquentielle. 3 photos = 3× 12s = 36s avant déverrouillage du formulaire.

**Action**
- Paralléliser : `Promise.all(files.map(processFile))` avec une **limite de concurrence** (ex: 3 max via une petite file).
- Afficher un progress bar par document (déjà spinner mais sans %).
- Si plus de 5 photos : avertir « Le traitement de 5+ photos peut prendre 30 s ».

### P9. Bandeau d'erreur OCR silencieux
**Constat** — [GuestVerification.tsx:1602-1608](src/pages/GuestVerification.tsx#L1602-L1608) : si `extractedData` est vide, on toast « Document non reconnu » mais le doc reste dans la liste avec spinner arrêté. L'utilisateur ne sait pas s'il doit le re-uploader.

**Action**
- Marquer visuellement les documents en erreur (bordure rouge + icône ⚠).
- Bouton « Recommencer l'extraction » sur ces documents.
- Bouton « Saisir manuellement » qui débloque les champs pour ce voyageur.

### P10. Dates OCR ambiguës (DOB vs expiration) parfois inversées
**Constat** — Le prompt Edge `extract-document-data` peut retourner DOB et expiration sans suffisamment de contexte. Le code parse les deux indépendamment mais ne vérifie pas la cohérence.

**Action**
- Validation côté client : si `dateOfBirth > documentIssueDate` (la naissance ne peut pas être après l'expiration), avertissement.
- Validation : `documentIssueDate - dateOfBirth > 0 ans` et `< 100 ans` (durée de vie raisonnable d'un document depuis la naissance).
- Si incohérent, demander confirmation : « Avons-nous correctement reconnu ces dates ? »

### P11. Le placeOfBirth est extrait mais non affiché ni envoyé
**Constat** — [GuestVerification.tsx:129, 1544, 1565-1569](src/pages/GuestVerification.tsx#L129) : `placeOfBirth` est dans l'objet `Guest` et affiché dans le résumé, mais pas dans le formulaire visible. Il n'est pas dans le `guestsPayload` final ([GuestVerification.tsx:1944-1964](src/pages/GuestVerification.tsx#L1944-L1964)).

**Action**
- Ajouter un input « Lieu de naissance » dans la grille des champs (déjà extrait → pré-rempli).
- L'inclure dans `guestsPayload` envoyé au serveur (utile pour la fiche de police).

---

## 4. Anti-patterns React et logique dupliquée

### P12. `document.querySelector` pour lire les inputs au moment de la soumission
**Constat** — [GuestVerification.tsx:1807, 1878, 1926, 1946-1949](src/pages/GuestVerification.tsx#L1807) :
```js
const motifSelect = document.querySelector(`select[name="motifSejour-${rowIndex}"]`) as HTMLSelectElement;
const motifSejour = motifSelect?.value || guest.motifSejour || '';
```
Et inputs avec `defaultValue` ([3911-3970](src/pages/GuestVerification.tsx#L3911-L3970)) — donc non contrôlés.

**Action**
- Convertir tous les inputs en composants contrôlés : `value={guest.profession}` + `onChange={(e) => updateGuest(rowIndex, 'profession', e.target.value)}`.
- Supprimer tous les `document.querySelector` au moment de la soumission.
- Bonus : le state devient l'unique source de vérité → fin des incohérences silencieuses.

### P13. Trois fonctions de nettoyage de nom quasi-identiques
**Constat**
- `cleanGuestNameFromUrl` — [GuestVerification.tsx:5](src/pages/GuestVerification.tsx#L5)
- `cleanGuestNameForUrl` — [useGuestVerification.ts:11](src/hooks/useGuestVerification.ts#L11)
- `cleanExtractedName` — [openaiDocumentService.ts:16](src/services/openaiDocumentService.ts#L16)

**Action**
- Extraire dans `src/utils/guestNameUtils.ts` : `sanitizeGuestName(raw: string): string`.
- Supprimer les 3 copies, importer depuis l'utilitaire unique.

### P14. 9 useRef + sessionStorage pour gérer 3 useEffect concurrents
**Constat** — [GuestVerification.tsx:322-403](src/pages/GuestVerification.tsx#L322-L403) maintient 9 refs (`isMountedRef`, `navigationInProgressRef`, `processingFilesRef`, `isProcessingRef`, `isCheckingICSRef`, `isVerifyingTokenRef`, `isSubmittingRef`, `hasInitializedICSRef`, `hasInitializedTokenRef`, `hasInitializedBookingRef`) + double garde sessionStorage. Symptôme d'effets mal isolés.

**Action**
- Extraire chaque source de pré-remplissage dans un **custom hook** :
  - `useGuestPrefillFromUrl(token, propertyId, search)` → renvoie `{ checkInDate, checkOutDate, guestCount, guestName } | null`
  - `useGuestPrefillFromIcsToken(token, propertyId)` → idem
  - `useGuestPrefillFromAirbnbBooking(token, propertyId, airbnbBookingId)` → idem
- Le composant principal consomme la première valeur non-null avec une stratégie de priorité claire (URL > ICS > Airbnb).
- Les hooks gèrent leur propre dédoublonnage interne (un seul fetch par tuple `token+propertyId`).
- **Suppression des 9 refs**, remplacés par 3 hooks à 1 ref chacun (state pattern).

### P15. `useLayoutEffect` qui efface dates puis useEffect qui les remplit
**Constat** — [GuestVerification.tsx:410-442](src/pages/GuestVerification.tsx#L410-L442) `useLayoutEffect` nettoie les params URL pour réservation indépendante AVANT que [445-807](src/pages/GuestVerification.tsx#L445-L807) `useEffect` re-fetch les dates. Risque de flash.

**Action**
- Fusionner dans un seul effet sync au mount qui décide :
  ```
  if (isIndependentBooking(url)) clean();
  else prefill(url);
  ```
- Pas de transition vide → remplie.

### P16. `inputs defaultValue` au lieu de `value` (cf. P12)
**Constat** — Inputs `profession`, `motifSejour`, `adressePersonnelle`, `email` utilisent `defaultValue`. Si l'OCR met à jour le state Guest après la première saisie, l'input n'est pas mis à jour visuellement.

**Action**
- Migration vers `value` + `onChange` contrôlés. Voir P12.

### P17. `MobileGuestVerification.tsx` orphelin
**Constat** — Aucun montage dans `App.tsx`. 600+ lignes mortes.

**Action**
- Supprimer le fichier (le composant principal gère déjà mobile via `useIsMobile`).

### P18. `testDateOfBirth` (fonction debug oubliée)
**Constat** — [GuestVerification.tsx:1335-1350](src/pages/GuestVerification.tsx#L1335-L1350) fonction de test en prod.

**Action**
- Supprimer.

### P19. Bandeau « DEV_GUEST_VERIFICATION_URL » visible en production si .env mal configuré
**Constat** — [GuestVerification.tsx:2540-2573](src/pages/GuestVerification.tsx#L2540-L2573).

**Action**
- Wrapper avec `import.meta.env.DEV` strictement, OU dans un composant `<DevOnly>` qui ne rend rien en prod.

---

## 5. Performance et instantanéité de l'envoi

### P20. 150 ms de délai artificiel avant navigation
**Constat** — [GuestVerification.tsx:2247-2266](src/pages/GuestVerification.tsx#L2247-L2266) :
```js
await saveFormDataToSession();          // ~500ms-2s (sérialisation base64)
await new Promise(r => setTimeout(r, 50));  // 50ms
await new Promise(r => setTimeout(r, 100)); // 100ms
navigate(url, { state, replace: false });
```

**Action**
- Si l'upload Storage se fait côté client (cf. P7), `saveFormDataToSession` n'a plus besoin de sérialiser les blobs → < 10 ms.
- Supprimer les `setTimeout(50)` et `setTimeout(100)` qui sont des workarounds pour les portails Radix UI (cf. P22).
- Naviguer immédiatement après le succès de l'Edge function.
- **Gain attendu** : 1-3 s économisées sur la navigation finale.

### P21. Spinner statique pendant `submitDocumentsUnified` (peut durer 15-30 s)
**Constat** — Le toast « Génération en cours... » s'affiche mais sans barre de progression. Sur réseau lent, l'utilisateur croit que c'est figé.

**Action**
- Si upload Storage séparé (P7) : barre de progression par fichier pendant l'upload (event `onUploadProgress` du SDK Supabase).
- Pendant la génération PDF côté Edge : afficher étapes textuelles (« Vérification documents... », « Génération contrat... », « Envoi à l'hôte... ») avec timer.
- Idéalement : Server-Sent Events ou polling court pour récupérer l'état réel côté serveur.

### P22. Workarounds « Erreur Portal ignorée » (30+ occurrences)
**Constat** — Le code mentionne « insertBefore » et « NotFoundError » dans 8+ blocs `try/catch`. C'est causé par Radix UI Select / Popover quand un Portal est démonté pendant qu'on accède à ses enfants.

**Action**
- Remplacer les `<Select>` Radix par des `<select>` natifs (déjà fait pour `documentType` et `motifSejour`, à étendre).
- Pour les popovers (date picker desktop), utiliser `Floating UI` directement OU des `<dialog>` natifs.
- Une fois les portails supprimés, **retirer tous les try/catch « insertBefore »** — ils masquent de vrais bugs en plus de Radix.

### P23. Le composant fait 4 184 lignes
**Constat** — Maintenabilité catastrophique, re-renders inutiles, difficile à tester.

**Action**
- Découper en sous-composants :
  - `BookingStep.tsx` (~400 lignes)
  - `DocumentsStep.tsx` (~500 lignes)
  - `GuestCard.tsx` (~250 lignes)
  - `DocumentUploadZone.tsx` (~150 lignes)
  - `MobileHeader.tsx`, `DesktopSidebar.tsx`, `StepperBar.tsx`
- `GuestVerification.tsx` devient le coordinateur (state, effets, soumission) en < 800 lignes.

### P24. Plusieurs sources de vérité pour le nombre de voyageurs
**Constat** — `numberOfGuests`, `numberOfAdults + numberOfChildren`, `guests.length`, `deduplicatedGuests.length` (cf. P5).

**Action**
- Source de vérité unique : `guests: Guest[]` (le tableau).
- `numberOfAdults` et `numberOfChildren` deviennent des dérivés (`useMemo` calculé depuis un champ `Guest.isMinor`).
- `numberOfGuests` calculé : `guests.length`.

---

## 6. Erreurs et reprise

### P25. « Réessayer » remet à zéro et perd toutes les données
**Constat** — [GuestVerification.tsx:2451-2461](src/pages/GuestVerification.tsx#L2451-L2461) :
```js
onClick={() => {
  setSubmissionError(null);
  goToStep('booking'); // ✅ CORRIGÉ : Utiliser goToStep
}}
```
Pas d'effet `setGuests([])` mais le retour à booking + sessionStorage stale = comportement chaotique.

**Action**
- « Réessayer » doit conserver l'état et retourner à l'étape Documents (pas Booking).
- Afficher un bandeau persistant en haut « Échec précédent : <message>. Veuillez vérifier ci-dessous » sans clear de form.
- Bouton « Recommencer entièrement » optionnel pour cas extrêmes.

### P26. Persistance sessionStorage : memory leak via `URL.createObjectURL`
**Constat** — [GuestVerification.tsx:1011-1032](src/pages/GuestVerification.tsx#L1011-L1032) `restoreFormDataFromSession` crée des `URL.createObjectURL` mais ne les `revokeObjectURL` jamais.

**Action**
- Garder un set de toutes les URLs créées et `URL.revokeObjectURL` au démontage.
- Si upload Storage côté client (P7), on stocke les `storagePath` (chaînes) au lieu de blobs → plus de leak possible.

### P27. Sur dates passées : pas d'avertissement, juste accepté
**Constat** — [GuestVerification.tsx:184-187](src/pages/GuestVerification.tsx#L184-L187) commentaire « ✅ SUPPRESSION : Plus de restriction sur les dates passées ».

**Action**
- Si `checkIn < today` : afficher avertissement non bloquant « Vous avez sélectionné une date passée. Continuer ? » avec confirmation.
- Garder la possibilité d'avancer (cas légitime de régularisation), mais sans laisser passer un clic accidentel.

---

## 7. Navigation et stepper

### P28. Stepper étape 3 « Signature » non cliquable mais l'utilisateur a déjà signé
**Constat** — [GuestVerification.tsx:3095-3142](src/pages/GuestVerification.tsx#L3095-L3142) Step 3 toujours `cursor: 'default'`.

**Action**
- Si on est sur l'étape `documents`, le step 3 ne doit montrer qu'il est cliquable QU'après la soumission réussie.
- La page Signature étant une autre route, la navigation depuis le stepper doit utiliser `navigate('/contract-signing/...')` avec le `bookingId` en state.

### P29. Bouton Précédent depuis Signature
**Constat** — La page `/contract-signing/` n'est pas dans ce composant. Le hook `useEffect` ligne 1044 gère le retour via `location.state.fromSignaturePage`, mais c'est fragile : si l'utilisateur tape l'URL directement ou rafraîchit, l'état est perdu.

**Action**
- Persister `bookingId` dans `localStorage` ET sessionStorage avec un TTL court (15 min).
- Au mount du `GuestVerification`, vérifier si un `currentBookingId` existe → afficher banner « Vous avez déjà soumis ces informations. [Voir la signature] [Recommencer] ».

### P30. Mobile : le bouton « Suivant » peut être hors écran après scroll
**Constat** — La page Documents sur mobile peut faire 2-3 écrans de hauteur. Le bouton bas est fixe via la mise en page, mais pas en `position: sticky`.

**Action**
- Ajouter une barre d'action sticky en bas sur mobile (`position: sticky; bottom: 0`) avec Précédent + Suivant + indicateur progression.
- Safe-area-inset-bottom pour iOS.

---

## 8. Internationalisation et accessibilité

### P31. Strings non traduites
**Constat** — Plusieurs strings en dur français :
- « Glissez-déposez vos documents » [GuestVerification.tsx:2786](src/pages/GuestVerification.tsx#L2786)
- « Carte d'identité ou passeport en format PDF, PNG, JPG (5MB max par fichier) » [2793](src/pages/GuestVerification.tsx#L2793)
- « Voyageurs », « Adultes », « Enfants », « Confirmer » dans les bottom sheets

**Action**
- Audit complet des strings dans le composant → tout via `t('...')`.
- Ajouter les clés manquantes dans les 3 langues (FR / EN / ES).

### P32. Champ « Motif du séjour » : libellés non traduits
**Constat** — [GuestVerification.tsx:3940-3946](src/pages/GuestVerification.tsx#L3940-L3946) options en dur :
```jsx
<option value="TOURISME">Tourisme</option>
<option value="AFFAIRES">Affaires</option>
...
```

**Action**
- Passer par une constante `MOTIF_OPTIONS` typée + `t('motif.tourism')`.

### P33. Inputs sans `autoComplete` explicite
**Constat** — Le navigateur peut autofill avec les mauvaises valeurs.

**Action**
- `autoComplete="given-name"` / `family-name` / `email` / `street-address` / `bday` selon le champ.
- `inputMode="numeric"` pour numéro de document.

### P34. Pas de labels associés aux inputs date hybride
**Constat** — `<Label htmlFor>` présent ligne 3819, 3892 mais le `<input>` interne au composant porte un autre `id`.

**Action**
- Vérifier que `<Label htmlFor={id}>` correspond bien au `id` passé au `GuestHybridDateField`.

---

## 9. Logique des dates et timezone

### P35. 4 chemins de parsing de dates avec fallback partout
**Constat** — `extractDateOnly + parseLocalDate` apparaît dans :
- URL params → [GuestVerification.tsx:524-543](src/pages/GuestVerification.tsx#L524-L543)
- ICS metadata → [732-756](src/pages/GuestVerification.tsx#L732-L756)
- Airbnb booking → [1280-1297](src/pages/GuestVerification.tsx#L1280-L1297)
- Fallback `new Date()` → idem

**Action**
- Centraliser dans un helper `parseAndNormalizeStayDate(value): Date | null` dans `dateUtils.ts`.
- Une seule implémentation, testable, avec types stricts.

### P36. `parseStayDateForCalendar` peut retourner `Date(NaN)` silencieusement
**Constat** — [dateUtils.ts:43-67](src/utils/dateUtils.ts#L43-L67).

**Action**
- Retourner `null` au lieu de `Date(NaN)`.
- Les appelants doivent gérer explicitement le `null`.

---

## 10. Bugs serveur — Edge Function `submit-guest-info-unified`

> Référence : [supabase/functions/submit-guest-info-unified/index.ts](supabase/functions/submit-guest-info-unified/index.ts) — **7 162 lignes** (le plus gros fichier du repo). Voir aussi [problemecoflitcontract.md](problemecoflitcontract.md), [PLAN_CHIRURGICAL_TOKENS_NOMS.md](PLAN_CHIRURGICAL_TOKENS_NOMS.md), [solutionpercistancedataverification.md](solutionpercistancedataverification.md).

### S1. `placeOfBirth` extrait par OCR mais jamais sauvegardé en base
**Constat** — [submit-guest-info-unified/index.ts:1455](supabase/functions/submit-guest-info-unified/index.ts#L1455) :
```ts
place_of_birth: '', // Non disponible dans GuestInfo pour l'instant
```
Le frontend l'extrait (cf. P11 du plan UX) mais le côté serveur le force à chaîne vide à l'insertion. Toute la fiche de police perd cette info pour les non-marocains (champ légal obligatoire).

**Action**
- Ajouter `placeOfBirth?: string` à l'interface `GuestInfo` côté Edge (ligne 137-152).
- Remplacer `place_of_birth: ''` par `place_of_birth: sanitizedGuest.placeOfBirth || ''`.
- Mettre à jour `sanitizeGuestInfo` (ligne 470) pour conserver `placeOfBirth`.

### S2. Patch D — sweep des « guests fantômes » basé sur `updated_at` peut supprimer un guest légitime
**Constat** — [submit-guest-info-unified/index.ts:1677-1696](supabase/functions/submit-guest-info-unified/index.ts#L1677-L1696) :
```ts
const submissionStartedAt = new Date().toISOString();
// ... INSERT/UPDATE guests ...
const ghosts = guestsBeforeSubmission.filter(g => !g.updated_at || g.updated_at < submissionStartedAt);
// DELETE ghosts
```
Si une INSERT a un timestamp `updated_at = NOW()` qui finit < `submissionStartedAt` (race ms-level + clock drift entre Postgres et Deno), un guest fraîchement inséré peut être classé fantôme.
Plus grave : si la soumission part avec **moins** de voyageurs que la résa initiale (groupe réduit), les voyageurs supprimés sont permanents, alors qu'il faudrait peut-être les archiver.

**Action**
- Comparer par `id` plutôt que par timestamp : `ghosts = guestsBeforeSubmission.filter(g => !currentSubmissionGuestIds.has(g.id))`.
- Ajouter une trace `deletion_reason: 'phantom_sweep'` dans une table d'audit avant le DELETE.
- Bouton hôte « Restaurer guest archivé » plutôt que suppression dure.

### S3. Tokens partagés historiques — 1 token = N bookings (catastrophe sécurité)
**Constat** — [PLAN_CHIRURGICAL_TOKENS_NOMS.md:33-44](PLAN_CHIRURGICAL_TOKENS_NOMS.md#L33-L44) documente que dans `guest_submissions`, **5 `token_id` distincts** apparaissent sur **2 à 14 bookings différents** :

| `token_id` | Nb bookings concernés |
|---|---|
| `73a33917-...` | 14 |
| `aee301ed-...` | 8 |
| `5cc9acf4-...` | 4 |

Cause racine : ancienne version de `issue-guest-link` rattachait la « prochaine résa active » sans `bookingId`. Migration [`20260520160000_one_active_token_per_booking.sql`](supabase/migrations/20260520160000_one_active_token_per_booking.sql) ajoute un index unique mais doit être appliquée.

**Action**
- Vérifier que la migration est bien appliquée en prod (cf. Phase 2 du plan chirurgical).
- Ajouter un trigger Postgres `BEFORE INSERT/UPDATE` qui rejette si `is_active=true` et un autre token actif existe déjà pour le même booking_id.
- Audit mensuel : `SELECT token_id, count(DISTINCT booking_id) FROM guest_submissions GROUP BY token_id HAVING count(DISTINCT booking_id) > 1`.

### S4. `saveDocumentToDatabase` crée plusieurs versions du contrat (3-15 par résa)
**Constat** — [submit-guest-info-unified/index.ts:5220-5481](supabase/functions/submit-guest-info-unified/index.ts#L5220-L5481).
- Garde anti-doublon (ligne 5244) : « si même URL → no-op ». Mais l'URL Storage inclut un timestamp dans le nom de fichier → URL toujours différente.
- Logique : « si signed exists + new signed différent → CRÉE nouvelle ligne ». Versionning légitime pour re-signature, mais déclenché aussi par chaque clic de bouton "Régénérer" côté hôte.

**Action**
- Comparer le **contenu** du PDF (hash SHA-256 du bytes avant upload), pas l'URL :
  ```ts
  const newPdfHash = await crypto.subtle.digest('SHA-256', pdfBytes);
  const existingHashes = await client.from('generated_documents').select('content_hash').eq('booking_id', bookingId);
  if (existingHashes.some(e => e.content_hash === newPdfHash)) return existing;
  ```
- Ajouter colonne `content_hash` sur `generated_documents` + index.
- Bouton hôte « Régénérer » → demande confirmation si contrat signé existe.

### S5. Génération contrat AVANT que les `guests` soient synchronisés
**Constat** — [problemecoflitcontract.md:97-105](problemecoflitcontract.md#L97-L105) : « PDF généré et enregistré dans `generated_documents`. Plus tard : lignes `guests` créées ou modifiées ». L'audit `CONTRACT_BEFORE_GUEST_BACKFILL` repère ce cas.

Dans le code actuel [submit-guest-info-unified/index.ts:4374-4392](supabase/functions/submit-guest-info-unified/index.ts#L4374-L4392) `Promise.all([generateContract, generatePolice])` lance **en parallèle** après `saveGuestDataInternal`. Mais si une exception se produit dans l'écriture des `guests` (transaction non commitée), le PDF lit l'état pré-insertion.

**Action**
- Garantir transactionnellement que tous les `guests` sont commités avant la génération PDF : wrapper dans une transaction Postgres explicite via RPC.
- Si impossible : ajouter une lecture de confirmation `SELECT count(*) FROM guests WHERE booking_id = ?` après `saveGuestDataInternal`, qui doit retourner `guestInfos.length`. Sinon, retry.

### S6. Booking de prévisualisation pollue la base
**Constat** — [submit-guest-info-unified/index.ts:2931-3013](supabase/functions/submit-guest-info-unified/index.ts#L2931-L3013) `generate_contract_preview` et `generate_police_preview` créent un booking réel `is_preview: true`, génèrent le PDF, puis le suppriment. Si la génération crash, le cleanup `try/catch` couvre le cas, mais une crash hard (timeout Edge function 60s, OOM, segfault) laisse les rows orphelines.
Mention `booking_reference: 'PREVIEW-${Date.now()}'` : collision possible si deux previews avec même timestamp ms.

**Action**
- Cron job (Edge Function scheduled) qui supprime les bookings `is_preview=true` âgés de plus de 1 heure.
- Préfixer le booking_reference avec UUID au lieu de Date.now() pour éviter collision.
- Idéalement : génération preview sans écriture base (utiliser un objet en mémoire passé en paramètre à `generateContractPDF`).

### S7. `runningWorkflows` Map côté client n'a pas d'équivalent serveur
**Constat** — [documentServiceUnified.ts:72-96](src/services/documentServiceUnified.ts#L72-L96) garde côté client. Mais 2 onglets / 2 appareils peuvent soumettre simultanément. Côté serveur, **aucun lock** sur `bookings.id` ou `(token, propertyId)` → race conditions sur l'insert.

**Action**
- Côté serveur : utiliser `pg_advisory_xact_lock` sur `hashtext(token)` au début de la transaction :
  ```sql
  SELECT pg_advisory_xact_lock(hashtext('submit_guest:' || :token));
  ```
- Cela sérialise les soumissions concurrentes sur le même token.

### S8. `airbnb_reservations` non synchronisé pour `INDEPENDENT_BOOKING`
**Constat** — [submit-guest-info-unified/index.ts:1129, 1333](supabase/functions/submit-guest-info-unified/index.ts#L1129) :
```ts
if (booking.airbnbCode && booking.airbnbCode !== 'INDEPENDENT_BOOKING') {
  // sync vers airbnb_reservations
}
```
Les réservations indépendantes ne sont pas visibles dans le calendrier hôte côté Airbnb sync UI (qui lit `airbnb_reservations`).

**Action**
- Étendre la sync à toutes les réservations (ou créer une vue unifiée `all_reservations` qui UNION `bookings` et `airbnb_reservations`).

### S9. `validateRequest` exige minimum 2 caractères pour prénom/nom
**Constat** — [submit-guest-info-unified/index.ts:352-356](supabase/functions/submit-guest-info-unified/index.ts#L352-L356) :
```ts
if (!firstName || firstName.trim().length < 2) {
  errors.push(`${label}: prénom invalide (minimum 2 caractères)`);
}
```
Discrimine les invités avec noms courts : prénoms chinois « Li », « Yu » ; noms vietnamiens « An ».

**Action**
- Réduire à `length < 1` (juste vérifier non vide).
- Ajouter validation côté front + serveur pour éviter chiffres dans le nom (déjà fait dans `cleanGuestName`).

### S10. Auto-cleanup des tokens : 130 297 tokens en base, 99% inactifs
**Constat** — Migration `20260521000000_fix_rls_security.sql` lignes 92-94 :
```sql
DELETE FROM property_verification_tokens
WHERE is_active = FALSE
  AND created_at < NOW() - INTERVAL '90 days';
```
Migration ponctuelle, mais pas de prévention récurrente. Risque de retomber à 130K dans 6 mois.

**Action**
- Cron Edge Function `cleanup-stale-tokens` qui s'exécute tous les jours.
- Statistique observable dans un dashboard interne.

### S11. Multiples appels `getServerClient()` dans la même requête
**Constat** — Recherche : `getServerClient` apparaît **20+ fois** dans submit-guest-info-unified. Chaque appel re-crée un client `createClient(url, key)`. Le SDK Supabase ne pool pas les clients.

**Action**
- Injecter un `client` au top-level du `serve()` handler et le passer en paramètre.
- Profile : sur une soumission complète, mesurer le gain (probablement 100-300 ms).

### S12. `Patch D bis` : re-sync `bookings.guest_name` choisit le 1er guest créé
**Constat** — [submit-guest-info-unified/index.ts:1698-1719](supabase/functions/submit-guest-info-unified/index.ts#L1698-L1719) :
```ts
.from('guests').select('full_name').eq('booking_id', bookingId)
  .order('created_at', { ascending: true }).limit(1)
```
« Premier guest créé » ≠ forcément « voyageur principal ». Si l'OCR remplit le 2e slot avant le 1er (parallélisation), le mauvais nom devient `guest_name`.

**Action**
- Stocker un flag `is_primary` sur `guests` ou utiliser l'ordre d'arrivée dans le payload (`guests[0]`).
- Le `saveGuestDataInternal` reçoit `guestInfos[0]` comme primary — l'utiliser directement pour `bookings.guest_name` (déjà fait ligne 1087, mais le `Patch D bis` peut écraser après !).

### S13. `fontCache` global Noto Sans dépend de CDN externes
**Constat** — [submit-guest-info-unified/index.ts:14-24](supabase/functions/submit-guest-info-unified/index.ts#L14-L24) : fontes téléchargées depuis `cdn.jsdelivr.net` et `raw.githubusercontent.com`. Si l'un est bloqué (firewall pays, panne CDN), fallback Helvetica = **perte Unicode silencieuse** (caractères turcs « İ », arabes « محمد », accents japonais).

**Action**
- Héberger les fontes dans Supabase Storage du projet (un seul download, contrôle qualité).
- Monitoring : alert si `usesUnicode === false` en production.

---

## 11. Bugs serveur — Edge Function `extract-document-data` (OCR)

> Référence : [supabase/functions/extract-document-data/index.ts](supabase/functions/extract-document-data/index.ts) — 185 lignes.

### S14. Rate limit en mémoire par worker — inefficace en pratique
**Constat** — [extract-document-data/index.ts:11-19](supabase/functions/extract-document-data/index.ts#L11-L19) :
```ts
const _rl = new Map<string, { n: number; reset: number }>();
```
Map en mémoire. Supabase Edge Functions scale en N workers Deno isolés → chaque worker a sa propre Map. 10 req/min sur worker A peut être 10 req/min sur worker B.
De plus, `ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'` → tous les guests dont l'IP n'est pas reverse-proxiée correctement partagent la clé `'unknown'` → **faux positifs collectifs** : un guest qui upload bloque 9 autres.

**Action**
- Utiliser un store distribué : table Postgres `ocr_rate_limit (ip, count, window_start)` ou Supabase Realtime channels avec presence.
- Mieux : déplacer le rate-limit côté Postgres via `pg_advisory_xact_lock` + table de comptage.
- Distinguer rate-limit IP (anti-bot) vs rate-limit booking (anti-spam par guest).

### S15. `detail: 'low'` insuffisant pour les CIN à petits caractères
**Constat** — [extract-document-data/index.ts:124](supabase/functions/extract-document-data/index.ts#L124) :
```ts
detail: 'low', // ← 65 tokens fixes (vs 765+ en high/auto)
```
Bon pour les passeports (gros caractères, MRZ lisible). Mauvais pour les CIN marocaines / européennes avec petites polices : OpenAI Vision rate le numéro ou la date d'expiration → `documentNumber: null` + utilisateur frustré qui doit re-saisir.

**Action**
- Détecter d'abord le type via une première passe `detail: 'low'`. Si `documentType === 'national_id'` ou si des champs critiques manquent : re-appeler avec `detail: 'high'` (1 retry, coût marginal acceptable).
- Documenter le pourcentage de retry pour ajuster.

### S16. Pas de retry sur OpenAI 429 / 500
**Constat** — [extract-document-data/index.ts:135-140](supabase/functions/extract-document-data/index.ts#L135-L140) : première erreur OpenAI = échec définitif pour l'utilisateur.

**Action**
- Wrapper l'appel OpenAI dans une boucle de retry exponentielle (3 tentatives, 1s/2s/4s) pour les codes 429 et 5xx.
- Distinguer 4xx (erreur permanente, ne pas retry) de 5xx (erreur transitoire).

### S17. `temperature: 0` + `response_format: json_object` mais pas de validation de schéma
**Constat** — [extract-document-data/index.ts:111-132](supabase/functions/extract-document-data/index.ts#L111-L132). Le JSON retourné par le modèle peut contenir n'importe quoi (champ supplémentaire, type incorrect : nombre au lieu de string).

**Action**
- Valider le JSON avec un schéma Zod / Valibot côté Edge avant de le renvoyer au client.
- Si validation échoue, retry une fois ou fallback vers null fields explicites.

### S18. CORS `Allow-Origin: '*'` (vs whitelist sur `issue-guest-link`)
**Constat** — [extract-document-data/index.ts:5](supabase/functions/extract-document-data/index.ts#L5) :
```ts
'Access-Control-Allow-Origin': '*',
```
Permet à n'importe quel site d'utiliser l'OCR (consommation gratuite de l'API OpenAI sur le compte du projet).

**Action**
- Aligner sur la whitelist `ALLOWED_ORIGINS` de [issue-guest-link/index.ts:5-22](supabase/functions/issue-guest-link/index.ts#L5-L22).
- Renforcer : exiger un token guest valide en header (pas de OCR anonyme).

### S19. `OffscreenCanvas` peut ne pas être disponible
**Constat** — [extract-document-data/index.ts:48-54](supabase/functions/extract-document-data/index.ts#L48-L54) : utilise `OffscreenCanvas` pour resize. Deno Deploy le supporte normalement, mais en cas d'erreur, fallback `return { bytes, mime }` retourne l'image originale → si 5 Mo, gros payload OpenAI.

**Action**
- Logger explicitement les cas de fallback.
- Imposer un max size avant appel OpenAI : si > 2 Mo et resize échoué, rejeter avec 413 Payload Too Large.

### S20. Pas de logging structuré ni de monitoring
**Constat** — `console.log` seulement. Pas de Sentry, pas de métrique de taux d'erreur, pas d'alerte sur pic OCR (cf. pic 1421 requêtes le 19/05 noté dans [PLAN_CHIRURGICAL_TOKENS_NOMS.md:399](PLAN_CHIRURGICAL_TOKENS_NOMS.md#L399)).

**Action**
- Intégrer Sentry ou Logflare.
- Métrique custom Supabase : `ocr_calls_per_booking_per_day` exposée dans un dashboard.

---

## 12. Bugs serveur — Edge Function `issue-guest-link`

> Référence : [supabase/functions/issue-guest-link/index.ts](supabase/functions/issue-guest-link/index.ts) — 1 181 lignes.

### S21. `handleResolve` incrémente `used_count` sur chaque appel
**Constat** — [issue-guest-link/index.ts:1159-1170](supabase/functions/issue-guest-link/index.ts#L1159-L1170) :
```ts
await server.from('property_verification_tokens')
  .update({ used_count: (tokenRow.used_count ?? 0) + 1, last_used_at: new Date().toISOString() })
```
Un guest qui refresh sa page 10 fois → 10 incréments. Si la contrainte `pvt_used_count_lte_max_uses` (migration 20260521) est active et `max_uses=10`, le 11e refresh est rejeté.

**Action**
- Incrémenter `used_count` **uniquement** lors de la soumission finale (dans `submit-guest-info-unified`), pas lors du resolve.
- `last_used_at` peut rester sur le resolve (utile pour audit), mais sans incrément.

### S22. `handleResolve` ne valide pas que `booking_id` existe encore
**Constat** — [issue-guest-link/index.ts:1115-1131](supabase/functions/issue-guest-link/index.ts#L1115-L1131). Retourne `bookingId: tokenRow.booking_id` sans vérifier que le booking existe en BDD.
Cas observé : [PLAN_CHIRURGICAL_TOKENS_NOMS.md:29](PLAN_CHIRURGICAL_TOKENS_NOMS.md#L29) booking SAKARA supprimé → token orphelin actif.

**Action**
- Joindre `bookings` dans la sélection :
  ```sql
  SELECT pvt.*, b.id AS booking_exists FROM property_verification_tokens pvt
  LEFT JOIN bookings b ON b.id = pvt.booking_id
  WHERE pvt.token = ?
  ```
- Si `booking_exists IS NULL` et `pvt.booking_id IS NOT NULL` → désactiver le token et retourner 410.

### S23. Réutilisation de token avec `shouldReuse = true` toujours actif
**Constat** — [issue-guest-link/index.ts:355-381](supabase/functions/issue-guest-link/index.ts#L355-L381) : tout token actif est toujours réutilisé. Aucun mécanisme de rotation. Si un lien fuit (Twitter, capture d'écran), il reste valide à vie.

**Action**
- Ajouter expiration par défaut configurable (90 jours, override par hôte).
- Bouton « Régénérer ce lien » côté hôte qui désactive l'ancien et émet un nouveau.
- Possibilité de définir `max_uses` côté hôte (10 par défaut).

### S24. `ACCESS_CODE_PEPPER` non-rotable
**Constat** — [issue-guest-link/index.ts:122-134](supabase/functions/issue-guest-link/index.ts#L122-L134) `hashAccessCode` utilise un pepper d'env. Si compromis, le seul recours est de tourner le pepper, mais cela invalide **tous** les tokens existants. Catastrophe.

**Action**
- Stocker le pepper version dans le token : `pepper_version: 1`.
- Au moment de la vérification, utiliser le pepper correspondant à la version du token.
- Migration progressive lors d'une rotation.

### S25. `existingActiveToken` peut renvoyer un token d'un autre booking
**Constat** — [issue-guest-link/index.ts:335-348](supabase/functions/issue-guest-link/index.ts#L335-L348) :
```ts
const tokenQuery = server.from('property_verification_tokens')
  .select('id, token, expires_at, created_at, metadata')
  .eq('property_id', propertyId)
  .eq('is_active', true);

if (finalBookingId) {
  tokenQuery.eq('booking_id', finalBookingId);
}
```
Si `finalBookingId` est `undefined` (cas indépendant), `maybeSingle()` peut renvoyer le premier token actif pour la propriété — qui appartient à un **autre** booking. → Token réutilisé pour le mauvais séjour, exactement le bug Magno.

**Action**
- Si `!finalBookingId`, ne PAS réutiliser un token actif (créer toujours un nouveau).
- Forcer l'appelant à fournir un `bookingId` (ou des dates dans `reservationData`).

### S26. Pas d'audit trail des émissions de tokens
**Constat** — Aucun log persistant de « qui a émis quel token quand ». Si un guest a 11 tokens (cas Magno), impossible de tracer la source.

**Action**
- Table `audit_token_issuance (token_id, issued_by_user_id, issued_at, request_origin, metadata)`.
- RLS : admin uniquement.

---

## 13. Cache et mémoire — Côté client

### M1. `_ocrCache: Map<string, ExtractedGuestData>` sans limite de taille
**Constat** — [openaiDocumentService.ts:62](src/services/openaiDocumentService.ts#L62) :
```ts
const _ocrCache = new Map<string, ExtractedGuestData>();
```
Vit pour la session navigateur. Si l'invité teste 30 photos différentes, la Map gonfle. Pas de LRU.

**Action**
- Limite à 20 entrées max (LRU).
- TTL implicite par fermeture d'onglet (déjà fait).

### M2. Hash SHA-256 client-side identifie le fichier mais pas l'image
**Constat** — [openaiDocumentService.ts:64-68](src/services/openaiDocumentService.ts#L64-L68) hash sur les bytes du fichier. Un même JPEG re-compressé (drag-n-drop depuis WhatsApp) a un hash différent → cache miss → coût OpenAI.

**Action**
- Hash **perceptuel** (pHash, dHash) basé sur les pixels normalisés. Acceptable pour l'usage.
- Alternative : hash côté serveur après resize (la version normalisée 1024px est stable).

### M3. `URL.createObjectURL` jamais révoqué pour les documents restaurés depuis sessionStorage
**Constat** — [GuestVerification.tsx:1022](src/pages/GuestVerification.tsx#L1022) `restoreFormDataFromSession` crée des `URL.createObjectURL(blob)` sans les tracker. Si le user fait 5 navigations, 5 URLs par document × N documents accumulent.

**Action**
- Garder un `Set<string>` des URLs créées, `URL.revokeObjectURL` au `useEffect` cleanup et au démontage.
- Idéalement : ne pas restaurer les blobs depuis sessionStorage (cf. P7 du plan UX : upload Storage côté client → on stocke seulement le `storagePath`).

### M4. `processingFilesRef: Set<string>` jamais vidé
**Constat** — [GuestVerification.tsx:325](src/pages/GuestVerification.tsx#L325) `processingFilesRef.current = new Set<string>()`. Chaque fichier ajouté avec `.add(fileKey)` mais retiré avec `.delete()` uniquement en cas de succès (ligne 1633). En cas d'erreur non capturée, l'entrée reste.

**Action**
- Wrap dans `try/finally` global pour garantir le `.delete()`.

### M5. `localStorage` clés globales : `currentBookingId`, `contractUrl`, etc.
**Constat** — [GuestVerification.tsx:2167-2184](src/pages/GuestVerification.tsx#L2167-L2184) écrit dans `localStorage` sans namespace par token / propertyId. Si un invité ouvre 2 réservations différentes (même Airbnb avec 2 séjours), la 2e écrase la 1ère.

**Action**
- Suffixer chaque clé : `localStorage.setItem(`contractUrl:${propertyId}:${token}`, ...)`.
- Cron de nettoyage : à chaque mount, supprimer les clés > 7 jours.

### M6. sessionStorage déborde sur uploads multiples (QuotaExceededError silencieux)
**Constat** — [GuestVerification.tsx:929-952](src/pages/GuestVerification.tsx#L929-L952) `saveFormDataToSession` sérialise les fichiers en base64 dans sessionStorage. 5 photos × 2 Mo = 13 Mo base64. La plupart des navigateurs : sessionStorage limité à 5-10 Mo → `setItem` throw silencieusement, `catch` log mais utilisateur ne sait pas.

**Action**
- Si upload Storage côté client (cf. P7) : on stocke uniquement les `storagePath` (chaînes < 200 octets chacune). Plus de débordement.
- Affichage utilisateur : « ⚠️ Sauvegarde locale impossible (trop de photos). Vos données seront perdues si vous fermez l'onglet. »

### M7. `lastDeduplicatedGuestsRef.current` peut retenir des références obsolètes
**Constat** — [GuestVerification.tsx:241](src/pages/GuestVerification.tsx#L241) ref vers le dernier array `guests`. Au démontage du composant, le ref n'est pas explicitement vidé → la JS engine garde l'array vivant tant que le module reste chargé.

**Action**
- `useEffect(() => () => { lastDeduplicatedGuestsRef.current = []; }, [])` au démontage.

### M8. `isMountedRef.current` set à false au cleanup mais pas tous les autres refs
**Constat** — [GuestVerification.tsx:372-380](src/pages/GuestVerification.tsx#L372-L380) :
```ts
return () => {
  isMountedRef.current = false;
  navigationInProgressRef.current = false;
};
```
Les 7 autres refs (`isProcessingRef`, `isCheckingICSRef`, `isVerifyingTokenRef`, `isSubmittingRef`, `hasInitializedICSRef`, etc.) ne sont pas réinitialisés → si le user revient sur la page via SPA navigation, les flags figés peuvent bloquer une nouvelle soumission.

**Action**
- Reset tous les refs au cleanup (ou mieux : utiliser un `useReducer` au lieu de 10 refs).

### M9. `runningWorkflows: Map<string, boolean>` module-level
**Constat** — [documentServiceUnified.ts:72](src/services/documentServiceUnified.ts#L72) `const runningWorkflows = new Map<string, boolean>();`. Module-level → vivant tant que la page est chargée. Pas de nettoyage automatique sur exception.

**Action**
- Wrapper avec timestamp + TTL : `{ startedAt: number }`, purge automatique > 60s.
- Reset proactif au `beforeunload`.

---

## 14. Persistance et race conditions — Côté client

### M10. `useLayoutEffect` ligne 410 puis `useEffect` ligne 445 = double effet de bord
**Constat** — Le `useLayoutEffect` nettoie sessionStorage si `INDEPENDENT_BOOKING`, puis le `useEffect` ICS re-fetch. Si l'un échoue, l'autre opère sur un état partiel.

**Action**
- Fusionner dans un seul `useEffect` synchrone (déjà mentionné P15).
- Stratégie de priorité claire : si URL params → utilise-les. Sinon ICS metadata. Sinon Airbnb booking.

### M11. 3 useEffect concurrents + 9 refs + 6 sessionStorage keys
**Constat** — Compté dans le composant :
- `isMountedRef`, `navigationInProgressRef`, `processingFilesRef`, `isProcessingRef`, `isCheckingICSRef`, `isVerifyingTokenRef`, `isSubmittingRef`, `hasInitializedICSRef`, `hasInitializedTokenRef`, `hasInitializedBookingRef` = **10 refs de gardes**
- sessionStorage keys : `ics`, `token`, `booking_*`, `token_valid`, `property_name`, `form_*` = **6+ clés**
- Race conditions : si le user clique 2 fois rapidement sur "Suivant", `isSubmittingRef` bloque mais l'utilisateur ne sait pas pourquoi.

**Action**
- Cf. P14 : 3 custom hooks isolés. Suppression de 8 refs (garder uniquement `isMountedRef` et un seul ref d'état machine).
- Remplacer sessionStorage par un store React (Zustand) qui synchronise avec sessionStorage automatiquement.

### M12. `document.querySelector` pour lire les inputs (rappel P12 mais avec impact race)
**Constat** — [GuestVerification.tsx:1807, 1878, 1926, 1946-1949](src/pages/GuestVerification.tsx#L1807). Lecture au moment du submit. Si React n'a pas encore reconcilié (animation Framer en cours), le DOM peut être obsolète.

**Action**
- Inputs contrôlés (cf. P12).
- Si conservé : `flushSync(() => { ... })` avant la lecture (mais coût performance).

### M13. `clearStaleSupabaseSessionIfNeeded` ne traite pas le cas "session valide mais user différent"
**Constat** — [guestSupabaseAuthCleanup.ts:12-25](src/lib/guestSupabaseAuthCleanup.ts#L12-L25) nettoie uniquement si l'erreur match `STALE_SESSION_MSG`. Mais si l'hôte est connecté sur son propre device puis utilise un lien guest (test) : la session hôte reste, `auth.uid()` côté client = hôte, ce qui pourrait fausser les RLS si jamais l'appel SDK passe par le SDK authentifié.

**Action**
- Force `supabase.auth.signOut({ scope: 'local' })` systématiquement avant un parcours guest (le tradeoff : si l'hôte teste, il doit se reconnecter ensuite).
- Ou : utiliser un client Supabase séparé pour les pages guest (sans session persistante).

### M14. `EdgeClient` parse `text` puis re-`JSON.parse(text)` même si déjà JSON
**Constat** — [edgeClient.ts:34-44](src/lib/edgeClient.ts#L34-L44) :
```ts
const text = await response.text();
data = text ? JSON.parse(text) : undefined;
```
Si la réponse est très lourde (10 Mo), on alloue la string + on re-parse. Inefficace.

**Action**
- Utiliser `response.json()` directement.
- Wrapper try/catch pour gérer non-JSON.

---

## 15. Bugs RLS / migrations

### S27. `generated_documents` était sans RLS jusqu'à la migration 20260521
**Constat** — [supabase/migrations/20260521000000_fix_rls_security.sql:70](supabase/migrations/20260521000000_fix_rls_security.sql#L70) active RLS sur `generated_documents`. Avant cette migration : **n'importe quel utilisateur authentifié pouvait lire tous les contrats de tous les hôtes**.

**Action**
- Vérifier que la migration est appliquée en production.
- Audit : `SELECT * FROM pg_tables WHERE rowsecurity = false AND schemaname = 'public'` doit retourner 0.

### S28. `airbnb_sync_status`, `guest_verification_tokens` (legacy), `generated_documents_archive` sans policy
**Constat** — Même migration ajoute les policies manquantes (lignes 22-57). Avant : tables `RLS ON` mais 0 policy → tout est bloqué OU tout est ouvert selon l'état.

**Action**
- Vérifier l'application en prod (cf. S27).

### S29. Tables `bookings_backup_*` non protégées (avant migration)
**Constat** — Migration 20260521 ligne 65 supprime des tables backup. Si non encore appliquée : copie complète de bookings accessible sans RLS.

**Action**
- Migration prioritaire à appliquer.
- Audit : `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%backup%'` doit retourner 0.

### S30. `check_reservation_allowed` RPC en fallback permissif
**Constat** — [issue-guest-link/index.ts:262-302](supabase/functions/issue-guest-link/index.ts#L262-L302) : si le RPC n'existe pas (`PGRST202`), `permissionAllowed = true` (fallback permissif).
Si admin a désactivé un hôte mais que la migration `20260513150000_ensure_check_reservation_allowed_service_role.sql` n'est pas appliquée → contrôle bypass.

**Action**
- Vérifier l'application de la migration.
- Changer le fallback à **deny** (`permissionAllowed = false`) avec message explicite.

### S31. `pvt_used_count_lte_max_uses` constraint check
**Constat** — Migration 20260521 ligne 117-119 ajoute la contrainte. Si `max_uses` était dans le code mais pas en BDD avant, des tokens existants peuvent violer la contrainte → migration échoue.

**Action**
- Avant d'appliquer : pré-vérifier les violations potentielles (cf. PLAN_CHIRURGICAL_TOKENS_NOMS.md Phase 2.1).

---

## 16. Bugs nommage / sémantique de colonnes

### S32. `document_issue_date` en BDD mais c'est en réalité la date d'**expiration**
**Constat** — Commentaire dans le code [submit-guest-info-unified/index.ts:1453](supabase/functions/submit-guest-info-unified/index.ts#L1453) :
```ts
document_issue_date: sanitizedGuest.documentIssueDate || null, // ✅ Date d'expiration du document
```
Aussi dans [GuestVerification.tsx:217](src/pages/GuestVerification.tsx#L217). Le commentaire dit explicitement qu'il s'agit de la date d'expiration mais le nom de colonne dit le contraire.

**Impact** :
- Risque d'erreur : un futur dev verra `document_issue_date` et passera la date d'**émission** → contrat avec date fausse.
- L'audit (`audit_contract_guest_names.sql`) peut afficher des dates en colonne `issue_date` qui sont en réalité des expirations.

**Action**
- Migration de renommage : `ALTER TABLE guests RENAME COLUMN document_issue_date TO document_expiry_date;`
- Vue de compatibilité 1 mois : `CREATE VIEW guests_legacy AS SELECT *, document_expiry_date AS document_issue_date FROM guests;`
- Mettre à jour toutes les références dans les Edge functions (15+ occurrences).
- Mettre à jour le prompt OCR pour clairement demander la date d'expiration.

### S33. `adresse_personnelle` snake_case en BDD vs `adressePersonnelle` camelCase en payload
**Constat** — Toutes les colonnes en snake_case mais le payload côté client en camelCase. Mapping manuel partout, fragile aux fautes de frappe.

**Action**
- Générer les types via `supabase gen types typescript` et faire des helpers `toDbFormat()` / `fromDbFormat()`.
- Ou : utiliser le mode `transform` du SDK Supabase.

### S34. Colonnes inexistantes documentées par commentaires (`email`, `phone` dans `guests`)
**Constat** — [submit-guest-info-unified/index.ts:1444-1465](supabase/functions/submit-guest-info-unified/index.ts#L1444-L1465) :
```ts
// ❌ IMPORTANT : La table 'guests' n'a PAS de colonnes 'email' ni 'phone'
// ❌ SUPPRIMÉ : Ne PAS ajouter email - la colonne n'existe pas dans la table 'guests'
```
Le code rappelle régulièrement de ne pas ajouter ces colonnes. Symptôme d'un bug récurrent corrigé multiple fois.

**Action**
- Soit ajouter les colonnes `email` et `phone` à `guests` (chaque voyageur peut avoir le sien).
- Soit créer une vue `guests_with_contact` qui jointe `bookings.guest_email` au premier guest.

---

## 17. Code mort et fichiers obsolètes

### D1. 180+ fichiers `.md` à la racine
**Constat** — `ANALYSE_*`, `DIAGNOSTIC_*`, `CORRECTION_*`, `SOLUTION_*` — accumulation depuis des sessions de debug.

**Action**
- Archiver dans `docs/archive/2025-2026/` les fichiers > 30 jours.
- Garder à la racine uniquement : `README.md`, `CLAUDE.md`, `verification-guest.md` (ce plan), et les 2-3 actifs.

### D2. Fichiers `supabase/functions/issue-guest-link/index-*.ts` en double
**Constat** — `index-CORRIGE-COMPLET.ts`, `index-optimized.ts`, `index-standalone-secure.ts`, `index-CORRIGE.md`. Confusion sur la version active.

**Action**
- Garder uniquement `index.ts` (la version déployée).
- Archiver les autres dans `_archive/`.

### D3. `MobileGuestVerification.tsx` orphelin (déjà P17)
### D4. `testDateOfBirth` debug en prod (déjà P18)
### D5. `DEV_GUEST_VERIFICATION_URL` banner (déjà P19)

### D6. Nouveaux fichiers SQL à la racine non commités (statut git)
**Constat** — Git status :
```
?? supabase/sql/EXECUTER_SQL_EDITOR_phase2_et_3.sql
?? supabase/sql/EXECUTER_SQL_EDITOR_v2_corrige.sql
?? supabase/sql/fix_date_conflicts_audit.sql
?? supabase/sql/fix_magno_tokens_and_july_stay.sql
?? supabase/sql/fix_saima_sakara_apply.sql
?? supabase/sql/fix_saima_sakara_dates.sql
?? supabase/sql/fix_shared_tokens_deactivate.sql
?? supabase/sql/restitution_bloc_D_ready_to_paste.sql
?? tools/audit-date-conflicts.mjs
?? tools/audit-name-consistency.mjs
?? tools/audit-shared-tokens.mjs
?? tools/fix-saima-sakara.mjs
?? tools/fix-shared-tokens.mjs
?? tools/investigate-magno.mjs
?? tools/query-saima-sakara.mjs
```
Scripts de fix one-shot. À versionner ou supprimer.

**Action**
- Versionner dans `supabase/sql/scripts/` pour traçabilité.
- Documenter quels ont été exécutés en prod et quand (table `executed_scripts`).

---

## 18. Récapitulatif des actions priorisées

### Phase 1 — Quick wins UX (1-2 jours, pas de refacto)
1. **P1** — Découpler verrouillage des champs : motif/profession/adresse/email saisissables immédiatement.
2. **P2** — Renommer « Suivant » → « Vérifier et envoyer » sur étape Documents.
3. **P4** — Découpler suppression document ↔ suppression voyageur.
4. **P9** — Bouton « Recommencer extraction » sur documents en erreur.
5. **P11** — Ajouter champ « Lieu de naissance » au formulaire (déjà extrait).
6. **P17** — Supprimer `MobileGuestVerification.tsx` orphelin.
7. **P18** — Supprimer `testDateOfBirth`.
8. **P19** — Wrapper DEV banner avec `import.meta.env.DEV`.
9. **P20** — Supprimer `setTimeout(50)` et `setTimeout(100)` avant navigate.
10. **P25** — « Réessayer » revient à Documents, pas à Booking ; garder data.
11. **P27** — Avertissement non-bloquant si date passée.
12. **P31, P32** — Strings manquantes en i18n.

### Phase 2 — Refonte calendriers (2-3 jours)
13. **P-Cal1** — Ajouter `minDate={today}` au calendrier de séjour, supprimer staggered animation, fix re-mount selects.
14. **P-Cal2** — Composant DOB à 3 selects (jour/mois/année).
15. **P-Cal3** — Composant Expiration à 3 selects + renommer en `documentExpiryDate` partout.

### Phase 3 — Refonte architecture (4-5 jours)
16. **P7** — Upload Storage client-side (Supabase Storage) au lieu de base64-in-body.
17. **P12, P16** — Inputs contrôlés partout, suppression `document.querySelector`.
18. **P13** — Extraction `sanitizeGuestName`.
19. **P14, P15** — 3 custom hooks `useGuestPrefillFromX`, suppression des 9 refs.
20. **P22** — Suppression des Portals Radix + try/catch « insertBefore ».
21. **P23** — Découpage en sous-composants.
22. **P24** — Source de vérité unique : `guests[]`.

### Phase 4 — Robustesse et fiabilité (2-3 jours)
23. **P3** — Mapping N documents ↔ M voyageurs.
24. **P5** — Dédoublonnage uniquement sur `documentNumber` non vide.
25. **P6** — TTL sur `runningWorkflows`.
26. **P8** — Upload parallèle avec concurrence limitée.
27. **P10** — Validation cohérence DOB / expiration.
28. **P21** — Progress bar réelle pendant soumission.
29. **P26** — `revokeObjectURL` au démontage.
30. **P28, P29** — Stepper Signature cliquable + reprise post-signature.
31. **P30** — Sticky action bar mobile.
32. **P33, P34** — Accessibilité (autoComplete, labels).
33. **P35, P36** — Helpers dates centralisés, retours `null` explicites.

### Phase 5 — Bugs serveur critiques (3-4 jours)
34. **S1** — Persister `placeOfBirth` en BDD (champ extrait mais perdu).
35. **S2** — Sweep guests fantômes basé sur ID, pas sur timestamp.
36. **S3** — Vérifier l'application de la migration `one_active_token_per_booking` + trigger préventif.
37. **S4** — Garde anti-doublon des contrats basée sur **hash du contenu**, pas l'URL.
38. **S5** — Garantir transaction `guests` commitée avant génération PDF.
39. **S6** — Cron de cleanup des bookings `is_preview=true` orphelins.
40. **S7** — `pg_advisory_xact_lock` côté serveur sur `(token, propertyId)`.
41. **S11** — Pooler le client Supabase côté Edge (un seul par requête).
42. **S12** — `bookings.guest_name` toujours synchronisé avec `guests[0]` du payload.
43. **S13** — Hoster Noto Sans dans Supabase Storage (autonomie vs CDN externes).

### Phase 6 — Bugs serveur OCR + token (2-3 jours)
44. **S14** — Rate limit OCR côté Postgres (table + RPC), pas en mémoire.
45. **S15** — Retry OCR avec `detail: high` si champs critiques manquants.
46. **S16** — Retry exponentiel sur OpenAI 429/500.
47. **S17** — Validation Zod du JSON OCR avant retour client.
48. **S18** — CORS strict sur `extract-document-data` (whitelist domaines).
49. **S21** — `used_count` incrémenté uniquement à la soumission finale.
50. **S22** — Vérifier que `booking_id` existe lors du resolve token.
51. **S23** — Expiration token par défaut (90 jours) + bouton hôte de régénération.
52. **S24** — Pepper versionné pour `access_code_hash`.
53. **S25** — Ne pas réutiliser un token sans `bookingId` explicite.
54. **S26** — Table d'audit des émissions de tokens.

### Phase 7 — Cache, mémoire et persistance client (2 jours)
55. **M1** — LRU 20 entrées max sur `_ocrCache`.
56. **M2** — Hash perceptuel pour le cache OCR (robuste à re-compression).
57. **M3** — Tracker et révoquer tous les `URL.createObjectURL`.
58. **M4** — `try/finally` global pour vider `processingFilesRef`.
59. **M5** — Namespacer toutes les clés `localStorage` par token+propertyId.
60. **M6** — Plus de blobs en sessionStorage (cf. P7 = upload Storage côté client).
61. **M7, M8** — Reset tous les refs au démontage (ou migration vers useReducer).
62. **M9** — TTL sur `runningWorkflows` Map (60s).
63. **M11** — Migration vers Zustand pour la persistance synchronisée.
64. **M13** — `signOut({ scope: 'local' })` systématique sur entrée parcours guest.
65. **M14** — `response.json()` au lieu de `text() → JSON.parse`.

### Phase 8 — RLS et nomenclature BDD (1-2 jours)
66. **S27** — Vérifier RLS actif sur `generated_documents` en prod.
67. **S28** — Vérifier policies sur `airbnb_sync_status`, `generated_documents_archive`.
68. **S29** — Confirmer suppression des tables `bookings_backup_*`.
69. **S30** — Fallback `check_reservation_allowed` en **deny** au lieu de allow.
70. **S31** — Pré-check violations avant `pvt_used_count_lte_max_uses`.
71. **S32** — Renommer `document_issue_date` → `document_expiry_date` (migration + alias).
72. **S33** — Types générés `supabase gen types` + helpers de mapping.
73. **S34** — Décider de la stratégie email/phone dans `guests` vs `bookings`.

### Phase 9 — Hygiène du repo (0.5 jour)
74. **D1** — Archiver les 180+ `.md` historiques dans `docs/archive/`.
75. **D2** — Supprimer les `index-*.ts` duplicates dans `issue-guest-link/`.
76. **D6** — Versionner ou archiver les scripts SQL one-shot non commités.

---

## 19. Mesures de succès attendues

### Front-end (UX)
| Métrique | État actuel (estimé) | Cible |
|---|---|---|
| Temps moyen entre arrivée sur la page et soumission réussie | 6-10 min | < 3 min |
| Taux d'abandon entre étape Documents et soumission | ~ 20-30 % | < 8 % |
| Taux de soumissions avec ≥ 1 erreur OCR à corriger manuellement | ~ 40 % | < 20 % |
| Payload moyen de l'appel `submit-guest-info-unified` | 3-15 Mo | < 100 Ko |
| Temps total `handleSubmit` → page signature | 15-45 s | < 8 s |
| Lignes de code `GuestVerification.tsx` | 4 184 | < 800 |
| useRef de gardes anti-double-exécution | 10 | ≤ 2 |
| Strings non traduites visibles | ~ 15 | 0 |
| `URL.createObjectURL` non révoquées au démontage | ~ 10 | 0 |
| Memory leaks tracés par DevTools sur 10 navigations | OOM en 5-10 cycles | 0 |

### Serveur (intégrité données)
| Métrique | État actuel | Cible |
|---|---|---|
| Tokens actifs par booking | jusqu'à 11 (Magno) | 1 (index unique) |
| `guest_name = 'Guest'` (placeholder) | 5+ documenté | 0 |
| Contrats par booking (versions accumulées) | 3-15 | ≤ 2 (1 brouillon + 1 signé) |
| `CONTRACT_BEFORE_GUEST_BACKFILL` cases | 9+ (batch avril) | 0 |
| Tokens partagés (1 token = N bookings) | 5 confirmés | 0 |
| `placeOfBirth` extrait perdu en BDD | 100% | 0% |
| OCR cache hit rate | inconnu | > 30% |
| Coût OpenAI mensuel (estimation) | élevé (pics) | -50% (retry + cache) |
| RLS désactivé sur tables critiques | 4+ (avant migration) | 0 |

### Stabilité
| Métrique | Cible |
|---|---|
| Soumissions doublons | 0 |
| Conflits dates concurrents non détectés | 0 |
| Sessions stale hôte/guest mélangées | 0 |
| Bookings preview orphelins > 1h | 0 |
| OCR rate-limit faux positifs | 0 |

---

## 20. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Régression sur les liens ICS Airbnb existants | Tests E2E avec captures URL réelles (3 cas : URL params, token ICS, airbnbBookingId) |
| Régression dates timezone (Vercel) | Tests sur dates limites (1er janvier, dernier jour du mois, DST) |
| Régression sur navigation depuis page de signature | Conserver `location.state.fromSignaturePage` pendant la transition |
| Régression OCR (changement de prompt) | A/B test : 100 dernières extractions vs nouvelles |
| Upload Storage CORS / RLS bloqué | Vérifier policies `guest-documents` bucket avant déploiement |
| Migration de renommage `document_expiry_date` casse code legacy | Vue alias 1 mois, audit grep, déploiement progressif |
| Trigger Postgres trop strict bloque soumission | Tester sur staging avec données prod (read-only), rollback rapide |
| Rate-limit Postgres devient bottleneck | Index optimisé + benchmark 100 req/s |
| Suppression de tables backup perd des données réelles | Snapshot complet S3 avant migration |
| Hash perceptuel cache OCR faux positifs | Seuil de distance Hamming configurable, monitoring |
| `signOut` systématique frustre l'hôte qui teste | Toggle dev mode |

---

## 21. Plan de déploiement recommandé

```
Semaine 1 : Quick wins UX (Phase 1) — déploiement continu, faible risque
Semaine 2 : Calendriers (Phase 2) — 1 calendrier par jour
Semaine 3-4 : Refonte architecture (Phase 3) — feature flag par sous-composant
Semaine 5 : Robustesse (Phase 4) — staging puis prod
Semaine 6 : Bugs serveur critiques (Phase 5) — migration BDD avec rollback
Semaine 7 : Bugs serveur OCR + token (Phase 6) — déploiement par Edge function
Semaine 8 : Cache/mémoire client (Phase 7) — monitoring DevTools avant/après
Semaine 9 : RLS et nomenclature (Phase 8) — audit complet de sécurité
Semaine 10 : Hygiène (Phase 9) + validation 24h des métriques cibles
```

---

## 22. Hors scope (à traiter séparément)

- Le composant `ContractSigning` (page suivante) : nettoyage et UX de la signature.
- Le composant `GuestEditDialog` (autre flux côté hôte).
- La gestion de la langue dans `GuestLocaleProvider`.
- Refonte complète du dashboard hôte (génération de liens, etc.).
- Migration vers SSR / Next.js (impact systémique).
- Refonte du système de paiement / souscriptions.

---

*Fin du plan exhaustif. Couvre UX (P1-P36), serveur (S1-S34), cache/mémoire/persistance (M1-M14), code mort (D1-D6) = **89 actions priorisées en 9 phases**. Prêt pour validation avant exécution.*
