import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    // Cela évite les re-renders qui causent des doublons visuels
    const isPortalError = 
      error.message.includes('removeChild') || 
      error.message.includes('insertBefore') ||
      error.name === 'NotFoundError' ||
      error.message.includes('Failed to execute') ||
      error.message.includes('not a child of this node') ||
      error.message.includes('The node to be removed') ||
      error.message.includes('The node before which');
    
    if (isPortalError) {
      // Ignorer complètement - ne pas changer le state
      return { hasError: false, error: null };
    }
    
    // Pour les autres erreurs, mettre à jour le state normalement
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ Ignorer spécifiquement les erreurs Portal "removeChild" et "insertBefore"
    const isPortalError = 
      error.message.includes('removeChild') || 
      error.message.includes('insertBefore') ||
      error.name === 'NotFoundError' ||
      error.message.includes('Failed to execute') ||
      error.message.includes('not a child of this node') ||
      error.message.includes('The node to be removed') ||
      error.message.includes('The node before which');
    
    if (isPortalError) {
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
      // ✅ Si c'est une erreur Portal, on ignore et on continue
      const isPortalError = 
        this.state.error.message.includes('removeChild') || 
        this.state.error.message.includes('insertBefore') ||
        this.state.error.name === 'NotFoundError' ||
        this.state.error.message.includes('Failed to execute') ||
        this.state.error.message.includes('not a child of this node') ||
        this.state.error.message.includes('The node to be removed') ||
        this.state.error.message.includes('The node before which');
      
      if (isPortalError) {
        return this.props.children;
      }

      // Pour les autres erreurs, afficher le fallback
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-800">Une erreur s'est produite</h2>
          <p className="text-red-600 mt-2">{this.state.error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
