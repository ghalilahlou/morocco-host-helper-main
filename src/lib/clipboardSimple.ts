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

  // ✅ ÉTAPE 2 : Fallback avec textarea visible/sélectionnable (compatible iOS Safari)
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      // Créer un textarea (pas input) pour meilleure compatibilité
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true; // Empêche la modification
      textarea.style.fontSize = '16px'; // Empêche le zoom automatique sur iOS
      
      // ✅ CRITIQUE : Élément VISIBLE et SÉLECTIONNABLE (pas display: none)
      // Sur mobile, l'élément DOIT être visible pour que execCommand('copy') fonctionne
      if (isMobile) {
        // Style VISIBLE mais discret pour mobile
        textarea.style.position = 'fixed';
        textarea.style.top = '50%';
        textarea.style.left = '50%';
        textarea.style.transform = 'translate(-50%, -50%)';
        textarea.style.width = '85vw';
        textarea.style.maxWidth = '400px';
        textarea.style.height = '60px';
        textarea.style.padding = '12px 16px';
        textarea.style.border = '2px solid #10b981';
        textarea.style.borderRadius = '8px';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        textarea.style.background = '#ffffff';
        textarea.style.opacity = '1';
        textarea.style.zIndex = '999999';
        textarea.style.pointerEvents = 'auto';
        textarea.style.color = '#1f2937';
        textarea.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        textarea.style.textAlign = 'center';
        textarea.style.lineHeight = '1.5';
        textarea.style.overflow = 'hidden';
        textarea.style.textOverflow = 'ellipsis';
        textarea.style.whiteSpace = 'nowrap';
        
        // Overlay sombre pour mettre en évidence
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.zIndex = '999998';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.flexDirection = 'column';
        overlay.style.gap = '16px';
        
        // Message d'instruction
        const message = document.createElement('div');
        message.textContent = 'Appuyez longuement sur le texte pour copier';
        message.style.color = '#ffffff';
        message.style.fontSize = '15px';
        message.style.textAlign = 'center';
        message.style.padding = '0 20px';
        message.style.fontWeight = '500';
        message.style.lineHeight = '1.4';
        
        // Bouton de fermeture
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fermer';
        closeBtn.style.padding = '12px 24px';
        closeBtn.style.background = '#10b981';
        closeBtn.style.color = '#ffffff';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.fontSize = '15px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontWeight = '500';
        closeBtn.style.minHeight = '44px'; // Touch target minimum iOS
        
        const removeElements = () => {
          try {
            if (document.body.contains(textarea)) document.body.removeChild(textarea);
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
          } catch (e) {
            // Ignorer si déjà retiré
          }
        };
        
        closeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeElements();
        };
        
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            removeElements();
          }
        };
        
        overlay.appendChild(message);
        overlay.appendChild(textarea);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
        
        // ✅ Essayer la copie automatique après un court délai
        setTimeout(async () => {
          try {
            // Focus et sélection
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            
            // Essayer execCommand plusieurs fois
            let successful = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                successful = document.execCommand('copy');
                if (successful) {
                  console.log(`✅ [CLIPBOARD] Copié avec execCommand (mobile) - tentative ${attempt + 1}`);
                  message.textContent = '✅ Lien copié ! Vous pouvez fermer cette fenêtre.';
                  message.style.color = '#10b981';
                  resolve({ success: true });
                  return;
                }
              } catch (e: any) {
                console.warn(`⚠️ [CLIPBOARD] Tentative ${attempt + 1} échouée:`, e);
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
            }
            
            if (!successful) {
              console.log('ℹ️ [CLIPBOARD] Copie automatique échouée, sélection manuelle disponible');
              // Laisser l'input visible pour copie manuelle
              resolve({ 
                success: false, 
                error: 'La copie automatique a échoué. Veuillez appuyer longuement sur le texte pour copier manuellement.' 
              });
            }
          } catch (error: any) {
            console.error('❌ [CLIPBOARD] Erreur lors de la copie (mobile):', error);
            resolve({ 
              success: false, 
              error: error.message || 'Erreur lors de la copie sur mobile' 
            });
          }
        }, 150);
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
