
import React from 'react';
import { Button } from '@/components/ui/button';
import { NavLink } from './NavLink';
import { HelpCircle, SettingsIcon, LogOutIcon, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_ONBOARDING_STATE_EVENT,
  getDashboardOnboardingState,
  requestDashboardOnboardingReplay,
  type DashboardOnboardingSidebarState,
} from '@/lib/dashboardOnboardingEvents';

interface SidebarFooterProps {
  isCollapsed: boolean;
  logout: () => void;
  onToggleCollapse?: () => void;
}

export function SidebarFooter({ isCollapsed, logout, onToggleCollapse }: SidebarFooterProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [onboardingState, setOnboardingState] =
    React.useState<DashboardOnboardingSidebarState | null>(() => getDashboardOnboardingState());

  React.useEffect(() => {
    const handleOnboardingState = (event: Event) => {
      const detail = (event as CustomEvent<DashboardOnboardingSidebarState>).detail;
      setOnboardingState(detail ?? null);
    };

    window.addEventListener(DASHBOARD_ONBOARDING_STATE_EVENT, handleOnboardingState);
    return () => window.removeEventListener(DASHBOARD_ONBOARDING_STATE_EVENT, handleOnboardingState);
  }, []);
  
  return (
    <div className="mt-auto">
      {onboardingState?.visible && (
        <div className={cn('mb-2', isCollapsed && 'flex justify-center')}>
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'default'}
            className={cn(
              'text-primary hover:bg-primary/10 hover:text-primary',
              !isCollapsed && 'w-full justify-start',
              isCollapsed && 'h-10 w-10 p-0 justify-center'
            )}
            type="button"
            data-onboarding-replay=""
            onClick={() => {
              requestDashboardOnboardingReplay(onboardingState.roleKey);
              if (pathname !== '/dashboard') {
                navigate('/dashboard');
              }
            }}
            aria-label={onboardingState.label}
            title={onboardingState.label}
          >
            <HelpCircle className={cn('h-5 w-5', isCollapsed ? '' : 'mr-3')} />
            {!isCollapsed && <span>{onboardingState.label}</span>}
          </Button>
        </div>
      )}
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
          aria-label="Logout"
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
            data-sidebar-toggle
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            aria-controls="application-sidebar-content"
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
