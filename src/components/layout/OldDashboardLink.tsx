import { ExternalLink } from 'lucide-react';
import { OLD_DASHBOARD_URL } from '@/config/oldDashboard';
import { cn } from '@/lib/utils';

interface OldDashboardLinkProps {
  placement: 'sidebar' | 'navbar';
  isCollapsed?: boolean;
}

export function OldDashboardLink({ placement, isCollapsed = false }: OldDashboardLinkProps) {
  return (
    <a
      href={OLD_DASHBOARD_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Old Dashboard (opens in a new tab)"
      title="Old Dashboard (opens in a new tab)"
      className={cn(
        'relative flex shrink-0 items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        placement === 'sidebar'
          ? 'gap-3 px-3 py-2 text-sm'
          : 'h-10 gap-1.5 text-xs font-medium sm:gap-2 sm:px-2 sm:text-sm',
        isCollapsed && 'justify-center p-2',
      )}
    >
      <ExternalLink aria-hidden="true" className={placement === 'sidebar' ? 'h-5 w-5 shrink-0' : 'h-4 w-4 shrink-0'} />
      {!isCollapsed && (
        <span className={placement === 'navbar' ? 'max-w-[64px] leading-tight sm:max-w-none sm:whitespace-nowrap' : undefined}>
          Old Dashboard
        </span>
      )}
    </a>
  );
}
