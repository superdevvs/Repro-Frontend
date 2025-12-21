import React, { useState } from 'react';
import { DashboardActivityItem } from '@/types/dashboard';
import { Card } from './SharedComponents';
import { Switch } from '@/components/ui/switch';
import {
  Clock,
  UploadCloud,
  ClipboardCheck,
  Users2,
  MessageSquare,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityMonitorCardProps {
  activity: DashboardActivityItem[];
}

const ACTIVITY_MAP: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  upload: { icon: <UploadCloud size={16} />, color: 'bg-sky-500/10 text-sky-500', label: 'Upload' },
  qc: { icon: <ClipboardCheck size={16} />, color: 'bg-amber-500/10 text-amber-600', label: 'QC' },
  assignment: { icon: <Users2 size={16} />, color: 'bg-emerald-500/10 text-emerald-600', label: 'Assignment' },
  review: { icon: <MessageSquare size={16} />, color: 'bg-purple-500/10 text-purple-500', label: 'Review' },
  alert: { icon: <AlertTriangle size={16} />, color: 'bg-rose-500/10 text-rose-600', label: 'Alert' },
  info: { icon: <Info size={16} />, color: 'bg-muted text-muted-foreground', label: 'Update' },
};

const getActivityVisual = (type: string) => ACTIVITY_MAP[type] || ACTIVITY_MAP.info;

export const ActivityMonitorCard: React.FC<ActivityMonitorCardProps> = ({ activity }) => {
  const [live, setLive] = useState(true);

  return (
    <Card className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Latest updates</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full border', live ? 'border-emerald-200 text-emerald-600' : 'border-border')}>
            <span className={cn('h-2 w-2 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
            Live
          </span>
          <Switch checked={live} onCheckedChange={setLive} />
        </div>
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
        {activity.slice(0, 6).map((item) => {
          const visual = getActivityVisual(item.type);
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 p-3 hover:border-primary/40 transition-colors"
            >
              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', visual.color)}>
                {visual.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.message}</p>
                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                  <Clock size={12} />
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                  {item.userName ? ` • ${item.userName}` : ''}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {visual.label}
              </span>
            </div>
          );
        })}
        {activity.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">No activity logged yet today.</div>
        )}
      </div>
    </Card>
  );
};

