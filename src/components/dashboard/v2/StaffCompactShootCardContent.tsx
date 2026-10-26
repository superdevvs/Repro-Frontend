import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';

import { ShootActionRequestBadges } from '@/components/shoots/ShootActionRequests';
import { cn } from '@/lib/utils';
import type { DashboardShootSummary } from '@/types/dashboard';
import { getDashboardShootDisplayDate } from '@/utils/dashboardShootSchedule';
import { formatWorkflowStatus } from '@/utils/status';

interface StaffCompactShootCardContentProps {
  shoot: DashboardShootSummary;
  formattedTime: string;
  statusClass: string;
  hideClientInfo: boolean;
  submittedForReview?: boolean;
  actions?: ReactNode;
}

/** Admin-style compact cards retain the current staff member's visibility/actions. */
export function StaffCompactShootCardContent({
  shoot,
  formattedTime,
  statusClass,
  hideClientInfo,
  submittedForReview,
  actions,
}: StaffCompactShootCardContentProps) {
  const shootDate = getDashboardShootDisplayDate(shoot);
  const validDate = shootDate && !Number.isNaN(shootDate.getTime()) ? shootDate : null;
  const month = validDate?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() ?? '--';
  const day = validDate ? String(validDate.getDate()) : '--';
  const weekday = validDate?.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() ?? '';

  return (
    <div className="min-w-0" data-compact-shoot="true">
      <ShootActionRequestBadges shoot={shoot} className="mb-2" />
      <div className="grid min-h-[62px] min-w-0 grid-cols-[48px,minmax(0,1fr)] items-center gap-x-3 gap-y-2 min-[360px]:grid-cols-[48px,minmax(0,1fr),auto] sm:min-h-[68px] sm:grid-cols-[56px,minmax(0,1fr),auto] sm:gap-4">
        <div className="row-span-2 rounded-xl border border-border/80 bg-muted/40 px-2 py-2 text-center shadow-sm min-[360px]:row-span-1 dark:bg-muted/20">
          <p className="text-[9px] font-semibold leading-none text-muted-foreground sm:text-[10px]">{month}</p>
          <p className="mt-0.5 text-lg font-bold leading-none text-foreground sm:text-xl">{day}</p>
          <p className="mt-1 text-[9px] font-semibold leading-none text-muted-foreground sm:text-[10px]">{weekday}</p>
        </div>
        <div className="min-w-0 border-l border-border/60 pl-3">
          <h3 className="cursor-text select-text truncate text-sm font-semibold text-foreground sm:text-base" title={shoot.addressLine}>
            {shoot.addressLine}
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-xs">
            <MapPin size={10} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{shoot.cityStateZip}</span>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-xs">
            {!hideClientInfo && <>
            <span className="shrink-0">Client</span>
            <span className="truncate font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span>
            </>}
            <span className="shrink-0">{hideClientInfo ? 'Shoot' : '•'} #{shoot.id}</span>
          </p>
        </div>
        <div className="col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-l border-border/60 pl-3 min-[360px]:col-start-auto min-[360px]:h-full min-[360px]:min-w-[76px] min-[360px]:flex-col min-[360px]:flex-nowrap min-[360px]:items-end min-[360px]:justify-center min-[360px]:border-l-0 min-[360px]:pl-0 sm:min-w-[96px]">
          <span className="whitespace-nowrap text-xs font-semibold text-primary sm:text-sm">{formattedTime || '--'}</span>
          <span className={cn(
            'inline-flex max-w-[76px] items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:max-w-[96px] sm:text-[11px]',
            statusClass,
          )}>
            <span className="truncate">{formatWorkflowStatus(shoot.workflowStatus || shoot.status)}</span>
          </span>
          {actions}
        </div>
      </div>
      {submittedForReview && <p className="mt-2 text-right text-[10px] text-emerald-500">Submitted for review</p>}
    </div>
  );
}
