import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { PropertyDetail } from "@/components/PropertyDetail";
import { GuestVerificationPage } from "@/components/guest/GuestVerificationPage";
import { GuestWelcome } from "@/pages/GuestWelcome";
import { ContractSigning } from "@/pages/ContractSigning";
import { VerifyToken } from "@/pages/VerifyToken";
import { Landing } from "@/pages/Landing";
import { Pricing } from "@/pages/Pricing";
import { AirbnbSyncHelp } from "@/pages/AirbnbSyncHelp";
import { ClientLinkHelp } from "@/pages/ClientLinkHelp";
import { Layout } from "@/components/Layout";
import { Profile } from "@/pages/Profile";
import { AccountSettings } from "@/pages/AccountSettings";
import { ChangePassword } from "@/pages/ChangePassword";
import { AuthCallback } from "@/pages/AuthCallback";
import { TestVerification } from "@/pages/TestVerification";
import { GuestLocaleProvider } from '@/i18n/GuestLocaleProvider';
import GuestLayout from '@/components/guest/GuestLayout';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { ErrorMonitorPanel } from '@/components/dev/ErrorMonitorPanel';
import { AdminProvider } from '@/contexts/AdminContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// 🚀 LAZY LOADING: Composants admin lourds chargés à la demande
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Composant de loading pour Suspense
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// ✅ Composant de fallback global pour ErrorBoundary
const GlobalErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => {
  console.error('🔴 [GlobalErrorBoundary] Erreur capturée:', error);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg border-2 border-red-200">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Une erreur s'est produite</h2>
          <p className="text-red-600 mb-4">
            L'application a rencontré une erreur inattendue. Veuillez rafraîchir la page.
          </p>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-gray-100 rounded-lg text-xs font-mono overflow-auto max-h-40">
            <p className="font-semibold mb-2">Détails de l'erreur (dev seulement):</p>
            <p className="text-red-600">{error.message}</p>
            {error.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-gray-600">Stack trace</summary>
                <pre className="mt-2 text-xs overflow-auto">{error.stack}</pre>
              </details>
            )}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Rafraîchir la page
          </button>
          <button
            onClick={resetError}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ✅ Intercepteur Portal global pour éviter les erreurs insertBefore/removeChild
const PortalErrorInterceptor = () => {
  useEffect(() => {
    // Sauvegarder les handlers originaux
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    // Handler pour les erreurs synchrones
    window.onerror = function(message, source, lineno, colno, error) {
      // ✅ CORRIGÉ : Intercepter aussi basé sur le message string (pour React compilé)
      const messageStr = typeof message === 'string' ? message : String(message);
      const errorMessage = error?.message || '';
      const errorName = error?.name || '';
      
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
        (error && error.name === 'NotFoundError')
      ) {
        // Erreur Portal interceptée et ignorée silencieusement
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

    return () => {
      // Restaurer les handlers originaux lors du démontage
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
    };
  }, []);

  return null;
};

const App = () => (
  <ErrorBoundary
    fallback={(error, resetError) => <GlobalErrorFallback error={error} resetError={resetError} />}
    onError={(error, errorInfo) => {
      console.error('🔴 [App] Erreur capturée par ErrorBoundary global:', error, errorInfo);
    }}
  >
    <QueryClientProvider client={queryClient}>
      <PortalErrorInterceptor />
      <TooltipProvider>
        <AdminProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
          {/* Guest verification routes - no layout needed for external users */}
          <Route path="/welcome/:propertyId/:token" element={
            <GuestLocaleProvider>
              <GuestLayout>
                <GuestWelcome />
              </GuestLayout>
            </GuestLocaleProvider>
          } />
          <Route path="/welcome/:propertyId/:token/:airbnbBookingId" element={
            <GuestLocaleProvider>
              <GuestLayout>
                <GuestWelcome />
              </GuestLayout>
            </GuestLocaleProvider>
          } />
          <Route path="/guest-verification/:propertyId/:token" element={<GuestVerificationPage />} />
          <Route path="/verify/:token" element={
            <GuestLocaleProvider>
              <GuestLayout>
                <VerifyToken />
              </GuestLayout>
            </GuestLocaleProvider>
          } />
          <Route path="/guest-verification/:propertyId/:token/:airbnbBookingId" element={<GuestVerificationPage />} />
          <Route path="/contract-signing/:propertyId/:token" element={
            <GuestLocaleProvider>
              <GuestLayout>
                <ContractSigning />
              </GuestLayout>
            </GuestLocaleProvider>
          } />
          <Route path="/contract-signing/:propertyId/:token/:airbnbBookingId" element={
            <GuestLocaleProvider>
              <GuestLayout>
                <ContractSigning />
              </GuestLayout>
            </GuestLocaleProvider>
          } />
          
          {/* Authenticated routes with layout */}
          <Route path="/dashboard" element={<Layout />}>
            <Route index element={<Index />} />
            <Route path="property/:propertyId" element={<PropertyDetail />} />
            <Route path="test-verification" element={<TestVerification />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
          
          {/* Help pages */}
          <Route path="/help/airbnb-sync/:propertyId" element={<AirbnbSyncHelp />} />
          <Route path="/help/client-link/:propertyId" element={<ClientLinkHelp />} />
          
          {/* User profile routes with layout */}
          <Route path="/profile" element={<Layout><Profile /></Layout>} />
          <Route path="/account-settings" element={<Layout><AccountSettings /></Layout>} />
          <Route path="/change-password" element={<Layout><ChangePassword /></Layout>} />
          
          {/* Admin routes */}
          <Route path="/admin" element={
            <AdminRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <AdminDashboard />
              </Suspense>
            </AdminRoute>
          } />
          
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
        
          {/* ✅ Panel de monitoring des erreurs (dev seulement) */}
          {process.env.NODE_ENV === 'development' && <ErrorMonitorPanel />}
        </BrowserRouter>
      </AdminProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
