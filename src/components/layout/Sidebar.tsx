
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion } from 'framer-motion';
import MobileMenu from './MobileMenu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarLinks } from './sidebar/SidebarLinks';
import { SidebarFooter } from './sidebar/SidebarFooter';

const SMALL_DESKTOP_BREAKPOINT = 1280;

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const isMobile = useIsMobile();
  const isSmallDesktop = typeof window !== 'undefined' && window.innerWidth < SMALL_DESKTOP_BREAKPOINT;
  const [isCollapsed, setIsCollapsed] = useState(isSmallDesktop);
  const manualOverride = useRef(false);
  const { user, role, logout } = useAuth();

  // Auto-collapse/expand when crossing the breakpoint, unless user manually toggled
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${SMALL_DESKTOP_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!manualOverride.current) {
        setIsCollapsed(!e.matches);
      }
      // Reset manual override when crossing breakpoint so auto-behavior resumes
      manualOverride.current = false;
    };
    // Set initial state
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  
  // For mobile devices, use the MobileMenu component
  if (isMobile) {
    return <MobileMenu />;
  }
  
  // Toggle sidebar collapse/expand manually
  const toggleCollapse = () => {
    manualOverride.current = true;
    setIsCollapsed(!isCollapsed);
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
        'group border-r bg-background p-3 py-4 relative hidden md:block',
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
