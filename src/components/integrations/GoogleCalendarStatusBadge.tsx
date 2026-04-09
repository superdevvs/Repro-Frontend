import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GoogleCalendarStatusBadgeProps {
  available?: boolean;
  connected?: boolean;
  syncEnabled?: boolean;
}

export function GoogleCalendarStatusBadge({
  available = true,
  connected = false,
  syncEnabled = false,
}: GoogleCalendarStatusBadgeProps) {
  const label = !available
    ? 'Not Configured'
    : connected && syncEnabled
      ? 'Connected'
      : connected
        ? 'Disabled'
        : 'Not Connected';

  return (
    <Badge
      variant="secondary"
      className={cn(
        'border',
        !available && 'border-amber-200 bg-amber-50 text-amber-700',
        available && connected && syncEnabled && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        available && !connected && 'border-slate-200 bg-slate-50 text-slate-700',
        available && connected && !syncEnabled && 'border-orange-200 bg-orange-50 text-orange-700',
      )}
    >
      {label}
    </Badge>
  );
}
