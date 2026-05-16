import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, PhoneForwarded, RefreshCw, Workflow, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cancelScheduledVoiceCall, getScheduledVoiceCalls, getVoiceSettings, retryScheduledVoiceCall } from '@/services/voice';

const automationLabels: Record<string, string> = {
  missed_call_callback: 'Missed call callback',
  failed_transfer_callback: 'Failed transfer callback',
  shoot_reminder: 'Shoot reminder',
  delivery_follow_up: 'Delivery follow-up',
  unpaid_invoice_reminder: 'Unpaid invoice reminder',
};

export default function CallsAutomations() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const scheduled = useQuery({
    queryKey: ['scheduled-voice-calls'],
    queryFn: () => getScheduledVoiceCalls({ per_page: 25 }),
  });
  const retry = useMutation({
    mutationFn: retryScheduledVoiceCall,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] }),
  });
  const cancel = useMutation({
    mutationFn: cancelScheduledVoiceCall,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] }),
  });

  const toggles = settings.data?.automation_toggles ?? {};
  const rows = scheduled.data?.data ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4 text-blue-600" /> Automation Rules
          </CardTitle>
          <p className="text-sm text-muted-foreground">Configured in Voice Settings and executed through scheduled calls.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(automationLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 text-blue-600" />
                {label}
              </div>
              <Badge variant={toggles[key] ? 'default' : 'secondary'}>{toggles[key] ? 'On' : 'Off'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Callback Queue
          </CardTitle>
          <p className="text-sm text-muted-foreground">Missed calls, failed transfers, and proactive call attempts.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.target_phone}</span>
                    <Badge variant="outline">{item.status}</Badge>
                    {item.automation_type && <Badge variant="secondary">{automationLabels[item.automation_type] ?? item.automation_type}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.summary || item.reason || 'Scheduled voice follow-up'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Next attempt: {item.next_attempt_at ? new Date(item.next_attempt_at).toLocaleString() : 'Not scheduled'} · Attempts {item.attempts}/{item.max_attempts}
                  </p>
                  {item.last_error && <p className="mt-1 text-xs text-red-600">{item.last_error}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => retry.mutate(item.id)} disabled={retry.isPending}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cancel.mutate(item.id)} disabled={cancel.isPending}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {scheduled.isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading scheduled calls...</div>}
          {!scheduled.isLoading && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <PhoneForwarded className="mx-auto mb-2 h-6 w-6" /> No scheduled calls yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
