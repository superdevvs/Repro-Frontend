
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { PageTransition } from './PageTransition';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileMenu from './MobileMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AlertCircle, LogOut } from 'lucide-react';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, className }) => {
  const isMobile = useIsMobile();
  const { isImpersonating, user, stopImpersonating, role } = useAuth();
  const contentPadding = isMobile ? 'p-2 pb-20' : 'p-3 pb-10';
  
  // Photographers and editors get a simplified layout without sidebar
  const isSimplifiedLayout = role === 'photographer' || role === 'editor';

  return (
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
              onClick={stopImpersonating}
              className="h-7 text-xs bg-white dark:bg-slate-950 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200"
            >
              <LogOut className="mr-2 h-3 w-3" />
              Exit View
            </Button>
          </div>
        )}
        <Navbar />
        {/* Main content area (single scrollbar) */}
        <ErrorBoundary>
          <main className={`flex-1 min-h-0 overflow-y-auto bg-background text-foreground ${contentPadding} ${className || ''}`}>
            {children || <Outlet />}
          </main>
        </ErrorBoundary>
        {isMobile && <MobileMenu />}
      </div>
    </div>
  );
};

export default DashboardLayout;
