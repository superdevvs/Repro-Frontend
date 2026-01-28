import React from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from './NavLink';
import { ExpandableNavLink } from './ExpandableNavLink';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Link } from 'react-router-dom';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
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
  Upload,
  Search,
  Sparkles,
} from 'lucide-react';

interface SidebarLinksProps {
  isCollapsed: boolean;
  role: string;
}

export function SidebarLinks({ isCollapsed, role }: SidebarLinksProps) {
  const { pathname } = useLocation();
  const permission = usePermission();
  
  // Define permissions for each section
  const dashboardPermission = permission.forResource('dashboard');
  const shootsPermission = permission.forResource('shoots');
  const accountsPermission = permission.forResource('accounts');
  const invoicesPermission = permission.forResource('invoices');
  const availabilityPermission = permission.forResource('availability');

  const isChatActive = pathname === '/chat-with-reproai';

  return (
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
      
      {/* Book Shoot link - only those who can book shoots */}
      {shootsPermission.canBook() && (
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
      
      {/* Accounts link */}
      {accountsPermission.canView() && (
        <>
          <NavLink
            to="/accounts"
            icon={<BuildingIcon className="h-5 w-5" />}
            label="Accounts"
            isCollapsed={isCollapsed}
            isActive={pathname === '/accounts'}
          />
          <NavLink
            to="/scheduling-settings"
            icon={<Settings2Icon className="h-5 w-5" />}
            label="Scheduling"
            isCollapsed={isCollapsed}
            isActive={pathname === '/scheduling-settings'}
          />
        </>
      )}

      {/* Exclusive Listings */}
      {(role === 'admin' || role === 'superadmin' || role === 'salesRep' || role === 'client' || role === 'sales_rep') && (
        <NavLink
          to="/portal"
          icon={<Search className="h-5 w-5" />}
          label="Exclusive Listings"
          isCollapsed={isCollapsed}
          isActive={pathname === '/portal' || pathname.startsWith('/exclusive-listings')}
        />
      )}
      
      {/* Accounting - Available to all roles with role-specific labels */}
      {(() => {
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
      {role === 'client' && (
        <NavLink
          to="/messaging/email/inbox"
          icon={<Mail className="h-5 w-5" />}
          label="Messaging"
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith('/messaging/email')}
        />
      )}
      {/* Messaging - Expandable with Emails and SMS for admins */}
      {(role === 'admin' || role === 'superadmin' || role === 'sales_rep') && (
        <ExpandableNavLink
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messaging"
          isCollapsed={isCollapsed}
          defaultTo="/messaging/overview"
          subItems={[
            { to: '/messaging/email/inbox', label: 'Emails' },
            { to: '/messaging/sms', label: 'SMS' },
          ]}
        />
      )}
      
      {/* Availability */}
      {availabilityPermission.canView() && (
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
      {(role === 'admin' || role === 'superadmin') && (
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
      {(role === 'client' || role === 'admin' || role === 'superadmin') && (
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
  );
}