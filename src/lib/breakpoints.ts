/**
 * Source unique de vérité pour les breakpoints responsives.
 *
 * ⚠️ Ces valeurs DOIVENT rester alignées avec :
 *  - les breakpoints Tailwind (`md` = 768px) dans tailwind.config.ts
 *  - les media queries de src/styles/mobile.css
 *
 * Toute détection « mobile » en JS doit importer ces constantes plutôt que
 * de coder un seuil en dur (cf. refonte mobile — REFONTE_MOBILE_FRONTEND.md).
 */
export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

/** Media query (sans le préfixe `@media`) pour le mode mobile. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Détection synchrone du mode mobile, sûre côté SSR / premier rendu.
 * Utilise `matchMedia` (aligné sur les media queries CSS) plutôt que
 * `window.innerWidth` (qui inclut/exclut la scrollbar selon le navigateur).
 */
export function getIsMobile(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}
