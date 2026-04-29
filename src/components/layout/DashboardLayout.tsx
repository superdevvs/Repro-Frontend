
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { PageTransition } from './PageTransition';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileMenu from './MobileMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AlertCircle, LogOut } from 'lucide-react';

const DashboardLayoutContext = React.createContext(false);

interface DashboardLayoutProps {
  children?: React.ReactNode;
  className?: string;
  hideNavbar?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, className, hideNavbar = false }) => {
  const isInsideDashboardLayout = React.useContext(DashboardLayoutContext);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isImpersonating, user, stopImpersonating, role } = useAuth();
  const contentPadding = isMobile ? 'p-3 pb-20' : 'p-3';
  
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
      <div className="h-screen flex overflow-hidden">
        {!isMobile && !isSimplifiedLayout && <Sidebar />}
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
            <main className={`flex-1 min-h-0 overflow-y-auto bg-background text-foreground ${contentPadding} ${className || ''}`}>
              <PageTransition className="flex flex-col min-h-full">
                {children || <Outlet />}
              </PageTransition>
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
            </main>
          </ErrorBoundary>
          {isMobile && <MobileMenu />}
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
};

export default DashboardLayout;
