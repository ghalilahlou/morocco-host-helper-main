/**
 * ✅ SOLUTION FINALE UNIFIÉE : Copie de texte dans le presse-papiers
 * Fonctionne sur iOS, Android et Desktop - SANS MODAL VISIBLE
 * Copie directe et fluide dans le presse-papiers
 */

/**
 * Détecte si on est sur un appareil mobile
 */
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Détecte si on est sur iOS
 */
const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * ✅ SOLUTION FINALE : Copie directe dans le presse-papiers
 * Cette fonction DOIT être appelée directement dans un gestionnaire d'événement utilisateur
 * 
 * @param text - Le texte à copier
 * @param event - L'événement utilisateur (CRITIQUE pour iOS)
 * @returns Promise<boolean> - true si la copie a réussi
 */
export const copyToClipboardSimple = async (
  text: string,
  event?: Event | React.SyntheticEvent
): Promise<boolean> => {
  if (!text || text.trim() === '') {
    console.warn('⚠️ [CLIPBOARD] Texte vide');
    return false;
  }

  // ✅ ÉTAPE 1 : Essayer navigator.clipboard (recommandé pour tous les navigateurs modernes)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      // ✅ CRITIQUE pour iOS : La copie DOIT être dans le contexte de l'événement utilisateur
      // Si on a un événement, l'utiliser directement
      if (event) {
        // Extraire l'événement natif si c'est un SyntheticEvent React
        const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
        
        // Pour iOS, s'assurer que c'est un événement fiable
        if (isIOS() && nativeEvent && 'isTrusted' in nativeEvent && nativeEvent.isTrusted) {
          // Copie synchrone dans le contexte de l'événement (iOS)
          await navigator.clipboard.writeText(text);
          console.log('✅ [CLIPBOARD] Copié avec Clipboard API (iOS avec événement)');
          return true;
        }
      }
      
      // Pour Android et autres navigateurs, copie directe
      await navigator.clipboard.writeText(text);
      console.log('✅ [CLIPBOARD] Copié avec Clipboard API');
      return true;
    } catch (error) {
      console.warn('⚠️ [CLIPBOARD] Clipboard API échoué, passage au fallback:', error);
      // Continue vers le fallback
    }
  }

  // ✅ ÉTAPE 2 : Fallback avec input invisible (pour navigateurs non-HTTPS ou anciens)
  return new Promise<boolean>((resolve) => {
    try {
      const input = document.createElement('input');
      input.value = text;
      input.readOnly = true;
      input.style.fontSize = '16px'; // Empêche le zoom sur iOS
      
      // Style INVISIBLE mais présent dans le DOM
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.style.width = '2px';
      input.style.height = '2px';
      input.style.padding = '0';
      input.style.border = 'none';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      input.style.zIndex = '-1';
      input.style.outline = 'none';
      
      document.body.appendChild(input);
      
      // Focus et sélection
      input.focus();
      input.select();
      input.setSelectionRange(0, text.length);
      
      // Essayer execCommand
      setTimeout(() => {
        try {
          const success = document.execCommand('copy');
          document.body.removeChild(input);
          
          if (success) {
            console.log('✅ [CLIPBOARD] Copié avec execCommand (fallback)');
            resolve(true);
          } else {
            console.warn('❌ [CLIPBOARD] execCommand a échoué');
            resolve(false);
          }
        } catch (error) {
          try {
            document.body.removeChild(input);
          } catch (e) {
            // Ignorer si déjà retiré
          }
          console.error('❌ [CLIPBOARD] Erreur execCommand:', error);
          resolve(false);
        }
      }, 10);
    } catch (error) {
      console.error('❌ [CLIPBOARD] Erreur lors de la configuration du fallback:', error);
      resolve(false);
    }
  });
};

