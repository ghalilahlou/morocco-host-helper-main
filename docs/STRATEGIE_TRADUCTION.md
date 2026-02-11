# Stratégie de traduction (i18n) — Checky

Ce document décrit le mécanisme de traduction pour les **utilisateurs francophones et anglophones** (et espagnol), ainsi que la **traduction des pages** de l’application.

---

## 1. Vue d’ensemble

- **Langues supportées** : Français (fr), Anglais (en), Espagnol (es).
- **Stockage** : `localStorage` (`guest_locale`) + paramètre d’URL `?lang=fr|en|es`.
- **Détection** : au premier chargement, la langue est détectée via `?lang`, puis `localStorage`, puis la langue du navigateur (sinon français par défaut).

---

## 2. Contrat de location (FR / EN / ES)

### 2.1 Côté interface (prévisualisation)

- Le **texte du contrat** affiché à l’écran (et le PDF prévisualisé) dépend de la **langue choisie** par l’utilisateur (sélecteur FR | EN | ES).
- Fichiers concernés :
  - **Clés i18n** : `src/i18n/fr.ts`, `src/i18n/en.ts` (section `contract.body.*`).
  - **Composant** : `src/components/WelcomingContractSignature.tsx` :
    - utilise `useGuestLocale()` et `useT()` pour construire le contenu du contrat ;
    - les dates sont formatées selon la locale (ex. `fr-FR`, `en-GB`, `es-ES`).

### 2.2 Génération du PDF (edge function)

- L’appel à `getContractPdfUrl()` peut recevoir un paramètre optionnel **`locale`** (`'fr' | 'en' | 'es'`).
- Ce paramètre est transmis à l’edge function `submit-guest-info-unified` (body `locale`).
- **À faire côté backend** : dans l’edge function, lire `body.locale` et utiliser des libellés ou templates de contrat en français ou en anglais (et espagnol si souhaité) pour générer le PDF dans la bonne langue. Tant que ce n’est pas implémenté, le PDF peut rester en français par défaut.

---

## 3. Traduction des pages (choix de langue)

### 3.1 Provider global

- Un seul **`GuestLocaleProvider`** enveloppe **toutes les routes** dans `App.tsx`.
- Toutes les pages (invités, tableau de bord, landing, etc.) ont accès à la même langue via :
  - **`useGuestLocale()`** : `{ locale, setLocale }`
  - **`useT()`** : fonction de traduction liée à la locale courante

### 3.2 Sélecteur de langue

- **Composant** : `src/components/guest/LanguageSwitcher.tsx` (liens FR | EN | ES).
- **Utilisation** :
  - Pages invités (vérification, signature de contrat) : déjà présent dans le header invité.
  - **Tableau de bord (Layout)** : le sélecteur est affiché dans le header et dans le footer, et met à jour la langue pour toute l’app (même clé `guest_locale`).

### 3.3 Ajouter des traductions à une page

1. **Définir les clés** dans `src/i18n/fr.ts` et `src/i18n/en.ts` (et `es.ts` si besoin), par exemple :
   ```ts
   // fr.ts
   'dashboard.title': 'Tableau de bord',
   'dashboard.welcome': 'Bienvenue, {{name}}',
   // en.ts
   'dashboard.title': 'Dashboard',
   'dashboard.welcome': 'Welcome, {{name}}',
   ```
2. **Dans le composant** :
   ```tsx
   import { useT } from '@/i18n/GuestLocaleProvider';

   const MyPage = () => {
     const t = useT();
     return (
       <h1>{t('dashboard.title')}</h1>
       <p>{t('dashboard.welcome', { name: user?.name ?? '' })}</p>
     );
   };
   ```
3. **Variables** : utiliser `{{variableName}}` dans la chaîne et passer `{ variableName: value }` en second argument de `t()`.

### 3.4 Format des dates selon la langue

- Utiliser la locale pour l’affichage des dates :
  ```ts
  const { locale } = useGuestLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : 'fr-FR';
  const formatted = new Date(date).toLocaleDateString(dateLocale, { ... });
  ```

---

## 4. Fichiers clés

| Rôle | Fichier |
|------|--------|
| Détection / traduction | `src/i18n/index.ts` |
| Provider + hooks | `src/i18n/GuestLocaleProvider.tsx` |
| Dictionnaires | `src/i18n/fr.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` |
| Sélecteur de langue | `src/components/guest/LanguageSwitcher.tsx` |
| Contenu du contrat (UI) | `src/components/WelcomingContractSignature.tsx` |
| Appel PDF + locale | `src/services/contractService.ts` (`getContractPdfUrl`) |

---

## 5. Évolutions possibles

- **Edge function** : implémenter la génération du PDF du contrat en plusieurs langues en s’appuyant sur `body.locale`.
- **Pages restantes** : remplacer progressivement les textes en dur par des appels à `t(...)` dans le Dashboard, les modales, les emails, etc.
- **Espagnol** : compléter `es.ts` (notamment les clés `contract.body.*`) pour un contrat et une UI entièrement en espagnol.
