## 🔍 Analyse détaillée des problèmes de performance liés au bucket `guest-documents`

### 1. Résumé exécutif

- **Symptôme principal**: latence très élevée et erreurs 429/5xx lors de l’utilisation du site (saturation Supabase).
- **Point chaud identifié**: endpoint `/storage/v1/object/list/guest-documents` appelé **plus de 52 000 fois en moins d’une heure**.
- **Impact**:
  - Table `objects` de Supabase Storage scannée sans index → **CPU DB à 100%**.
  - Temps de réponse moyen \> 3 secondes sur beaucoup de requêtes.
  - Erreurs 429 (rate limiting) et 544 (time-out côté infra) → **application quasi inutilisable** pendant le pic.
- **Cause profonde**: combinaison de:
  - **Frontend** qui appelle trop souvent l’edge function `get-guest-documents-unified`.
  - **Edge function** qui, pour chaque réservation, fait plusieurs appels `.list(...)` sur `guest-documents` pour retrouver des fichiers.
  - **Stratégie de stockage** qui repose encore partiellement sur le "scan du bucket" au lieu d’utiliser uniquement la base de données comme source de vérité.

---

### 2. Symptômes observés et métriques clés

#### 2.1. Trafic sur `/storage/v1/object/list/guest-documents`

- **Nombre d’appels**: > 52 815 requêtes en moins d’une heure.
- **Répartition**:
  - 51 423 réponses **200 OK**, mais lenteur moyenne d’environ **3 062 ms**.
  - ~1 400 erreurs (principalement **429 Too Many Requests** et **544**).
- **Interprétation**:
  - Supabase a laissé passer la majorité des requêtes mais avec une latence énorme (DB saturée).
  - À partir d’un certain seuil, la couche de protection a renvoyé 429/544 → serveur en mode "défense".

#### 2.2. État de la base de données

- Table `objects` (celle qui stocke les métadonnées des fichiers du storage):
  - **0% d’utilisation d’index** dans les plans d’exécution au moment du pic.
  - Chaque `.list(...)` sur `guest-documents` provoque un **scan coûteux** de cette table.
- Conséquence directe:
  - **CPU à 100%** pendant la vague de `.list`.
  - Graphiques de santé DB montrant jusqu’à **69.23% d’erreurs** pendant le pic.

#### 2.3. Flux réseau (Ingress/Egress)

- **Vers 09h00**:
  - **Ingress** (données entrantes) passe de 1.73 MB à 5.11 MB (**+194%**).
  - **Egress** (données sortantes) chute de 2.55 MB à 0.86 MB.
- Interprétation:
  - Le serveur **reçoit beaucoup plus de requêtes** qu’avant (ingress ↑).
  - Mais il **répond moins** (egress ↓) car il passe son temps à calculer / attendre la DB → comportement typique d’un système en saturation CPU.

---

### 3. Architecture actuelle du flux de documents (vue simplifiée)

#### 3.1. Côté frontend

Composants / hooks principaux impliqués:

- `DocumentsViewer.tsx`
  - À chaque ouverture de la modale de documents pour une réservation:
    - Appelle `supabase.functions.invoke('get-guest-documents-unified', { body: { bookingId } })`.
  - Recharge les documents dès que `booking.id` change (`useEffect`).

- `useGuestVerification.ts`
  - Fonction `loadGuestSubmissions`:
    - Récupère les propriétés de l’utilisateur.
    - Pour **jusqu’à 3 propriétés**, appelle **en parallèle**:
      - `supabase.functions.invoke('get-guest-documents-unified', { body: { propertyId } })`.
    - Fonction potentiellement appelée depuis le dashboard / vues admin.

En pratique:
- Chaque ouverture / rafraîchissement d’un écran lié aux documents peut générer **plusieurs appels** à `get-guest-documents-unified`.

#### 3.2. Côté edge function `get-guest-documents-unified`

Pour chaque appel:

1. Récupère les réservations concernées:
   - Filtre par `bookingId` **ou** `propertyId`.
   - Peut retourner **plusieurs bookings** pour une propriété.

2. Pour chaque booking:
   - Charge les documents via:
     - Table `uploaded_documents`.
     - Table `generated_documents`.
     - Champs legacy / JSON dans `bookings.documents_generated` + colonnes `contract_url`, `police_url`, `identity_url` (via `safeSelectBooking`).
   - Construit une liste unifiée de documents, dédoublonnée, puis catégorisée (`identity`, `contract`, `police`).

3. **Fallback critique** (source de surcharge storage):
   - Si aucun document trouvé pour un type donné:
     - Appelle `getDocumentUrlFromStorage(supabase, type, bookingId)` qui fait:
       - `supabase.storage.from('guest-documents').list(prefix, { sortBy: { column: 'updated_at', order: 'desc' } })`
       - `prefix` dépend du type:
         - `identity/${bookingId}` + fallback `identities/${bookingId}`
         - `contract/${bookingId}` + fallback `contracts/${bookingId}`
         - `police/${bookingId}` + fallback `police-forms/${bookingId}`
   - Chaque réservation sans enregistrement correct en DB pour un type de document entraîne **jusqu’à 3 appels `.list(...)`**.

Conclusion:
- Un seul appel à `get-guest-documents-unified` peut générer:
  - **N bookings × (jusqu’à 3 `.list` par booking)** sur `guest-documents`.
  - Si plusieurs écrans / modales appellent cette edge function fréquemment → **explosion combinatoire** du nombre de `.list`.

---

### 4. Analyse des causes racines

#### 4.1. Cause 1 – Trop d’appels côté frontend

- `DocumentsViewer` appelle systématiquement `get-guest-documents-unified` à chaque montage:
  - Pas de cache par `booking.id`.
  - Si l’utilisateur ouvre/ferme la modale plusieurs fois ou navigue rapidement → **multiples appels identiques**.

- `useGuestVerification.loadGuestSubmissions`:
  - Appelle `get-guest-documents-unified` pour plusieurs propriétés en parallèle.
  - Chaque appel peut retourner beaucoup de bookings.
  - Même si cette fonction n’est pas exécutée au montage par défaut, elle peut, selon l’usage du dashboard, déclencher **des vagues d’appels sur de nombreuses réservations**.

Effet:
- Même avec un code relativement "raisonnable", la combinaison d’UI + re-rendus + interactions peut produire **des dizaines de milliers d’appels** sur l’edge function, donc sur le storage.

#### 4.2. Cause 2 – Fallback agressif dans l’edge function (scan du storage)

- Lorsqu’un document n’est pas trouvé dans:
  - `uploaded_documents`
  - `generated_documents`
  - `bookings.documents_generated` / legacy
- La fonction **essaie systématiquement de "deviner" les fichiers directement dans le bucket** via `.list(prefix, ...)`.

Problèmes:

1. **Scan coûteux**:
   - `.list` sur un bucket avec beaucoup de fichiers force des lectures intenses sur la table `objects`.
   - Sans index adaptés, chaque `.list` = scan lourd.

2. **Multiplication des appels**:
   - Pour chaque booking, jusqu’à 3 `.list`.
   - Pour chaque appel frontend, potentiellement des dizaines / centaines de bookings.

3. **Stratégie fragile**:
   - La présence / absence de fichiers dans le bucket devient une logique métier implicite.
   - Toute divergence entre le storage et la DB casse la performance et complique le debug.

#### 4.3. Cause 3 – Base de données non utilisée comme "source de vérité" unique

- Historiquement, certaines fonctionnalités ont:
  - Uploadé des PDFs directement dans le bucket (`guest-documents`) sans toujours enregistrer une entrée propre dans:
    - `uploaded_documents`
    - `generated_documents`
    - `bookings.documents_generated`
  - D’où la nécessité de faire des `.list` pour "retrouver" des documents perdus.

Effet:
- Tant que la DB n’est pas complète et fiable sur les documents, le code se repose sur le **storage comme index secondaire**, ce qui est exactement ce qui surcharge Supabase et la table `objects`.

---

### 5. Recommandations détaillées pour résoudre la latence

#### 5.1. Priorité 1 – Réduire drastiquement les `.list` sur `guest-documents`

**Objectif**: faire en sorte que **l’immense majorité** des requêtes storage soient des `createSignedUrl(path, ...)` sur un chemin **déjà connu**, et non des `.list(...)`.

Actions concrètes:

1. Dans `get-guest-documents-unified`:
   - **Désactiver / supprimer les appels à `getDocumentUrlFromStorage` en fallback automatique.**
   - Quand aucun document d’un type n’est trouvé en DB:
     - Retourner simplement l’info "missing" dans la réponse (pas de `.list`).
   - Option: garder `getDocumentUrlFromStorage` uniquement derrière un **flag de maintenance** (mode script manuel, jamais appelé en production normale).

2. Vérifier toutes les edge functions qui créent des documents:
   - `submit-guest-info-unified`
   - `generate-documents`
   - `generate-police-form` / `generate-police-forms`
   - `finalize-reservation-unified`
   - `documentGenerators.ts`
   - S’assurer que CHAQUE fois qu’un PDF est envoyé dans `guest-documents`:
     - Un enregistrement cohérent est créé dans `uploaded_documents` ou `generated_documents`.
     - `booking_id`, `document_type`, `file_path` sont correctement remplis.
     - `bookings.documents_generated` est mis à jour de manière fiable.

Résultat attendu:
- Les documents sont toujours trouvés via la DB.
- Le fallback par scan du bucket devient **inutile** → plus de `.list` massifs.

#### 5.2. Priorité 2 – Appliquer du cache et limiter les appels côté frontend

Objectif: éviter d’appeler `get-guest-documents-unified` plusieurs fois pour la même réservation ou le même ensemble de réservations.

Actions:

1. `DocumentsViewer.tsx`:
   - Introduire un **cache mémoire** (par exemple un `Map<string, DocumentUrls>` au niveau d’un hook ou d’un contexte) indexé par `booking.id`.
   - Avant d’appeler `supabase.functions.invoke('get-guest-documents-unified', ...)`:
     - Vérifier si les documents pour ce `booking.id` sont déjà en cache.
     - Si oui, les utiliser directement sans nouvel appel.
   - Ne recharger que:
     - Sur action explicite de l’utilisateur (bouton "Rafraîchir les documents").
     - Ou après une action qui modifie les documents (upload/génération).

2. `useGuestVerification.loadGuestSubmissions`:
   - Ne l’appeler **que sur action utilisateur** clairement identifiée (bouton "Charger les documents invités").
   - Ajouter éventuellement:
     - Des paramètres de **filtre** (plage de dates, propriété spécifique).
     - Une limite stricte sur le nombre de réservations retournées par la fonction (côté edge).

3. Envisager l’utilisation d’un **client de données** type React Query / TanStack Query:
   - Pour gérer cache, refetch contrôlé et déduplication d’appels.

#### 5.3. Priorité 3 – Solidifier la stratégie "DB = source de vérité"

Objectif: ne plus jamais avoir besoin de "deviner" l’état du système à partir du bucket.

Actions:

1. **Revue des schémas**:
   - Vérifier que:
     - `uploaded_documents` contient bien toutes les pièces uploadées par les invités (id, booking_id, guest_id, file_path, document_url, document_type, created_at).
     - `generated_documents` contient bien tous les PDFs générés (contrats, fiches de police, etc.).
     - `bookings.documents_generated` résume proprement l’état pour chaque type (booléens + URLs principales).

2. **Migrations de rattrapage (one-shot)**:
   - Si nécessaire, lancer un script SQL ou une petite edge function de maintenance qui:
     - Scanne `guest-documents` **une seule fois** (hors pics de trafic).
     - Reconstruit les entrées manquantes dans `uploaded_documents` / `generated_documents`.
   - Une fois cette migration faite et les edge functions corrigées:
     - Les fallbacks `.list` deviennent définitivement inutiles en production.

#### 5.4. Priorité 4 – Renforcer la sécurité & la résilience

1. **Rate limiting applicatif (côté code)**:
   - Ajouter une protection simple au début de `get-guest-documents-unified`:
     - Limiter la taille des résultats (ex: max 100 bookings).
     - Loguer et éventuellement refuser des patterns anormaux (ex: même client qui appelle la fonction des centaines de fois par minute).

2. **Monitoring dédié**:
   - Mettre en place:
     - Un suivi des appels à `get-guest-documents-unified` (par IP / par utilisateur / par propriété).
     - Des alertes sur:
       - le nombre d’appels `/storage/v1/object/list/guest-documents`.
       - le temps moyen de réponse DB.

3. **Index et tuning DB**:
   - Sur la table `objects` (gérée par Supabase), laisser les optimisations matérielles à Supabase.
   - Côté tables métier:
     - Vérifier les index sur `uploaded_documents.booking_id`, `generated_documents.booking_id`, `bookings.id`, `bookings.property_id`.

---

### 6. Feuille de route (ligne de route à suivre)

Cette section est ta **ligne de conduite pratique** : elle décrit **quoi faire, dans quels fichiers, dans quel ordre, et comment vérifier** que chaque étape est bien réalisée.

#### 6.1 Vue globale de réalisation

- **Étape 1 – Sécuriser**: couper immédiatement la cause principale de surcharge (`.list` en fallback) et vérifier que le frontend ne déclenche pas d’appels cachés.
- **Étape 2 – Stabiliser**: remettre la base de données au centre du système (source de vérité unique) et corriger tous les flux de création de documents.
- **Étape 3 – Optimiser**: réduire le trafic inutile côté frontend (cache, limites, filtres) et tester la charge.
- **Étape 4 – Surveiller**: ajouter des garde‑fous (alertes, bonnes pratiques) pour que le problème ne réapparaisse jamais.

Les sous‑sections suivantes détaillent ces étapes comme une **checklist concrète**.

---

#### Phase 1 – Urgence: stopper l’hémorragie (0–1 jour)

**Objectif**: faire chuter immédiatement le nombre d’appels `/storage/v1/object/list/guest-documents` sans casser la fonctionnalité principale.

1. **Désactiver les fallbacks storage dans `get-guest-documents-unified`**
   - **Fichier à modifier**: `supabase/functions/get-guest-documents-unified/index.ts`.
   - **Action concrète**:
     - Rechercher les blocs qui:
       - Appellent `getDocumentUrlFromStorage(supabase, 'contract' | 'police' | 'identity', booking.id)`.
       - Loggent des messages du type `"No contract found in DB, checking Storage..."`, `"No police form found in Storage..."`, `"No identity document found in DB, checking Storage..."`.
     - **Commenter ou supprimer** ces appels et blocs associés.
       - Comportement final souhaité:
         - Si aucun document n’est trouvé en DB pour un type donné, **la fonction renvoie simplement un type manquant dans `missingTypes`**, sans tenter de scanner le bucket.
   - **Résultat attendu**:
     - Plus de `.list(...)` automatiques en production.
     - Charge sur la table `objects` et sur `/storage/v1/object/list/guest-documents` fortement réduite dès le déploiement.

2. **Vérifier l’usage réel de `loadGuestSubmissions` côté frontend**
   - **Fichier principal**: `src/hooks/useGuestVerification.ts`.
   - **Ce que dit déjà le code**:
     - Le commentaire indique que `loadGuestSubmissions` est **lent** et **ne doit pas être appelé au montage**, mais seulement à la demande.
   - **Contrôles à faire**:
     - Rechercher dans tout le projet les appels à `loadGuestSubmissions(`.
     - Vérifier que:
       - Il n’est **jamais** appelé dans un `useEffect` sans garde (par ex. `useEffect(() => { loadGuestSubmissions(); }, [])`).
       - Il est uniquement déclenché par une action explicite de l’utilisateur (clic sur un bouton, ouverture volontaire d’un écran d’analyse, etc.).
   - **Si un appel automatique existe**:
     - Le déplacer derrière:
       - Un bouton "Charger les documents invités" **ou**
       - Un chargement différé avec garde stricte (et éventuellement un flag d’activation manuelle).

3. **Mettre en place une surveillance courte terme après déploiement**
   - **Via Supabase** (ou équivalent):
     - Observer pendant quelques heures:
       - Le volume de requêtes `/storage/v1/object/list/guest-documents`.
       - Le temps de réponse moyen DB.
       - Le taux d’erreurs 429/544.
   - **Critère de réussite Phase 1**:
     - Courbe des `.list` qui s’effondre.
     - Disparition des pics CPU à 100% liés au storage.

---

#### Phase 2 – Stabilisation: DB comme source de vérité (1–3 jours)

**Objectif**: faire en sorte que **tous les documents** puissent être retrouvés à partir de la base (sans jamais devoir scanner le bucket).

1. **Auditer toutes les créations de documents (backend)**
   - **Fichiers/Edge functions à passer en revue**:
     - `supabase/functions/submit-guest-info-unified/index.ts`
     - `supabase/functions/generate-documents/index.ts`
     - `supabase/functions/generate-police-form/index.ts` ou `generate-police-forms/index.ts`
     - `supabase/functions/finalize-reservation-unified/index.ts`
     - `supabase/functions/_shared/documentGenerators.ts`
   - **Checklist pour chaque flux**:
     - Quand un PDF est généré et uploadé dans `guest-documents`:
       - S’assurer qu’il y a **toujours**:
         - Un insert dans `uploaded_documents` **ou** `generated_documents` avec:
           - `booking_id`
           - `document_type` (identity/contract/police)
           - `file_path` (chemin complet dans le bucket)
           - `document_url` (URL publique ou signée, si disponible)
         - Une mise à jour cohérente de `bookings.documents_generated` (booleans + URLs principales).
     - S’il manque un de ces éléments pour un flux:
       - Ajouter la logique d’insert/update correspondante.

2. **Mettre en place un script de rattrapage (si des documents existent déjà sans trace DB)**
   - **But**: une **seule passe contrôlée** pour réparer l’historique.
   - **Stratégie**:
     - Créer soit:
       - Un script SQL dans `supabase/sql` ou `supabase/scripts`, **ou**
       - Une petite edge function de maintenance (appelée manuellement).
     - Ce script:
       - Parcourt les entrées du bucket `guest-documents` concernées (par plage de dates ou par pattern de chemin).
       - Pour chaque fichier "orphelin":
         - Reconstruit l’information manquante dans `uploaded_documents`/`generated_documents`.
     - Le lancer **une seule fois**, hors horaires de forte charge.

3. **Adapter `get-guest-documents-unified` à cette nouvelle discipline**
   - **Objectif**: la fonction ne doit plus jamais dépendre de `.list`, seulement de la DB.
   - **Actions**:
     - Vérifier que, dans `get-guest-documents-unified`:
       - Tous les documents proviennent de:
         - `uploaded_documents`
         - `generated_documents`
         - `bookings.documents_generated` / colonnes legacy.
       - La génération d’URL:
         - Utilise `createSignedUrl(path, ...)` quand on connaît `file_path`.
         - N’essaie plus de deviner les fichiers via des prefixes.
   - **Critère de réussite Phase 2**:
     - Pour une réservation donnée, **tous les documents attendus sont trouvés via les tables** sans fallback storage.

---

#### Phase 3 – Optimisation frontend et UX (3–7 jours)

**Objectif**: réduire le nombre d’appels inutiles côté frontend et fluidifier l’expérience utilisateur.

1. **Mettre en place un cache par `booking.id` pour les documents**
   - **Cible principale**: `DocumentsViewer.tsx`.
   - **Approche recommandée**:
     - Créer soit:
       - Un petit hook local (`useDocumentsCache`) basé sur un `Map<string, DocumentUrls>`, **ou**
       - Un cache géré par React Query/TanStack Query.
     - Comportement:
       - Lors de l’ouverture de `DocumentsViewer`:
         - Si les documents pour `booking.id` sont en cache → utiliser le cache et **ne pas rappeler** `get-guest-documents-unified`.
         - Sinon → appeler l’edge function, puis stocker le résultat dans le cache.
       - Préciser quand invalider le cache:
         - Après upload de nouveaux documents.
         - Après génération d’un contrat ou d’une fiche de police.

2. **Limiter les résultats et affiner les filtres pour les appels par propriété**
   - **Concerne**: les appels à `get-guest-documents-unified` avec `propertyId`.
   - **Actions**:
     - Côté edge function:
       - Ajouter des filtres (par ex. sur les dates de réservation, statut `completed` vs `cancelled`, etc.).
       - Imposer une limite (ex: max 50 ou 100 bookings par appel).
     - Côté UI:
       - Proposer des filtres à l’utilisateur avant de lancer le chargement (dates, propriété, statut).

3. **Effectuer des tests de charge contrôlés**
   - **Scénarios à simuler**:
     - Ouverture répétée de `DocumentsViewer` sur plusieurs réservations (avec et sans cache).
     - Utilisation de `loadGuestSubmissions` sur un compte avec beaucoup de propriétés.
   - **Vérifications**:
     - Le temps de réponse de `get-guest-documents-unified` reste stable (\< 500–800 ms).
     - Aucune remontée de 429/544 liée au storage pendant ces tests.

---

#### Phase 4 – Sécurité et observabilité long terme (7+ jours)

**Objectif**: verrouiller le système pour que ce type de saturation ne puisse pas revenir en production sans être détecté très tôt.

1. **Mettre en place des alertes de supervision**
   - **À surveiller**:
     - Nombre d’appels à `/storage/v1/object/list/guest-documents`.
     - Latence moyenne DB.
     - Taux d’erreurs 429/5xx sur les endpoints storage et les edge functions critiques.
   - **Seuils d’alerte** (à adapter à ta charge normale):
     - Si les `.list` dépassent un certain seuil par heure.
     - Si la latence moyenne DB dépasse un certain nombre de ms sur une période donnée.

2. **Documenter les bonnes pratiques internes (règles à respecter)**
   - **Interdictions**:
     - Ne pas utiliser `.list(...)` comme mécanisme principal pour retrouver des documents dans le bucket de prod.
   - **Règles positives**:
     - "La DB est la source de vérité" pour tout ce qui concerne les documents.
     - Toute nouvelle feature document:
       - Doit enregistrer un enregistrement en DB avec un `file_path` clair.
       - Ne doit jamais scanner le bucket à l’aveugle.

3. **Revue régulière du code lié au storage**
   - Tous les X mois:
     - Faire une recherche globale sur `.list(` dans le code.
     - Vérifier:
       - Que ces appels ne sont présents que:
         - Dans des scripts de maintenance/diagnostic.
         - Ou dans des outils de test/débogage clairement séparés de la prod.
       - Qu’aucun nouveau flux métier critique ne repose sur `.list(...)`.

---

### 7. Métriques de succès spécifiques à ce problème

- **Avant / Après** (à suivre via Supabase):
  - Nombre de requêtes `/storage/v1/object/list/guest-documents`:
    - Avant: ~50 000+ / heure pendant un pic.
    - Cible: \<< 100 / heure en régime normal.
  - Temps de réponse moyen sur ces requêtes:
    - Avant: ~3 062 ms.
    - Cible: \< 300 ms.
  - Taux d’erreurs 429 / 544 pendant les heures de pointe:
    - Avant: pics à ~69% d’erreurs DB.
    - Cible: quasi 0% (éventuellement quelques 429 isolés si vrai abus).

- **Expérience utilisateur**:
  - Chargement des documents dans `DocumentsViewer`:
    - Cible: \< 1 seconde pour afficher les documents.
  - Dashboard / vues admin:
    - Pas de freeze ni de blocage lors du chargement des données invités / documents.

Ce fichier doit servir de **référence centrale** pour toutes les futures modifications liées aux documents et au storage `guest-documents`. Toute nouvelle évolution devrait être vérifiée par rapport à ces règles pour éviter de recréer les mêmes problèmes de performance.

