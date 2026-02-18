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

  // ✅ ÉTAPE 2 : Fallback avec textarea (élément focusable pour iOS/Android)
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      // Créer un textarea pour compatibilité mobile (iOS exige élément focusable/sélectionnable)
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // iOS : readOnly=false requis pour que execCommand('copy') fonctionne
      textarea.readOnly = !isMobile;
      textarea.setAttribute('aria-hidden', 'true');
      textarea.style.fontSize = '16px'; // Empêche le zoom automatique sur iOS
      
      if (isMobile) {
        // ✅ MOBILE : Élément dans le viewport mais quasi invisible (iOS ne copie que si focusable)
        // position fixed + dans la page + opacity très faible = focusable sur iOS/Android
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2px';
        textarea.style.height = '2px';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.opacity = '0.01';
        textarea.style.pointerEvents = 'none';
        textarea.style.zIndex = '9999';
        textarea.style.outline = 'none';
        textarea.style.overflow = 'hidden';
        
        document.body.appendChild(textarea);
        
        const doCopy = () => {
          try {
            textarea.focus();
            textarea.setSelectionRange(0, text.length);
            textarea.select();
            
            let successful = document.execCommand('copy');
            
            // iOS fallback : utiliser l'API Selection si execCommand échoue
            if (!successful && isIOSDevice && window.getSelection) {
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                const range = document.createRange();
                range.selectNodeContents(textarea);
                sel.addRange(range);
                successful = document.execCommand('copy');
                sel.removeAllRanges();
              }
            }
            
            try { document.body.removeChild(textarea); } catch (e) {}
            
            if (successful) {
              console.log('✅ [CLIPBOARD] Copié avec execCommand (mobile)');
              resolve({ success: true });
            } else {
              console.log('ℹ️ [CLIPBOARD] Copie automatique échouée sur mobile');
              resolve({
                success: false,
                error: 'Le lien a été généré. Appuyez longuement sur le lien ci-dessous pour le copier, ou utilisez "Partager".'
              });
            }
          } catch (error: any) {
            try { document.body.removeChild(textarea); } catch (e) {}
            console.error('❌ [CLIPBOARD] Erreur lors de la copie (mobile):', error);
            resolve({
              success: false,
              error: 'Le lien a été généré. Appuyez longuement sur le lien pour le copier, ou utilisez "Partager".'
            });
          }
        };
        
        // Délai minimal pour laisser le DOM attacher l’élément (iOS)
        const delay = isIOSDevice ? 50 : 10;
        setTimeout(doCopy, delay);
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
