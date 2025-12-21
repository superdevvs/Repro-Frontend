import { Link, useLocation } from 'react-router-dom';
import { Mail, FileText, Zap, Settings, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';

export function EmailNavigation() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isClient = role === 'client';

  const allTabs = [
    {
      to: '/messaging/email/inbox',
      icon: Mail,
      label: 'Inbox',
      isActive: pathname.startsWith('/messaging/email/inbox') && pathname !== '/messaging/email/compose',
    },
    {
      to: '/messaging/email/templates',
      icon: FileText,
      label: 'Templates',
      isActive: pathname.startsWith('/messaging/email/templates'),
      hideForClient: true,
    },
    {
      to: '/messaging/email/automations',
      icon: Zap,
      label: 'Automations',
      isActive: pathname.startsWith('/messaging/email/automations'),
      hideForClient: true,
    },
    {
      to: '/messaging/settings',
      icon: Settings,
      label: 'Settings',
      isActive: pathname === '/messaging/settings',
      hideForClient: true,
    },
  ];

  // Filter tabs based on role - clients only see Inbox
  const tabs = isClient 
    ? allTabs.filter(tab => !tab.hideForClient)
    : allTabs;

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.to}
                variant={tab.isActive ? 'secondary' : 'ghost'}
                size="sm"
                asChild
                className={cn(
                  'shrink-0',
                  tab.isActive && 'bg-secondary font-medium'
                )}
              >
                <Link to={tab.to}>
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </div>
        <Button
          variant={pathname === '/messaging/email/compose' ? 'default' : 'default'}
          size="sm"
          asChild
          className="shrink-0"
        >
          <Link to="/messaging/email/compose">
            <Pencil className="h-4 w-4 mr-2" />
            Compose
          </Link>
        </Button>
      </div>
    </div>
  );
}

