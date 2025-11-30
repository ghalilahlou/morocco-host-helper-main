/**
 * ✅ SOLUTION FINALE UNIFIÉE : Copie de texte dans le presse-papiers
 * Fonctionne sur iOS, Android et Desktop - SANS MODAL VISIBLE
 * Copie directe et fluide dans le presse-papiers
 */

import { copyToClipboardSimple } from './clipboardSimple';

/**
 * ✅ DÉPRÉCIÉ : Utiliser copyToClipboardSimple directement
 * Cette fonction est maintenue pour compatibilité mais redirige vers copyToClipboardSimple
 * 
 * @param text - Le texte à copier
 * @param event - L'événement utilisateur (CRITIQUE pour iOS)
 * @returns Promise<boolean> - true si la copie a réussi
 */
export const copyToClipboard = async (
  text: string,
  event?: Event | React.SyntheticEvent
): Promise<boolean> => {
  // ✅ REDIRECTION : Utiliser la fonction unifiée simple
  return copyToClipboardSimple(text, event);
};

/**
 * Vérifie si le clipboard est disponible
 * @returns boolean - true si clipboard API est disponible
 */
export const isClipboardAvailable = (): boolean => {
  return !!(navigator.clipboard && window.isSecureContext);
};

/**
 * Vérifie si on est dans un contexte sécurisé
 * @returns boolean - true si isSecureContext
 */
export const isSecureContext = (): boolean => {
  return window.isSecureContext;
};
