import React from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from './NavLink';
import { ExpandableNavLink } from './ExpandableNavLink';
import { usePermission } from '@/hooks/usePermission';
import { useLinkedSharedVisibility } from '@/hooks/useLinkedSharedVisibility';
import { cn } from '@/lib/utils';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Link } from 'react-router-dom';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
import { LayoutGroup } from 'framer-motion';
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

export function SidebarLinks({ isCollapsed, role }: SidebarLinksProps) {
  const { pathname } = useLocation();
  const permission = usePermission();
  const linkedSharedVisibility = useLinkedSharedVisibility();
  const isEditingManager = role === 'editing_manager';
  const canViewShared = role === 'client' && linkedSharedVisibility.data.hasLinkedAccounts;
  
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

  return (
    <LayoutGroup>
    <div className="flex flex-1 flex-col gap-2 p-2">
      {/* Dashboard link - everyone with dashboard view permission can see this */}
      {dashboardPermission.canView() && (
        <NavLink
          to="/dashboard"
          icon={<HomeIcon className="h-5 w-5" />}
          label="Dashboard"
          isCollapsed={isCollapsed}
          isActive={pathname === '/dashboard'}
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
        />
      )}
      {canViewShared && (
        <NavLink
          to="/shared"
          icon={<Link2 className="h-5 w-5" />}
          label="Shared"
          isCollapsed={isCollapsed}
          isActive={pathname === '/shared'}
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
        />
      )}
      {canViewScheduling && !isEditingManager && (
        <NavLink
          to="/scheduling-settings"
          icon={<Settings2Icon className="h-5 w-5" />}
          label="Scheduling"
          isCollapsed={isCollapsed}
          isActive={pathname === '/scheduling-settings'}
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
          />
        );
      })()}
      
      {/* Messaging - Simple link for clients, expandable for admins */}
      {canViewEmailInbox && !canViewMessagingOverview && !canViewSms && (
        <NavLink
          to="/messaging/email/inbox"
          icon={<Mail className="h-5 w-5" />}
          label="Messaging"
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith('/messaging/email')}
        />
      )}
      {/* Messaging - Expandable with Emails and SMS for admins */}
      {(canViewMessagingOverview || canViewSms) && (
        <ExpandableNavLink
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messaging"
          isCollapsed={isCollapsed}
          defaultTo={canViewMessagingOverview ? "/messaging/overview" : "/messaging/sms"}
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
          />
          <NavLink
            to="/book-shoot-enhanced"
            icon={<TestTubeIcon className="h-5 w-5" />}
            label="Enhanced Book Shoot"
            isCollapsed={isCollapsed}
            isActive={pathname === '/book-shoot-enhanced'}
          />
          <NavLink
            to="/test-client-form"
            icon={<ClipboardIcon className="h-5 w-5" />}
            label="Test Client Form"
            isCollapsed={isCollapsed}
            isActive={pathname === '/test-client-form'}
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
        />
      )}

      {/* Chat with Robbie - Special styled link - Above separator */}
      {/* Only visible to client, admin, superadmin */}
      {canViewRobbie && (
        <Link
          to="/chat-with-reproai"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative',
            isChatActive 
              ? 'bg-secondary/80 font-medium border border-primary/20 shadow-sm' 
              : 'text-muted-foreground hover:bg-secondary/50',
            isCollapsed && 'justify-center p-2'
          )}
        >
          <ReproAiIcon className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Chat with Robbie</span>}
        </Link>
      )}
    </div>
    </LayoutGroup>
  );
}
