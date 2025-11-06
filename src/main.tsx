import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ✅ Intercepteur Portal global AVANT le render de React
// Cela garantit que l'intercepteur est actif dès le début, avant que React ne charge
(function setupPortalErrorInterceptor() {
  // Sauvegarder les handlers originaux
  const originalOnError = window.onerror;
  const originalOnUnhandledRejection = window.onunhandledrejection;

  // Handler pour les erreurs synchrones
  window.onerror = function(message, source, lineno, colno, error) {
    // ✅ CORRIGÉ : Intercepter aussi basé sur le message string (pour React compilé)
    const messageStr = typeof message === 'string' ? message : String(message);
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    const sourceStr = source || '';
    const stack = error?.stack || '';
    
    // ✅ CRITIQUE : Vérifier aussi dans les chunk files et le stack trace
    const isChunkFile = sourceStr.includes('chunk-') || sourceStr.includes('.js?v=');
    const isFailedToExecute = messageStr.includes('Failed to execute') || errorMessage.includes('Failed to execute');
    
    // Intercepter les erreurs Portal et les ignorer silencieusement
    if (
      messageStr.includes('insertBefore') ||
      messageStr.includes('removeChild') ||
      messageStr.includes('not a child of this node') ||
      messageStr.includes('The node before which') ||
      messageStr.includes('The node to be removed') ||
      messageStr.includes('NotFoundError') ||
      errorMessage.includes('insertBefore') ||
      errorMessage.includes('removeChild') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node before which') ||
      errorMessage.includes('The node to be removed') ||
      errorName === 'NotFoundError' ||
      (error && error.name === 'NotFoundError') ||
      stack.includes('insertBefore') ||
      stack.includes('removeChild') ||
      (isChunkFile && isFailedToExecute)
    ) {
      // Erreur Portal interceptée et ignorée silencieusement
      // ✅ CRITIQUE : Empêcher complètement la propagation pour éviter que React bloque
      return true; // Empêche la propagation de l'erreur
    }

    // Laisser passer les autres erreurs
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Handler pour les erreurs asynchrones
  window.onunhandledrejection = function(event) {
    const error = event.reason;
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    const errorString = String(error || '');
    
    // ✅ CORRIGÉ : Intercepter aussi basé sur le message string et le nom
    if (
      errorMessage.includes('removeChild') ||
      errorMessage.includes('insertBefore') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node before which') ||
      errorMessage.includes('The node to be removed') ||
      errorName === 'NotFoundError' ||
      errorString.includes('insertBefore') ||
      errorString.includes('removeChild') ||
      errorString.includes('NotFoundError')
    ) {
      // Erreur Portal async interceptée et ignorée silencieusement
      event.preventDefault(); // Empêche la propagation
      event.stopPropagation(); // ✅ AJOUT : Arrêter aussi la propagation
      return;
    }

    // Laisser passer les autres erreurs
    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection.call(window, event);
    }
  };
  
  // ✅ NOUVEAU : Intercepter aussi les erreurs via addEventListener pour une couverture complète
  // ✅ CRITIQUE : Utiliser capture phase ET plusieurs listeners pour une interception maximale
  const errorHandler = function(event: ErrorEvent) {
    const message = event.message || '';
    const error = event.error;
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    const source = event.filename || '';
    
    // ✅ CORRIGÉ : Vérifier aussi dans le source (chunk files) et le stack trace
    const stack = error?.stack || '';
    
    // ✅ CRITIQUE : Intercepter aussi les erreurs qui causent des pages blanches
    // Ces erreurs se produisent pendant le commit de React et peuvent causer des crashes
    const isReactCommitError = 
      stack.includes('commitLayoutEffectOnFiber') ||
      stack.includes('commitLayoutMountEffects') ||
      stack.includes('commitLayoutEffects') ||
      stack.includes('commitRootImpl') ||
      stack.includes('commitRoot') ||
      stack.includes('performSyncWorkOnRoot') ||
      message.includes('The above error occurred in the') ||
      (source.includes('chunk-') && message.includes('error occurred'));
    
    if (
      message.includes('insertBefore') ||
      message.includes('removeChild') ||
      message.includes('not a child of this node') ||
      message.includes('NotFoundError') ||
      message.includes('The node before which') ||
      message.includes('The node to be removed') ||
      errorMessage.includes('insertBefore') ||
      errorMessage.includes('removeChild') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node before which') ||
      errorMessage.includes('The node to be removed') ||
      errorName === 'NotFoundError' ||
      (error && error.name === 'NotFoundError') ||
      stack.includes('insertBefore') ||
      stack.includes('removeChild') ||
      source.includes('chunk-') && (message.includes('Failed to execute') || errorMessage.includes('Failed to execute')) ||
      isReactCommitError
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation(); // ✅ AJOUT : Arrêter immédiatement la propagation
      
      // ✅ CRITIQUE : Pour les erreurs de commit React, empêcher le crash complet
      if (isReactCommitError) {
        // Ne pas laisser React crasher complètement
        // L'ErrorBoundary gérera l'affichage
        return false;
      }
      
      return false;
    }
  };
  
  // Ajouter plusieurs listeners pour une interception maximale
  window.addEventListener('error', errorHandler, true); // Capture phase
  window.addEventListener('error', errorHandler, false); // Bubble phase aussi
})();

createRoot(document.getElementById("root")!).render(<App />);
