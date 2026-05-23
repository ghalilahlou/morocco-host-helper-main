# Archive — Résolution conflits tokens, réservations et contrats

Document d’archivage de la session de résolution (mai 2026) : mauvais noms sur contrats, rattachement de séjours via tokens partagés, cas Saima/Sakara et Magno.

**Date d’archivage :** 20 mai 2026  
**Propriété centrale (exemples) :** 7ème ciel (`a0ae5d83-41a7-49e4-8939-d1850ab3c61c`), La pépite de Gauthier (`e9014f29-d8dd-45ce-adbb-d0497a13987f`)

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Symptômes et causes racines](#2-symptômes-et-causes-racines)
3. [Chronologie des actions](#3-chronologie-des-actions)
4. [Cas traités en détail](#4-cas-traités-en-détail)
5. [Correctifs code (non déployés sauf mention)](#5-correctifs-code-non-déployés-sauf-mention)
6. [Correctifs données exécutés](#6-correctifs-données-exécutés)
7. [Tokens partagés désactivés](#7-tokens-partagés-désactivés)
8. [Commandes et scripts](#8-commandes-et-scripts)
9. [Fichiers SQL](#9-fichiers-sql)
10. [Outils Node (`tools/`)](#10-outils-node-tools)
11. [Migrations Supabase](#11-migrations-supabase)
12. [Fichiers code clés](#12-fichiers-code-clés)
13. [Documentation Markdown liée](#13-documentation-markdown-liée)
14. [Plans Cursor](#14-plans-cursor)
15. [Prévention et suite](#15-prévention-et-suite)
16. [Transcript de conversation](#16-transcript-de-conversation)

---

## 1. Synthèse exécutive

Le dysfonctionnement n’était **pas** « un contrat par voyageur » sur un même séjour, mais :

1. **Tokens partagés** — un même `token_id` dans `guest_submissions` pointait vers **plusieurs** `booking_id` (jusqu’à 15 réservations pour un seul token).
2. **Mauvais `booking_id` à la soumission** — `submit-guest-info-unified` utilisait le séjour du token, pas toujours les dates choisies par l’invité.
3. **Émission de liens** — `issue-guest-link` rattachait parfois la « prochaine résa » ou un lien propriété sans `booking_id`.
4. **Historique PDF** — plusieurs `generated_documents` ; l’UI pouvait afficher une ancienne version.
5. **OCR** — ex. SAIMA lu comme SAUNA RAB.

**Règle cible :** 1 token actif = 1 séjour (`booking_id` + dates cohérentes dans `metadata.reservationData`).

---

## 2. Symptômes et causes racines

| Symptôme | Cause typique |
|----------|----------------|
| Nom contrat ≠ voyageur réel | PDF ancien, ou `guests` mis à jour après génération |
| « Sauna +1 » sur mauvaises dates | Soumission Saima sur `booking_id` Sakara (23–28) |
| 11+ liens pour une résa (Magno) | Réémissions sans désactivation des anciens tokens |
| 8 soumissions, 8 `booking_id` (token `aee301ed`) | Lien générique « bus » propriété |
| Dates invité ignorées | `getExistingICSBooking` + token avec `bookingId` fixe |

---

## 3. Chronologie des actions

| Étape | Action |
|-------|--------|
| Audit | Analyse flux `issue-guest-link`, `submit-guest-info-unified`, `GuestVerification.tsx` |
| Document | Création / enrichissement de [problemecoflitcontract.md](./problemecoflitcontract.md) |
| SQL audit | `audit_contract_guest_names.sql`, `fix_date_conflicts_audit.sql` |
| Cas Magno | Investigation, désactivation 11 tokens, création séjour juillet `3d38c126…` |
| Cas Saima/Sakara | Séparation 21–23 / 23–28, script `fix-saima-sakara.mjs`, régénération PDF Saima |
| Tokens partagés | Désactivation des 5 `token_id` via `fix-shared-tokens.mjs` |
| Prévention | Migration `idx_one_active_token_per_booking`, correctifs code locaux |

---

## 4. Cas traités en détail

### 4.1 Saima / Sakara (7ème ciel)

| Séjour | Dates | `booking_id` | État après correction |
|--------|-------|--------------|------------------------|
| **Saima** | 21–23 mai 2026 | `6f160405-0bf9-44be-b156-42b95f570994` | Guest **SAIMA RADYAH RAB**, passeport `558769636`, scans ID déplacés, contrat + police régénérés |
| **Sakara** | 23–28 mai 2026 | `e6113444-9e48-4cef-8d45-e797478d7bf7` | `guest_name` = SAKARA (à compléter), `guests` vidés, anciens PDF supprimés — **nouveau lien invité requis** |

**Preuve du conflit (soumission erronée) :**

```json
{
  "booking_id": "e6113444-9e48-4cef-8d45-e797478d7bf7",
  "sub_check_in": "2026-05-23",
  "sub_check_out": "2026-05-28",
  "submission_guests": ["SAUNA RAB", "RAFID CHOWDHURY"]
}
```

Cause : token `73a33917…` (15 réservations) + mauvais routage, pas un conflit « 2 invités normaux » sur un séjour.

### 4.2 Magno (La pépite)

| Élément | Valeur |
|---------|--------|
| Résa mai (historique) | `29168681-a9db-400d-b2ea-ca8f7ae7fa1d` — 13–15 mai 2026 |
| Résa juillet créée | `3d38c126-9c3f-416d-8d4d-2cc040ff05dd` — 10–12 juillet 2026 |
| Token bus | `aee301ed-6505-46f0-9d4f-4222634b8fe5` — 8 `booking_id` (désactivé) |
| Tokens mai | 11 tokens désactivés (voir SQL Magno) |

---

## 5. Correctifs code (non déployés sauf mention)

Fichiers modifiés en local — **à déployer** pour effet en production :

```bash
supabase functions deploy issue-guest-link
supabase functions deploy submit-guest-info-unified
```

| Fichier | Changement |
|---------|------------|
| [supabase/functions/issue-guest-link/index.ts](./supabase/functions/issue-guest-link/index.ts) | Plus de rattachement « prochaine résa » ; INDEPENDENT par bien+dates ; pas d’écrasement dates si mismatch ; désactivation anciens tokens même `booking_id` ; `guest_name` null au lieu de `Guest` |
| [supabase/functions/submit-guest-info-unified/index.ts](./supabase/functions/submit-guest-info-unified/index.ts) | Si dates formulaire ≠ dates token → `createIndependentBooking` ; `guest_submissions.token_id` = token de la requête ; `generate_all_documents` sans signature obligatoire |

**Déploiement :** non confirmé en prod (erreur 403 mentionnée en session).

---

## 6. Correctifs données exécutés

| Script / action | Résultat |
|-----------------|----------|
| `node tools/fix-saima-sakara.mjs` | Saima complétée + PDF régénérés ; Sakara nettoyée |
| `node tools/fix-shared-tokens.mjs` | 5 tokens partagés désactivés (4 étaient encore actifs) |
| SQL Magno (section A) | 11 tokens mai désactivés (si exécuté) |

---

## 7. Tokens partagés désactivés

Audit : `guest_submissions` — un `token_id` → plusieurs `booking_id`.

| `token_id` | `nb_bookings` | Propriété / note | Statut |
|------------|---------------|------------------|--------|
| `73a33917-1a1e-4c27-a4c0-b4b8c7441945` | 15 | 7ème ciel — **cause Saima/Sakara** | Désactivé |
| `aee301ed-6505-46f0-9d4f-4222634b8fe5` | 8 | La pépite — Magno / bus | Déjà inactif |
| `5cc9acf4-c299-48e7-8ada-084e9932c7ab` | 4 | La pépite — sans `booking_id` | Désactivé |
| `50d51c12-127c-4a93-9cd3-5d988175e47a` | 2 | Lien générique | Désactivé |
| `f6309bc8-0c51-4856-b8b8-de7370c65470` | 2 | Doublon Jackson | Désactivé |

**Note :** ~546 tokens actifs sans `booking_id` subsistent — risque si réutilisés ; émettre les liens **depuis la fiche réservation**.

---

## 8. Commandes et scripts

### Audit

```powershell
cd c:\Users\ghali\Videos\morocco-host-helper-main-main

# Tokens partagés
node tools/audit-shared-tokens.mjs

# Conflits de dates (script)
node tools/audit-date-conflicts.mjs

# Cohérence noms
node tools/audit-name-consistency.mjs

# État Saima/Sakara
node tools/query-saima-sakara.mjs

# Investigation Magno
node tools/investigate-magno.mjs
```

### Correction

```powershell
# Saima / Sakara (données + régénération PDF Saima)
node tools/fix-saima-sakara.mjs

# Désactiver tous les tokens partagés connus + détectés
node tools/fix-shared-tokens.mjs

# Aperçu sans écriture
node tools/fix-shared-tokens.mjs --dry-run
```

### Régénérer documents (une résa)

```powershell
node -e "import { createClient } from '@supabase/supabase-js'; import dotenv from 'dotenv'; dotenv.config(); const s=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); const r=await s.functions.invoke('submit-guest-info-unified',{body:{action:'generate_all_documents',bookingId:'6f160405-0bf9-44be-b156-42b95f570994',documentTypes:['contract','police']}}); console.log(r.data||r.error);"
```

### Déploiement Edge Functions

```bash
supabase functions deploy issue-guest-link
supabase functions deploy submit-guest-info-unified
```

**Prérequis :** `.env` avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.

---

## 9. Fichiers SQL

| Fichier | Rôle |
|---------|------|
| [supabase/sql/fix_date_conflicts_audit.sql](./supabase/sql/fix_date_conflicts_audit.sql) | Audit dates, tokens partagés, pattern 21–23 / 23–28 |
| [supabase/sql/fix_saima_sakara_dates.sql](./supabase/sql/fix_saima_sakara_dates.sql) | Vérification Saima/Sakara (sections A–B) |
| [supabase/sql/fix_saima_sakara_apply.sql](./supabase/sql/fix_saima_sakara_apply.sql) | Correction SQL Saima/Sakara (alternative au script Node) |
| [supabase/sql/fix_shared_tokens_deactivate.sql](./supabase/sql/fix_shared_tokens_deactivate.sql) | Désactivation tokens partagés (SQL Editor) |
| [supabase/sql/fix_magno_tokens_and_july_stay.sql](./supabase/sql/fix_magno_tokens_and_july_stay.sql) | Désactivation 11 tokens Magno + option juillet |
| [supabase/sql/audit_contract_guest_names.sql](./supabase/sql/audit_contract_guest_names.sql) | Audit noms contrat / police / guests (sections A–O) |
| [supabase/sql/diagnostic_guest_links.sql](./supabase/sql/diagnostic_guest_links.sql) | Diagnostic liens invités / tokens |

---

## 10. Outils Node (`tools/`)

| Script | Description |
|--------|-------------|
| [tools/fix-saima-sakara.mjs](./tools/fix-saima-sakara.mjs) | Corrige Saima 21–23, nettoie Sakara 23–28, régénère PDF |
| [tools/fix-shared-tokens.mjs](./tools/fix-shared-tokens.mjs) | Désactive tokens « bus » |
| [tools/audit-shared-tokens.mjs](./tools/audit-shared-tokens.mjs) | Liste tokens → N bookings |
| [tools/audit-date-conflicts.mjs](./tools/audit-date-conflicts.mjs) | Audit conflits dates |
| [tools/audit-name-consistency.mjs](./tools/audit-name-consistency.mjs) | Audit cohérence noms |
| [tools/query-saima-sakara.mjs](./tools/query-saima-sakara.mjs) | État rapide 7ème ciel mai |
| [tools/investigate-magno.mjs](./tools/investigate-magno.mjs) | Investigation Magno (lecture seule) |

---

## 11. Migrations Supabase

| Fichier | Rôle |
|---------|------|
| [supabase/migrations/20260520160000_one_active_token_per_booking.sql](./supabase/migrations/20260520160000_one_active_token_per_booking.sql) | Index unique : 1 token actif par `booking_id` |

À appliquer : `supabase db push` ou SQL Editor.

---

## 12. Fichiers code clés

| Fichier | Rôle |
|---------|------|
| [supabase/functions/issue-guest-link/index.ts](./supabase/functions/issue-guest-link/index.ts) | Création lien + token + réservation |
| [supabase/functions/submit-guest-info-unified/index.ts](./supabase/functions/submit-guest-info-unified/index.ts) | Soumission invité, PDF, `generate_all_documents` |
| [src/pages/GuestVerification.tsx](./src/pages/GuestVerification.tsx) | Formulaire invité, OCR |
| [src/services/guestSubmissionService.ts](./src/services/guestSubmissionService.ts) | Enrichissement liste résas (« Sauna +1 », etc.) |
| [src/components/UnifiedBookingModal.tsx](./src/components/UnifiedBookingModal.tsx) | Modal hôte, émission liens |

---

## 13. Documentation Markdown liée

### Document principal (synthèse session)

| Document | Description |
|----------|-------------|
| **[problemecoflitcontract.md](./problemecoflitcontract.md)** | Synthèse complète : symptômes, causes, plan, Magno, Saima/Sakara, tokens, déploiement |

### Résolution contrats et noms

| Document | Description |
|----------|-------------|
| [PLAN_RESOLUTION_CONTRATS.md](./PLAN_RESOLUTION_CONTRATS.md) | Plan de résolution contrats |
| [ANALYSE_COMPLETE_SIGNATURE_POLICE.md](./ANALYSE_COMPLETE_SIGNATURE_POLICE.md) | Signature et fiches police |
| [METHODOLOGIE_FIX_SIGNATURE_GUEST_POLICE.md](./METHODOLOGIE_FIX_SIGNATURE_GUEST_POLICE.md) | Méthodologie correctif police |
| [INSTRUCTIONS_CONTRACT_SIGNING.md](./INSTRUCTIONS_CONTRACT_SIGNING.md) | Instructions signature contrat |

### Tokens et liens invités

| Document | Description |
|----------|-------------|
| [CORRECTION_CRITIQUE_TOKEN_WORKFLOW.md](./CORRECTION_CRITIQUE_TOKEN_WORKFLOW.md) | Workflow token critique |
| [CORRECTION_ISSUE_GUEST_LINK.md](./CORRECTION_ISSUE_GUEST_LINK.md) | Corrections issue-guest-link |
| [ANALYSE_PROBLEME_LIENS_ICS_MULTIPLES.md](./ANALYSE_PROBLEME_LIENS_ICS_MULTIPLES.md) | Liens ICS multiples |
| [DIAGNOSTIC_ERREUR_400_GUEST_LINK.md](./DIAGNOSTIC_ERREUR_400_GUEST_LINK.md) | Erreurs 400 liens invités |
| [SOLUTION_FINALE_GENERATION_LIENS.md](./SOLUTION_FINALE_GENERATION_LIENS.md) | Génération liens |

### Réservations indépendantes et calendrier

| Document | Description |
|----------|-------------|
| [ANALYSE_PROBLEME_RESERVATIONS_INDEPENDANTES.md](./ANALYSE_PROBLEME_RESERVATIONS_INDEPENDANTES.md) | Réservations INDEPENDENT |
| [README_CALENDRIER_CONFLITS.md](./README_CALENDRIER_CONFLITS.md) | Conflits calendrier |
| [INDEX_CORRECTION_RESERVATIONS.md](./INDEX_CORRECTION_RESERVATIONS.md) | Index corrections réservations |
| [AUDIT_LOGIQUE_RESERVATIONS.md](./AUDIT_LOGIQUE_RESERVATIONS.md) | Audit logique réservations |
| [AUDIT_LOGIQUE_RESERVATIONS_SUITE.md](./AUDIT_LOGIQUE_RESERVATIONS_SUITE.md) | Suite audit réservations |

### Déploiement et diagnostics

| Document | Description |
|----------|-------------|
| [DEPLOY_EDGE_FUNCTION.md](./DEPLOY_EDGE_FUNCTION.md) | Déploiement Edge Functions |
| [DEPLOIEMENT_FIX_SIGNATURE_POLICE.md](./DEPLOIEMENT_FIX_SIGNATURE_POLICE.md) | Déploiement fix police |
| [docs/TROUVER_LOGS_EDGE_FUNCTIONS.md](./docs/TROUVER_LOGS_EDGE_FUNCTIONS.md) | Logs Edge Functions |
| [DIAGNOSTIC_EDGE_FUNCTIONS.md](./DIAGNOSTIC_EDGE_FUNCTIONS.md) | Diagnostic Edge Functions |

### Autres (contexte ICS / flux)

| Document | Description |
|----------|-------------|
| [ANALYSE_PROBLEME_ICS_DOUBLE_FORMULAIRE.md](./ANALYSE_PROBLEME_ICS_DOUBLE_FORMULAIRE.md) | Double formulaire ICS |
| [ANALYSE_FLUX_FRONTEND.md](./ANALYSE_FLUX_FRONTEND.md) | Flux frontend |
| [CORRECTIONS_APPLIQUEES.md](./CORRECTIONS_APPLIQUEES.md) | Corrections appliquées (historique) |
| [RESUME_FINAL_CORRECTIONS.md](./RESUME_FINAL_CORRECTIONS.md) | Résumé corrections finales |

---

## 14. Plans Cursor

| Plan | Sujet |
|------|--------|
| [.cursor/plans/issue-guest-link_500_diagnostic_8adccbf3.plan.md](./.cursor/plans/issue-guest-link_500_diagnostic_8adccbf3.plan.md) | Diagnostic 500 `issue-guest-link` |
| [.cursor/plans/401_vs_500_submit-guest_c02d649e.plan.md](./.cursor/plans/401_vs_500_submit-guest_c02d649e.plan.md) | 401 vs 500 `submit-guest-info-unified` |

---

## 15. Prévention et suite

### Checklist opérationnelle

- [ ] Déployer `issue-guest-link` et `submit-guest-info-unified` en production
- [ ] Appliquer migration `idx_one_active_token_per_booking`
- [ ] Ne plus envoyer de liens propriété génériques — **toujours depuis la fiche réservation**
- [ ] Sakara (`e6113444…`) : **nouveau lien invité** pour compléter 23–28 mai
- [ ] Magno juillet (`3d38c126…`) : nouveau lien si besoin signature invité
- [ ] Audit mensuel : `node tools/audit-shared-tokens.mjs` + section 2 de `fix_date_conflicts_audit.sql`
- [ ] Régénérer contrats « CONTRACT_BEFORE_GUEST_BACKFILL » (voir `audit_contract_guest_names.sql` § N)

### Règle métier affichage UI

- Contrats : `ORDER BY created_at DESC` (ou dernier signé selon politique)
- Invalider `localStorage` / anciennes URLs après correction

### Arbre de décision (réclamation invité)

```
Réclamation nom / contrat
    ├─ Mauvais booking ? → Audit tokens partagés + dates
    ├─ guest_name = Guest mais guests OK ? → Sync guest_name
    ├─ guests OK mais PDF faux ? → Régénérer + pointer vers dernier PDF
    └─ Token partagé ? → Désactiver + nouveau lien par booking_id
```

---

## 16. Transcript de conversation

Historique complet de la session agent (JSONL) :

`C:\Users\ghali\.cursor\projects\c-Users-ghali-Videos-morocco-host-helper-main-main\agent-transcripts\6b044eb1-0527-46d9-87dc-dd750af60597\6b044eb1-0527-46d9-87dc-dd750af60597.jsonl`

---

## Index rapide des UUID

| Libellé | UUID |
|---------|------|
| Propriété 7ème ciel | `a0ae5d83-41a7-49e4-8939-d1850ab3c61c` |
| Booking Saima 21–23 | `6f160405-0bf9-44be-b156-42b95f570994` |
| Booking Sakara 23–28 | `e6113444-9e48-4cef-8d45-e797478d7bf7` |
| Guest Saima | `315d84a6-4768-4d0a-9cce-eb06f08483c1` |
| Token 7ème ciel (15 résas) | `73a33917-1a1e-4c27-a4c0-b4b8c7441945` |
| Propriété La pépite | `e9014f29-d8dd-45ce-adbb-d0497a13987f` |
| Booking Magno mai | `29168681-a9db-400d-b2ea-ca8f7ae7fa1d` |
| Booking Magno juillet | `3d38c126-9c3f-416d-8d4d-2cc040ff05dd` |
| Token bus La pépite | `aee301ed-6505-46f0-9d4f-4222634b8fe5` |

---

*Archive générée pour Morocco Host Helper — conserver ce fichier avec les scripts et SQL listés ci-dessus.*
