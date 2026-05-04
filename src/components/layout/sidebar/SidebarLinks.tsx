import React from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from './NavLink';
import { ExpandableNavLink } from './ExpandableNavLink';
import { usePermission } from '@/hooks/usePermission';
import { useLinkedSharedVisibility } from '@/hooks/useLinkedSharedVisibility';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Link } from 'react-router-dom';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  ClipboardIcon,
  HistoryIcon,
  BuildingIcon,
  CalendarIcon,
  BarChart3Icon,
  Settings2Icon,
  MapPinIcon,
  TestTubeIcon,
  Mail,
  MessageSquare,
  Link2,
  Upload,
  Crown,
  Sparkles,
} from 'lucide-react';

interface SidebarLinksProps {
  isCollapsed: boolean;
  role: string;
}

const SidebarLinksSkeleton = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <div className="flex flex-col gap-2 p-2 pt-4">
    {Array.from({ length: 10 }).map((_, index) => (
      <div
        key={index}
        className={cn(
          'flex h-10 items-center gap-3 rounded-xl px-3',
          isCollapsed && 'justify-center px-2'
        )}
      >
        <Skeleton className="h-5 w-5 rounded-md" />
        {!isCollapsed && (
          <Skeleton
            className={cn(
              'h-4 rounded-md',
              index === 0 && 'w-24',
              index === 1 && 'w-28',
              index === 2 && 'w-32',
              index === 3 && 'w-24',
              index === 4 && 'w-28',
              index > 4 && index % 2 === 0 && 'w-36',
              index > 4 && index % 2 !== 0 && 'w-24'
            )}
          />
        )}
      </div>
    ))}
  </div>
);

export function SidebarLinks({ isCollapsed, role }: SidebarLinksProps) {
  const { pathname } = useLocation();
  const navListRef = React.useRef<HTMLDivElement | null>(null);
  const [activeIndicator, setActiveIndicator] = React.useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const permission = usePermission();
  const linkedSharedVisibility = useLinkedSharedVisibility();
  const isEditingManager = role === 'editing_manager';
  const canViewShared = linkedSharedVisibility.data.hasLinkedAccounts;
  
  // Define permissions for each section
  const dashboardPermission = permission.forResource('dashboard');
  const shootsPermission = permission.forResource('shoots');
  const accountsPermission = permission.forResource('accounts');
  const availabilityPermission = permission.forResource('availability');
  const canBookShoot = permission.can('book-shoot', 'create');
  const canViewScheduling = permission.can('scheduling-settings', 'view');
  const canViewPortal = permission.can('portal', 'view');
  const canViewAccounting = permission.can('accounting', 'view');
  const canViewEmailInbox = permission.can('messaging-email', 'view');
  const canViewMessagingOverview = permission.can('messaging-overview', 'view');
  const canViewSms = permission.can('messaging-sms', 'view');
  const canViewAiEditing = permission.can('ai-editing', 'view');
  const canViewRobbie = permission.can('robbie', 'view');

  const isChatActive = pathname === '/chat-with-reproai';

  const measureActiveIndicator = React.useCallback(() => {
    const container = navListRef.current;
    const activeElement = container?.querySelector<HTMLElement>('[data-sidebar-active="true"]');

    if (!container || !activeElement) {
      setActiveIndicator(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();

    setActiveIndicator({
      top: activeRect.top - containerRect.top,
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, []);

  const previewActiveIndicator = React.useCallback((activeElement: HTMLElement) => {
    const container = navListRef.current;

    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();

    setActiveIndicator({
      top: activeRect.top - containerRect.top,
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, []);

  React.useLayoutEffect(() => {
    measureActiveIndicator();
    window.addEventListener('resize', measureActiveIndicator);

    return () => window.removeEventListener('resize', measureActiveIndicator);
  }, [pathname, role, canViewShared, canBookShoot, canViewScheduling, canViewPortal, canViewAccounting, canViewEmailInbox, canViewMessagingOverview, canViewSms, canViewAiEditing, canViewRobbie, measureActiveIndicator]);

  React.useLayoutEffect(() => {
    setActiveIndicator(null);

    let frameId = 0;
    const settleTimer = window.setTimeout(measureActiveIndicator, 240);

    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(measureActiveIndicator);
    });

    return () => {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(frameId);
    };
  }, [isCollapsed, measureActiveIndicator]);

  if (permission.isLoading || linkedSharedVisibility.loading) {
    return <SidebarLinksSkeleton isCollapsed={isCollapsed} />;
  }

  return (
    <div ref={navListRef} className="relative flex flex-1 flex-col gap-2 p-2">
      {activeIndicator && (
        <motion.div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-10 rounded-xl ring-1 ring-sidebar-border dark:ring-white/5',
            isCollapsed
              ? 'bg-sidebar-primary/20 ring-sidebar-primary/30 dark:bg-sidebar-primary/40 dark:ring-sidebar-primary/40'
              : 'bg-[linear-gradient(90deg,hsl(var(--sidebar-primary)/0.18)_0%,hsl(var(--sidebar-primary)/0.11)_46%,hsl(var(--sidebar-accent)/0.7)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--sidebar-primary)/0.62)_0%,hsl(var(--sidebar-primary)/0.26)_42%,hsl(var(--sidebar-accent)/0.55)_100%)]'
          )}
          initial={false}
          animate={activeIndicator}
          transition={{
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      )}
      {/* Dashboard link - everyone with dashboard view permission can see this */}
      {dashboardPermission.canView() && (
        <NavLink
          to="/dashboard"
          icon={<HomeIcon className="h-5 w-5" />}
          label="Dashboard"
          isCollapsed={isCollapsed}
          isActive={pathname === '/dashboard'}
          onActivePreview={previewActiveIndicator}
        />
      )}
      
      {/* Book Shoot link - only those who can book shoots (not editing_manager) */}
      {canBookShoot && (
        <NavLink
          to="/book-shoot"
          icon={<ClipboardIcon className="h-5 w-5" />}
          label="Book Shoot"
          isCollapsed={isCollapsed}
          isActive={pathname === '/book-shoot'}
          onActivePreview={previewActiveIndicator}
        />
      )}
      
      {/* Shoot History - main shoots management page */}
      {shootsPermission.canView() && (
        <NavLink
          to="/shoot-history"
          icon={<HistoryIcon className="h-5 w-5" />}
          label="Shoot History"
          isCollapsed={isCollapsed}
          isActive={pathname === '/shoot-history' || pathname.startsWith('/shoots')}
          onActivePreview={previewActiveIndicator}
        />
      )}
      {canViewShared && (
        <NavLink
          to="/shared"
          icon={<Link2 className="h-5 w-5" />}
          label="Shared"
          isCollapsed={isCollapsed}
          isActive={pathname === '/shared'}
          onActivePreview={previewActiveIndicator}
        />
      )}
      
      {/* Accounts link */}
      {accountsPermission.canView() && (
        <NavLink
          to="/accounts"
          icon={<BuildingIcon className="h-5 w-5" />}
          label="Accounts"
          isCollapsed={isCollapsed}
          isActive={pathname === '/accounts'}
          onActivePreview={previewActiveIndicator}
        />
      )}
      {canViewScheduling && !isEditingManager && (
        <NavLink
          to="/scheduling-settings"
          icon={<Settings2Icon className="h-5 w-5" />}
          label="Scheduling"
          isCollapsed={isCollapsed}
          isActive={pathname === '/scheduling-settings'}
          onActivePreview={previewActiveIndicator}
        />
      )}

      {/* Exclusive Listings */}
      {canViewPortal && (
        <NavLink
          to="/portal"
          icon={<Crown className="h-5 w-5" />}
          label="Exclusive Listings"
          isCollapsed={isCollapsed}
          isActive={pathname === '/portal' || pathname.startsWith('/exclusive-listings')}
          onActivePreview={previewActiveIndicator}
          activeIconClassName="[&_svg]:text-yellow-600 dark:[&_svg]:text-amber-300"
          animateIconOnActive
        />
      )}
      
      {/* Accounting - hidden for editor */}
      {canViewAccounting && (() => {
        const accountingMode = getAccountingMode(role);
        const config = accountingConfigs[accountingMode];
        return (
          <NavLink
            to="/accounting"
            icon={<BarChart3Icon className="h-5 w-5" />}
            label={config.sidebarLabel}
            isCollapsed={isCollapsed}
            isActive={pathname === '/accounting'}
            onActivePreview={previewActiveIndicator}
          />
        );
      })()}
      
      {/* Messaging - Simple link for clients, expandable for admins */}
      {canViewEmailInbox && !canViewMessagingOverview && !canViewSms && (
        <NavLink
          to="/messaging/email/inbox"
          icon={<Mail className="h-5 w-5" />}
          label={role === 'client' ? 'Contact' : 'Messaging'}
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith('/messaging/email')}
          onActivePreview={previewActiveIndicator}
        />
      )}
      {/* Messaging - Expandable with Emails and SMS for admins */}
      {(canViewMessagingOverview || canViewSms) && (
        <ExpandableNavLink
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messaging"
          isCollapsed={isCollapsed}
          defaultTo={canViewMessagingOverview ? "/messaging/overview" : "/messaging/sms"}
          onActivePreview={previewActiveIndicator}
          subItems={[
            ...(canViewEmailInbox ? [{ to: '/messaging/email/inbox', label: 'Emails' }] : []),
            ...(canViewSms ? [{ to: '/messaging/sms', label: 'SMS' }] : []),
          ]}
        />
      )}
      
      {/* Availability */}
      {availabilityPermission.canView() && !isEditingManager && role !== 'client' && (
        <NavLink
          to="/availability"
          icon={<CalendarIcon className="h-5 w-5" />}
          label="Availability"
          isCollapsed={isCollapsed}
          isActive={pathname === '/availability'}
          onActivePreview={previewActiveIndicator}
        />
      )}
      
      {/* Development/Testing Links - Remove in production */}
      {import.meta.env.VITE_ENV === 'development' && (
        <>
          <div className="border-t border-gray-200 my-2"></div>
          <div className={`px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isCollapsed ? 'text-center' : ''}`}>
            {!isCollapsed && 'Testing'}
          </div>
          <NavLink
            to="/address-lookup-demo"
            icon={<MapPinIcon className="h-5 w-5" />}
            label="Address Lookup Demo"
            isCollapsed={isCollapsed}
            isActive={pathname === '/address-lookup-demo'}
            onActivePreview={previewActiveIndicator}
          />
          <NavLink
            to="/book-shoot-enhanced"
            icon={<TestTubeIcon className="h-5 w-5" />}
            label="Enhanced Book Shoot"
            isCollapsed={isCollapsed}
            isActive={pathname === '/book-shoot-enhanced'}
            onActivePreview={previewActiveIndicator}
          />
          <NavLink
            to="/test-client-form"
            icon={<ClipboardIcon className="h-5 w-5" />}
            label="Test Client Form"
            isCollapsed={isCollapsed}
            isActive={pathname === '/test-client-form'}
            onActivePreview={previewActiveIndicator}
          />
        </>
      )}

      {/* AI Editing link - admins only */}
      {canViewAiEditing && (
        <NavLink
          to="/ai-editing"
          icon={<Sparkles className="h-5 w-5" />}
          label="AI Editing"
          isCollapsed={isCollapsed}
          isActive={pathname === '/ai-editing' || pathname.startsWith('/ai-editing')}
          onActivePreview={previewActiveIndicator}
        />
      )}

      {/* Chat with Robbie - Special styled link - Above separator */}
      {/* Only visible to client, admin, superadmin */}
      {canViewRobbie && (
        <Link
          to="/chat-with-reproai"
          data-sidebar-active={isChatActive ? 'true' : undefined}
          onPointerDown={(event) => previewActiveIndicator(event.currentTarget)}
          className={cn(
            'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
            isChatActive 
              ? 'font-medium text-sidebar-accent-foreground dark:text-sidebar-primary-foreground' 
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            isCollapsed && 'justify-center p-2'
          )}
        >
          <ReproAiIcon
            useSolid={isChatActive}
            className={cn(
              'relative z-20 h-5 w-5 flex-shrink-0',
              isChatActive && 'text-sidebar-primary-foreground'
            )}
          />
          {!isCollapsed && (
            <span className="relative z-20 leading-tight">
              Chat with
              <br />
              Robbie
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
