import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { getScheduleState } from '@/services/voice';
import type { ScheduleState, ScheduleStateName } from '@/types/voice';
import { cn } from '@/lib/utils';

const STATE_META: Record<ScheduleStateName, { icon: string; label: string; className: string }> = {
  team_open: { icon: '🟢', label: 'Team open', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  ai_only: { icon: '🟡', label: 'AI only', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  holiday_closed: { icon: '🔴', label: 'Holiday closed', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' },
  quiet_hours: { icon: '🌙', label: 'Quiet hours', className: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' },
  override_open: { icon: '🔵', label: 'Override open', className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  override_closed: { icon: '⚫', label: 'Override closed', className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
};

export function scheduleStateMeta(state?: ScheduleStateName | null) {
  return (state && STATE_META[state]) || STATE_META.ai_only;
}

interface ScheduleBadgeProps {
  compact?: boolean;
  className?: string;
  /** Provide a state directly (e.g. from the SSE stream) to skip the query. */
  state?: ScheduleState | null;
}

export default function ScheduleBadge({ compact = false, className, state }: ScheduleBadgeProps) {
  const query = useQuery({
    queryKey: ['voice-schedule-state'],
    queryFn: () => getScheduleState(),
    refetchInterval: 60_000,
    enabled: !state,
  });

  const resolved = state ?? query.data?.state ?? null;
  const meta = scheduleStateMeta(resolved?.state);
  const label = resolved?.label ? `${meta.label} · ${resolved.label}` : meta.label;

  return (
    <Badge variant="outline" className={cn('h-8 gap-2 px-3 text-xs font-medium', meta.className, className)}>
      <span aria-hidden>{meta.icon}</span>
      {compact ? meta.label : label}
    </Badge>
  );
}
