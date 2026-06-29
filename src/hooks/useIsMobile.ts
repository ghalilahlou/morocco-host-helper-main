/**
 * @deprecated Utiliser `useIsMobile` depuis '@/hooks/use-mobile'.
 *
 * Ce fichier historique exposait une détection mobile dupliquée et divergente
 * (init à `false` + window.innerWidth). Il est désormais un simple alias du hook
 * canonique basé sur matchMedia, pour ne pas casser les imports existants.
 * Voir REFONTE_MOBILE_FRONTEND.md §1.1.
 *
 * Note : l'ancien hook acceptait un paramètre `breakpoint`. Il est ignoré ;
 * le seuil unique est MOBILE_BREAKPOINT (768px).
 */
import { useIsMobile as useIsMobileCanonical } from '@/hooks/use-mobile';

export const useIsMobile = (_breakpoint?: number): boolean => useIsMobileCanonical();
