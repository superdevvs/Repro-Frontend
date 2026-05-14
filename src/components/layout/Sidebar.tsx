
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion } from 'framer-motion';
import MobileMenu from './MobileMenu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarLinks } from './sidebar/SidebarLinks';
import { SidebarFooter } from './sidebar/SidebarFooter';

const SMALL_DESKTOP_BREAKPOINT = 1520;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'repro.sidebar.collapsed';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const isMobile = useIsMobile();
  const [isNarrowDesktop, setIsNarrowDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < SMALL_DESKTOP_BREAKPOINT,
  );
  const [manualCollapsedPref, setManualCollapsedPref] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return stored === null ? null : stored === 'true';
  });
  const { user, role, logout } = useAuth();

  // Track whether the viewport is below the small-desktop breakpoint.
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SMALL_DESKTOP_BREAKPOINT - 1}px)`);
    const handler = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsNarrowDesktop(event.matches);
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Force collapse below the breakpoint; otherwise honor the stored manual preference.
  const isCollapsed = isNarrowDesktop ? true : (manualCollapsedPref ?? false);

  // For mobile devices, use the MobileMenu component
  if (isMobile) {
    return <MobileMenu />;
  }

  // Toggle sidebar collapse/expand manually (only meaningful at wide viewports).
  const toggleCollapse = () => {
    if (isNarrowDesktop) {
      // Below the breakpoint we always stay collapsed; no-op.
      return;
    }
    const next = !isCollapsed;
    setManualCollapsedPref(next);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
  };
  
  // Desktop sidebar
  return (
    <motion.div
      initial={false}
      animate={{
        width: isCollapsed ? 80 : 210,
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'group bg-background p-3 py-4 relative hidden md:block',
        isCollapsed && 'items-center',
        className
      )}
    >
      <div className="flex h-full flex-col">
        <SidebarHeader isCollapsed={isCollapsed} />
        
        <ScrollArea className="flex-1 overflow-auto">
          <SidebarLinks isCollapsed={isCollapsed} role={role} />
        </ScrollArea>
        
        <SidebarFooter isCollapsed={isCollapsed} logout={logout} onToggleCollapse={toggleCollapse} />
      </div>
    </motion.div>
  );
}
