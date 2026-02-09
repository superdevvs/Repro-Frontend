
import React, { Suspense, lazy, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/auth";
import { PermissionsProvider } from './context/PermissionsContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { IssueManagerProvider, useIssueManager } from './context/IssueManagerContext';
import { PhotographerAssignmentProvider, usePhotographerAssignment } from './context/PhotographerAssignmentContext';
import { PageTransition } from '@/components/layout/PageTransition';
import Index from "./pages/Index";
import { ShootsProvider } from './context/ShootsContext';
import { toast } from "./components/ui/use-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { startRealtimeListener } from '@/realtime/realtimeListener';
import { subscribeRealtimeEvents } from '@/realtime/realtimeEvents';
import {
  triggerEditingRequestsRefresh,
  triggerShootDetailRefresh,
  triggerShootHistoryRefresh,
  triggerInvoicesRefresh,
  triggerShootListRefresh,
} from '@/realtime/realtimeRefreshBus';

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
const MlsPublishingQueue = lazy(() => import('./pages/MlsPublishingQueue'));
const PrivateListingPortal = lazy(() => import('./pages/PrivateListingPortal'));
const ExclusiveListingDetails = lazy(() => import('./pages/ExclusiveListingDetails'));
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
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));

// Messaging pages
const MessagingOverview = lazy(() => import('./pages/messaging/MessagingOverview'));
const EmailInbox = lazy(() => import('./pages/messaging/EmailInbox'));
const EmailCompose = lazy(() => import('./pages/messaging/EmailCompose'));
const Templates = lazy(() => import('./pages/messaging/Templates'));
const Automations = lazy(() => import('./pages/messaging/Automations'));
const SmsCenter = lazy(() => import('./pages/messaging/SmsCenter'));
const MessagingSettings = lazy(() => import('./pages/messaging/MessagingSettings'));

// Lazy-load modals
const IssueManagerModal = lazy(() => import('./components/issues/IssueManagerModal').then(module => ({ default: module.IssueManagerModal })));
const PhotographerAssignmentModal = lazy(() => import('./components/photographers/PhotographerAssignmentModal').then(module => ({ default: module.PhotographerAssignmentModal })));

// Create a new QueryClient instance with optimized defaults for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000, // Data is fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes (formerly cacheTime)
    },
  },
});

const FullScreenSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const RobbieRouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/chat-with-reproai') return;
    try {
      sessionStorage.setItem('robbie_last_route', location.pathname);
    } catch (error) {
      // Ignore storage errors (private mode, blocked storage, etc.)
    }
  }, [location.pathname]);

  return null;
};

// Protected route component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (hasNotifiedRef.current) return;
      hasNotifiedRef.current = true;
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
    } else {
      hasNotifiedRef.current = false;
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Admin route component
const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { role, isAuthenticated, isLoading } = useAuth();
  const authNotifiedRef = useRef(false);
  const denyNotifiedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (authNotifiedRef.current) return;
      authNotifiedRef.current = true;
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
    } else {
      authNotifiedRef.current = false;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const isDenied = !['admin', 'superadmin', 'editing_manager'].includes(role);
    if (!isDenied) {
      denyNotifiedRef.current = false;
      return;
    }
    if (denyNotifiedRef.current) return;
    denyNotifiedRef.current = true;
    toast({
      title: "Access Denied",
      description: "You don't have permission to access this page.",
      variant: "destructive",
    });
  }, [isAuthenticated, isLoading, role]);

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!['admin', 'superadmin', 'editing_manager'].includes(role)) {
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
  const authNotifiedRef = useRef(false);
  const denyNotifiedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (authNotifiedRef.current) return;
      authNotifiedRef.current = true;
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
    } else {
      authNotifiedRef.current = false;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const isDenied = !role || !allowedRoles.includes(role);
    if (!isDenied) {
      denyNotifiedRef.current = false;
      return;
    }
    if (denyNotifiedRef.current) return;
    denyNotifiedRef.current = true;
    toast({
      title: "Access Denied",
      description: "You don't have permission to access this page.",
      variant: "destructive",
    });
  }, [allowedRoles, isAuthenticated, isLoading, role]);

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Redirect to dashboard if role is not in allowed roles
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Wrapper for Dashboard route with IssueManager and PhotographerAssignment contexts
const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isOpen: isIssueModalOpen } = useIssueManager();
  const { isOpen: isPhotoModalOpen } = usePhotographerAssignment();

  return (
    <>
      {isIssueModalOpen && (
        <Suspense fallback={null}>
          <IssueManagerModal />
        </Suspense>
      )}
      {isPhotoModalOpen && (
        <Suspense fallback={null}>
          <PhotographerAssignmentModal />
        </Suspense>
      )}
      {children}
    </>
  );
};

// Wrapper retained for route compatibility; ShootsProvider now sits above AppRoutes.
const ShootRoutesWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const RealtimeBridge = () => {
  const { isAuthenticated, role, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    startRealtimeListener({ role, userId: user?.id ?? null }).then((stop) => {
      if (cancelled) {
        stop?.();
        return;
      }
      cleanup = stop;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isAuthenticated, role, user?.id]);

  useEffect(() =>
    subscribeRealtimeEvents((event) => {
      switch (event.type) {
        case 'shoot.updated':
        case 'shoot.assigned':
          triggerShootListRefresh();
          triggerShootHistoryRefresh();
          triggerShootDetailRefresh(event.shootId);
          break;
        case 'request.updated':
          triggerEditingRequestsRefresh();
          triggerShootDetailRefresh(event.shootId);
          break;
        case 'invoice.paid':
          triggerInvoicesRefresh();
          triggerShootListRefresh();
          triggerShootDetailRefresh(event.shootId);
          break;
        default:
          break;
      }
    }),
  []);

  return null;
};

// Routes wrapper with auth provider
const AppRoutes = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
      <Route path="/" element={
        <PageTransition>
          <Index />
        </PageTransition>
      } />
      
      {/* Public test routes for address lookup */}
      <Route path="/test-address-lookup" element={
        <PageTransition>
          <AddressLookupTest />
        </PageTransition>
      } />
      <Route path="/test-client-form" element={
        <PageTransition>
          <TestClientPropertyForm />
        </PageTransition>
      } />

      <Route path="/dropbox-callback" element={
        <PageTransition>
          <DropboxCallback />
        </PageTransition>
      } />
      {/* Public client-facing tour pages (accept ?shootId=) */}
      <Route path="/tour/branded" element={
        <PageTransition>
          <BrandedPage />
        </PageTransition>
      } />
      <Route path="/tour/mls" element={
        <PageTransition>
          <MlsCompliant />
        </PageTransition>
      } />
      <Route path="/tour/g-mls" element={
        <PageTransition>
          <GenericMLS />
        </PageTransition>
      } />
      {/* Public client portal so clients can share their link */}
      <Route path="/client-portal" element={
        <PageTransition>
          <ClientPortal />
        </PageTransition>
      } />
      {/* Public password reset page */}
      <Route path="/reset-password" element={
        <PageTransition>
          <ResetPassword />
        </PageTransition>
      } />
      {/* Public payment page */}
      <Route path="/payment/:id" element={
        <PageTransition>
          <PaymentPage />
        </PageTransition>
      } />
       <Route path="/tours/branded" element={
        // <ProtectedRoute>
          <PageTransition>
            <BrandedPage />
          </PageTransition>
        // </ProtectedRoute>
      } />

       <Route path="/tours/mls" element={
        // <ProtectedRoute>
          <PageTransition>
            <MlsCompliant />
          </PageTransition>
        // </ProtectedRoute>
      } />

       <Route path="/tours/g-mls" element={
        // <ProtectedRoute>
          <PageTransition>
            <GenericMLS />
          </PageTransition>
        // </ProtectedRoute>
       } />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <IssueManagerProvider>
              <PhotographerAssignmentProvider>
                <DashboardWrapper>
                  <Dashboard />
                </DashboardWrapper>
              </PhotographerAssignmentProvider>
            </IssueManagerProvider>
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/shoots/:id" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <ShootDetails />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/book-shoot" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <BookShoot />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/shoot-history" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <ShootHistory />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute>
          <Invoices />
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <Accounting />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <Accounts />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/availability" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'photographer', 'salesRep']}>
          <ShootRoutesWrapper>
            <Availability />
          </ShootRoutesWrapper>
        </RoleRestrictedRoute>
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
        <RoleRestrictedRoute allowedRoles={['client', 'admin', 'superadmin', 'editing_manager']}>
          <ChatWithReproAi />
        </RoleRestrictedRoute>
      } />
      <Route path="/ai-editing" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager']}>
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
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep', 'client']}>
          <PrivateListingPortal />
        </RoleRestrictedRoute>
      } />
      <Route path="/exclusive-listings/:id" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep', 'client']}>
          <ExclusiveListingDetails />
        </RoleRestrictedRoute>
      } />
      <Route path="/photographer-history" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <PhotographerShootHistory />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/photographer-account" element={
        <ProtectedRoute>
          <ShootRoutesWrapper>
            <PhotographerAccount />
          </ShootRoutesWrapper>
        </ProtectedRoute>
      } />
      <Route path="/photographer-availability" element={
        <ProtectedRoute>
          <PhotographerAvailability />
        </ProtectedRoute>
      } />
      <Route path="/coupons" element={
        <ProtectedRoute>
          <Navigate to="/settings?tab=coupons" replace />
        </ProtectedRoute>
      } />
      {/* CubiCasa mobile scanning - photographers and admins only */}
      <Route path="/cubicasa-scanning" element={
        <RoleRestrictedRoute allowedRoles={['photographer', 'admin', 'superadmin', 'editing_manager']}>
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
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <MessagingOverview />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/overview" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <MessagingOverview />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/email/templates" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <Templates />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/email/automations" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <Automations />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/sms" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <SmsCenter />
        </RoleRestrictedRoute>
      } />
      <Route path="/messaging/settings" element={
        <RoleRestrictedRoute allowedRoles={['admin', 'superadmin', 'editing_manager', 'salesRep']}>
          <MessagingSettings />
        </RoleRestrictedRoute>
      } />
      {/* Address lookup testing routes */}
      <Route path="/address-lookup-demo" element={
        <ProtectedRoute>
          <PageTransition>
            <AddressLookupDemo />
          </PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/book-shoot-enhanced" element={
        <ProtectedRoute>
          <PageTransition>
            <BookShootWithAddressLookup />
          </PageTransition>
        </ProtectedRoute>
      } />
      <Route path="*" element={
        <PageTransition>
          <NotFound />
        </PageTransition>
      } />

    </Routes>
    </AnimatePresence>
    </Suspense>
  );
};

function App() {
  return (
    <div className="app-root">
      <div className="app-shell">
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-right" closeButton richColors />
              <BrowserRouter>
                <RobbieRouteTracker />
                <AuthProvider>
                  <UserPreferencesProvider>
                    <PermissionsProvider>
                      <ShootsProvider>
                        <RealtimeBridge />
                        <ErrorBoundary>
                          <AppRoutes />
                        </ErrorBoundary>
                      </ShootsProvider>
                    </PermissionsProvider>
                  </UserPreferencesProvider>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </QueryClientProvider>
        </React.StrictMode>
      </div>
    </div>
  );
}

export default App;
