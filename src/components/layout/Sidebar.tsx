
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
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  const [isHovered, setIsHovered] = useState(false);
  const { user, role, logout } = useAuth();
  
  // For mobile devices, use the MobileMenu component
  if (isMobile) {
    return <MobileMenu />;
  }
  
  // Auto-expand on hover, collapse when not hovering
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsCollapsed(false);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsCollapsed(true);
  };
  
  // Desktop sidebar
  return (
    <motion.div
      initial={false}
      animate={{
        width: isCollapsed ? 80 : 240,
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group border-r bg-background p-3 py-4 relative hidden md:block',
        isCollapsed && 'items-center',
        className
      )}
    >
      <div className="flex h-full flex-col">
        <SidebarHeader 
          isCollapsed={isCollapsed} 
          toggleCollapsed={() => setIsCollapsed(!isCollapsed)} 
        />
        
        <ScrollArea className="flex-1 overflow-auto">
          <SidebarLinks isCollapsed={isCollapsed} role={role} />
        </ScrollArea>
        
        <SidebarFooter isCollapsed={isCollapsed} logout={logout} />
      </div>
    </motion.div>
  );
}
