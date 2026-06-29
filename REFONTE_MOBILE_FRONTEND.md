# Refonte Frontend Mobile — Audit introspectif & plan de chantier

> **But** : éliminer les décalages et incohérences d'affichage **d'un navigateur à l'autre** sur mobile (iOS Safari, Chrome Android, Firefox, Samsung Internet, navigateur in-app Instagram/Facebook/WhatsApp), et poser une base responsive unique et fiable.
>
> **Statut** : 📋 Audit terminé — chantier en cours.
> **Dernière mise à jour** : 2026-06-29

---

## 0. Résumé exécutif

L'application n'a **pas une seule source de vérité** pour décider « est-ce mobile ? » ni pour gérer la hauteur d'écran. Elle empile **3 mécanismes JS de détection mobile** + **les media queries CSS** + **les classes Tailwind `md:`**, qui ne sont **pas alignés sur le même seuil ni la même logique**. Résultat : selon le navigateur (largeur de scrollbar, barre d'URL dynamique, vitesse d'hydratation), le rendu bascule différemment → **décalages, sauts visuels (FOUC), boutons coupés, contenu sous la barre d'URL**.

Les 5 causes racines, par ordre d'impact :

| # | Cause racine | Symptôme visible | Impact |
|---|--------------|------------------|--------|
| 1 | `100vh` / `min-h-screen` partout (95 occurrences) | Boutons du bas coupés, contenu masqué sous la barre d'URL — **différent sur chaque navigateur** | 🔴 Critique |
| 2 | 3 hooks de détection mobile non synchronisés + seuils CSS mixtes (767/768) | Saut de layout au chargement, rendu différent selon la vitesse du navigateur | 🔴 Critique |
| 3 | Double système de Dialog mobile (JS dans `dialog.tsx` **et** `!important` dans `mobile.css`) qui se battent | Modales qui « sautent » de centrées à plein écran, erreurs DOM `insertBefore/removeChild` | 🔴 Critique |
| 4 | `GuestVerification.tsx` monolithique (4290 lignes, 50+ ternaires `isMobile ?` + styles inline) | Espacements/tailles incohérents, `marginLeft: '436px'` codé en dur | 🟠 Majeur |
| 5 | Polices chargées 2× (`<link>` + `@import`), pas de `text-size-adjust`, pas de garde `overflow-x` | FOUT variable selon navigateur, zoom auto du texte, scroll horizontal parasite | 🟡 Moyen |

---

## 1. Cartographie de l'existant

### 1.1 Détection « mobile » — il y en a TROIS, incompatibles

| Source | Fichier | Valeur initiale | Logique | Problème |
|--------|---------|-----------------|---------|----------|
| Hook A | [src/hooks/useIsMobile.ts](src/hooks/useIsMobile.ts) | `false` | `resize` + `innerWidth < 768` | Démarre en *desktop*, bascule après montage → **flash** |
| Hook B | [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) | `undefined` → `!!` | `matchMedia(max-width:767)` + `innerWidth < 768` | Démarre en *mobile* (`!!undefined === false`)… mais logique différente de A |
| Hook C (inline) | [src/components/ui/dialog.tsx:9](src/components/ui/dialog.tsx#L9) | `false` | `resize` + `innerWidth < 768` | Copie dupliquée, recalculée par dialog |

➡️ **Deux hooks portent le même nom `useIsMobile`** mais vivent dans deux fichiers différents (`useIsMobile.ts` vs `use-mobile.tsx`). Selon l'import, on n'a pas le même comportement initial. C'est la première source d'incohérence.

### 1.2 Seuils CSS incohérents

- Tailwind `md:` = `min-width: 768px` (mobile = `< 768`).
- [src/styles/mobile.css](src/styles/mobile.css) utilise **à la fois** `@media (max-width: 768px)` **et** `@media (max-width: 767px)` selon les blocs.
- Les hooks JS utilisent `innerWidth < 768`.

➡️ **À exactement 768px**, le JS dit « desktop », un bloc CSS dit « mobile » (768), un autre dit « desktop » (767), et Tailwind dit « desktop ». → décalage net à la frontière, et comportement différent selon que le navigateur compte ou non la scrollbar dans `innerWidth`.

### 1.3 `innerWidth` n'est pas fiable cross-navigateur

- Desktop : `innerWidth` **inclut** la scrollbar sur certains navigateurs, **l'exclut** sur d'autres (largeur scrollbar : 0px macOS overlay, ~15-17px Windows). → la frontière 768 tombe à un endroit différent.
- Mobile : `innerWidth` **change** quand le clavier virtuel s'ouvre ou que la barre d'URL se rétracte. Les hooks écoutent `resize` → recalcul en plein usage → re-render et **saut de layout**.

### 1.4 Hauteur d'écran — `100vh` est cassé sur mobile

95 occurrences de `100vh` / `min-h-screen` / `h-screen` réparties dans 41 fichiers (cf. `grep`). Exemples critiques :
- [src/pages/GuestVerification.tsx:2875](src/pages/GuestVerification.tsx#L2875) : `minHeight: '100vh'` en style inline.
- [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) : `h-full` sur mobile plein écran.
- [src/styles/mobile.css:84](src/styles/mobile.css#L84) : `min-height: 100vh !important` sur les dialogs.

**Pourquoi c'est le cœur du problème « navigateur à navigateur » :**
- iOS Safari : `100vh` = hauteur **barre d'URL masquée** (la plus grande). Au chargement la barre est visible → le contenu de `100vh` dépasse → **le bas est coupé**.
- Chrome Android / Samsung Internet : comportement différent encore, barre d'outils dynamique.
- Firefox mobile : encore une autre heuristique.

➡️ Le même `100vh` donne **4 hauteurs différentes** sur 4 navigateurs. C'est la cause n°1 des décalages.
**Solution** : `100dvh` (dynamic viewport height) avec fallback `100vh`, et `svh`/`lvh` selon le besoin. Aucune occurrence de `dvh/svh/lvh` actuellement.

### 1.5 Dialogs / Modales — deux systèmes en conflit

Sur mobile, **deux mécanismes** rendent les dialogs plein écran :
1. **JS** dans [dialog.tsx:63-72](src/components/ui/dialog.tsx#L63) : si `isMobile`, applique les classes `inset-0 w-full h-full …` et **retire** la transformation de centrage.
2. **CSS** dans [mobile.css:74-95](src/styles/mobile.css#L74) : `[role="dialog"][data-state="open"] { left:0!important; transform:none!important; width:100vw!important; min-height:100vh!important; … }`.

Conséquences :
- Au 1er rendu, le hook JS vaut `false` → Radix rend la modale **centrée avec transform**, puis le hook bascule → **saut visuel**. Le CSS `!important` se déclenche selon le media query, pas selon le JS → **désynchronisation**.
- `width: 100vw` ignore la scrollbar → **débordement horizontal** sur desktop à classic scrollbar.
- Le va-et-vient de classes provoque des **remontages de portails Radix** → les erreurs `insertBefore` / `removeChild` / `NotFoundError` que [src/main.tsx](src/main.tsx) et [src/App.tsx](src/App.tsx) s'épuisent à **intercepter et masquer** (≈250 lignes de patch défensif). On traite le symptôme, pas la cause.

### 1.6 Layouts multiples et divergents

| Wrapper | Fichier | Fond | En-tête | Usage |
|---------|---------|------|---------|-------|
| `Layout` | [src/components/Layout.tsx](src/components/Layout.tsx) | `#F9F7F2` | header blanc sticky | Dashboard/auth |
| `GuestLayout` | [src/components/guest/GuestLayout.tsx](src/components/guest/GuestLayout.tsx) | dégradé slate | header transparent | Pages invité |
| `MobileLayout` | [src/components/mobile/MobileLayout.tsx](src/components/mobile/MobileLayout.tsx) | `bg-gray-50` | espaceurs `h-16` | Quasi inutilisé |

➡️ Trois fonds, trois en-têtes, trois logiques de padding/safe-area. Aucune primitive partagée (pas de `<Screen>`/`<Container>` commun). Les valeurs de padding et de safe-area sont réinventées à chaque page.

### 1.7 `GuestVerification.tsx` — le monolithe (4290 lignes)

- **50+ ternaires `isMobile ? … : …`** pilotant tailles de texte, paddings, marges, grilles, animations (cf. `grep` lignes 2518 → 4127).
- Styles **inline** codés en dur : `marginLeft: isMobile ? 0 : '436px'` ([:2874](src/pages/GuestVerification.tsx#L2874)), `minHeight: '100vh'` ([:2875](src/pages/GuestVerification.tsx#L2875)).
- Mélange **3 systèmes de style** sur les mêmes éléments : ternaire JS + classes Tailwind `md:` + classes `mobile.css`.

➡️ Chaque décision d'espacement est dupliquée mobile/desktop à la main → l'incohérence est **structurelle**, pas accidentelle. C'est ici que se concentre le ressenti de « décalage » sur la page la plus vue par les invités.

### 1.8 Polices, texte, débordements

- **Double chargement des polices** : `<link>` dans [index.html:13](index.html#L13) **et** `@import url(...)` dans [src/index.css:1](src/index.css#L1). Double requête, FOUT (flash of unstyled text) qui se comporte différemment selon le cache/navigateur.
- **Pas de `-webkit-text-size-adjust: 100%`** → iOS Safari peut **gonfler** le texte en paysage.
- **Pas de garde `overflow-x: hidden`** au niveau racine → tout débordement (margin 436px, `100vw`, scrollbar) crée un **scroll horizontal** parasite, perçu comme un « décalage ».
- [src/App.css](src/App.css) est un **résidu Vite** (`#root { max-width:1280px; padding:2rem; text-align:center }`). Non importé aujourd'hui (✅ vérifié), mais à supprimer pour éviter tout réamorçage accidentel.

### 1.9 Safe-area (encoche / barre d'accueil iOS)

- `viewport-fit=cover` est bien présent ([index.html:5](index.html#L5)) → le contenu passe **sous** l'encoche et la barre d'accueil.
- Mais `env(safe-area-inset-*)` n'est appliqué **que partiellement** (quelques classes `safe-area-*`, le footer guest). Beaucoup de boutons fixes en bas ne compensent pas → masqués par la barre d'accueil sur iPhone.

---

## 2. Problèmes par navigateur (synthèse)

| Navigateur | Problèmes spécifiques constatés / attendus |
|------------|---------------------------------------------|
| **iOS Safari** | `100vh` trop grand (barre d'URL) → bas coupé ; zoom auto sur input `< 16px` ; safe-area encoche/home indicator non compensée partout ; momentum scroll nécessite `-webkit-overflow-scrolling`. |
| **Chrome Android** | Barre d'outils dynamique → `100vh` instable ; `resize` au scroll → re-render des hooks → saut ; clavier virtuel modifie `innerWidth`. |
| **Samsung Internet** | Idem Chrome + barre de navigation gestuelle ; rendu de `backdrop`/`fixed` parfois décalé. |
| **Firefox Android** | Heuristique `vh` encore différente ; `matchMedia` ok mais seuil 767 vs 768 visible. |
| **WebView in-app (Instagram/FB/WhatsApp)** | Hauteur de viewport réduite et non standard ; `dvh` mal supporté sur vieilles WebView → fallback indispensable ; pas de barre d'URL → `lvh` ≈ `svh`. |
| **Desktop (frontière 768px)** | Scrollbar incluse/exclue de `innerWidth` selon navigateur → bascule mobile/desktop à un pixel différent ; `100vw` déborde sous la scrollbar classique. |

---

## 3. Plan de chantier (par phases, du plus sûr au plus structurant)

### Phase 1 — Fondations (faible risque, fort impact) ⏳ EN COURS
- [x] **Source unique de breakpoints** : module [src/lib/breakpoints.ts](src/lib/breakpoints.ts) (`MOBILE_BREAKPOINT = 768`, `getIsMobile()` basé matchMedia) consommé par les hooks.
- [x] **Utilitaires de hauteur fiables** : `.min-h-screen-dvh` / `.h-screen-dvh` / `.min-h-screen-svh` (fallback `vh` → `dvh`/`svh`) ajoutés dans [src/index.css](src/index.css). Remplacement de `100vh` en cours, déjà appliqué au wrapper principal de `GuestVerification.tsx`.
- [x] **Normalisation racine** : `html, body, #root { overflow-x: hidden }` + `text-size-adjust: 100%` + `min-height: 100dvh` + `overscroll-behavior-y: none` dans [src/index.css](src/index.css).
- [x] **Polices** : `@import` Google Fonts retiré de `index.css` (le `<link>` préchargé d'`index.html` couvre déjà toutes les familles).
- [x] Résidu [src/App.css](src/App.css) supprimé (n'était pas importé).
- [ ] **Reste à faire** : remplacer progressivement les `100vh`/`min-h-screen` restants (94 occurrences) écran par écran, en priorisant les pages invité plein écran.

### Phase 2 — Détection mobile & Dialogs (risque moyen) ✅ FAIT
- [x] Un **seul** `useIsMobile` basé `matchMedia`, **init synchrone** (`getIsMobile()`) → plus de flash. `useIsMobile.ts` redirige désormais vers `use-mobile.tsx` ([détails §1.1](src/hooks/useIsMobile.ts)).
- [x] **Un seul système de dialog mobile** : `dialog.tsx` et `alert-dialog.tsx` pilotés **100% en CSS responsive** (mobile-first plein écran, `md:` centré) ; hooks JS `useDialogIsMobile`/`useAlertDialogIsMobile` **supprimés**. Bloc `[role="dialog"] { …!important }` de `mobile.css` **retiré** (il cassait aussi les Sheets). Rendu correct dès le 1er paint → suppression de la cause des erreurs `insertBefore/removeChild`.
- [x] `100vw`/`100vh` des dialogs remplacés par `inset-0` + `w-full h-full` (pinné au viewport réel, pas de débordement scrollbar) + `pb-[max(1rem,env(safe-area-inset-bottom))]`.
- [ ] **À surveiller** : une fois les modales validées en réel, alléger les interceptors d'erreurs DOM de [src/main.tsx](src/main.tsx) / [src/App.tsx](src/App.tsx) (la cause étant traitée).

### Phase 3 — Layouts partagés & nettoyage CSS (structurant) ⏳ EN COURS
- [x] **Upgrade global `dvh`** : `min-h-screen`/`h-screen` (Tailwind = `100vh`) surchargées en `100dvh` via `@supports` dans [src/index.css](src/index.css) → **~40 call-sites corrigés d'un coup**, fallback `vh` automatique sur vieux navigateurs. Vérifié dans le CSS compilé.
- [x] **Styles inline `100vh` restants** migrés : [WelcomingContractSignature.tsx](src/components/WelcomingContractSignature.tsx) (sidebar `h-screen` + contenu `min-h-screen-dvh`), `calc(100vh-…)` → `calc(100dvh-…)` dans [CalendarMobile.tsx](src/components/calendar/CalendarMobile.tsx) et [MobilePdfViewer.tsx](src/components/MobilePdfViewer.tsx).
- [x] **Primitives partagées créées** : [`<Screen>`](src/components/layout/Screen.tsx) (hauteur dvh + safe-area + anti-overflow) et [`<Container>`](src/components/layout/Container.tsx) (largeur max + padding cohérent). Appliquées à [GuestLayout](src/components/guest/GuestLayout.tsx) (preuve de concept).
- [x] **Coquilles de layout migrées** vers `<Screen>`/`<Container>` : [Layout](src/components/Layout.tsx) (header/main/footer via `<Container size="xl">`, root `<Screen safe={false}>`), [MainDashboard](src/components/MainDashboard.tsx) (root `<Screen>`), [GuestLayout](src/components/guest/GuestLayout.tsx).
  - ℹ️ Les **pages** invité (`GuestWelcome`, `VerifyToken`) sont rendues **dans** `GuestLayout` (déjà un `<Screen>`) → pas de second `<Screen>` (éviterait un double safe-area), et leur `min-h-screen` reçoit déjà l'upgrade `dvh`. `ContractSigning` a déjà `safe-area-all` + dvh auto. → laissées telles quelles, déjà correctes.
- [ ] **Reste à faire** : refactor incrémental du monolithe `GuestVerification.tsx` (4290 lignes, 50+ ternaires `isMobile`) ; purge des `!important` scopés devenus superflus dans `mobile.css` ; uniformiser les 2 lectures `window.innerWidth < 768` non-réactives restantes ([WelcomingContractSignature](src/components/WelcomingContractSignature.tsx), [AirbnbSyncManager](src/components/AirbnbSyncManager.tsx)).

---

## 4. Principes directeurs de la refonte

1. **Une seule source de vérité par préoccupation** (breakpoint, hauteur, safe-area, dialog).
2. **CSS d'abord, JS en dernier recours.** Le responsive doit fonctionner avant l'hydratation JS → pas de flash. On ne fait du JS (`useIsMobile`) que pour le rendu conditionnel *structurel* (composants différents), jamais pour de simples tailles/paddings (→ classes `md:`).
3. **`dvh` + fallback `vh`** pour toute hauteur plein-écran.
4. **Tester sur la frontière** : 767 / 768 / 769 px, et avec/sans scrollbar.
5. **Safe-area systématique** sur tout élément collé aux bords (header sticky, boutons fixes, footers).
6. **Supprimer les rustines** (interceptors d'erreurs DOM) une fois la cause éliminée.

## 5. Matrice de tests cibles

| Appareil / Navigateur | Largeur | À vérifier |
|----------------------|---------|-----------|
| iPhone SE / Safari | 375 | bas non coupé, pas de zoom input, safe-area |
| iPhone 15 Pro / Safari | 393 | encoche, home indicator |
| Pixel / Chrome | 412 | barre dynamique, clavier |
| Galaxy / Samsung Internet | 360 | barre gestuelle |
| WebView Instagram (iOS+Android) | var. | hauteur réduite, dvh fallback |
| iPad / Safari | 768/834 | frontière mobile/desktop |
| Desktop Chrome/Firefox | 767/768/769 | bascule au bon pixel, pas de scroll horizontal |

---

*Document vivant : cocher les cases au fur et à mesure du chantier et documenter chaque correctif (commit + fichier touché).*

---

## 7. Durcissement Safari / iOS ✅

Passe ciblée sur les quirks WebKit (Safari macOS + iOS) du parcours invité.

| Sujet | Problème Safari/iOS | Correctif |
|-------|---------------------|-----------|
| **Champs date natifs** (`input[type=date]`) | iOS centre la valeur et peut effondrer la hauteur → look incohérent vs autres champs | Classe `.guest-date-input` : `-webkit-appearance:none`, `min-height:48px`, `::-webkit-date-and-time-value{text-align:left}`, `::-webkit-datetime-edit{padding:0}` ([GuestHybridDateField](src/components/guest/GuestHybridDateField.tsx) + [mobile.css](src/styles/mobile.css)) |
| **Selects** | Risque de double-flèche / style natif si `-webkit-appearance` absent | Vérifié : **autoprefixer** (defaults) émet bien `-webkit-appearance:none` dans le CSS compilé → OK, + chevron custom déjà présent |
| **`position: sticky` cassé** | `overflow-x:hidden` sur html/body/#root transforme la page en conteneur de défilement et casse le header sticky sur iOS | `@supports (overflow: clip)` → `overflow-x: clip` (coupe sans créer de scroll-container) ; fallback `hidden` pour Safari < 16 ([index.css](src/index.css)) |
| **Hauteur / barre d'URL** | `100vh` trop grand sur iOS Safari | déjà traité Phase 3 : `min-h-screen`/`h-screen` → `100dvh` (fallback vh) |
| **Zoom au focus** | iOS zoome si police input < 16px | inputs/selects/date en `text-base` (16px) + règle `font-size:16px` dans `.guest-verification-main` |
| **Flash gris au tap** | iOS affiche un highlight gris sur tap | `-webkit-tap-highlight-color: transparent` sur boutons/liens/champs |
| **Safe-area** | encoche / home indicator | `viewport-fit=cover` + `env(safe-area-inset-*)` sur header/footer |

Vérifié dans le CSS compilé (`webkit-date-and-time-value`, `overflow-x:clip`, `webkit-tap-highlight-color:transparent` présents). `tsc` + `vite build` ✅.

---

## 6. Audit détaillé — Guest Verification mobile (vitrine client)

> Page : [src/pages/GuestVerification.tsx](src/pages/GuestVerification.tsx) (monolithe 4290 lignes). Parcours : **booking → documents → signature**, plus états *chargement / lien invalide / succès*. Audit réalisé écran par écran sur la cible mobile (`isMobile` = `< 768px`).

### 6.1 Corrigé ✅ (cette passe)

| # | Étape / écran | Défaut mobile | Correctif |
|---|---------------|---------------|-----------|
| A | États *chargement*, *lien invalide*, *succès* | Cartes centrées **sans padding horizontal** → la carte `max-w-md` colle aux bords sur téléphone étroit (<448px) | `p-4` sur le wrapper + `w-full` sur la carte (lignes ~2300/2335/2423) |
| B | Étape **booking** | Marge latérale incohérente : `px-4` ajouté **en plus** du `px-6` parent (40px) vs 24px sur documents/signature → la largeur « saute » au changement d'étape | Retrait du `px-4` superflu (alignement sur les autres étapes) |
| C | Étape **signature** | Titre `text-3xl` non responsive (trop gros sur petit écran) | `text-2xl md:text-3xl` + sous-titre `text-sm md:text-base` |
| D | Bottom-sheet voyageurs | `max-height: 90vh` (barre d'URL non prise en compte) | `90vh` → `90dvh` (fallback) dans [mobile.css](src/styles/mobile.css) |

### 6.2 Constats ouverts

1. **✅ CORRIGÉ — Textes codés en dur en français** (écrans 100% visibles client, app FR/EN/ES). 13 clés ajoutées dans `fr.ts`/`en.ts`/`es.ts` (`verifyingLink`, `loadingInProgress`, `invalidLinkContactHost`, `thankYou`, `submissionSuccessDesc`, `travelersTitle`, `adults`, `children`, `submissionInProgress*`, `submitErrorDesc`, `selectDatesError`) et tous les textes/toasts remplacés par `t(...)` dans [GuestVerification.tsx](src/pages/GuestVerification.tsx). Un voyageur EN/ES voit désormais sa langue partout.
2. **🟠 Étape signature = impasse — DIAGNOSTIC FAIT** :
   - **Marche avant** : booking → documents → `handleSubmit()` → écran **succès** → bouton « Signer le contrat » → `/contract-signing/...` (composant séparé). L'écran signature in-page **n'est jamais affiché en avançant**.
   - **Seul accès** : retour depuis la page de signature (`navState.fromSignaturePage`, [ligne ~1188](src/pages/GuestVerification.tsx#L1188)) qui marque les 3 étapes visitées → l'écran in-page (contrat *placeholder* + case + bouton Précédent seul) s'affiche, **sans rien signer**.
   - **Recommandation** : garder l'étape dans le stepper (roadmap claire), mais remplacer le contenu *placeholder* par un vrai CTA « Signer le contrat » qui renvoie vers `/contract-signing/...` (identique au bouton de l'écran succès). → **en attente de validation** avant application.
3. **🟠 Sur-utilisation de styles inline + ternaires `isMobile`** (50+) dans la page : chaque taille/espacement est dupliqué à la main → source structurelle d'incohérences futures. Refactor incrémental recommandé (extraction de sous-composants par étape, passage aux classes `md:`).
4. **🟡 Boutons sans feedback tactile** : les CTA reposent sur `onMouseEnter/Leave` (sans effet au toucher) et n'ont pas d'état `:active`. Ajouter un retour visuel `active:` pour le mobile.
5. **🟡 Largeur des zones tactiles** : vérifier que tous les CTA atteignent 44px de haut (la plupart OK via `py-3`, à confirmer visuellement).

### 6.2bis Fiche « informations voyageur » (étape documents) — REFONTE ✅

La fiche de saisie (11 champs : nom, naissance, nationalité, lieu de naissance, type/numéro/expiration de pièce, profession, motif, adresse, email) était « moche et mal répartie ». Corrigé :

| Avant | Après |
|-------|-------|
| Carte en styles inline, **ombre dure** `0 4px 4px rgba(0,0,0,.25)` | Tailwind `bg-white rounded-2xl border border-gray-100` + **ombre douce** ; padding `p-4 md:p-6` (plus de largeur input sur mobile) |
| Grille inline `isMobile ? 1fr : 1fr 1fr` (seuil 768 JS) avec **champ orphelin** → trou à côté sur desktop | `grid grid-cols-1 md:grid-cols-2 gap-4` (CSS pur, breakpoint 768 cohérent) |
| Champs longs (motif, adresse, email) coincés en demi-largeur | `md:col-span-2` → **pleine largeur**, répartition propre (4 lignes de paires + 3 pleines) |
| Focus incohérent (champ date = anneau teal, autres = bordure grise) | **Focus unifié** sur tous les champs : `focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20` (+ champ date aligné) |
| Titre section `30px` fixe (trop gros mobile) | `text-2xl md:text-3xl` |
| Boutons nav `px-8` → risque de **débordement** mobile (texte « Vérifier et continuer ») | `px-5 md:px-8` |

Tous les inputs/selects en `text-base` (16px) → pas de zoom iOS. Champ date natif `[color-scheme:light]` + même hauteur (`py-3`) que les autres → alignement parfait des lignes. `tsc` + `vite build` ✅.

### 6.2ter Refonte visuelle inspirée de la maquette « CHECKY Mobile » ✅

Disposition reprise de la maquette de référence (design vert menthe Plus Jakarta Sans), **en gardant le code couleur teal de l'app et la logique existante**. Périmètre : carte voyageur + zone upload / liste documents.

| Élément | Refonte |
|---------|---------|
| **Zone d'upload** | Dashed teal clair sur fond teal très pâle (`#A7DDD0` / `#F2FAF8`), radius 18px, icône + titre teal (`mobile.css` + JSX) |
| **« Documents téléchargés »** | Libellé `uppercase` + tracking (style maquette) |
| **Carte document** | Vignette `46×46` à dégradé teal + nom (ellipsis) + résumé + bouton retirer doux `30×30 rounded-[9px] bg-red-50` (au lieu d'un X absolu) ; bordure douce `#E4EAE7` |
| **Carte voyageur** | **Badge numéroté** teal (carré arrondi avec le n°) + titre ; bordure `#E4EAE7` radius 18px ; bouton retirer arrondi gris→rouge |
| **Champs** | Bordure `1.5px #E4EAE7` + `rounded-xl` (12px) + focus anneau teal (inputs, selects, champ date) |

`tsc` + `vite build` ✅. Couleurs : teal app (`#55BA9F`/`brand-teal`) — pas le menthe `#15C39A` de la maquette.

### 6.3 Prochaine étape recommandée
Validation visuelle réelle (iOS Safari + Chrome Android) des 3 étapes et des 3 états, puis arbitrage des points 6.2.1 (i18n) et 6.2.2 (étape signature) qui sont les plus visibles côté client.
