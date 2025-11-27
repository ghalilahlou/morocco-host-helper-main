/**
 * ✅ MOBILE-OPTIMIZED : Fonction de copie optimisée pour iOS et Android
 * Utilise directement navigator.clipboard dans le gestionnaire d'événement utilisateur
 */

/**
 * Détecte si on est sur un appareil mobile iOS ou Android
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Détecte si on est sur iOS
 */
export const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Détecte si on est sur Android
 */
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * ✅ MOBILE-OPTIMIZED : Copie directe dans le presse-papiers pour mobile
 * Cette fonction DOIT être appelée directement dans un gestionnaire d'événement utilisateur
 * (pas dans un setTimeout ou une promesse async qui se résout plus tard)
 * 
 * @param text - Le texte à copier
 * @param event - L'événement utilisateur (optionnel, pour iOS)
 * @returns Promise<boolean> - true si la copie a réussi
 */
export const copyToClipboardMobile = async (
  text: string,
  event?: Event | React.SyntheticEvent
): Promise<boolean> => {
  // ✅ ÉTAPE 1 : Essayer navigator.clipboard directement (fonctionne sur iOS/Android en HTTPS)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      // ✅ CRITIQUE : Pour iOS, s'assurer que c'est appelé dans le contexte de l'événement utilisateur
      if (isIOS() && event) {
        // Sur iOS, la copie doit être synchrone avec l'événement utilisateur
        // Utiliser l'événement natif si disponible
        const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
        if (nativeEvent && nativeEvent.isTrusted) {
          // L'événement est fiable, on peut copier directement
          await navigator.clipboard.writeText(text);
          console.log('✅ Copié avec Clipboard API (iOS)');
          return true;
        }
      }
      
      // Pour Android et autres navigateurs, copie directe
      await navigator.clipboard.writeText(text);
      console.log('✅ Copié avec Clipboard API (mobile)');
      return true;
    } catch (error) {
      console.warn('❌ Clipboard API failed sur mobile, trying fallback:', error);
      // Continue vers le fallback
    }
  }

  // ✅ ÉTAPE 2 : Fallback avec input visible pour mobile
  return new Promise<boolean>((resolve) => {
    try {
      // Créer un input temporaire
      const input = document.createElement('input');
      input.value = text;
      input.readOnly = true;
      
      // Style pour mobile : visible mais discret
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.style.width = '1px';
      input.style.height = '1px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      input.style.fontSize = '16px'; // Empêche le zoom sur iOS
      
      // Ajouter au DOM
      document.body.appendChild(input);
      
      // Focus et sélection
      input.focus();
      input.select();
      input.setSelectionRange(0, text.length);
      
      // Essayer execCommand (fonctionne encore sur certains navigateurs mobiles)
      setTimeout(() => {
        try {
          const success = document.execCommand('copy');
          document.body.removeChild(input);
          
          if (success) {
            console.log('✅ Copié avec execCommand (mobile fallback)');
            resolve(true);
          } else {
            console.warn('❌ execCommand a échoué sur mobile');
            resolve(false);
          }
        } catch (error) {
          try {
            document.body.removeChild(input);
          } catch (e) {
            // Ignorer si déjà retiré
          }
          console.error('❌ Erreur execCommand sur mobile:', error);
          resolve(false);
        }
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lors de la configuration du fallback mobile:', error);
      resolve(false);
    }
  });
};




