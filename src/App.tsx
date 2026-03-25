
import React, { Suspense, lazy, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/auth";
import { PermissionsProvider } from './context/PermissionsContext';
import { usePermission } from './hooks/usePermission';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { IssueManagerProvider, useIssueManager } from './context/IssueManagerContext';
import { PhotographerAssignmentProvider, usePhotographerAssignment } from './context/PhotographerAssignmentContext';
import { PageTransition } from '@/components/layout/PageTransition';
import Index from "./pages/Index";
import { ShootsProvider } from './context/ShootsContext';
import { UploadProvider } from './context/UploadContext';
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
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));

// Messaging pages
const MessagingOverview = lazy(() => import('./pages/messaging/MessagingOverview'));
const EmailInbox = lazy(() => import('./pages/messaging/EmailInbox'));
const EmailCompose = lazy(() => import('./pages/messaging/EmailCompose'));
const Templates = lazy(() => import('./pages/messaging/Templates'));
const Automations = lazy(() => import('./pages/messaging/Automations'));
const AutomationWorkflowEditor = lazy(() => import('./pages/messaging/AutomationWorkflowEditor'));
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
  <div className="flex items-center justify-center h-screen bg-background">
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

  // Show loading state if auth is still initializing
  if (isLoading) {
    return <FullScreenSpinner />;
  }

  // Silently redirect to login - no toast notification needed
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const PermissionRoute = ({
  children,
  resource,
  action = 'view',
  fallbackTo = '/dashboard',
}: {
  children: JSX.Element;
  resource: string;
  action?: string;
  fallbackTo?: string;
}) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermission();
  const denyNotifiedRef = useRef(false);
  const hasPermission = can(resource, action);

  useEffect(() => {
    if (authLoading || permissionsLoading || !isAuthenticated) return;
    if (hasPermission) {
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
  }, [action, authLoading, hasPermission, isAuthenticated, permissionsLoading, resource]);

  if (authLoading || permissionsLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!hasPermission) {
    return <Navigate to={fallbackTo} replace />;
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
      <Route path="/terms-and-conditions" element={
        <PageTransition>
          <TermsAndConditions />
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
        <PermissionRoute resource="dashboard" fallbackTo="/">
          <ShootRoutesWrapper>
            <IssueManagerProvider>
              <PhotographerAssignmentProvider>
                <DashboardWrapper>
                  <Dashboard />
                </DashboardWrapper>
              </PhotographerAssignmentProvider>
            </IssueManagerProvider>
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/shoots/:id" element={
        <PermissionRoute resource="shoots">
          <ShootRoutesWrapper>
            <ShootDetails />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/book-shoot" element={
        <PermissionRoute resource="book-shoot" action="create">
          <ShootRoutesWrapper>
            <BookShoot />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/shoot-history" element={
        <PermissionRoute resource="shoots">
          <ShootRoutesWrapper>
            <ShootHistory />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/invoices" element={
        <PermissionRoute resource="invoices">
          <Invoices />
        </PermissionRoute>
      } />
      <Route path="/accounting" element={
        <PermissionRoute resource="accounting">
          <ShootRoutesWrapper>
            <Accounting />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/accounts" element={
        <PermissionRoute resource="accounts">
          <ShootRoutesWrapper>
            <Accounts />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/availability" element={
        <PermissionRoute resource="availability">
          <ShootRoutesWrapper>
            <Availability />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/reports" element={
        <PermissionRoute resource="reports">
          <Reports />
        </PermissionRoute>
      } />
      <Route path="/settings" element={
        <PermissionRoute resource="settings">
          <Settings />
        </PermissionRoute>
      } />
      <Route path="/chat-with-reproai" element={
        <PermissionRoute resource="robbie">
          <ChatWithReproAi />
        </PermissionRoute>
      } />
      <Route path="/ai-editing" element={
        <PermissionRoute resource="ai-editing">
          <AiEditing />
        </PermissionRoute>
      } />
      <Route path="/scheduling-settings" element={
        <PermissionRoute resource="scheduling-settings">
          <SchedulingSettings />
        </PermissionRoute>
      } />
      <Route path="/tour-branding" element={
        <PermissionRoute resource="tour-branding">
          <TourBranding />
        </PermissionRoute>
      } />
      <Route path="/profile" element={
        <PermissionRoute resource="profile">
          <Profile />
        </PermissionRoute>
      } />
      <Route path="/integrations" element={
        <PermissionRoute resource="integrations">
          <Integrations />
        </PermissionRoute>
      } />
      <Route path="/admin/integrations" element={
        <PermissionRoute resource="integrations">
          <Integrations />
        </PermissionRoute>
      } />
      <Route path="/admin/mls-queue" element={
        <PermissionRoute resource="integrations">
          <MlsPublishingQueue />
        </PermissionRoute>
      } />
      <Route path="/portal" element={
        <PermissionRoute resource="portal">
          <PrivateListingPortal />
        </PermissionRoute>
      } />
      <Route path="/exclusive-listings/:id" element={
        <PermissionRoute resource="portal">
          <ExclusiveListingDetails />
        </PermissionRoute>
      } />
      <Route path="/photographer-history" element={
        <PermissionRoute resource="shoots">
          <ShootRoutesWrapper>
            <PhotographerShootHistory />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/photographer-account" element={
        <PermissionRoute resource="profile">
          <ShootRoutesWrapper>
            <PhotographerAccount />
          </ShootRoutesWrapper>
        </PermissionRoute>
      } />
      <Route path="/photographer-availability" element={
        <PermissionRoute resource="availability">
          <PhotographerAvailability />
        </PermissionRoute>
      } />
      <Route path="/coupons" element={
        <PermissionRoute resource="coupons">
          <Navigate to="/settings?tab=coupons" replace />
        </PermissionRoute>
      } />
      {/* CubiCasa mobile scanning - photographers and admins only */}
      <Route path="/cubicasa-scanning" element={
        <PermissionRoute resource="cubicasa-scanning">
          <CubiCasaScanning />
        </PermissionRoute>
      } />
      {/* New permissions settings route */}
      <Route path="/permissions" element={
        <PermissionRoute resource="permissions-manager">
          <PermissionSettings />
        </PermissionRoute>
      } />
      {/* Messaging routes - Inbox and Compose available to all authenticated users */}
      <Route path="/messaging/email/inbox" element={
        <PermissionRoute resource="messaging-email">
          <EmailInbox />
        </PermissionRoute>
      } />
      <Route path="/messaging/email/compose" element={
        <PermissionRoute resource="messaging-compose" action="create">
          <EmailCompose />
        </PermissionRoute>
      } />
      {/* Messaging routes - Overview, Templates, Automations, SMS, Settings only for admins */}
      <Route path="/messaging" element={
        <PermissionRoute resource="messaging-overview">
          <MessagingOverview />
        </PermissionRoute>
      } />
      <Route path="/messaging/overview" element={
        <PermissionRoute resource="messaging-overview">
          <MessagingOverview />
        </PermissionRoute>
      } />
      <Route path="/messaging/email/templates" element={
        <PermissionRoute resource="messaging-templates">
          <Templates />
        </PermissionRoute>
      } />
      <Route path="/messaging/email/automations" element={
        <PermissionRoute resource="messaging-automations">
          <Automations />
        </PermissionRoute>
      } />
      <Route path="/messaging/email/automations/new" element={
        <PermissionRoute resource="messaging-automations">
          <AutomationWorkflowEditor />
        </PermissionRoute>
      } />
      <Route path="/messaging/email/automations/:automationId" element={
        <PermissionRoute resource="messaging-automations">
          <AutomationWorkflowEditor />
        </PermissionRoute>
      } />
      <Route path="/messaging/sms" element={
        <PermissionRoute resource="messaging-sms">
          <SmsCenter />
        </PermissionRoute>
      } />
      <Route path="/messaging/settings" element={
        <PermissionRoute resource="messaging-settings">
          <MessagingSettings />
        </PermissionRoute>
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
                        <UploadProvider>
                          <RealtimeBridge />
                          <ErrorBoundary>
                            <AppRoutes />
                          </ErrorBoundary>
                        </UploadProvider>
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
