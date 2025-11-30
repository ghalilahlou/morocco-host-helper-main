import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook React moderne pour copier du texte dans le presse-papiers
 * Fonctionne de manière fluide sur mobile (iOS/Android) et desktop
 * Sans modal visible - copie directe et silencieuse
 */
export const useClipboard = () => {
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();

  const copy = useCallback(async (
    text: string,
    event?: React.SyntheticEvent | Event
  ): Promise<boolean> => {
    if (!text || text.trim() === '') {
      console.warn('⚠️ [CLIPBOARD] Texte vide, copie annulée');
      return false;
    }

    setIsCopying(true);

    try {
      // ✅ ÉTAPE 1 : Essayer l'API Clipboard moderne (recommandé)
      if (navigator.clipboard && window.isSecureContext) {
        try {
          // ✅ CRITIQUE pour iOS : La copie DOIT être dans le contexte de l'événement utilisateur
          // Si on a un événement, l'utiliser directement
          if (event) {
            // Extraire l'événement natif si c'est un SyntheticEvent React
            const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
            
            // Pour iOS, s'assurer que c'est un événement fiable
            if (nativeEvent && 'isTrusted' in nativeEvent && nativeEvent.isTrusted) {
              // Copie synchrone dans le contexte de l'événement
              await navigator.clipboard.writeText(text);
              console.log('✅ [CLIPBOARD] Copié avec Clipboard API (événement fiable)');
              setIsCopying(false);
              toast({
                title: "Lien copié !",
                description: "Le lien a été copié dans le presse-papiers",
              });
              return true;
            }
          }
          
          // Pour Android et autres navigateurs, copie directe
          await navigator.clipboard.writeText(text);
          console.log('✅ [CLIPBOARD] Copié avec Clipboard API');
          setIsCopying(false);
          toast({
            title: "Lien copié !",
            description: "Le lien a été copié dans le presse-papiers",
          });
          return true;
        } catch (clipboardError) {
          console.warn('⚠️ [CLIPBOARD] Clipboard API échoué, passage au fallback:', clipboardError);
          // Continue vers le fallback
        }
      }

      // ✅ ÉTAPE 2 : Fallback avec input invisible (pour navigateurs non-HTTPS ou anciens)
      return new Promise<boolean>((resolve) => {
        try {
          const input = document.createElement('input');
          input.value = text;
          input.style.position = 'fixed';
          input.style.top = '0';
          input.style.left = '0';
          input.style.width = '2px';
          input.style.height = '2px';
          input.style.padding = '0';
          input.style.border = 'none';
          input.style.opacity = '0';
          input.style.pointerEvents = 'none';
          input.style.fontSize = '16px'; // Empêche le zoom sur iOS
          input.readOnly = true;
          
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
                setIsCopying(false);
                toast({
                  title: "Lien copié !",
                  description: "Le lien a été copié dans le presse-papiers",
                });
                resolve(true);
              } else {
                console.warn('❌ [CLIPBOARD] execCommand a échoué');
                setIsCopying(false);
                toast({
                  title: "Copie échouée",
                  description: "Veuillez copier le lien manuellement",
                  variant: "destructive",
                });
                resolve(false);
              }
            } catch (error) {
              try {
                document.body.removeChild(input);
              } catch (e) {
                // Ignorer si déjà retiré
              }
              console.error('❌ [CLIPBOARD] Erreur execCommand:', error);
              setIsCopying(false);
              toast({
                title: "Copie échouée",
                description: "Veuillez copier le lien manuellement",
                variant: "destructive",
              });
              resolve(false);
            }
          }, 10);
        } catch (error) {
          console.error('❌ [CLIPBOARD] Erreur lors de la configuration du fallback:', error);
          setIsCopying(false);
          toast({
            title: "Erreur",
            description: "Impossible de copier le lien",
            variant: "destructive",
          });
          resolve(false);
        }
      });
    } catch (error) {
      console.error('❌ [CLIPBOARD] Erreur générale:', error);
      setIsCopying(false);
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    copy,
    isCopying,
  };
};

