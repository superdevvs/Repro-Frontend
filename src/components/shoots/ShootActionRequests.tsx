import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPendingShootActionRequests, type ShootActionRequestFields } from '@/utils/shootActionRequests';

function requestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function ShootActionRequestBadges({ shoot, className, iconOnly = false }: { shoot: ShootActionRequestFields; className?: string; iconOnly?: boolean }) {
  const requests = getPendingShootActionRequests(shoot);
  if (!requests.length) return null;
  return <span className={cn('inline-flex max-w-full flex-wrap items-center gap-1', className)} aria-label="Requested actions">
    {requests.map(request => <span key={request.type}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300 bg-amber-50 py-0.5 text-[10px] font-semibold leading-tight text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200', iconOnly ? 'px-1' : 'px-2')}
      title={[request.label, 'Awaiting review', request.reason, requestDate(request.requestedAt)].filter(Boolean).join(' · ')}>
      <Clock3 aria-hidden="true" className="h-3 w-3 shrink-0" /><span className={iconOnly ? 'sr-only' : undefined}>{request.label}</span>
    </span>)}
  </span>;
}

export function ShootActionRequestBanner({ shoot, className }: { shoot: ShootActionRequestFields; className?: string }) {
  const requests = getPendingShootActionRequests(shoot);
  if (!requests.length) return null;
  return <div role="status" aria-label="Requested actions" className={cn('space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100', className)}>
    {requests.map(request => <div key={request.type} className="flex items-start gap-2">
      <Clock3 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold">{request.label} · Awaiting review</span>
          {requestDate(request.requestedAt) && <time dateTime={request.requestedAt} className="text-[10px] opacity-80">{requestDate(request.requestedAt)}</time>}
        </div>
        {request.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs">{request.reason}</p>}
      </div>
    </div>)}
  </div>;
}
