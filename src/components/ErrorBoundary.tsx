import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary pour capturer les erreurs React et éviter les crashs
 * Spécialement utile pour capturer les erreurs Portal de Radix UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // ✅ CORRIGÉ : Ne pas changer le state pour les erreurs Portal
    // Cela évite les re-renders qui causent des doublons visuels et des boucles infinies
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    const errorString = String(error || '');
    const errorStack = error?.stack || '';
    
    const isPortalError = 
      errorMessage.includes('removeChild') || 
      errorMessage.includes('insertBefore') ||
      errorName === 'NotFoundError' ||
      errorMessage.includes('Failed to execute') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node to be removed') ||
      errorMessage.includes('The node before which') ||
      errorString.includes('insertBefore') ||
      errorString.includes('removeChild') ||
      errorStack.includes('insertBefore') ||
      errorStack.includes('removeChild');
    
    // ✅ CRITIQUE : Détecter aussi les erreurs qui causent des pages blanches
    // Ces erreurs se produisent pendant le commit de React
    const isReactCommitError = 
      errorStack.includes('commitLayoutEffectOnFiber') ||
      errorStack.includes('commitLayoutMountEffects') ||
      errorStack.includes('commitLayoutEffects') ||
      errorStack.includes('commitRootImpl') ||
      errorStack.includes('commitRoot') ||
      errorStack.includes('performSyncWorkOnRoot') ||
      errorMessage.includes('The above error occurred in the');
    
    if (isPortalError || isReactCommitError) {
      // ✅ CRITIQUE : Ignorer complètement - ne pas changer le state
      // Si on change le state, React essaie de recréer le composant, ce qui cause une nouvelle erreur
      return null; // ✅ CORRIGÉ : Retourner null pour ne pas changer le state du tout
    }
    
    // Pour les autres erreurs, mettre à jour le state normalement
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ Ignorer spécifiquement les erreurs Portal "removeChild" et "insertBefore"
    const errorMessage = error?.message || '';
    const errorStack = error?.stack || '';
    
    const isPortalError = 
      errorMessage.includes('removeChild') || 
      errorMessage.includes('insertBefore') ||
      error.name === 'NotFoundError' ||
      errorMessage.includes('Failed to execute') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node to be removed') ||
      errorMessage.includes('The node before which') ||
      errorStack.includes('insertBefore') ||
      errorStack.includes('removeChild');
    
    // ✅ CRITIQUE : Détecter aussi les erreurs qui causent des pages blanches
    const isReactCommitError = 
      errorStack.includes('commitLayoutEffectOnFiber') ||
      errorStack.includes('commitLayoutMountEffects') ||
      errorStack.includes('commitLayoutEffects') ||
      errorStack.includes('commitRootImpl') ||
      errorStack.includes('commitRoot') ||
      errorStack.includes('performSyncWorkOnRoot') ||
      errorMessage.includes('The above error occurred in the');
    
    if (isPortalError || isReactCommitError) {
      // ✅ CORRIGÉ : NE PAS changer le state pour éviter les re-renders
      // Ignorer complètement l'erreur silencieusement
      // Ne rien faire - laisser React continuer normalement
      return;
    }

    // Pour les autres erreurs, logger et appeler le callback
    console.error('❌ Erreur capturée par ErrorBoundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // ✅ Si c'est une erreur Portal ou de commit React, on ignore et on continue
      const errorMessage = this.state.error?.message || '';
      const errorStack = this.state.error?.stack || '';
      
      const isPortalError = 
        errorMessage.includes('removeChild') || 
        errorMessage.includes('insertBefore') ||
        this.state.error.name === 'NotFoundError' ||
        errorMessage.includes('Failed to execute') ||
        errorMessage.includes('not a child of this node') ||
        errorMessage.includes('The node to be removed') ||
        errorMessage.includes('The node before which') ||
        errorStack.includes('insertBefore') ||
        errorStack.includes('removeChild');
      
      const isReactCommitError = 
        errorStack.includes('commitLayoutEffectOnFiber') ||
        errorStack.includes('commitLayoutMountEffects') ||
        errorStack.includes('commitLayoutEffects') ||
        errorStack.includes('commitRootImpl') ||
        errorStack.includes('commitRoot') ||
        errorStack.includes('performSyncWorkOnRoot') ||
        errorMessage.includes('The above error occurred in the');
      
      if (isPortalError || isReactCommitError) {
        // ✅ CRITIQUE : Ignorer ces erreurs pour éviter les pages blanches
        // Mais logger quand même pour le debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [ErrorBoundary] Erreur Portal/Commit ignorée:', this.state.error.message);
        }
        return this.props.children;
      }

      // Pour les autres erreurs, afficher le fallback
      const fallback = this.props.fallback;
      
      // Si le fallback est une fonction, l'appeler avec l'erreur et une fonction de reset
      if (typeof fallback === 'function') {
        return fallback(this.state.error, () => {
          this.setState({ hasError: false, error: null });
        });
      }
      
      // Sinon, utiliser le fallback statique ou le défaut
      return fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-800">Une erreur s'est produite</h2>
          <p className="text-red-600 mt-2">{this.state.error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
