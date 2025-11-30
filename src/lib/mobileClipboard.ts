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
  console.log('📱 [MOBILE CLIPBOARD] Tentative de copie:', {
    textLength: text.length,
    hasClipboard: !!navigator.clipboard,
    isSecureContext: window.isSecureContext,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    hasEvent: !!event
  });

  // ✅ ÉTAPE 1 : Essayer navigator.clipboard directement (fonctionne sur iOS/Android en HTTPS)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      // ✅ CRITIQUE : Pour iOS, s'assurer que c'est appelé dans le contexte de l'événement utilisateur
      if (isIOS()) {
        // Sur iOS, la copie DOIT être dans le contexte de l'événement utilisateur
        // Si on a un événement, l'utiliser directement
        if (event) {
          // Extraire l'événement natif si c'est un SyntheticEvent React
          const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
          
          // Essayer la copie immédiatement dans le contexte de l'événement
          try {
            await navigator.clipboard.writeText(text);
            console.log('✅ Copié avec Clipboard API (iOS avec événement)');
            return true;
          } catch (iosError) {
            console.warn('⚠️ iOS clipboard échoué avec événement, essai sans:', iosError);
            // Continuer vers le fallback
          }
        }
        
        // Si pas d'événement ou échec, essayer quand même (peut fonctionner)
        try {
          await navigator.clipboard.writeText(text);
          console.log('✅ Copié avec Clipboard API (iOS sans événement)');
          return true;
        } catch (iosError2) {
          console.warn('⚠️ iOS clipboard échoué, passage au fallback:', iosError2);
        }
      } else {
        // Pour Android et autres navigateurs, copie directe
        await navigator.clipboard.writeText(text);
        console.log('✅ Copié avec Clipboard API (mobile non-iOS)');
        return true;
      }
    } catch (error) {
      console.warn('❌ Clipboard API failed sur mobile, trying fallback:', error);
      // Continue vers le fallback
    }
  } else {
    console.log('⚠️ Clipboard API non disponible:', {
      hasClipboard: !!navigator.clipboard,
      isSecureContext: window.isSecureContext
    });
  }

  // ✅ ÉTAPE 2 : Fallback avec input invisible (pas de modal visible)
  return new Promise<boolean>((resolve) => {
    try {
      // Créer un input temporaire INVISIBLE pour mobile
      const input = document.createElement('input');
      input.value = text;
      input.readOnly = true;
      input.style.fontSize = '16px'; // Empêche le zoom automatique sur iOS
      
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
      
      document.body.appendChild(input);
      
      // Focus et sélection
      input.focus();
      input.select();
      input.setSelectionRange(0, text.length);
      
      // Essayer execCommand immédiatement
      setTimeout(() => {
        try {
          const success = document.execCommand('copy');
          document.body.removeChild(input);
          
          if (success) {
            console.log('✅ [MOBILE CLIPBOARD] Copié avec execCommand (fallback invisible)');
            resolve(true);
          } else {
            console.warn('❌ [MOBILE CLIPBOARD] execCommand a échoué');
            resolve(false);
          }
        } catch (error) {
          try {
            document.body.removeChild(input);
          } catch (e) {
            // Ignorer si déjà retiré
          }
          console.error('❌ [MOBILE CLIPBOARD] Erreur execCommand:', error);
          resolve(false);
        }
      }, 10);
    } catch (error) {
      console.error('❌ [MOBILE CLIPBOARD] Erreur lors de la configuration du fallback:', error);
      resolve(false);
    }
  });
};




