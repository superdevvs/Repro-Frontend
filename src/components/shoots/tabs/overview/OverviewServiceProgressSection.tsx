import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { ShootData } from '@/types/shoots';
import {
  formatServiceItemStatus,
  getShootServiceItems,
  type NormalizedShootServiceItem,
} from '@/utils/shootServiceItems';
import { CalendarClock } from 'lucide-react';

type OverviewServiceProgressSectionProps = {
  shoot: ShootData;
  compact?: boolean;
  canDeliver?: boolean;
  deliveringServiceItemId?: string | null;
  onDeliverServiceItem?: (shootServiceItemId: string) => void;
};

const scheduleFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const getProgressValue = (item: NormalizedShootServiceItem) => {
  const delivery = String(item.deliveryStatus || '').toLowerCase();
  const workflow = String(item.workflowStatus || '').toLowerCase();

  if (delivery === 'cancelled' || workflow === 'cancelled') return 100;
  if (delivery === 'delivered' || workflow === 'delivered') return 100;
  if (delivery === 'ready' || workflow === 'ready') return 75;
  if (workflow === 'in_progress') return 50;
  if (workflow === 'scheduled' || item.scheduledAt) return 25;
  return 8;
};

const getTimelineProgress = (items: NormalizedShootServiceItem[]) => {
  const deliverableItems = items.filter((item) => item.isDeliverable);
  const progressItems = deliverableItems.length ? deliverableItems : items;

  if (progressItems.length === 0) return 0;

  const average =
    progressItems.reduce((sum, item) => sum + getProgressValue(item), 0) / progressItems.length;

  return Math.round(average);
};

const formatSchedule = (value?: string | null) => {
  if (!value) return 'Order schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Order schedule';
  return scheduleFormatter.format(date);
};

const formatTimelineRange = (items: NormalizedShootServiceItem[]) => {
  const scheduledDates = items
    .map((item) => (item.scheduledAt ? new Date(item.scheduledAt) : null))
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (scheduledDates.length === 0) return 'Order schedule';

  const first = scheduleFormatter.format(scheduledDates[0]);
  const last = scheduleFormatter.format(scheduledDates[scheduledDates.length - 1]);

  return first === last ? first : `${first} - ${last}`;
};

const getCurrentTimelineStep = (items: NormalizedShootServiceItem[]) => {
  const orderedItems = [...items].sort((a, b) => {
    const left = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const right = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return left - right;
  });

  return orderedItems.find((item) => getProgressValue(item) < 100) ?? orderedItems[orderedItems.length - 1];
};

export function OverviewServiceProgressSection({
  shoot,
}: OverviewServiceProgressSectionProps) {
  const serviceItems = getShootServiceItems(shoot);

  if (serviceItems.length === 0) {
    return null;
  }

  const timelineProgress = getTimelineProgress(serviceItems);
  const currentStep = getCurrentTimelineStep(serviceItems);
  const deliveredCount = serviceItems.filter((item) => getProgressValue(item) === 100 && item.isDeliverable).length;
  const deliverableCount = serviceItems.filter((item) => item.isDeliverable).length || serviceItems.length;
  const sortedItems = [...serviceItems].sort((a, b) => {
    const left = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const right = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return left - right;
  });

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Shoot Progress</span>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatTimelineRange(sortedItems)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-semibold text-foreground">{timelineProgress}%</div>
          <div className="text-[10px] text-muted-foreground">
            {deliveredCount}/{deliverableCount} delivered
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Progress value={timelineProgress} className="h-2 rounded-full bg-muted [&>div]:bg-primary" />

        {currentStep && (
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{currentStep.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {formatSchedule(currentStep.scheduledAt)}
                  {currentStep.photographerName ? ` · ${currentStep.photographerName}` : ''}
                  {currentStep.editorName ? ` · Editor: ${currentStep.editorName}` : ''}
                </div>
              </div>
              <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
                {formatServiceItemStatus(currentStep.workflowStatus || currentStep.deliveryStatus)}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
