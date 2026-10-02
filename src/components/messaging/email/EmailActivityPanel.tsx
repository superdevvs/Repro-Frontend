import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Eye, MousePointerClick, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEmailActivity } from '@/services/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Message } from '@/types/messaging';

const labels: Record<string, string> = {
  sent: 'Sent', accepted: 'Accepted by provider', queued: 'Queued', delivered: 'Delivered',
  opened: 'Opened', clicked: 'Link clicked', bounced: 'Bounced', bounce: 'Bounced',
  complained: 'Spam complaint', spam: 'Spam complaint', failed: 'Failed', rejected: 'Rejected',
  suppressed: 'Suppressed', delivery_delayed: 'Delivery delayed', unsubscribed: 'Unsubscribed',
};

function eventTime(value: string | null): string {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

export function EmailActivityPanel({ message }: { message: Message }) {
  const { user, role } = useAuth();
  const enabled = message.direction === 'OUTBOUND' && ['RESEND', 'CAKEMAIL'].includes(message.provider ?? '');
  const activity = useQuery({
    queryKey: ['email-activity', user?.id, role, message.id], queryFn: () => getEmailActivity(message.id),
    enabled, refetchInterval: 30_000, retry: false,
  });
  if (!enabled) return null;
  const data = activity.data;
  const status = data?.status ?? message.status;
  const summary = [
    { label: 'Delivery', value: status.toLowerCase().replaceAll('_', ' '), icon: CheckCircle },
    { label: 'Opens', value: data ? String(data.open_count) : '—', icon: Eye },
    { label: 'Clicks', value: data ? String(data.click_count) : '—', icon: MousePointerClick },
  ];

  return (
    <section aria-label="Email activity" className="rounded-lg border border-border p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Email activity</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{message.provider === 'RESEND' ? 'Resend' : 'CakeMail'}</span>
          <Button variant="ghost" size="icon" aria-label="Refresh email activity" disabled={activity.isFetching}
            className="h-7 w-7" onClick={() => void activity.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${activity.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2">
        {summary.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-md bg-muted/50 p-2 sm:p-3 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" />{label}</div>
            <div className="mt-1 text-sm font-semibold capitalize break-words">{value}</div>
          </div>
        ))}
      </div>
      {activity.isLoading && <p className="text-xs text-muted-foreground" role="status">Loading email activity…</p>}
      {activity.isError && <p className="text-xs text-destructive" role="alert">Email activity could not be loaded. Try refreshing.</p>}
      {data && !data.provider_logs_available && <p className="text-xs text-muted-foreground">CakeMail logs are temporarily unavailable. Showing saved events.</p>}
      <p className="text-xs text-muted-foreground">Delivered means the recipient’s mail server accepted the email. Opens are reported when images load; privacy tools can affect open and click counts.</p>
      {data && (
        <details className="text-sm" open={data.events.some(event => ['rejected', 'suppressed', 'bounced', 'failed'].includes(event.type))}>
          <summary className="cursor-pointer font-medium">Event timeline ({data.events.length})</summary>
          {data.events.length ? (
            <ol className="mt-3 space-y-3 border-l border-border pl-3">
              {[...data.events].reverse().map((event, index) => (
                <li key={`${event.id}-${index}`} className="space-y-0.5">
                  <div className="font-medium">{labels[event.type] ?? event.type.replaceAll('_', ' ')}</div>
                  <div className="text-xs text-muted-foreground">{eventTime(event.at)}</div>
                  {event.detail && <p className="text-xs break-words">{event.detail}</p>}
                  {event.link && <p className="text-xs text-muted-foreground break-all">{event.link}</p>}
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-xs text-muted-foreground">No delivery or engagement events have been reported yet.</p>}
        </details>
      )}
    </section>
  );
}
