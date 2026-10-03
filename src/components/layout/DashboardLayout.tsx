import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { PageTransition } from './PageTransition';
import { PageLoadingBoundary } from './PageLoadingBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaQuery } from '@/hooks/use-media-query';
import MobileMenu from './MobileMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { EmailVerificationNotice } from '@/components/auth/EmailVerificationNotice';
import { AlertCircle, LogOut } from 'lucide-react';
import { canUseListingStudioDashboard, listingStudioRole, LISTING_STUDIO_QUERY } from '@/utils/listingStudio';
import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';
import { isSupportInbox } from '@/pages/messaging/messagingSupport';
import { formatUserRoleLabel } from '@/utils/userRoleLabels';

const ListingStudioDialog = React.lazy(() => import('@/components/listing-studio/ListingStudioDialog'));

// Stash the context on globalThis so Vite HMR doesn't create duplicate context
// instances during development (which would defeat the nested-layout guard and
// cause the entire sidebar+navbar to render twice on a route like /shoot-history).
const DASHBOARD_LAYOUT_CONTEXT_KEY = '__REPRO_DASHBOARD_LAYOUT_CONTEXT__';
const globalScope = globalThis as unknown as Record<string, React.Context<boolean> | undefined>;
const DashboardLayoutContext: React.Context<boolean> =
  globalScope[DASHBOARD_LAYOUT_CONTEXT_KEY] ?? React.createContext(false);
if (!globalScope[DASHBOARD_LAYOUT_CONTEXT_KEY]) {
  globalScope[DASHBOARD_LAYOUT_CONTEXT_KEY] = DashboardLayoutContext;
}

interface DashboardLayoutProps {
  children?: React.ReactNode;
  className?: string;
  hideNavbar?: boolean;
  hideFooter?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, className, hideNavbar = false, hideFooter = false }) => {
  const isInsideDashboardLayout = React.useContext(DashboardLayoutContext);
  const isMobile = useIsMobile();
  const isCompactDashboardShell = useMediaQuery('(max-width: 1024px)');
  const navigate = useNavigate();
  const location = useLocation();
  const { isImpersonating, user, stopImpersonating, role } = useAuth();
  const listingStudioRequested = new URLSearchParams(location.search).get(LISTING_STUDIO_QUERY) === '1';
  const listingStudioTab = new URLSearchParams(location.search).get('listingStudioTab');
  const isListingStudioClient = listingStudioRole(role, user?.secondary_roles) === 'client';
  const listingStudioOpen = canUseListingStudioDashboard(role, user?.secondary_roles) && listingStudioRequested;
  React.useEffect(() => {
    // Existing bookmarks and notification links should follow the client's website flow too.
    if (!isInsideDashboardLayout && isListingStudioClient && listingStudioRequested) {
      window.location.replace(LISTING_STUDIO_WEBSITE_URL);
    }
  }, [isInsideDashboardLayout, isListingStudioClient, listingStudioRequested]);
  const closeListingStudio = () => {
    const params = new URLSearchParams(location.search);
    params.delete(LISTING_STUDIO_QUERY);
    params.delete('listingStudioTab');
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true });
  };
  const [bottomNavHeight, setBottomNavHeight] = React.useState(0);
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
  const isSupportWorkspace = location.pathname === '/messaging/email/inbox' && isSupportInbox(location.search);
  const isCallsWorkspace = location.pathname === '/calls' || location.pathname.startsWith('/calls/');
  const useCompactShell = isMobile || (isDashboardRoute && isCompactDashboardShell);
  const isStudioWorkspace = location.pathname === '/ai-editing' && new URLSearchParams(location.search).has('workspace');
  const fillSms =
    (location.pathname === '/messaging/sms' || location.pathname === '/messaging/email/compose')
    && isCompactDashboardShell;
  const isWorkflowEditor = /^\/messaging\/email\/automations\/.+/.test(location.pathname);
  const canContainWorkflow = useMediaQuery('(min-width: 1024px) and (min-height: 700px)');
  const lockWorkflowEditor = isWorkflowEditor && canContainWorkflow;
  // Availability + Shoot History calendar desktop (xl+) own overflow inside the
  // cards. App.tsx used to only slap !overflow-hidden on <main>, which never
  // made main a flex column or hid the footer — flex-1/h-full children had no
  // bounded height. Shoot History list/grid/map still scroll inside the page
  // when the calendar is not active.
  // Always call useMediaQuery (Rules of Hooks). Gating the hook behind pathname
  // crashed DashboardLayout when navigating Dashboard → /availability ("This
  // view could not load" via ErrorBoundary).
  const isDesktopCalendarViewport = useMediaQuery('(min-width: 1280px)');
  const fillDesktopCalendar =
    (location.pathname === '/availability' || location.pathname === '/shoot-history')
    && isDesktopCalendarViewport;
  // The compact shell keeps 12px at the sides (Availability's gutter) and 6px
  // above the page. Pages must not add extra horizontal padding on compact.
  const compactBottomInset = useCompactShell ? bottomNavHeight : 0;
  const lockCompactDashboard = useCompactShell && isDashboardRoute;
  const lockMainScroll =
    isCallsWorkspace || isSupportWorkspace || lockCompactDashboard || isStudioWorkspace || fillSms || lockWorkflowEditor || fillDesktopCalendar;
  const contentPadding = useCompactShell
    ? `${isStudioWorkspace || fillSms ? 'p-0' : 'px-3 pt-1.5'} ${compactBottomInset > 0 || lockCompactDashboard ? '' : 'pb-20'}`
    : fillSms
      ? 'p-0'
      : 'p-3';
  // Filled dashboard cards ignore main padding-bottom on phones. Publish the
  // measured nav height as a variable; .dashboard-mobile-page consumes it.
  const compactMainStyle = compactBottomInset > 0
    ? {
        ...(lockCompactDashboard ? {} : { paddingBottom: compactBottomInset }),
        ['--mobile-bottom-nav-height' as string]: `${compactBottomInset}px`,
      }
    : undefined;
  const shouldHideFooter =
    hideFooter || isCallsWorkspace || isSupportWorkspace || lockCompactDashboard || fillDesktopCalendar ||
    location.pathname === '/ai-editing' ||
    location.pathname.startsWith('/chat-with-reproai') ||
    location.pathname === '/messaging/sms' ||
    location.pathname === '/messaging/email/compose' ||
    isWorkflowEditor;
  
  // Photographers and editors get a simplified layout without sidebar
  const isSimplifiedLayout = role === 'photographer' || role === 'editor';

  const handleStopImpersonating = React.useCallback(() => {
    stopImpersonating();
    navigate('/accounts', { replace: true });
  }, [navigate, stopImpersonating]);

  if (isInsideDashboardLayout) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <DashboardLayoutContext.Provider value={true}>
      {/* The viewport rule keeps the dynamic height after its legacy fallback;
          combining h-screen and h-dvh lets Tailwind's h-screen rule win. */}
      <div className="dashboard-viewport flex overflow-hidden">
        {!useCompactShell && !isSimplifiedLayout && <Sidebar />}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isImpersonating && user && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Viewing as <strong>{user.name || user.email}</strong> ({formatUserRoleLabel(user.role, user)})</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleStopImpersonating}
                className="h-7 text-xs bg-white dark:bg-slate-950 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200"
              >
                <LogOut className="mr-2 h-3 w-3" />
                Exit View
              </Button>
            </div>
          )}
          {!hideNavbar && <Navbar />}
          {/* Main content area (single scrollbar) */}
          <ErrorBoundary>
            <PageLoadingBoundary key={`${location.pathname}:${user?.id ?? 'guest'}:${role}`} bottomInset={compactBottomInset}>
              {isDashboardRoute && <DashboardRefreshNotice />}
            <main style={compactMainStyle} className={`flex-1 min-w-0 min-h-0 ${lockMainScroll ? 'flex flex-col overflow-hidden overflow-x-hidden' : 'overflow-y-auto'} overscroll-y-contain [-webkit-overflow-scrolling:touch] bg-background text-foreground ${contentPadding} ${className || ''}`}>
              <PageTransition className={lockMainScroll ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden' : 'flex flex-col min-h-full'}>
                <EmailVerificationNotice>
                  {isCallsWorkspace || isSupportWorkspace || lockCompactDashboard || fillSms || fillDesktopCalendar ? (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children || <Outlet />}</div>
                  ) : (
                    children || <Outlet />
                  )}
                </EmailVerificationNotice>
              </PageTransition>
              {!shouldHideFooter && (
                <footer className="border-t border-border/40 mt-8 py-4 text-center text-[11px] text-muted-foreground">
                  © {new Date().getFullYear()} R/E Pro Photos ·{' '}
                  <Link
                    to="/terms-and-conditions"
                    className="transition-colors hover:text-foreground"
                  >
                    Terms and Conditions
                  </Link>{' '}
                  ·{' '}
                  <Link
                    to="/privacy-policy"
                    className="transition-colors hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </footer>
              )}
            </main>
            </PageLoadingBoundary>
          </ErrorBoundary>
          {useCompactShell && <MobileMenu onBottomNavHeightChange={setBottomNavHeight} />}
        </div>
      </div>
      {listingStudioOpen && (
        <React.Suspense fallback={null}>
          <ListingStudioDialog key={`${user?.id}:${role}:${user?.secondary_roles?.join(',')}:${location.search}`} initialTab={listingStudioTab === 'requests' || listingStudioTab === 'subscriptions' ? listingStudioTab : undefined} onClose={closeListingStudio} />
        </React.Suspense>
      )}
    </DashboardLayoutContext.Provider>
  );
};

export default DashboardLayout;
import { DashboardRefreshNotice } from '@/components/dashboard/DashboardRefreshNotice';
