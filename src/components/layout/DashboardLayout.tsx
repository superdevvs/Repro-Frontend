import MonitorNotifications from '@/features/server-monitor/MonitorNotifications';

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
  const [bottomNavHeight, setBottomNavHeight] = React.useState(0);
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
  const useCompactShell = isMobile || (isDashboardRoute && isCompactDashboardShell);
  const isStudioWorkspace = location.pathname === '/ai-editing' && new URLSearchParams(location.search).has('workspace');
  const fillSms =
    (location.pathname === '/messaging/sms' || location.pathname === '/messaging/email/compose')
    && isCompactDashboardShell;
  // The compact shell keeps 12px at the sides (Availability's gutter) and 6px
  // above the page. Pages must not add extra horizontal padding on compact.
  const compactBottomInset = useCompactShell ? bottomNavHeight : 0;
  const lockCompactDashboard = useCompactShell && isDashboardRoute;
  const lockMainScroll = lockCompactDashboard || isStudioWorkspace || fillSms;
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
    hideFooter || lockCompactDashboard || location.pathname === '/ai-editing' ||
    location.pathname.startsWith('/chat-with-reproai') ||
    location.pathname === '/messaging/sms' ||
    location.pathname === '/messaging/email/compose';
  
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
      <MonitorNotifications />
      {/* The viewport rule keeps the dynamic height after its legacy fallback;
          combining h-screen and h-dvh lets Tailwind's h-screen rule win. */}
      <div className="dashboard-viewport flex overflow-hidden">
        {!useCompactShell && !isSimplifiedLayout && <Sidebar />}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isImpersonating && user && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Viewing as <strong>{user.name || user.email}</strong></span>
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
            <PageLoadingBoundary key={`${location.pathname}:${user?.id ?? 'guest'}:${role}`} bottomInset={useCompactShell ? bottomNavHeight : 0}>
            <main style={compactMainStyle} className={`flex-1 min-w-0 min-h-0 ${lockMainScroll ? 'flex flex-col overflow-hidden overflow-x-hidden' : 'overflow-y-auto'} overscroll-y-contain [-webkit-overflow-scrolling:touch] bg-background text-foreground ${contentPadding} ${className || ''}`}>
              <PageTransition className={lockMainScroll ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden' : 'flex flex-col min-h-full'}>
                <EmailVerificationNotice>
                  {lockCompactDashboard || fillSms ? (
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
    </DashboardLayoutContext.Provider>
  );
};

export default DashboardLayout;
