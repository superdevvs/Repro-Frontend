import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Bell, CalendarClock, Plus, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useToast } from '@/hooks/use-toast';
import { cancelScheduledVoiceCall, getScheduledVoiceCalls, getVoiceSettings, retryScheduledVoiceCall, updateVoiceSettings } from '@/services/voice';
import ScheduleVoiceCallDialog from './ScheduleVoiceCallDialog';
import { formatWhen } from './workspace/callDisplay';
import { EmptyCalls } from './workspace/bits';
import { CallsQueryError } from './workspace/CallsQueryError';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceAutomationRules } from '@/services/voiceAutomations';
import { VoiceAutomationBuilder } from './workspace/VoiceAutomationBuilder';

const rules = [
  { key: 'missed_call_callback', label: 'Missed call callback', detail: 'Queue a callback when an inbound call is missed.' },
  { key: 'failed_transfer_callback', label: 'Failed transfer callback', detail: 'Retry when a handoff to staff does not connect.' },
  { key: 'shoot_reminder', label: 'Shoot reminder', detail: 'Call ahead of a booked shoot when this automation is on.' },
  { key: 'delivery_follow_up', label: 'Delivery follow-up', detail: 'Follow up after media is delivered.' },
  { key: 'unpaid_invoice_reminder', label: 'Unpaid invoice reminder', detail: 'Remind callers about an open invoice.' },
];

export default function CallsAutomations() {
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canManage = can('voice-calls', 'manage');
  const canOperate = can('voice-calls', 'operate');
  const { toast } = useToast();
  const [callbackPage, setCallbackPage] = useState(1);
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const customRules = useQuery({ queryKey: ['voice-automation-rules'], queryFn: getVoiceAutomationRules });
  const scheduled = useQuery({ queryKey: ['scheduled-voice-calls', callbackPage], queryFn: () => getScheduledVoiceCalls({ per_page: 40, page: callbackPage }) });
  usePageLoading(settings.isLoading || scheduled.isLoading);

  const retry = useMutation({
    mutationFn: retryScheduledVoiceCall,
    onError: (error) => toast({ title: 'Could not retry callback', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
      toast({ title: 'Callback retry queued' });
    },
  });
  const cancel = useMutation({
    mutationFn: cancelScheduledVoiceCall,
    onError: (error) => toast({ title: 'Could not cancel callback', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
      toast({ title: 'Callback cancelled' });
    },
  });
  const updateAutomation = useMutation({
    onError: (error) => toast({ title: 'Could not update automation', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
    mutationFn: ({ key, checked }: { key: string; checked: boolean }) =>
      updateVoiceSettings({ automation_toggles: { ...(settings.data?.automation_toggles ?? {}), [key]: checked } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
      toast({ title: 'Automation updated' });
    },
  });

  const rows = scheduled.data?.data ?? [];
  const toggles = settings.data?.automation_toggles ?? {};
  const counts = Object.fromEntries(rules.map((rule) => [rule.key, rows.filter((row) => row.automation_type === rule.key && ['scheduled', 'deferred', 'failed'].includes(row.status) && row.attempts < row.max_attempts).length]));

  if (settings.isError) return <CallsQueryError message="Could not load automation settings. Your saved rules have not changed." retry={() => void settings.refetch()} />;
  if (!settings.data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold leading-9">The work that happens after the hello.</h2>
          <p className="mt-1 text-sm text-[var(--calls-muted)]">Manage callback rules and review recent outcomes.</p>
          {!permissionsLoading && !canManage && <p className="mt-2 text-sm text-[var(--calls-muted)]">Manage Calls permission is required to change automation rules.</p>}
        </div>
        <ScheduleVoiceCallDialog
          trigger={
            <Button disabled={!canOperate} className="calls-primary h-11 rounded-lg">
              <Plus className="h-4 w-4" />
              Schedule callback
            </Button>
          }
        />
      </div>

      <VoiceAutomationBuilder />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <h3 className="font-semibold">Standard automations</h3>
          {rules.map((rule) => (
            <div key={rule.key} className="calls-panel flex items-start justify-between gap-4 p-4">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <Bell className="h-4 w-4 text-[var(--calls-brand)]" />
                  {rule.label}
                </p>
                <p className="mt-1 text-sm text-[var(--calls-muted)]">{rule.detail}</p>
                <p className="mt-2 text-xs text-[var(--calls-muted)]">{counts[rule.key] || 0} queued among the {rows.length} callbacks on this page</p>
                {customRules.data?.managed_triggers.some((key) => key === rule.key) && <p className="mt-2 text-xs text-[var(--calls-muted)]">Managed by custom workflows, including disabled or archived rules. This standard toggle is suppressed.</p>}
              </div>
              <Switch
                aria-label={rule.label}
                checked={!customRules.data?.managed_triggers.some((key) => key === rule.key) && (toggles[rule.key] ?? false)}
                onCheckedChange={(checked) => updateAutomation.mutate({ key: rule.key, checked })}
                disabled={!canManage || updateAutomation.isPending || !customRules.data || customRules.isError || customRules.data.managed_triggers.some((key) => key === rule.key)}
              />
            </div>
          ))}
          <div className="calls-panel p-4">
            <p className="font-medium">After-hours voicemail</p>
            <p className="mt-1 text-sm text-[var(--calls-muted)]">
              {settings.data?.quiet_hours?.enabled
                ? settings.data.out_of_hours_message || `Quiet hours ${settings.data.quiet_hours.start}–${settings.data.quiet_hours.end}`
                : 'Quiet hours are off. Configure them in Schedule.'}
            </p>
          </div>
        </section>

        <section className="calls-panel p-5">
          <p className="flex items-center gap-2 font-medium">
            <CalendarClock className="h-4 w-4 text-[var(--calls-brand)]" />
            Scheduled callbacks
          </p>
          <div className="mt-4 space-y-3">
            {rows.map((item) => (
              <div key={item.id} className="rounded-xl bg-[var(--calls-subtle)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.target_phone}</p>
                    <p className="text-sm text-[var(--calls-muted)]">{item.summary || item.reason || 'Scheduled follow-up'}</p>
                    <p className="mt-1 text-xs text-[var(--calls-muted)]">
                      {item.status} · {formatWhen(item.next_attempt_at || item.scheduled_at)} · {item.attempts}/{item.max_attempts}
                    </p>
                    {item.last_error && <p className="mt-1 text-xs text-[var(--calls-danger)]">{item.last_error}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => retry.mutate(item.id)} disabled={!canOperate || scheduled.isError || retry.isPending || item.status !== 'failed' || item.attempts >= item.max_attempts} aria-label="Retry">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => cancel.mutate(item.id)} disabled={!canOperate || scheduled.isError || cancel.isPending || !['scheduled', 'deferred', 'failed'].includes(item.status)} aria-label="Cancel">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {scheduled.isError && (
              <div role="alert" className="text-sm text-[var(--calls-danger)]">
                Could not load scheduled calls.
                <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void scheduled.refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {!scheduled.isLoading && !scheduled.isError && rows.length === 0 && (
              <EmptyCalls title="No scheduled calls yet" />
            )}
          </div>
          {(callbackPage > 1 || (scheduled.data?.last_page ?? 1) > 1) && <nav aria-label="Scheduled callback pages" className="mt-4 space-y-2 border-t border-[var(--calls-border)] pt-4">
            <p className="text-xs text-[var(--calls-muted)]">{scheduled.data ? `Page ${scheduled.data.current_page ?? callbackPage} of ${scheduled.data.last_page ?? callbackPage} · ${scheduled.data.total ?? rows.length} callbacks` : `Page ${callbackPage}`}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="calls-secondary h-11" disabled={callbackPage <= 1 || scheduled.isFetching} onClick={() => setCallbackPage((current) => current - 1)}>Previous callbacks</Button>
              <Button variant="outline" className="calls-secondary h-11" disabled={scheduled.isFetching || scheduled.isError || !scheduled.data || callbackPage >= (scheduled.data.last_page ?? 1)} onClick={() => setCallbackPage((current) => current + 1)}>Next callbacks</Button>
            </div>
          </nav>}
        </section>
      </div>
    </div>
  );
}
