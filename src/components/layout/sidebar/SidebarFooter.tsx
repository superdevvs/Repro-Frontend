
import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { NavLink } from './NavLink';
import { SettingsIcon, LogOutIcon, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SidebarFooterProps {
  isCollapsed: boolean;
  logout: () => void;
  onToggleCollapse?: () => void;
}

export function SidebarFooter({ isCollapsed, logout, onToggleCollapse }: SidebarFooterProps) {
  const { pathname } = useLocation();
  
  return (
    <div className="mt-auto">
      <Separator className="my-2" />
      <NavLink
        to="/settings"
        icon={<SettingsIcon className="h-5 w-5" />}
        label="Settings"
        isCollapsed={isCollapsed}
        isActive={pathname === '/settings'}
      />
      <div className={cn('mt-2', isCollapsed && 'flex justify-center')}>
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          className={cn(
            !isCollapsed && 'w-full justify-start',
            isCollapsed && 'h-10 w-10 p-0 justify-center'
          )}
          onClick={logout}
        >
          <LogOutIcon className={cn('h-5 w-5', isCollapsed ? '' : 'mr-3')} />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
      
      {/* Collapse/Expand Toggle Button */}
      {onToggleCollapse && (
        <div className={cn('mt-2', isCollapsed && 'flex justify-center')}>
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'default'}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              !isCollapsed && 'w-full justify-start',
              isCollapsed && 'h-10 w-10 p-0 justify-center'
            )}
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 mr-3" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
