import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getVoiceSettings, updateVoiceSettings } from '@/services/voice';
import { CallsQueryError } from './workspace/CallsQueryError';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceAutomationRules } from '@/services/voiceAutomations';
import { VoiceAutomationBuilder } from './workspace/VoiceAutomationBuilder';

const rules = [
  { key: 'missed_call_callback', label: 'Missed call', detail: 'When an inbound call is missed, queue a callback.' },
  { key: 'failed_transfer_callback', label: 'Failed staff transfer', detail: 'When a handoff does not connect, queue a callback.' },
  { key: 'shoot_reminder', label: 'Shoot reminder', detail: 'Call ahead of a booked shoot.' },
  { key: 'delivery_follow_up', label: 'Delivery follow-up', detail: 'Follow up after media is delivered.' },
  { key: 'unpaid_invoice_reminder', label: 'Unpaid invoice reminder', detail: 'Remind callers about an open invoice.' },
] as const;
export default function CallsAutomations() {
  const cache = useQueryClient();
  const { can } = usePermissions();
  const { toast } = useToast();
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const customRules = useQuery({ queryKey: ['voice-automation-rules'], queryFn: getVoiceAutomationRules });
  const update = useMutation({
    mutationFn: ({ key, checked }: { key: string; checked: boolean }) => updateVoiceSettings({ automation_toggles: { ...settings.data?.automation_toggles, [key]: checked } }),
    onSuccess: (data) => { cache.setQueryData(['voice-settings'], data); toast({ title: 'Automation updated' }); },
    onError: (error) => toast({ title: 'Could not update automation', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' }),
  });
  if (settings.isError) return <CallsQueryError message="Could not load automation settings." retry={() => void settings.refetch()} />;
  return <div className="space-y-5">
    <header className="calls-page-heading flex flex-wrap items-start justify-between gap-3"><div><h2>Automations</h2><p>Clear triggers, reviewable actions and real outcomes.</p></div><Button asChild className="calls-secondary h-11"><Link to="/calls/follow-ups">View callback activity</Link></Button></header>
    {settings.isLoading && <p role="status" className="text-sm text-[var(--calls-muted)]">Loading automations…</p>}
    {customRules.isError && <CallsQueryError message="Could not load custom workflows. Standard controls are paused until their ownership can be checked." retry={() => void customRules.refetch()} />}
    <section className="space-y-3" aria-label="Standard automations"><h3 className="text-sm font-semibold">Standard rules</h3>{rules.map((rule) => {
      const managed = customRules.data?.managed_triggers.includes(rule.key);
      const enabled = !managed && Boolean(settings.data?.automation_toggles?.[rule.key]);
      return <article key={rule.key} className="calls-panel flex items-start justify-between gap-4 p-5"><div><h4 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-[var(--calls-brand)]" />{rule.label}</h4><p className="mt-2 text-sm text-[var(--calls-muted)]">{rule.detail}</p><span className={`calls-chip mt-3 ${enabled ? 'calls-chip-success' : 'calls-chip-neutral'}`}>{managed ? 'Managed by custom workflow' : enabled ? 'On' : 'Off'}</span></div><Switch aria-label={rule.label} checked={enabled} disabled={!can('voice-calls', 'manage') || update.isPending || !settings.data || !customRules.data || Boolean(managed)} onCheckedChange={(checked) => update.mutate({ key: rule.key, checked })} /></article>;
    })}</section>
    <section className="calls-panel p-5"><h3 className="font-semibold">After-hours coverage</h3><p className="mt-2 text-sm text-[var(--calls-muted)]">{settings.data?.quiet_hours?.enabled ? settings.data.out_of_hours_message || `Quiet hours ${settings.data.quiet_hours.start}–${settings.data.quiet_hours.end}` : 'Quiet hours are off.'}</p><Button asChild variant="ghost" className="mt-2 h-11"><Link to="/calls/schedule">Edit business hours</Link></Button></section>
    <VoiceAutomationBuilder />
  </div>;
}
