import { Progress } from '@/components/ui/progress';
import type { ShootData } from '@/types/shoots';
import {
  getShootServiceItems,
  type NormalizedShootServiceItem,
} from '@/utils/shootServiceItems';
import {
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';
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

const parseSchedule = (value?: string | null) => {
  if (!value) return null;
  const date = formatDateForWallClockInput(value);
  const time = formatTimeForWallClockInput(value) || '00:00';
  if (!date) return null;

  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTimelineRange = (items: NormalizedShootServiceItem[]) => {
  const scheduledDates = items
    .map((item) => parseSchedule(item.scheduledAt))
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (scheduledDates.length === 0) return 'Order schedule';

  const first = scheduleFormatter.format(scheduledDates[0]);
  const last = scheduleFormatter.format(scheduledDates[scheduledDates.length - 1]);

  return first === last ? first : `${first} - ${last}`;
};

type TimelineCheckpoint = {
  key: string;
  label: string;
  detail: string;
  position: number;
  progress: number;
};

const buildTimelineCheckpoints = (items: NormalizedShootServiceItem[]): TimelineCheckpoint[] => {
  const scheduledItems = items
    .map((item) => {
      const date = parseSchedule(item.scheduledAt);
      return date ? { item, date, timestamp: date.getTime() } : null;
    })
    .filter((entry): entry is { item: NormalizedShootServiceItem; date: Date; timestamp: number } => Boolean(entry))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (scheduledItems.length === 0) return [];

  const groups = new Map<number, typeof scheduledItems>();
  scheduledItems.forEach((entry) => {
    const existing = groups.get(entry.timestamp) || [];
    existing.push(entry);
    groups.set(entry.timestamp, existing);
  });

  const orderedGroups = Array.from(groups.entries()).sort(([left], [right]) => left - right);
  const firstTimestamp = orderedGroups[0][0];
  const lastTimestamp = orderedGroups[orderedGroups.length - 1][0];
  const timelineSpan = lastTimestamp - firstTimestamp;

  return orderedGroups.map(([timestamp, group], index) => {
    const primaryItem = group[0].item;
    const serviceNames = group.map((entry) => entry.item.name).filter(Boolean);
    const position = timelineSpan > 0
      ? ((timestamp - firstTimestamp) / timelineSpan) * 100
      : orderedGroups.length === 1
        ? 50
        : (index / (orderedGroups.length - 1)) * 100;

    return {
      key: `${timestamp}-${index}`,
      label: scheduleFormatter.format(group[0].date),
      detail: group.length === 1
        ? primaryItem.name
        : `${group.length} services`,
      position: Math.min(92, Math.max(8, position)),
      progress: Math.round(group.reduce((sum, entry) => sum + getProgressValue(entry.item), 0) / group.length),
    };
  });
};

export function OverviewServiceProgressSection({
  shoot,
}: OverviewServiceProgressSectionProps) {
  const serviceItems = getShootServiceItems(shoot);

  if (serviceItems.length === 0) {
    return null;
  }

  const timelineProgress = getTimelineProgress(serviceItems);
  const deliveredCount = serviceItems.filter((item) => getProgressValue(item) === 100 && item.isDeliverable).length;
  const deliverableCount = serviceItems.filter((item) => item.isDeliverable).length || serviceItems.length;
  const sortedItems = [...serviceItems].sort((a, b) => {
    const left = parseSchedule(a.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const right = parseSchedule(b.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const checkpoints = buildTimelineCheckpoints(sortedItems);

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

      <div className="space-y-1.5">
        {checkpoints.length > 0 && (
          <div className="relative h-4">
            {checkpoints.map((checkpoint) => (
              <span
                key={`${checkpoint.key}-label`}
                className="absolute top-0 max-w-24 -translate-x-1/2 truncate text-center text-[10px] font-medium leading-4 text-muted-foreground"
                style={{ left: `${checkpoint.position}%` }}
                title={`${checkpoint.label} · ${checkpoint.detail}`}
              >
                {checkpoint.label}
              </span>
            ))}
          </div>
        )}

        <div className="relative h-4">
          <Progress value={timelineProgress} className="absolute top-1 h-2 rounded-full bg-muted [&>div]:bg-primary" />

          {checkpoints.map((checkpoint) => (
            <span
              key={checkpoint.key}
              className={[
                'absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 shadow-sm',
                checkpoint.progress >= 100
                  ? 'border-emerald-500 bg-emerald-500'
                  : checkpoint.progress >= 50
                    ? 'border-primary bg-primary'
                    : 'border-primary bg-card',
              ].join(' ')}
              style={{ left: `${checkpoint.position}%` }}
              title={`${checkpoint.label} · ${checkpoint.detail}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
