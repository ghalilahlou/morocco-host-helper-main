import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy load components for better performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PropertyDetail = lazy(() => import("./components/PropertyDetail"));
const GuestVerification = lazy(() => import("./pages/GuestVerification"));
const GuestWelcome = lazy(() => import("./pages/GuestWelcome"));
const ContractSigning = lazy(() => import("./pages/ContractSigning"));
const Landing = lazy(() => import("./pages/Landing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const AirbnbSyncHelp = lazy(() => import("./pages/AirbnbSyncHelp"));
const ClientLinkHelp = lazy(() => import("./pages/ClientLinkHelp"));
const Layout = lazy(() => import("./components/Layout"));
const Profile = lazy(() => import("./pages/Profile"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const GuestLocaleProvider = lazy(() => import('@/i18n/GuestLocaleProvider'));
const GuestLayout = lazy(() => import('@/components/guest/GuestLayout'));

// Create a new QueryClient instance with better configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
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
              <Route path="/guest-verification/:propertyId/:token" element={
                <GuestLocaleProvider>
                  <GuestLayout>
                    <GuestVerification />
                  </GuestLayout>
                </GuestLocaleProvider>
              } />
              <Route path="/guest-verification/:propertyId/:token/:airbnbBookingId" element={
                <GuestLocaleProvider>
                  <GuestLayout>
                    <GuestVerification />
                  </GuestLayout>
                </GuestLocaleProvider>
              } />
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

              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/auth" element={<Auth />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
