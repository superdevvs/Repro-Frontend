import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const artwork = {
  shoots: '01-upcoming-shoots', requests: '02-requests', completed: '03-completed-shoots',
  assignments: '04-assignments', photos: '05-photos', videos: '06-videos', tours: '07-tours-floor-plans',
  availability: '08-availability', slideshows: '09-slideshows', clear: '10-all-caught-up',
  shared: '11-shared-files', scanning: '12-scanning', accounts: '13-accounts',
  linked: '14-linked-accounts', listings: '15-listings', invoices: '16-invoices', payments: '17-payments',
  expenses: '18-expenses', reports: '19-reports', equipment: '20-equipment', services: '21-services',
  discounts: '22-discounts', branding: '23-branding', map: '24-service-areas', email: '25-email',
  conversations: '26-conversations', calls: '27-calls', notifications: '28-notifications',
  templates: '29-templates', automations: '30-automations', integrations: '31-integrations',
  studio: '32-studio', activity: '33-activity', downloads: '34-downloads', permissions: '35-permissions', search: '36-search',
} as const;

export type EmptyStateIcon = keyof typeof artwork;

/** Static decorative artwork. The adjacent heading supplies the accessible name. */
export function EmptyStateArtwork({ icon, className }: { icon: EmptyStateIcon; className?: string }) {
  return <img src={`/illustrations/empty-state/${artwork[icon]}.svg`} width={96} height={96} alt="" aria-hidden="true" draggable={false} className={cn('h-24 w-24 shrink-0 select-none object-contain', className)} />;
}

export interface EmptyStateProps {
  icon: EmptyStateIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Callers supply their existing permission-gated controls; this component grants no capabilities. */
  action?: ReactNode;
  children?: ReactNode;
  size?: 'compact' | 'default';
  className?: string;
}

export function EmptyState({ icon, title, description, action, children, size = 'default', className }: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div className={cn('flex min-w-0 flex-col items-center justify-center text-center', compact ? 'gap-2 px-3 py-5' : 'gap-3 px-5 py-8 sm:py-10', className)}>
      <EmptyStateArtwork icon={icon} className={compact ? 'h-16 w-16' : 'h-24 w-24 sm:h-28 sm:w-28'} />
      <h3 className={cn('max-w-sm font-semibold text-foreground', compact ? 'text-sm' : 'text-lg leading-snug sm:text-xl')}>{title}</h3>
      {description && <div className={cn('max-w-sm text-muted-foreground', compact ? 'text-xs leading-relaxed' : 'text-sm leading-relaxed')}>{description}</div>}
      {(action || children) && <div className="mt-2 flex max-w-full flex-wrap items-center justify-center gap-2">{action}{children}</div>}
    </div>
  );
}
