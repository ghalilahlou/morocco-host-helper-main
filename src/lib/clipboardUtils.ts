/**
 * Utility functions for clipboard operations with robust HTTP/local support
 * Compatible with localhost, local IP addresses, and HTTPS
 */

/**
 * Copies text to clipboard with robust fallback for HTTP/local contexts
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if copy succeeded, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  console.log('📋 copyToClipboard appelé', { 
    textLength: text.length, 
    isSecureContext: window.isSecureContext, 
    hasClipboard: !!navigator.clipboard,
    url: window.location.href
  });
  
  // ✅ ÉTAPE 1 : Essayer l'API Clipboard moderne (si disponible)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      console.log('📋 Tentative avec Clipboard API...');
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
      
      // Style pour être invisible mais présent dans le DOM
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
      textArea.style.opacity = '0.01'; // Presque invisible mais présent
      textArea.style.fontSize = '16px'; // Empêche le zoom sur iOS
      textArea.style.zIndex = '999999';
      textArea.style.pointerEvents = 'none';
      
      // Attributs pour compatibilité mobile
      textArea.setAttribute('readonly', '');
      textArea.readOnly = false; // Nécessaire pour certains navigateurs
      
      // Ajouter au DOM
      document.body.appendChild(textArea);
      
      // Détecter si mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // ✅ MOBILE : Focus et sélection avec délai
        textArea.focus();
        textArea.setSelectionRange(0, text.length);
        
        setTimeout(async () => {
          try {
            textArea.select();
            textArea.setSelectionRange(0, text.length);
            
            // Essayer plusieurs fois pour mobile
            let successful = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                successful = document.execCommand('copy');
                if (successful) {
                  console.log(`✅ Copié (mobile) - tentative ${attempt + 1}`);
                  break;
                }
              } catch (e) {
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
            }
            
            document.body.removeChild(textArea);
            if (successful) {
              console.log('✅ Copié avec succès (mobile)');
            } else {
              console.error('❌ Échec de la copie (mobile)');
            }
            resolve(successful);
          } catch (error) {
            document.body.removeChild(textArea);
            console.error('❌ Erreur lors de la copie (mobile):', error);
            resolve(false);
          }
        }, 100);
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
