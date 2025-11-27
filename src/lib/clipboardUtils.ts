/**
 * Utility functions for clipboard operations with robust HTTP/local support
 * Compatible with localhost, local IP addresses, and HTTPS
 * ✅ MOBILE-OPTIMIZED : Optimisé pour iOS et Android
 */

import { isMobileDevice, copyToClipboardMobile } from './mobileClipboard';

/**
 * Copies text to clipboard with robust fallback for HTTP/local contexts
 * ✅ MOBILE-OPTIMIZED : Utilise la fonction optimisée pour mobile
 * @param text - The text to copy to clipboard
 * @param event - L'événement utilisateur (optionnel, recommandé pour mobile)
 * @returns Promise<boolean> - true if copy succeeded, false otherwise
 */
export const copyToClipboard = async (
  text: string,
  event?: Event | React.SyntheticEvent
): Promise<boolean> => {
  console.log('📋 copyToClipboard appelé', { 
    textLength: text.length, 
    isSecureContext: window.isSecureContext, 
    hasClipboard: !!navigator.clipboard,
    isMobile: isMobileDevice(),
    url: window.location.href
  });
  
  // ✅ MOBILE-FIRST : Sur mobile, utiliser la fonction optimisée
  if (isMobileDevice()) {
    return copyToClipboardMobile(text, event);
  }
  
  // ✅ ÉTAPE 1 : Essayer l'API Clipboard moderne (si disponible) - Desktop
  if (navigator.clipboard && window.isSecureContext) {
    try {
      console.log('📋 Tentative avec Clipboard API (desktop)...');
      await navigator.clipboard.writeText(text);
      console.log('✅ Copié avec Clipboard API');
      return true;
    } catch (error) {
      console.warn('❌ Clipboard API failed, trying fallback:', error);
      // Continue vers le fallback
    }
  } else {
    console.log('⚠️ Clipboard API non disponible, utilisation du fallback', { 
      hasClipboard: !!navigator.clipboard, 
      isSecureContext: window.isSecureContext 
    });
  }

  // ✅ ÉTAPE 2 : Fallback avec textarea (fonctionne en HTTP/local)
  return new Promise<boolean>((resolve) => {
    try {
      // Créer un textarea temporaire
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // ✅ MOBILE-FRIENDLY : Style pour mobile (visible et sélectionnable)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Sur mobile, rendre le textarea visible et sélectionnable
        textArea.style.position = 'fixed';
        textArea.style.top = '50%';
        textArea.style.left = '50%';
        textArea.style.transform = 'translate(-50%, -50%)';
        textArea.style.width = '90vw';
        textArea.style.maxWidth = '500px';
        textArea.style.height = '60px';
        textArea.style.padding = '12px';
        textArea.style.border = '2px solid #10b981';
        textArea.style.borderRadius = '8px';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        textArea.style.background = 'white';
        textArea.style.opacity = '1';
        textArea.style.fontSize = '14px';
        textArea.style.zIndex = '999999';
        textArea.style.pointerEvents = 'auto';
        textArea.style.color = '#1f2937';
        textArea.style.fontFamily = 'system-ui, sans-serif';
      } else {
        // Desktop : invisible mais présent
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0.01';
        textArea.style.fontSize = '16px';
        textArea.style.zIndex = '999999';
        textArea.style.pointerEvents = 'none';
      }
      
      // Attributs pour compatibilité mobile
      if (!isMobile) {
        textArea.setAttribute('readonly', '');
        textArea.readOnly = false; // Nécessaire pour certains navigateurs
      } else {
        // Sur mobile, permettre la sélection manuelle
        textArea.readOnly = false;
        textArea.setAttribute('readonly', '');
      }
      
      // Ajouter au DOM
      document.body.appendChild(textArea);
      
      if (isMobile) {
        // ✅ MOBILE : Afficher le textarea et permettre la sélection manuelle
        textArea.focus();
        textArea.setSelectionRange(0, text.length);
        
        // Ajouter un overlay pour fermer après copie
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '999998';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.flexDirection = 'column';
        overlay.style.gap = '16px';
        
        const message = document.createElement('div');
        message.textContent = 'Appuyez longuement sur le texte pour copier';
        message.style.color = 'white';
        message.style.fontSize = '14px';
        message.style.textAlign = 'center';
        message.style.padding = '0 20px';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fermer';
        closeBtn.style.padding = '10px 20px';
        closeBtn.style.background = '#10b981';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.fontSize = '14px';
        closeBtn.style.cursor = 'pointer';
        
        const removeElements = () => {
          try {
            document.body.removeChild(textArea);
            document.body.removeChild(overlay);
          } catch (e) {
            // Ignorer si déjà retiré
          }
        };
        
        closeBtn.onclick = removeElements;
        overlay.onclick = (e) => {
          if (e.target === overlay) removeElements();
        };
        
        overlay.appendChild(message);
        overlay.appendChild(textArea);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
        
        // Essayer la copie automatique en arrière-plan
        setTimeout(async () => {
          try {
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, text.length);
            
            // Essayer plusieurs fois pour mobile
            let successful = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                successful = document.execCommand('copy');
                if (successful) {
                  console.log(`✅ Copié (mobile) - tentative ${attempt + 1}`);
                  message.textContent = '✅ Lien copié ! Vous pouvez fermer cette fenêtre.';
                  message.style.color = '#10b981';
                  break;
                }
              } catch (e) {
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
            }
            
            if (!successful) {
              console.log('ℹ️ Copie automatique échouée, sélection manuelle disponible');
            }
            
            // Ne pas retirer automatiquement - laisser l'utilisateur copier manuellement
            resolve(successful);
          } catch (error) {
            console.error('❌ Erreur lors de la copie (mobile):', error);
            resolve(false);
          }
        }, 300);
      } else {
        // ✅ DESKTOP : Méthode robuste pour HTTP/local
        (async () => {
          try {
            // Attendre que l'élément soit dans le DOM
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Focus et sélection - FORCER plusieurs fois
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, text.length);
            
            // Attendre que la sélection soit effective
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Vérifier la sélection
            const selectedText = textArea.value.substring(
              textArea.selectionStart || 0, 
              textArea.selectionEnd || 0
            );
            
            console.log('📋 Sélection vérifiée:', { 
              start: textArea.selectionStart, 
              end: textArea.selectionEnd, 
              length: selectedText.length,
              expectedLength: text.length,
              match: selectedText === text
            });
            
            // Si sélection invalide, réessayer
            if (selectedText.length === 0 || selectedText !== text) {
              console.warn('⚠️ Sélection invalide, nouvelle tentative...');
              textArea.focus();
              textArea.select();
              textArea.setSelectionRange(0, text.length);
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Essayer execCommand plusieurs fois
            let successful = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                // S'assurer que le textarea est toujours focus
                textArea.focus();
                
                const execResult = document.execCommand('copy');
                console.log(`📋 execCommand tentative ${attempt + 1}:`, execResult);
                
                if (execResult) {
                  successful = true;
                  console.log(`✅ Copié (desktop) - tentative ${attempt + 1}`);
                  
                  // Petite pause pour laisser le navigateur copier
                  await new Promise(resolve => setTimeout(resolve, 50));
                  
                  break;
                }
              } catch (e) {
                console.warn(`❌ Tentative ${attempt + 1} échouée:`, e);
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
            }
            
            // Retirer le textarea
            document.body.removeChild(textArea);
            
            if (successful) {
              console.log('✅ Copié avec succès (desktop)');
            } else {
              console.error('❌ Échec de la copie après 3 tentatives (desktop)');
            }
            
            resolve(successful);
          } catch (error) {
            try {
              document.body.removeChild(textArea);
            } catch (e) {
              // Ignorer si déjà retiré
            }
            console.error('❌ Erreur lors de la copie (desktop):', error);
            resolve(false);
          }
        })();
      }
    } catch (error) {
      console.error('❌ Erreur lors de la configuration du fallback:', error);
      resolve(false);
    }
  });
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
