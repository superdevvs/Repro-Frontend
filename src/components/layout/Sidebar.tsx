
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion } from 'framer-motion';
import MobileMenu from './MobileMenu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarLinks } from './sidebar/SidebarLinks';
import { SidebarFooter } from './sidebar/SidebarFooter';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false); // Start expanded by default
  const { user, role, logout } = useAuth();
  
  // For mobile devices, use the MobileMenu component
  if (isMobile) {
    return <MobileMenu />;
  }
  
  // Toggle sidebar collapse/expand manually
  const toggleCollapse = () => {
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
