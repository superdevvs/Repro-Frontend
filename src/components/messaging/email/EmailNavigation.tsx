import { Link, useLocation } from 'react-router-dom';
import { Mail, FileText, Zap, Settings, Pencil, RotateCcw, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { canSendExternalEmail } from '@/utils/messagingRoles';
import { usePermission } from '@/hooks/usePermission';
import { isSupportInbox, MESSAGING_SUPPORT_URL } from '@/pages/messaging/messagingSupport';

export function EmailNavigation() {
  const { pathname, search } = useLocation();
  const { role } = useAuth();
  const permission = usePermission();
  const isClient = role === 'client';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canManageMessaging = canSendExternalEmail(role);
  const supportSelected = pathname === '/messaging/email/inbox' && isSupportInbox(search);
  const canViewEmail = permission.can('messaging-email', 'view');
  const showComposeButton = pathname !== '/messaging/email/compose' && !supportSelected && canViewEmail && permission.can('messaging-compose', 'create');

  const allTabs = [
    {
      to: '/messaging/email/inbox',
      icon: Mail,
      label: isAdmin ? 'Inbox' : isClient ? 'Contact' : 'Inbox',
      isActive: pathname.startsWith('/messaging/email/inbox') && !supportSelected,
      resource: 'messaging-email',
    },
    {
      to: MESSAGING_SUPPORT_URL,
      icon: LifeBuoy,
      label: 'Support',
      isActive: supportSelected,
      resource: 'support',
    },
    {
      to: '/messaging/email/templates',
      icon: FileText,
      label: 'Templates',
      isActive: pathname.startsWith('/messaging/email/templates'),
      hideForClient: true,
      resource: 'messaging-templates',
    },
    {
      to: '/messaging/email/automations',
      icon: Zap,
      label: 'Automations',
      isActive: pathname.startsWith('/messaging/email/automations'),
      hideForClient: true,
      resource: 'messaging-automations',
    },
    {
      to: '/messaging/email/recovery',
      icon: RotateCcw,
      label: 'Recovery',
      isActive: pathname.startsWith('/messaging/email/recovery'),
      hideForClient: true,
      resource: 'messaging-overview',
    },
    {
      to: '/messaging/settings',
      icon: Settings,
      label: 'Settings',
      isActive: pathname === '/messaging/settings',
      hideForClient: true,
      resource: 'messaging-settings',
    },
  ];

  // Support access does not grant access to email or staff administration.
  const tabs = allTabs.filter(tab => {
    if (!permission.can(tab.resource, 'view')) return false;
    if (tab.resource === 'support') return true;
    if (!canViewEmail) return false;
    return isClient ? !tab.hideForClient : canManageMessaging || tab.resource === 'messaging-email';
  });

  const composeLabel = isAdmin ? 'Compose' : isClient ? 'New Contact' : 'Compose';

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2">
        <nav aria-label="Messaging navigation" className="flex min-w-0 items-center gap-1 sm:gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.to}
                variant={tab.isActive ? 'secondary' : 'ghost'}
                size="sm"
                asChild
                className={cn(
                  'shrink-0 h-8 sm:h-9',
                  tab.isActive && 'bg-secondary font-medium'
                )}
              >
                <Link to={tab.to} aria-current={tab.isActive ? 'page' : undefined}>
                  <Icon className="h-4 w-4 mr-1.5 sm:mr-2" />
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </nav>
        {showComposeButton && (
          <Button
            variant="default"
            size="sm"
            asChild
            className="shrink-0 hidden sm:inline-flex"
          >
            <Link to="/messaging/email/compose">
              <Pencil className="h-4 w-4 mr-2" />
              {composeLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
