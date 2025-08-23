import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { PropertyDetail } from "@/components/PropertyDetail";
import { GuestVerification } from "@/pages/GuestVerification";
import { GuestWelcome } from "@/pages/GuestWelcome";
import { ContractSigning } from "@/pages/ContractSigning";
import { Landing } from "@/pages/Landing";
import { Pricing } from "@/pages/Pricing";
import { AirbnbSyncHelp } from "@/pages/AirbnbSyncHelp";
import { ClientLinkHelp } from "@/pages/ClientLinkHelp";
import { Layout } from "@/components/Layout";
import { Profile } from "@/pages/Profile";
import { AccountSettings } from "@/pages/AccountSettings";
import { ChangePassword } from "@/pages/ChangePassword";
import { AuthCallback } from "@/pages/AuthCallback";
import { GuestLocaleProvider } from '@/i18n/GuestLocaleProvider';
import GuestLayout from '@/components/guest/GuestLayout';
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
