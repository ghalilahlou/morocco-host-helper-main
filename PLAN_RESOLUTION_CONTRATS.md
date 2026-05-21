# Plan final — Résolution du conflit contrats / noms invités

> Diagnostic et plan d'action consolidés à partir de :
> - [`problemecoflitcontract.md`](problemecoflitcontract.md) — synthèse du problème
> - [`supabase/sql/audit_contract_guest_names.sql`](supabase/sql/audit_contract_guest_names.sql) — requêtes d'audit
> - Code : [`submit-guest-info-unified/index.ts`](supabase/functions/submit-guest-info-unified/index.ts), [`issue-guest-link/index.ts`](supabase/functions/issue-guest-link/index.ts), [`GuestVerification.tsx`](src/pages/GuestVerification.tsx)
> - **Inspection réelle de la base** csopyblkfyofwkeqqegd au 2026-05-21 (via REST API anon key)

---

## 1. État réel de la base (faits confirmés ce jour)

| Mesure | Valeur | Interprétation |
|--------|--------|----------------|
| Réservations totales | **94** | — |
| Réservations `guest_name = "Guest"` (PLACEHOLDER) | **20 (21%)** | Sérieux : 1/5 des bookings sans nom correct |
| Lignes `guests` totales | **84** | < bookings → certaines résas sans aucun guest |
| Contrats `generated_documents` (type=contract) | **149** | — |
| Bookings ayant ≥1 contrat | **44** | — |
| Bookings ayant **≥2 contrats** | **34 / 44 (77%)** | **Catastrophique** |
| Pire cas | **15 contrats** sur 1 booking (`134412e5`) | Tous signés, créés par bursts de 2-3 en <200 ms |

### Cas type concret

**Booking `4bc14f6c-095f-47f3-8360-aade837a79a6`** — la situation décrite dans la section K du doc est **exactement** ce qu'on voit en prod :

- `bookings.guest_name` = **"Volkan Topcil"**
- `guests.full_name` (seule ligne) = **"CLAIRE JACQUELINE ANN BARNARDO"**
- **8 contrats signés** (probablement avec les mauvais noms)

Le batch `2026-04-13 14:21:12.355294+00` mentionné dans l'audit est aussi confirmé : AMADOU GUEYE, MELANIE SEITZ et d'autres ont leur ligne `guests` à ce timestamp exact, alors que **leurs contrats sont datés du 2026-03-31, 2026-04-01, 2026-04-05** → **CONTRACT_BEFORE_GUEST_BACKFILL** confirmé.

### Doublons de réservation

- 1 groupe doublon strict (même property+dates) — booking Airbnb réutilisé en INDEPENDENT_BOOKING.
- `HMTKN5SBD4` : même code Airbnb sur **2 properties différentes** → soit erreur saisie, soit ICS partagé entre logements.

---

## 2. Causes racines confirmées (par ordre d'impact)

### A. **Bursts de doublons dans `saveDocumentToDatabase`** (`submit-guest-info-unified/index.ts:4960-5210`)

**Évidence empirique** : pour le booking `134412e5`, les 15 contrats sont créés en groupes de 2-3 en <200 ms :

```
2026-04-21 11:13:30.426 + 2026-04-21 11:13:30.268   (158 ms d'écart)
2026-04-01 17:49:58.841 + 17:49:58.724              (117 ms)
2026-04-01 17:49:52.85  + 17:49:52.715              (135 ms)
2026-03-31 11:14:01.752 + 11:14:01.55               (200 ms)
```

**Hypothèse mécanique :**
- `generateContractPDF` est appelé, puis `saveDocumentToDatabase` (ligne 1887)
- Une autre branche (ligne 2954) **re-appelle** `saveDocumentToDatabase` avec le même contrat dans la même requête
- Dans `saveDocumentToDatabase` (ligne 4977), si `signedContract` existe déjà → **crée une nouvelle ligne** (commentaire explicite ligne 4982)
- Pas de garde "même URL ⇒ noop" sur le chemin signé (la garde existe seulement pour les non-signés ligne 5019)

**Conséquence** : chaque resoumission/signature multiplie les contrats sans dédoublonnage par URL.

### B. **`bookings.guest_name = "Guest"` jamais corrigé** (issue-guest-link → submit-guest-info-unified)

`issue-guest-link/index.ts` ligne 578, 623, 672 : `guest_name: reservationData.guestName || 'Guest'`

Si le formulaire invité a planté avant `saveGuestDataInternal` (ex. erreur PDF Unicode), `bookings.guest_name` reste "Guest" alors que `guests.full_name` peut avoir été rempli plus tard via OCR ou backfill manuel.

**Mesure** : **13 résas** dans cet état exact aujourd'hui (PLACEHOLDER fixable).

### C. **Contrats générés AVANT que `guests` soient remplis** (ordre d'opération)

- AMADOU : 1ᵉʳ contrat 2026-03-31, ligne `guests` 2026-04-13 → PDF avec ancien article occupants
- MELANIE : 1ᵉʳ contrat 2026-04-05, ligne `guests` 2026-04-13 → idem

Le PDF est figé avec ce qui existait au moment de la génération. Le contrat **régénéré plus tard** existe aussi (versions plus récentes), mais l'UI peut encore pointer vers l'ancien.

### D. **Désynchronisation `guest_name` ↔ `guests.full_name`**

Cas Volkan Topcil ≠ Claire Barnardo. `saveGuestDataInternal` (ligne 958) calcule pourtant `guest_name = ${primaryGuest.firstName} ${primaryGuest.lastName}`. Donc soit :
- La résa a été **réutilisée** par un nouveau voyageur sans nettoyer les anciens `guests`
- Soit une mise à jour partielle laisse `bookings.guest_name` figé sur le 1ᵉʳ voyageur jamais réécrit

### E. **`localStorage` côté client** (`GuestVerification.tsx:2167-2182`)

`localStorage.setItem('contractUrl', result.contractUrl)` après soumission → ancien lien resté en mémoire navigateur même si une nouvelle version existe en base.

### F. **RLS apparemment trop permissif**

Avec la **clé anon publique** seule, j'ai pu lire `bookings`, `guests`, `generated_documents` sans authentification. À auditer en parallèle (sortie de scope du problème contrat mais sécurité importante).

---

## 3. Plan d'action priorisé

### 🔴 Phase 0 — Urgent (< 24 h)

1. **Déployer l'Edge Function `submit-guest-info-unified` en prod**
   - Le fix Unicode (ex. `İ` turc) est dans le code mais pas en prod (cf. commits `ee2d50e`, `bbca003`)
   - Sans ça, chaque soumission turque/scandinave plante AVANT update `guest_name` → recrée un "Guest"
   ```bash
   supabase functions deploy submit-guest-info-unified --project-ref csopyblkfyofwkeqqegd
   ```

2. **Configurer le MCP Supabase** (cf. [`MCP_SETUP.md`](MCP_SETUP.md))
   - Permet d'exécuter les sections K/L/N/O depuis Claude Code en `--read-only`
   - Le PAT est différent de l'anon key (admin API)

3. **Snapshot avant correctif données**
   - Backup `bookings`, `guests`, `generated_documents` via Supabase Studio → `Database` → `Backups`

### 🟠 Phase 1 — Correction données (1-2 j)

**Exécuter dans Supabase SQL Editor** (les sections suivantes de [`audit_contract_guest_names.sql`](supabase/sql/audit_contract_guest_names.sql)) :

| Étape | Section | Action |
|-------|---------|--------|
| 1.1 | K | Lister tous les NAME_MISMATCH + PLACEHOLDER → tableau cible |
| 1.2 | O (SELECT) | Aperçu UPDATE Guest → guests.full_name |
| 1.3 | O (UPDATE) | **Étendre globalement** (pas seulement batch 13/04) : voir SQL ci-dessous |
| 1.4 | N | Lister `CONTRACT_BEFORE_GUEST_BACKFILL` |
| 1.5 | F | Pour chaque résa de 1.4 : régénérer le PDF via Edge Function ou marquer pour re-soumission |

**SQL généralisé pour 1.3 (corrige les 13 PLACEHOLDER fixables identifiés) :**

```sql
-- Aperçu d'abord
SELECT b.id, b.guest_name AS avant, g.full_name AS apres
FROM public.bookings b
JOIN public.guests g ON g.booking_id = b.id
WHERE lower(trim(coalesce(b.guest_name, ''))) = 'guest'
  AND g.full_name IS NOT NULL
  AND trim(g.full_name) <> ''
  AND lower(trim(g.full_name)) <> 'guest';

-- Puis (si OK) :
UPDATE public.bookings b
SET guest_name = g.full_name,
    updated_at = now()
FROM public.guests g
WHERE g.booking_id = b.id
  AND lower(trim(coalesce(b.guest_name, ''))) = 'guest'
  AND g.full_name IS NOT NULL
  AND trim(g.full_name) <> ''
  AND lower(trim(g.full_name)) <> 'guest';
```

**Pour les 7 résas NO_GUESTS_ROW** : ne rien toucher automatiquement — ces réservations n'ont jamais reçu de soumission invité, action manuelle requise (relancer le lien invité ou archiver).

**Pour le NAME_MISMATCH Volkan Topcil / Claire Barnardo** (`4bc14f6c`) : décision métier nécessaire — soit Claire est la vraie occupante (mettre `guest_name = "CLAIRE JACQUELINE ANN BARNARDO"`), soit le booking a été réutilisé par 2 séjours différents (créer 2 bookings distincts).

### 🟡 Phase 2 — Nettoyage des doublons de contrats (2-3 j)

Pour chaque booking avec >1 contrat (34 cas) — règle métier à valider :

**Politique recommandée : « le dernier contrat signé fait foi »**

```sql
-- Identifier le contrat à GARDER pour chaque booking
WITH ranked AS (
  SELECT
    id, booking_id, is_signed, document_url, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id
      ORDER BY is_signed DESC, created_at DESC
    ) AS rn
  FROM public.generated_documents
  WHERE document_type = 'contract'
)
SELECT booking_id, count(*) FILTER (WHERE rn > 1) AS to_archive
FROM ranked
GROUP BY booking_id
HAVING count(*) > 1
ORDER BY to_archive DESC;
```

**Ne pas supprimer immédiatement** — soft-delete recommandé : ajouter une colonne `superseded_at` ou flag `is_active`, ou archiver les lignes dans `generated_documents_archive`.

### 🟢 Phase 3 — Prévention code (1 semaine)

#### 3.1 — Fix critique dans `saveDocumentToDatabase` ([`submit-guest-info-unified/index.ts:4960`](supabase/functions/submit-guest-info-unified/index.ts#L4960))

Ajouter un garde "même URL" sur le chemin **signé** (qui manque actuellement) :

```ts
if (isSigned) {
  if (signedContract) {
    // ✅ NOUVEAU : si même URL que le dernier signé → no-op
    if (signedContract.document_url === documentUrl) {
      log('info', 'Signed contract with same URL exists, skipping duplicate');
      return signedContract;
    }
    // … sinon, créer nouvelle version (comportement actuel)
  }
}
```

Et **investiguer les double-appels** : pourquoi `saveDocumentToDatabase` est appelé à ligne 1887 ET ligne 2954 dans la même requête ? Ajouter un cache mémoire local au handler :

```ts
const savedContractsCache = new Set<string>();  // clé = `${bookingId}:${urlHash}`
// avant chaque insert : check
```

#### 3.2 — Supprimer le placeholder `"Guest"` ([`issue-guest-link/index.ts:578,623,672`](supabase/functions/issue-guest-link/index.ts#L578))

Remplacer par `NULL` plutôt que `"Guest"`. Puis dans la requête côté UI hôte, afficher `coalesce(guest_name, '(en attente)')`.

Comme ça : aucun PLACEHOLDER ne peut "passer pour" un vrai nom.

#### 3.3 — Toujours resynchroniser `bookings.guest_name` après update des `guests`

Dans `saveGuestDataInternal`, l'update à la ligne 980 utilise `bookingData` calculé à partir du **premier voyageur seulement**. Vérifier que ça remplace bien l'ancien nom même quand un voyageur a été supprimé/changé. Considérer un **trigger Postgres** :

```sql
CREATE OR REPLACE FUNCTION sync_booking_guest_name() RETURNS trigger AS $$
BEGIN
  UPDATE public.bookings b
  SET guest_name = (
    SELECT g.full_name FROM public.guests g
    WHERE g.booking_id = b.id
    ORDER BY g.created_at ASC LIMIT 1
  ),
  updated_at = now()
  WHERE b.id = COALESCE(NEW.booking_id, OLD.booking_id)
    AND lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_guest_name
  AFTER INSERT OR UPDATE OR DELETE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION sync_booking_guest_name();
```

#### 3.4 — Régénérer PDF **après** toutes les écritures `guests`

Dans le flux de [`submit-guest-info-unified/index.ts`](supabase/functions/submit-guest-info-unified/index.ts), s'assurer que `generateContractPDF` n'est appelé **qu'après** un `await` de toutes les opérations `guests` (upsert + sync_booking_guests + sync `guest_name`).

#### 3.5 — Côté client : invalider l'URL `localStorage` ([`GuestVerification.tsx:2172`](src/pages/GuestVerification.tsx#L2172))

Toujours re-fetcher la dernière version :

```ts
// au lieu de lire contractUrl depuis localStorage
const { data: latest } = await supabase
  .from('generated_documents')
  .select('document_url, is_signed, created_at')
  .eq('booking_id', bookingId)
  .eq('document_type', 'contract')
  .order('is_signed', { ascending: false })  // signé d'abord
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

Stocker `localStorage` uniquement comme **fallback réseau**, jamais comme source de vérité.

#### 3.6 — `sync_booking_guests` dans le flux invité

Dans `saveGuestDataInternal`, après l'upsert : **supprimer** les `guests` qui ne sont plus dans la soumission (sinon voyageurs fantômes restent et apparaissent dans le PDF).

```ts
const submittedDocNumbers = guestInfos.map(g => g.documentNumber).filter(Boolean);
await supabase
  .from('guests')
  .delete()
  .eq('booking_id', savedBooking.id)
  .not('document_number', 'in', `(${submittedDocNumbers.join(',')})`);
```

#### 3.7 — RLS

Vérifier `bookings`, `guests`, `generated_documents` : actuellement lisibles avec anon key sans authentification. Restreindre :

```sql
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- + policies par user_id pour SELECT côté hôte, et accès token-gated pour invités
```

### 🔵 Phase 4 — Monitoring & UX (continu)

- **RPC `admin_get_discrepant_bookings`** (migration `20260507000003`) : vérifier si déployée et l'exposer dans un dashboard admin.
- **UI hôte** : afficher dans la fiche réservation le nombre de versions de contrat + dernière date + état signé.
- **Email invité** : régénérer le lien PDF à la volée (pas envoyer une URL S3 figée).
- **Alerte Slack/email** sur `guest_name = 'Guest'` après J+1 du check-in.

---

## 4. Checklist d'exécution

- [ ] Phase 0.1 : `supabase functions deploy submit-guest-info-unified`
- [ ] Phase 0.2 : Configurer MCP (cf. [`MCP_SETUP.md`](MCP_SETUP.md)) — générer PAT
- [ ] Phase 0.3 : Backup base via Supabase Studio
- [ ] Phase 1.1 : Exécuter audit section K
- [ ] Phase 1.2 : Valider l'aperçu UPDATE
- [ ] Phase 1.3 : Appliquer UPDATE généralisé (13 PLACEHOLDER fixables)
- [ ] Phase 1.4 : Lister bookings `CONTRACT_BEFORE_GUEST_BACKFILL`
- [ ] Phase 1.5 : Décider règle de régénération + exécuter
- [ ] Phase 1.6 : Trancher cas Volkan/Claire (`4bc14f6c`) avec le métier
- [ ] Phase 2 : Soft-archiver les versions antérieures de contrats (34 bookings)
- [ ] Phase 3.1 : Patch `saveDocumentToDatabase` (garde URL signée + cache requête)
- [ ] Phase 3.2 : Supprimer `'Guest'` literal → `NULL`
- [ ] Phase 3.3 : Trigger Postgres `sync_booking_guest_name` (ou hook applicatif)
- [ ] Phase 3.4 : Garantir ordre `guests INSERT → PDF generate`
- [ ] Phase 3.5 : Front : re-fetch dernière version au lieu de `localStorage`
- [ ] Phase 3.6 : Sync delete des `guests` retirés
- [ ] Phase 3.7 : Audit RLS (`bookings`, `guests`, `generated_documents`)
- [ ] Phase 4 : Monitoring + RPC admin + UI versionning

---

## 5. Résumé exécutif (1 paragraphe)

Sur 94 réservations, **77 % de celles ayant un contrat en ont plusieurs versions** (jusqu'à 15), **21 % portent encore le placeholder "Guest"** comme nom principal, et au moins un cas confirmé montre une **inversion totale du nom** entre `bookings` et `guests` (Volkan ↔ Claire). Le code crée ces doublons parce que `saveDocumentToDatabase` insère une nouvelle ligne à chaque soumission signée, sans dédoublonner par URL — souvent appelé deux fois par requête. Les anciens noms persistent parce que le placeholder `"Guest"` n'est pas écrasé quand `saveGuestDataInternal` plante (typiquement sur caractères Unicode dont le fix n'est pas encore déployé). La résolution combine : **(1)** déploiement immédiat de l'Edge Function corrigée, **(2)** correctifs SQL idempotents pour aligner `bookings.guest_name` sur `guests.full_name`, **(3)** soft-archive des doublons, **(4)** trois patchs code (garde URL, suppression du `'Guest'`, trigger de sync), **(5)** invalidation des URLs `localStorage` côté invité.
