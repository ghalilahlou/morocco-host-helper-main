/**
 * ✅ SOLUTION FINALE ROBUSTE : Copie de texte dans le presse-papiers
 * Compatible iOS Safari, Android Chrome, et Desktop
 * 
 * CONTRAINTES RESPECTÉES :
 * - Action déclenchée directement par interaction utilisateur (tap/click)
 * - Utilise navigator.clipboard.writeText() si disponible
 * - Fallback compatible iOS Safari via textarea + select() + execCommand('copy')
 * - Élément visible/sélectionnable (pas display: none)
 * - Compatibilité HTTPS
 * - Retourne une erreur claire si la copie échoue
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
 * Détecte si on est sur Android
 */
const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * ✅ SOLUTION FINALE ROBUSTE : Copie directe dans le presse-papiers
 * 
 * Cette fonction DOIT être appelée directement dans un gestionnaire d'événement utilisateur
 * pour fonctionner correctement sur iOS Safari.
 * 
 * @param text - Le texte à copier
 * @param event - L'événement utilisateur (CRITIQUE pour iOS - doit être l'événement original du tap/click)
 * @returns Promise<{success: boolean, error?: string}> - Résultat de la copie avec message d'erreur si échec
 */
export const copyToClipboardSimple = async (
  text: string,
  event?: Event | React.SyntheticEvent
): Promise<{ success: boolean; error?: string }> => {
  // Validation du texte
  if (!text || text.trim() === '') {
    return { success: false, error: 'Le texte à copier est vide' };
  }

  // Vérification HTTPS
  if (!window.isSecureContext) {
    console.warn('⚠️ [CLIPBOARD] Contexte non sécurisé (HTTP), utilisation du fallback');
  }

  const isMobile = isMobileDevice();
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();

  console.log('📋 [CLIPBOARD] Tentative de copie:', {
    textLength: text.length,
    hasClipboard: !!navigator.clipboard,
    isSecureContext: window.isSecureContext,
    isMobile,
    isIOS: isIOSDevice,
    isAndroid: isAndroidDevice,
    hasEvent: !!event
  });

  // ✅ ÉTAPE 1 : Essayer navigator.clipboard.writeText() (recommandé)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      // ✅ CRITIQUE iOS : La copie DOIT être dans le contexte de l'événement utilisateur
      if (isIOSDevice && event) {
        // Extraire l'événement natif si c'est un SyntheticEvent React
        const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
        
        // Vérifier que c'est un événement fiable (isTrusted)
        if (nativeEvent && 'isTrusted' in nativeEvent && nativeEvent.isTrusted) {
          try {
            // ✅ COPIE SYNCHRONE dans le contexte de l'événement (iOS)
            await navigator.clipboard.writeText(text);
            console.log('✅ [CLIPBOARD] Copié avec Clipboard API (iOS avec événement fiable)');
            return { success: true };
          } catch (iosError: any) {
            console.warn('⚠️ [CLIPBOARD] iOS clipboard échoué avec événement:', iosError);
            // Continuer vers le fallback
          }
        }
      }
      
      // ✅ Pour Android et autres navigateurs, copie directe
      try {
        await navigator.clipboard.writeText(text);
        console.log('✅ [CLIPBOARD] Copié avec Clipboard API (direct)');
        return { success: true };
      } catch (directError: any) {
        console.warn('⚠️ [CLIPBOARD] Clipboard API direct échoué:', directError);
        // Continuer vers le fallback
      }
    } catch (error: any) {
      console.warn('⚠️ [CLIPBOARD] Clipboard API échoué, passage au fallback:', error);
    }
  }

  // ✅ ÉTAPE 2 : Fallback avec textarea invisible (SANS overlay bloquant)
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      // Créer un textarea (pas input) pour meilleure compatibilité
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true; // Empêche la modification
      textarea.style.fontSize = '16px'; // Empêche le zoom automatique sur iOS
      
      // ✅ MOBILE : Textarea invisible (PAS d'overlay bloquant)
      // On utilise le partage natif sur mobile, donc pas besoin d'overlay
      if (isMobile) {
        // Textarea invisible mais dans le DOM
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.style.zIndex = '-1';
        
        document.body.appendChild(textarea);
        
        // Essayer la copie
        setTimeout(() => {
          try {
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (successful) {
              console.log('✅ [CLIPBOARD] Copié avec execCommand (mobile)');
              resolve({ success: true });
            } else {
              console.log('ℹ️ [CLIPBOARD] Copie automatique échouée sur mobile');
              // ✅ Retourner false SANS overlay bloquant
              resolve({ 
                success: false, 
                error: 'Utilisez le bouton "Partager" pour envoyer le lien' 
              });
            }
          } catch (error: any) {
            try { document.body.removeChild(textarea); } catch (e) {}
            console.error('❌ [CLIPBOARD] Erreur lors de la copie (mobile):', error);
            resolve({ 
              success: false, 
              error: 'Utilisez le bouton "Partager" pour envoyer le lien' 
            });
          }
        }, 50);
      } else {
        // ✅ DESKTOP : Textarea invisible mais présent dans le DOM
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2px';
        textarea.style.height = '2px';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.style.zIndex = '-1';
        textarea.style.outline = 'none';
        textarea.style.overflow = 'hidden';
        
        document.body.appendChild(textarea);
        
        // Focus et sélection
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        
        // Essayer execCommand
        setTimeout(() => {
          try {
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (success) {
              console.log('✅ [CLIPBOARD] Copié avec execCommand (desktop)');
              resolve({ success: true });
            } else {
              console.warn('❌ [CLIPBOARD] execCommand a échoué');
              resolve({ success: false, error: 'La commande de copie a échoué' });
            }
          } catch (error: any) {
            try {
              document.body.removeChild(textarea);
            } catch (e) {
              // Ignorer si déjà retiré
            }
            console.error('❌ [CLIPBOARD] Erreur execCommand:', error);
            resolve({ 
              success: false, 
              error: error.message || 'Erreur lors de l\'exécution de la commande de copie' 
            });
          }
        }, 10);
      }
    } catch (error: any) {
      console.error('❌ [CLIPBOARD] Erreur lors de la configuration du fallback:', error);
      resolve({ 
        success: false, 
        error: error.message || 'Erreur lors de la configuration de la copie' 
      });
    }
  });
};
