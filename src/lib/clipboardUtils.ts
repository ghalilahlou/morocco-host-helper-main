/**
 * Utility functions for clipboard operations with mobile device support
 */

export const copyToClipboard = async (text: string): Promise<boolean> => {
  // First, try the modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
    }
  }

  // Fallback method for mobile devices and older browsers
  return new Promise((resolve) => {
    try {
      // Create a textarea element with improved mobile compatibility
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // Style the textarea to be visible but minimal for mobile compatibility
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
      textArea.style.fontSize = '16px'; // Prevents zoom on iOS

      // Make it accessible for mobile
      textArea.setAttribute('readonly', '');
      textArea.readOnly = false;

      document.body.appendChild(textArea);

      // For mobile devices, we need to trigger user interaction
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Focus first
        textArea.focus();
        textArea.setSelectionRange(0, text.length);

        // Small delay to ensure mobile keyboard doesn't interfere
        setTimeout(() => {
          try {
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            resolve(successful);
          } catch (error) {
            document.body.removeChild(textArea);
            console.error('Mobile clipboard copy failed:', error);
            resolve(false);
          }
        }, 100);
      } else {
        // Desktop fallback
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          resolve(successful);
        } catch (error) {
          document.body.removeChild(textArea);
          console.error('Desktop clipboard copy failed:', error);
          resolve(false);
        }
      }
    } catch (error) {
      console.error('Clipboard fallback setup failed:', error);
      resolve(false);
    }
  });
};
