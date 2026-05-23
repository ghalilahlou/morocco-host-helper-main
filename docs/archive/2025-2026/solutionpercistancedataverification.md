# Persistance Guest Verification → contrat / fiches police

## Symptômes

- Après OCR ou modification manuelle (date de naissance, nationalité, n° document), le contrat ou la fiche police affichent encore des placeholders ou « Non spécifiée ».
- Plusieurs invités enregistrés mais une seule fiche / données incomplètes côté hôte.

## Cause racine supplémentaire (contrat / fiche police vides malgré le formulaire)

La table `guests` (jointe sur `bookings`) peut contenir une ligne avec **seulement le nom**, alors que `guest_submissions.guest_data` contient la fiche complète (`guests[]`, `idNumber`, `dateOfBirth`, etc.).  
`buildContractContext` utilisait d’abord `b.guests` et **ne lisait `guest_submissions` que si aucune ligne** — le contrat et la logique police côté serveur prenaient donc des champs vides. **Corrigé** : dernière soumission lue en priorité quand la ligne `guests` est « sparse » (sans date de naissance ou sans n° document).  
Sur la fiche police, `mapGuestData` ignorait aussi **`idNumber` / `idType`** (camelCase du payload) : complété + dernière soumission par `updated_at`.

## Causes identifiées dans le code

### 1. `updateGuest` bloquait les mises à jour sans document à l’index

Dans `GuestVerification.tsx`, `updateGuest` retournait immédiatement si `uploadedDocuments[index]` était absent ou en cours de traitement. Les champs contrôlés ne mettaient alors pas à jour l’état React, alors que le verrouillage UX est déjà géré par `disabled={fieldsLocked}`.

### 2. Désalignement d’index : formulaire sur `deduplicatedGuests`, écritures sur `guests[i]`

Le rendu utilise `deduplicatedGuests.map((guest, index) => …)` mais `updateGuest(index, …)` modifiait `guests[index]`. Après déduplication, l’index affiché ne correspond plus forcément à la ligne dans `guests` (même référence d’objet : utiliser `guests.findIndex(g => g === guest)` comme **rowIndex**).

### 3. `generate-police-form` ignorait `guest_data.guests[]`

Les soumissions stockent plusieurs invités dans `guest_data.guests`. L’edge function faisait `submissions.map(s => mapGuestData(s.guest_data))`, ce qui ne développait pas le tableau `guests` → une seule entrée normalisée pour la génération PDF.

### 4. Validation documents / motif de séjour

Les sélecteurs `name="motifSejour-${index}"` et la validation des pièces doivent utiliser le même **rowIndex** que le formulaire.

## Correctifs appliqués (résumé)

| Zone | Action |
|------|--------|
| `updateGuest` | Suppression du garde-fou sur `uploadedDocuments` ; mise à jour toujours appliquée sur `guests[rowIndex]`. |
| Formulaire documents | `rowIndex = guests.findIndex(g => g === guest)` pour verrou, document, `updateGuest`, `removeGuest`, ids/names DOM. |
| Validation soumission | Boucles documents / `motifSejour` / `guestsPayload` basées sur `rowIndex`. |
| `generate-police-form` | Aplatissement de `guest_data.guests` (et équivalent par ligne de soumission) avant `mapGuestData`. |

## Vérifications manuelles recommandées

1. Un voyageur : OCR partiel puis complétion manuelle → contrat et fiche à jour.
2. Deux voyageurs distincts : deux lignes dans `guest_data.guests`, PDF police avec deux pages.
3. Cas avec doublon détecté dans les logs : édition du 2ᵉ voyageur affiché met bien à jour la bonne ligne `guests`.

## Fichiers touchés

- `src/pages/GuestVerification.tsx`
- `supabase/functions/generate-police-form/index.ts`
