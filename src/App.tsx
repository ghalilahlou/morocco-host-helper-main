import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
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

// 🚀 LAZY LOADING: Composants admin lourds chargés à la demande
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Composant de loading pour Suspense
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
);

export default App;
