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

  // ✅ ÉTAPE 2 : Fallback avec input visible et interactif pour mobile
  return new Promise<boolean>((resolve) => {
    try {
      // Créer un input temporaire VISIBLE pour mobile
      const input = document.createElement('input');
      input.value = text;
      input.readOnly = false; // Permettre la sélection manuelle
      input.style.fontSize = '16px'; // Empêche le zoom automatique sur iOS
      
      // Style pour mobile : VISIBLE au centre de l'écran
      input.style.position = 'fixed';
      input.style.top = '50%';
      input.style.left = '50%';
      input.style.transform = 'translate(-50%, -50%)';
      input.style.width = '85vw';
      input.style.maxWidth = '500px';
      input.style.padding = '16px';
      input.style.border = '2px solid #0891b2';
      input.style.borderRadius = '12px';
      input.style.background = 'white';
      input.style.color = '#1f2937';
      input.style.fontSize = '16px';
      input.style.zIndex = '999999';
      input.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      input.style.outline = 'none';
      
      // Créer un overlay sombre
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.background = 'rgba(0,0,0,0.7)';
      overlay.style.zIndex = '999998';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.flexDirection = 'column';
      overlay.style.gap = '16px';
      
      // Message d'instruction
      const message = document.createElement('div');
      message.textContent = 'Le lien est sélectionné. Appuyez longuement pour copier, ou utilisez le bouton ci-dessous.';
      message.style.color = 'white';
      message.style.fontSize = '14px';
      message.style.textAlign = 'center';
      message.style.padding = '0 20px';
      message.style.maxWidth = '90vw';
      
      // Bouton de copie
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋 Copier le lien';
      copyBtn.style.padding = '12px 24px';
      copyBtn.style.background = '#0891b2';
      copyBtn.style.color = 'white';
      copyBtn.style.border = 'none';
      copyBtn.style.borderRadius = '8px';
      copyBtn.style.fontSize = '16px';
      copyBtn.style.cursor = 'pointer';
      copyBtn.style.fontWeight = '600';
      copyBtn.style.marginTop = '8px';
      
      // Bouton de fermeture
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Fermer';
      closeBtn.style.padding = '10px 20px';
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = 'white';
      closeBtn.style.border = '1px solid white';
      closeBtn.style.borderRadius = '6px';
      closeBtn.style.fontSize = '14px';
      closeBtn.style.cursor = 'pointer';
      
      const removeElements = () => {
        try {
          if (document.body.contains(input)) document.body.removeChild(input);
          if (document.body.contains(overlay)) document.body.removeChild(overlay);
        } catch (e) {
          // Ignorer si déjà retiré
        }
      };
      
      // Gestionnaire de copie sur le bouton
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          // Essayer navigator.clipboard d'abord
          if (navigator.clipboard && window.isSecureContext) {
            try {
              await navigator.clipboard.writeText(text);
              message.textContent = '✅ Lien copié avec succès !';
              message.style.color = '#10b981';
              setTimeout(removeElements, 1500);
              resolve(true);
              return;
            } catch (clipError) {
              console.warn('Clipboard API échoué sur bouton:', clipError);
            }
          }
          
          // Fallback avec execCommand
          input.focus();
          input.select();
          input.setSelectionRange(0, text.length);
          const success = document.execCommand('copy');
          if (success) {
            message.textContent = '✅ Lien copié avec succès !';
            message.style.color = '#10b981';
            setTimeout(removeElements, 1500);
            resolve(true);
          } else {
            message.textContent = 'Sélectionnez le texte et copiez manuellement (Ctrl+C / Cmd+C)';
            message.style.color = '#fbbf24';
          }
        } catch (err) {
          console.error('Erreur copie:', err);
          message.textContent = 'Sélectionnez le texte et copiez manuellement';
          message.style.color = '#fbbf24';
        }
      };
      
      closeBtn.onclick = removeElements;
      overlay.onclick = (e) => {
        if (e.target === overlay) removeElements();
      };
      
      // Assembler l'overlay
      overlay.appendChild(message);
      overlay.appendChild(input);
      overlay.appendChild(copyBtn);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);
      
      // Focus et sélection automatique
      setTimeout(() => {
        input.focus();
        input.select();
        input.setSelectionRange(0, text.length);
        
        // Essayer la copie automatique en arrière-plan
        setTimeout(async () => {
          try {
            if (navigator.clipboard && window.isSecureContext) {
              try {
                await navigator.clipboard.writeText(text);
                message.textContent = '✅ Lien copié automatiquement !';
                message.style.color = '#10b981';
                setTimeout(removeElements, 2000);
                resolve(true);
                return;
              } catch (autoError) {
                console.log('Copie auto échouée, attente action utilisateur');
              }
            }
            
            // Essayer execCommand
            const success = document.execCommand('copy');
            if (success) {
              message.textContent = '✅ Lien copié automatiquement !';
              message.style.color = '#10b981';
              setTimeout(removeElements, 2000);
              resolve(true);
            }
          } catch (err) {
            // Laisser l'utilisateur copier manuellement
            console.log('Copie auto échouée, mode manuel activé');
          }
        }, 300);
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lors de la configuration du fallback mobile:', error);
      resolve(false);
    }
  });
};




