
import React, { Suspense, lazy } from 'react'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/auth";
import { PermissionsProvider } from './context/PermissionsContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { IssueManagerProvider } from './context/IssueManagerContext';
import { PhotographerAssignmentProvider } from './context/PhotographerAssignmentContext';
import { IssueManagerModal } from './components/issues/IssueManagerModal';
import { PhotographerAssignmentModal } from './components/photographers/PhotographerAssignmentModal';
import Index from "./pages/Index";
import { ShootsProvider } from './context/ShootsContext';
import { toast } from "./components/ui/use-toast";

const Dashboard = lazy(() => import('./pages/Dashboard'));
const BookShoot = lazy(() => import('./pages/BookShoot'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Settings = lazy(() => import('./pages/Settings'));
const SchedulingSettings = lazy(() => import('./pages/SchedulingSettings'));
const TourBranding = lazy(() => import('./pages/TourBranding'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Availability = lazy(() => import('./pages/Availability'));
const Reports = lazy(() => import('./pages/Reports'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ShootHistory = lazy(() => import('./pages/ShootHistory'));
const PhotographerShootHistory = lazy(() => import('./pages/PhotographerShootHistory'));
const PhotographerAccount = lazy(() => import('./pages/PhotographerAccount'));
const PhotographerAvailability = lazy(() => import('./pages/PhotographerAvailability'));
const ShootDetails = lazy(() => import('./pages/ShootDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Coupons = lazy(() => import('./pages/Coupons'));
const MlsPublishingQueue = lazy(() => import('./pages/MlsPublishingQueue'));
const PrivateListingPortal = lazy(() => import('./pages/PrivateListingPortal'));
const ChatWithReproAi = lazy(() => import('./pages/ChatWithReproAi'));
const AiEditing = lazy(() => import('./pages/AiEditing'));
const PermissionSettings = lazy(() => import('./pages/PermissionSettings'));
const DropboxCallback = lazy(() => import('./components/DropboxCallback'));
const AddressLookupDemo = lazy(() => import('./components/AddressLookupDemo'));
const ClientPortal = lazy(() => import('./components/clients/ClientPortal'));
const BookShootWithAddressLookup = lazy(() => import('./components/BookShootWithAddressLookup'));
const AddressLookupTest = lazy(() => import('./pages/AddressLookupTest'));
const TestClientPropertyForm = lazy(() => import('./pages/TestClientPropertyForm'));
const BrandedPage = lazy(() => import('@/components/tourLinks/BrandedPage').then(module => ({ default: module.BrandedPage })));
const MlsCompliant = lazy(() => import('@/components/tourLinks/MlsCompliant').then(module => ({ default: module.MlsCompliant })));
const GenericMLS = lazy(() => import('@/components/tourLinks/GenericMLS').then(module => ({ default: module.GenericMLS })));
const CubiCasaScanning = lazy(() => import('./pages/CubiCasaScanning'));

// Messaging pages
const MessagingOverview = lazy(() => import('./pages/messaging/MessagingOverview'));
const EmailInbox = lazy(() => import('./pages/messaging/EmailInbox'));
const EmailCompose = lazy(() => import('./pages/messaging/EmailCompose'));
const Templates = lazy(() => import('./pages/messaging/Templates'));
const Automations = lazy(() => import('./pages/messaging/Automations'));
const SmsCenter = lazy(() => import('./pages/messaging/SmsCenter'));
const MessagingSettings = lazy(() => import('./pages/messaging/MessagingSettings'));

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const FullScreenSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    // Show a toast notification when redirecting
    toast({
      title: "Authentication Required",
      description: "Please log in to access this page.",
      variant: "destructive",
    });
    return <Navigate to="/" replace />;
  }

  return children;
};

// Admin route component
const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { role, isAuthenticated, isLoading } = useAuth();

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    toast({
      title: "Authentication Required",
      description: "Please log in to access this page.",
      variant: "destructive",
    });
    return <Navigate to="/" replace />;
  }

  if (!['admin', 'superadmin'].includes(role)) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access this page.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Role-restricted route component
const RoleRestrictedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: JSX.Element; 
  allowedRoles: string[] 
}) => {
  const { role, isAuthenticated, isLoading } = useAuth();

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    toast({
      title: "Authentication Required",
      description: "Please log in to access this page.",
      variant: "destructive",
    });
    return <Navigate to="/" replace />;
  }

  // Redirect to dashboard if role is not in allowed roles
  if (!role || !allowedRoles.includes(role)) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access this page.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Routes wrapper with auth provider
const AppRoutes = () => {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <IssueManagerModal />
      <PhotographerAssignmentModal />
      <Routes>
      <Route path="/" element={<Index />} />
      
      {/* Public test routes for address lookup */}
      <Route path="/test-address-lookup" element={<AddressLookupTest />} />
      <Route path="/test-client-form" element={<TestClientPropertyForm />} />

      <Route path="/dropbox-callback" element={<DropboxCallback />} />
      {/* Public client-facing tour pages (accept ?shootId=) */}
      <Route path="/tour/branded" element={<BrandedPage />} />
      <Route path="/tour/mls" element={<MlsCompliant />} />
      <Route path="/tour/generic-mls" element={<GenericMLS />} />
      {/* Public client portal so clients can share their link */}
      <Route path="/client-portal" element={<ClientPortal />} />
       <Route path="/tours/branded" element={
        // <ProtectedRoute>
          <BrandedPage />
        // </ProtectedRoute>
      } />

       <Route path="/tours/mls" element={
        // <ProtectedRoute>
          <MlsCompliant />
        // </ProtectedRoute>
      } />

       <Route path="/tours/generic-mls" element={
        // <ProtectedRoute>
          <GenericMLS />
        // </ProtectedRoute>
       } />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/shoots/:id" element={
        <ProtectedRoute>
          <ShootDetails />
        </ProtectedRoute>
      } />
      <Route path="/book-shoot" element={
        <ProtectedRoute>
          <BookShoot />
        </ProtectedRoute>
      } />
      <Route path="/shoot-history" element={
        <ProtectedRoute>
          <ShootHistory />
        </ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute>
          <Invoices />
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute>
          <Accounting />
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/availability" element={
        <ProtectedRoute>
          <Availability />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/chat-with-reproai" element={
        <RoleRestrictedRoute allowedRoles={['client', 'admin', 'superadmin']}>
          <ChatWithReproAi />
        </RoleRestrictedRoute>
      } />
      <Route path="/ai-editing" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin']}>
          <AiEditing />
        </RoleRestrictedRoute>
      } />
      <Route path="/scheduling-settings" element={
        <AdminRoute>
          <SchedulingSettings />
        </AdminRoute>
      } />
      <Route path="/tour-branding" element={
        <AdminRoute>
          <TourBranding />
        </AdminRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/integrations" element={
        <ProtectedRoute>
          <Integrations />
        </ProtectedRoute>
      } />
      <Route path="/admin/integrations" element={
        <ProtectedRoute>
          <Integrations />
        </ProtectedRoute>
      } />
      <Route path="/admin/mls-queue" element={
        <ProtectedRoute>
          <MlsPublishingQueue />
        </ProtectedRoute>
      } />
      <Route path="/portal" element={
        <ProtectedRoute>
          <PrivateListingPortal />
        </ProtectedRoute>
      } />
      <Route path="/photographer-history" element={
        <ProtectedRoute>
          <PhotographerShootHistory />
        </ProtectedRoute>
      } />
      <Route path="/photographer-account" element={
        <ProtectedRoute>
          <PhotographerAccount />
        </ProtectedRoute>
      } />
      <Route path="/photographer-availability" element={
        <ProtectedRoute>
          <PhotographerAvailability />
        </ProtectedRoute>
      } />
      <Route path="/coupons" element={
        <ProtectedRoute>
          <Coupons />
        </ProtectedRoute>
      } />
      {/* CubiCasa mobile scanning - photographers and admins only */}
      <Route path="/cubicasa-scanning" element={
        <RoleRestrictedRoute allowedRoles={['photographer', 'admin', 'superadmin']}>
          <CubiCasaScanning />
        </RoleRestrictedRoute>
      } />
      {/* New permissions settings route */}
      <Route path="/permissions" element={
        <ProtectedRoute>
          <PermissionSettings />
        </ProtectedRoute>
      } />
      {/* Messaging routes - Inbox and Compose available to all authenticated users */}
      <Route path="/messaging/email/inbox" element={
        <ProtectedRoute>
          <EmailInbox />
        </ProtectedRoute>
      } />
      <Route path="/messaging/email/compose" element={
        <ProtectedRoute>
          <EmailCompose />
        </ProtectedRoute>
      } />
      {/* Messaging routes - Overview, Templates, Automations, SMS, Settings only for admins */}
      <Route path="/messaging" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <MessagingOverview />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/overview" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <MessagingOverview />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/email/templates" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <Templates />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/email/automations" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <Automations />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/sms" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <SmsCenter />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/settings" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'sales_rep']}>
          <MessagingSettings />
        </RoleRestrictedRoute>
      } />
      {/* Address lookup testing routes */}
      <Route path="/address-lookup-demo" element={
        <ProtectedRoute>
          <AddressLookupDemo />
        </ProtectedRoute>
      } />
      <Route path="/book-shoot-enhanced" element={
        <ProtectedRoute>
          <BookShootWithAddressLookup />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />

    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" closeButton richColors />
          <BrowserRouter>
            <AuthProvider>
              <UserPreferencesProvider>
                <PermissionsProvider>
                  <ShootsProvider>
                    <IssueManagerProvider>
                      <PhotographerAssignmentProvider>
                        <AppRoutes />
                      </PhotographerAssignmentProvider>
                    </IssueManagerProvider>
                  </ShootsProvider>
                </PermissionsProvider>
              </UserPreferencesProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
