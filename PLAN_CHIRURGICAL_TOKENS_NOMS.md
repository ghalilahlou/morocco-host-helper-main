# Plan chirurgical — Résolution conflits tokens, noms et contrats

> **Source d'analyse :** [problemecoflitcontract.md](problemecoflitcontract.md) + [ARCHIVE_RESOLUTION_TOKENS_CONTRATS.md](ARCHIVE_RESOLUTION_TOKENS_CONTRATS.md)
> **Date du plan :** 2026-05-21
> **Objectif :** déployer les correctifs code, appliquer les garde-fous BDD, et nettoyer les artefacts résiduels — étape par étape, vérification après chaque action.

---

## 0. Snapshot exact de l'état actuel

Vérifié en direct sur la base `csopyblkfyofwkeqqegd` au 2026-05-21 :

### 0.1 Code

| Fichier | État | Action requise |
|---------|------|----------------|
| `supabase/functions/issue-guest-link/index.ts` | ⚠️ **Modifié localement, NON commit, NON déployé** | Phase 1 |
| `supabase/functions/submit-guest-info-unified/index.ts` | ⚠️ **Modifié localement, NON commit, NON déployé** | Phase 1 |
| `supabase/migrations/20260520160000_one_active_token_per_booking.sql` | ⚠️ **Untracked dans git, NON appliquée en BDD** | Phase 2 |
| Patches doublons (commit `966ebaa`) | ✅ Déployés (run #79 GitHub Actions success) | — |

### 0.2 Données — cas spécifiques

| Cas | UUID | État actuel | Action requise |
|-----|------|------------|----------------|
| Magno MAI | `29168681-a9db-400d-b2ea-ca8f7ae7fa1d` | `guest_name=JANSEN GERALD MAGNO`, 3 Magno dans guests, 0 token actif | ✅ Restauré |
| Magno JUILLET | `3d38c126-9c3f-416d-8d4d-2cc040ff05dd` | `guest_name=JANSEN GERALD MAGNO`, dates 10-12/07, 3 Magno, 0 token actif | ✅ Créé |
| SAIMA 21-23/05 | `6f160405-0bf9-44be-b156-42b95f570994` | `guest_name=NULL`, 1 guest SAIMA, 1 token actif | ⚠️ Resync guest_name (Phase 3.2) |
| SAKARA 23-28/05 | `e6113444-9e48-4cef-8d45-e797478d7bf7` | **BOOKING SUPPRIMÉ**, 1 token orphelin actif | ⚠️ Désactiver token + relancer (Phase 3.1 + 3.4) |
| THOMAS SKOWRON | `c726ac61-d67a-4083-822b-31d589cf5060` | `guest_name=NULL`, 1 guest, 1 token actif | ⚠️ Resync (Phase 3.2) |

### 0.3 Tokens partagés (artefacts historiques)

Dans `guest_submissions`, **5 `token_id` distincts** apparaissent sur plusieurs `booking_id` :

| `token_id` | Nb bookings | État `property_verification_tokens` |
|------------|-------------|--------------------------------------|
| `73a33917-1a1e-4c27-a4c0-b4b8c7441945` | 14 | ❌ N'existe plus (supprimé) |
| `aee301ed-6505-46f0-9d4f-4222634b8fe5` | 8 | ❌ N'existe plus (supprimé) |
| `5cc9acf4-c299-48e7-8ada-084e9932c7ab` | 4 | ❌ N'existe plus (supprimé) |
| `50d51c12-127c-4a93-9cd3-5d988175e47a` | 2 | ❌ N'existe plus (supprimé) |
| `f6309bc8-0c51-4856-b8b8-de7370c65470` | 2 | ❌ N'existe plus (supprimé) |

**Conclusion :** plus de risque actif côté tokens — ce sont des FK orphelines dans `guest_submissions.token_id`. Action = soit nettoyer (NULL) soit laisser comme historique.

---

## 1. PHASE 1 — Déploiement code (priorité maximale, < 30 min)

> **Pourquoi en premier :** sans le code déployé, **chaque nouvelle soumission** recréé les mêmes bugs (tokens partagés, mauvais routage, doublons noms).

### 1.1 Vérifier la qualité du diff local

```powershell
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
git diff --stat supabase/functions/issue-guest-link/index.ts supabase/functions/submit-guest-info-unified/index.ts
```

**Attendu :** ~194 insertions, 71 suppressions sur les 2 fichiers.

**Résumé fonctionnel des changements :**

`issue-guest-link/index.ts` :
- ❌ Suppression du rattachement automatique « prochaine résa active » (cause du token bus)
- ✅ Protection contre l'écrasement des dates si mismatch
- ✅ INDEPENDENT_BOOKING résolu par (bien + dates) au lieu de « dernière INDEPENDENT »
- ✅ Désactivation auto des anciens tokens du même `booking_id` à chaque nouveau lien

`submit-guest-info-unified/index.ts` :
- ✅ Helper `extractDateOnly()` pour normalisation YYYY-MM-DD
- ✅ `saveGuestDataInternal(verificationToken)` — utilise le token EXACT de la soumission (pas le 1er token actif de la propriété)
- ✅ Si dates formulaire ≠ dates booking du token → crée une nouvelle réservation INDEPENDENT (corrige le bug Magno juillet)
- ✅ `generate_all_documents` accepte signature optionnelle

### 1.2 Commit + push (déclenche GitHub Actions)

```powershell
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
git add supabase/functions/issue-guest-link/index.ts supabase/functions/submit-guest-info-unified/index.ts
git commit -m "fix(guest-links): 1 token actif/booking + dates form prioritaires + token_id exact

- issue-guest-link: supprime le rattachement auto 'prochaine resa active'
  (cause des tokens bus partages entre plusieurs bookings)
- issue-guest-link: INDEPENDENT_BOOKING resolu par (bien + dates) et
  protection anti-ecrasement des dates en mismatch
- issue-guest-link: desactive auto les anciens tokens du meme booking_id
  a chaque nouvelle emission (resout Magno 11 tokens)
- submit-guest-info-unified: saveGuestDataInternal recoit le verification
  token exact de la soumission (corrige token_id partage en guest_submissions)
- submit-guest-info-unified: si dates form != dates booking du token ICS,
  cree une nouvelle reservation INDEPENDENT (corrige Magno mai vs juillet)
- submit-guest-info-unified: generate_all_documents accepte signature
  optionnelle (brouillon possible)"
git push origin main
```

### 1.3 Vérifier le déploiement GitHub Actions

```powershell
curl -s "https://api.github.com/repos/ghalilahlou/morocco-host-helper-main/actions/workflows/deploy-edge-functions.yml/runs?per_page=1"
```

**Critère de succès :**
- `status = "completed"` + `conclusion = "success"` (en général en 40-60 s)
- Si échec : consulter les logs sur https://github.com/ghalilahlou/morocco-host-helper-main/actions

**Rollback si déploiement échoue :**
```powershell
git revert HEAD --no-edit
git push origin main
```

### 1.4 Test post-déploiement (smoke test)

Faire **1 vraie émission de lien** depuis le dashboard hôte, puis **1 soumission invité complète** (avec signature). Puis :

```sql
-- Doit retourner 0 doublons exact créés
SELECT booking_id, document_url, count(*) FROM public.generated_documents
WHERE document_type = 'contract' AND created_at > now() - interval '15 minutes'
GROUP BY booking_id, document_url HAVING count(*) > 1;

-- Le token_id doit correspondre au token utilisé pour la soumission
SELECT gs.token_id, gs.booking_id, pvt.token, pvt.is_active
FROM public.guest_submissions gs
LEFT JOIN public.property_verification_tokens pvt ON pvt.id = gs.token_id
WHERE gs.created_at > now() - interval '15 minutes'
ORDER BY gs.created_at DESC;
```

---

## 2. PHASE 2 — Migration BDD prévention (< 10 min)

> **Pourquoi maintenant :** le code Phase 1 désactive les anciens tokens à chaque émission, mais une race condition reste possible. La migration ajoute un index unique qui rend l'état inviolable.

### 2.1 Pré-check : repérer les violations potentielles AVANT d'appliquer

```sql
-- Si cette requête retourne des lignes, l'index ne pourra PAS se créer
-- (et il faudra d'abord désactiver les anciens manuellement)
SELECT booking_id, count(*) AS active_tokens, array_agg(id) AS token_ids
FROM public.property_verification_tokens
WHERE is_active = true AND booking_id IS NOT NULL
GROUP BY booking_id
HAVING count(*) > 1;
```

**Si résultat non vide** — exécuter d'abord ce nettoyage (garde le plus récent par booking) :

```sql
-- DRY-RUN d'abord
WITH ranked AS (
  SELECT id, booking_id,
    ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at DESC) AS rn
  FROM public.property_verification_tokens
  WHERE is_active = true AND booking_id IS NOT NULL
)
SELECT booking_id, count(*) FILTER (WHERE rn > 1) AS to_deactivate
FROM ranked GROUP BY booking_id HAVING count(*) > 1;

-- Si OK, appliquer (decommenter le UPDATE) :
-- BEGIN;
--   WITH ranked AS (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at DESC) AS rn
--     FROM public.property_verification_tokens
--     WHERE is_active = true AND booking_id IS NOT NULL
--   )
--   UPDATE public.property_verification_tokens
--   SET is_active = false, updated_at = now()
--   WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
-- COMMIT;
```

### 2.2 Appliquer la migration

**Option A — Dashboard SQL Editor** (le plus simple) :

Copier-coller dans https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql/new :

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_booking
ON public.property_verification_tokens (booking_id)
WHERE is_active = true AND booking_id IS NOT NULL;

COMMENT ON INDEX public.idx_one_active_token_per_booking IS
  'Au plus un property_verification_token actif par booking_id';
```

**Option B — CLI Supabase** (si installée) :
```powershell
supabase db push --project-ref csopyblkfyofwkeqqegd
```

### 2.3 Vérification

```sql
-- L'index doit apparaître
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'property_verification_tokens'
  AND indexname = 'idx_one_active_token_per_booking';
```

### 2.4 Commit le fichier migration

```powershell
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
git add supabase/migrations/20260520160000_one_active_token_per_booking.sql
git commit -m "migration: index unique 1 token actif par booking_id"
git push origin main
```

---

## 3. PHASE 3 — Nettoyage données résiduelles (< 1 heure)

### 3.1 Désactiver les tokens orphelins (bookings supprimés)

**Cible identifiée :** booking `e6113444-9e48-4cef-8d45-e797478d7bf7` (SAKARA) → supprimé, mais token `d1187605...` toujours actif.

```sql
-- DRY-RUN
SELECT id, token, booking_id, is_active, created_at
FROM public.property_verification_tokens pvt
WHERE is_active = true
  AND booking_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id
  );
```

```sql
-- APPLIQUER (transaction)
BEGIN;
  UPDATE public.property_verification_tokens
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND booking_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    );
COMMIT;
```

### 3.2 Resync `bookings.guest_name` depuis `guests.full_name` (cas NULL ou Guest)

**Cibles identifiées :**
- `6f160405...` SAIMA → `guest_name=NULL`, guests=[SAIMA RADYAH RAB]
- `c726ac61...` THOMAS SKOWRON → `guest_name=NULL`, guests=[THOMAS SKOWRON]
- Tous les autres bookings où `guest_name IN (NULL, '', 'Guest')` mais `guests` valide

```sql
-- DRY-RUN
SELECT b.id, b.guest_name AS avant, g.full_name AS apres, b.check_in_date
FROM public.bookings b
JOIN LATERAL (
  SELECT full_name FROM public.guests
  WHERE booking_id = b.id AND full_name IS NOT NULL
    AND trim(full_name) <> '' AND lower(trim(full_name)) <> 'guest'
  ORDER BY created_at ASC LIMIT 1
) g ON true
WHERE (b.guest_name IS NULL OR lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest'));
```

```sql
-- APPLIQUER (transaction)
BEGIN;
  WITH first_real_guest AS (
    SELECT DISTINCT ON (booking_id) booking_id, full_name
    FROM public.guests
    WHERE full_name IS NOT NULL
      AND trim(full_name) <> ''
      AND lower(trim(full_name)) <> 'guest'
    ORDER BY booking_id, created_at ASC
  )
  UPDATE public.bookings b
  SET guest_name = frg.full_name, updated_at = now()
  FROM first_real_guest frg
  WHERE frg.booking_id = b.id
    AND (b.guest_name IS NULL OR lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest'));
COMMIT;
```

### 3.3 Appliquer le trigger de prévention (défense en profondeur)

Le trigger garantit que `bookings.guest_name` se sync automatiquement à chaque INSERT/UPDATE sur `guests` — même si le code applicatif oublie.

Copier-coller le contenu de [`supabase/sql/prevention_guest_name_sync_trigger.sql`](supabase/sql/prevention_guest_name_sync_trigger.sql) dans SQL Editor.

**Vérification :**
```sql
SELECT tgname, tgtype FROM pg_trigger
WHERE tgname = 'trg_sync_booking_guest_name';
```

### 3.4 Cas SAKARA — recréer si l'invité doit toujours venir

Le booking `e6113444...` a été supprimé. Si le séjour 23-28 mai est toujours valide :

1. Recréer le booking via dashboard hôte (propriété `7ème ciel`, dates 23-28/05/2026)
2. Émettre un nouveau lien invité **depuis la fiche réservation** (pas un lien propriété générique)
3. Vérifier que `bookingId` est bien dans le metadata du token

**Vérification :**
```sql
SELECT pvt.id, pvt.token, pvt.booking_id, b.guest_name, b.check_in_date, b.check_out_date
FROM public.property_verification_tokens pvt
LEFT JOIN public.bookings b ON b.id = pvt.booking_id
WHERE pvt.created_at > now() - interval '1 hour'
  AND pvt.is_active = true
ORDER BY pvt.created_at DESC;
```

### 3.5 Nettoyer les `token_id` orphelins dans `guest_submissions` (optionnel)

Les 5 tokens partagés historiques pointent vers des `property_verification_tokens` supprimés. Pour ne pas casser les FK lors d'audits :

```sql
-- DRY-RUN
SELECT count(*) AS orphan_submissions
FROM public.guest_submissions gs
WHERE gs.token_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = gs.token_id
  );
```

```sql
-- APPLIQUER : remplacer par NULL (préserve l'historique, supprime juste la FK invalide)
BEGIN;
  UPDATE public.guest_submissions
  SET token_id = NULL
  WHERE token_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = token_id
    );
COMMIT;
```

---

## 4. PHASE 4 — Bloc D (multi-versions contrats à archiver)

Toujours pendante depuis la session précédente. Voir [supabase/sql/restitution_bloc_D_ready_to_paste.sql](supabase/sql/restitution_bloc_D_ready_to_paste.sql) — étapes 1 à 5 dans l'ordre :

1. **Étape 1 SELECT** : preview du nombre à archiver par booking
2. **Étape 2** : `CREATE TABLE generated_documents_archive`
3. **Étape 3** : DRY-RUN avec `BEGIN ... ROLLBACK`
4. **Étape 4** : commit pour de vrai (remplacer ROLLBACK par COMMIT)
5. **Étape 5** : rapport final

**Cible attendue :** 29 bookings nettoyés, ~29-66 contrats archivés (selon politique).

---

## 5. PHASE 5 — Front-end (invalidation cache)

> **Pourquoi :** même avec toutes les corrections backend, un guest qui a ouvert son lien il y a 2 jours pourrait afficher l'ancien PDF stocké dans son `localStorage`.

### 5.1 Patch GuestVerification.tsx

Fichier : [src/pages/GuestVerification.tsx](src/pages/GuestVerification.tsx) lignes 2167-2182.

**Remplacer** la lecture depuis `localStorage.getItem('contractUrl')` par un re-fetch systématique :

```ts
// Avant (à supprimer)
const cachedUrl = localStorage.getItem('contractUrl');

// Après (à insérer)
const { data: latest } = await supabase
  .from('generated_documents')
  .select('document_url, is_signed, created_at')
  .eq('booking_id', bookingId)
  .eq('document_type', 'contract')
  .order('is_signed', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
const contractUrl = latest?.document_url;
```

**Conserver `localStorage` comme fallback réseau uniquement** — jamais comme source de vérité.

### 5.2 Patch UnifiedBookingModal.tsx (dashboard hôte)

S'assurer que l'émission de lien depuis le dashboard **passe toujours** `bookingId` au RPC `issue-guest-link`.

Recherche à faire :
```powershell
grep -n "issue-guest-link" src/components/UnifiedBookingModal.tsx
```

Vérifier que tous les appels incluent `bookingId` dans le body.

---

## 6. PHASE 6 — Pic OpenAI (analyse + mitigations)

> **Contexte :** 5.49K requêtes vision API depuis le 6 mai, pic 1421 le 19/05. Cause = tokens partagés + bug Unicode → re-soumissions massives.

### 6.1 Mitigations immédiates

| Mitigation | Effet | Où |
|------------|-------|-----|
| Phase 1 déployée | Élimine re-soumissions sur tokens partagés | Backend |
| Phase 5.1 (invalidation localStorage) | Évite que le guest renvoie le formulaire avec le même PDF | Frontend |
| Fix Unicode déjà déployé | Plus de crash sur `İ` turc → moins de retry | Backend |

### 6.2 Mitigations à ajouter (front-end)

1. **Cache par hash de fichier** dans `DocumentUploadStep.tsx` et `GuestVerification.tsx` :
   ```ts
   // Calculer SHA-256 du fichier
   // Avant d'appeler OpenAI : vérifier si on a déjà OCR ce hash → réutiliser le résultat
   ```

2. **Rate limit dans `extract-document-data` Edge Function** :
   - Max N appels par minute par IP/booking_id
   - Refus avec 429 sinon

3. **Monitoring** : dashboard interne qui montre les appels OCR par jour/booking pour détecter le prochain pic.

### 6.3 Recommandation économique

Si le coût continue de monter : envisager un OCR local (Tesseract.js) en première passe, OpenAI seulement en fallback pour les images de mauvaise qualité.

---

## 7. Critères de réussite globaux

À vérifier 24 h après l'application de Phases 1 → 3 :

```sql
-- (1) Aucun nouveau token bus créé
SELECT token_id, count(DISTINCT booking_id) AS n
FROM public.guest_submissions
WHERE created_at > now() - interval '24 hours'
GROUP BY token_id HAVING count(DISTINCT booking_id) > 1;
-- Attendu : 0 lignes

-- (2) Aucun nouveau placeholder Guest
SELECT count(*) FROM public.bookings
WHERE lower(trim(coalesce(guest_name, ''))) = 'guest'
  AND created_at > now() - interval '24 hours';
-- Attendu : 0

-- (3) Aucun nouveau doublon de contrat
SELECT booking_id, count(*) FROM public.generated_documents
WHERE document_type = 'contract' AND created_at > now() - interval '24 hours'
GROUP BY booking_id, document_url HAVING count(*) > 1;
-- Attendu : 0 lignes

-- (4) Index unique respecté (aucune violation possible grâce à Phase 2)
SELECT booking_id, count(*) FROM public.property_verification_tokens
WHERE is_active = true AND booking_id IS NOT NULL
GROUP BY booking_id HAVING count(*) > 1;
-- Attendu : 0 lignes
```

---

## 8. Plan de rollback global

Si un problème apparaît après Phase 1 :

```powershell
# 1. Revert le commit code
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
git revert HEAD --no-edit
git push origin main

# 2. Attendre redéploiement GitHub Actions (~1 min)
curl -s "https://api.github.com/repos/ghalilahlou/morocco-host-helper-main/actions/workflows/deploy-edge-functions.yml/runs?per_page=1"
```

Si un problème apparaît après Phase 2 (index trop strict) :

```sql
DROP INDEX IF EXISTS public.idx_one_active_token_per_booking;
```

Les Phases 3 et 4 sont des UPDATE/DELETE/INSERT enveloppés dans `BEGIN ... COMMIT` — utiliser `ROLLBACK` si l'aperçu ne convient pas.

---

## 9. Checklist d'exécution

### Phase 1 — Code (impératif, ~30 min)
- [ ] 1.1 Vérifier `git diff --stat` montre les 2 fichiers
- [ ] 1.2 `git add`, `git commit`, `git push origin main`
- [ ] 1.3 Vérifier GitHub Actions run = success
- [ ] 1.4 Smoke test : 1 soumission réelle → 1 seul contrat créé

### Phase 2 — Migration (15 min)
- [ ] 2.1 Pre-check violations potentielles
- [ ] 2.2 Si violations : nettoyer d'abord
- [ ] 2.3 Appliquer `CREATE UNIQUE INDEX` via SQL Editor
- [ ] 2.4 Vérifier `pg_indexes` contient l'index
- [ ] 2.5 Commit le fichier migration

### Phase 3 — Données résiduelles (1 h)
- [ ] 3.1 Désactiver tokens orphelins (bookings supprimés)
- [ ] 3.2 Resync `guest_name` NULL/Guest depuis `guests.full_name`
- [ ] 3.3 Appliquer trigger `sync_booking_guest_name`
- [ ] 3.4 (Métier) Décider sort de SAKARA → recréer si besoin
- [ ] 3.5 Nettoyer `guest_submissions.token_id` orphelins (optionnel)

### Phase 4 — Archive contrats (30 min)
- [ ] 4 Exécuter `restitution_bloc_D_ready_to_paste.sql` étapes 1-5

### Phase 5 — Front-end (2-4 h dev)
- [ ] 5.1 Patch `GuestVerification.tsx` invalidation localStorage
- [ ] 5.2 Audit `UnifiedBookingModal.tsx` passage bookingId

### Phase 6 — OpenAI mitigation (1-2 j dev)
- [ ] 6.1 Cache par hash dans frontend
- [ ] 6.2 Rate limit Edge Function
- [ ] 6.3 Monitoring OCR par jour/booking

### Validation 24 h après
- [ ] 7 Exécuter les 4 requêtes de réussite globale

---

## 10. Index des UUIDs critiques

| Libellé | UUID | État |
|---------|------|------|
| Magno MAI | `29168681-a9db-400d-b2ea-ca8f7ae7fa1d` | ✅ Restauré |
| Magno JUILLET | `3d38c126-9c3f-416d-8d4d-2cc040ff05dd` | ✅ Créé |
| SAIMA 21-23/05 | `6f160405-0bf9-44be-b156-42b95f570994` | ⚠️ guest_name=NULL → Phase 3.2 |
| SAKARA 23-28/05 | `e6113444-9e48-4cef-8d45-e797478d7bf7` | ❌ Supprimé → Phase 3.4 |
| THOMAS SKOWRON | `c726ac61-d67a-4083-822b-31d589cf5060` | ⚠️ guest_name=NULL → Phase 3.2 |
| Token SAIMA actif | `d95c994a-...` | ✅ OK |
| Token SAKARA orphelin | `d1187605-...` | ⚠️ → Phase 3.1 |

| Token bus (historique, déjà supprimé) | UUID |
|-----------------------------------------|------|
| 7ème ciel (14 bookings) | `73a33917-1a1e-4c27-a4c0-b4b8c7441945` |
| La pépite (8 bookings) | `aee301ed-6505-46f0-9d4f-4222634b8fe5` |
| La pépite (4 bookings) | `5cc9acf4-c299-48e7-8ada-084e9932c7ab` |
| Lien générique (2 bookings) | `50d51c12-127c-4a93-9cd3-5d988175e47a` |
| Doublon Jackson (2 bookings) | `f6309bc8-0c51-4856-b8b8-de7370c65470` |

---

*Plan chirurgical généré pour Morocco Host Helper — 2026-05-21.*
