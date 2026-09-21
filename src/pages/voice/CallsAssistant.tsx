import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bot, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useToast } from '@/hooks/use-toast';
import { getVoiceHealth, getVoiceLlmUsage, getVoiceSettings, syncVoiceAssistant, updateVoiceSettings } from '@/services/voice';
import type { VoiceOutboundMode } from '@/types/voice';
import NewCallDialog from './workspace/NewCallDialog';
import OutboundModeControl from './workspace/OutboundModeControl';
import { toolLabel } from './workspace/callDisplay';
import { CallsQueryError } from './workspace/CallsQueryError';
import { usePermissions } from '@/context/PermissionsContext';

export default function CallsAssistant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canManage = can('voice-calls', 'manage');
  const canOperate = can('voice-calls', 'operate');
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth });
  const usage = useQuery({ queryKey: ['voice-llm-usage'], queryFn: getVoiceLlmUsage });
  usePageLoading(settings.isLoading || health.isLoading);
  const [greeting, setGreeting] = useState('');
  const [disclosure, setDisclosure] = useState('');

  useEffect(() => {
    if (!settings.data) return;
    setGreeting(settings.data.greeting_text || settings.data.gather_prompt || '');
    setDisclosure(settings.data.disclosure_text || '');
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => updateVoiceSettings({ greeting_text: greeting, gather_prompt: greeting, disclosure_text: disclosure }),
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
      toast({ title: 'Robbie copy saved' });
      queryClient.invalidateQueries({ queryKey: ['voice-health'] });
    },
    onError: (error) => toast({ title: 'Could not save Robbie copy', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });

  const saveOutbound = useMutation({
    mutationFn: (next: { outbound_mode: VoiceOutboundMode; canary_numbers: string[] }) => updateVoiceSettings(next),
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['voice-health'] });
      toast({ title: 'Outbound calling updated' });
    },
    onError: (error) => toast({ title: 'Could not update outbound calling', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });

  const syncTools = useMutation({
    mutationFn: () => syncVoiceAssistant({ promote_to_main: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-health'] });
      toast({ title: 'Telnyx tools synced' });
    },
    onError: (error) => {
      toast({
        title: 'Unable to sync Telnyx tools',
        description: error instanceof Error ? error.message : 'Check the assistant configuration and try again.',
        variant: 'destructive',
      });
    },
  });

  const tools = settings.data?.tool_allowlist ?? [];
  const gated = settings.data?.confirmation_gated_tools ?? [];
  const sync = health.data?.assistant_sync;

  if (settings.isError) return <CallsQueryError message="Could not load Robbie settings. Your saved configuration has not changed." retry={() => void settings.refetch()} />;
  if (!settings.data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold leading-9">Robbie, in his own words.</h2>
          <p className="mt-1 text-sm text-[var(--calls-muted)]">Personality, greeting, and the tools he is actually allowed to use.</p>
          {!permissionsLoading && !canManage && <p className="mt-2 text-sm text-[var(--calls-muted)]">You can review Robbie’s configuration. Manage Calls permission is required to change it.</p>}
        </div>
        <NewCallDialog trigger={<Button disabled={!canOperate} className="calls-primary h-11 rounded-lg">Test with a real call</Button>} />
      </div>

      <section className="calls-panel p-5">
        <OutboundModeControl
          mode={settings.data?.outbound_mode ?? health.data?.outbound_mode}
          canaryNumbers={settings.data?.canary_numbers}
          disabled={!canManage || saveOutbound.isPending}
          onChange={(next) => saveOutbound.mutate(next)}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <section className="calls-panel p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4 text-[var(--calls-brand)]" />
            Greeting & disclosure
          </p>
          <label className="mt-4 block text-sm font-medium">What callers hear first</label>
          <Textarea disabled={!canManage} className="mt-2 min-h-28" value={greeting} onChange={(event) => setGreeting(event.target.value)} />
          <label className="mt-4 block text-sm font-medium">Recording disclosure</label>
          <Textarea disabled={!canManage} className="mt-2 min-h-24" value={disclosure} onChange={(event) => setDisclosure(event.target.value)} />
          <Button className="calls-primary mt-4 h-11 rounded-lg" disabled={!canManage || save.isPending} onClick={() => save.mutate()}>
            Save copy
          </Button>
        </section>

        <aside className="space-y-4">
          <section className="calls-panel p-5">
            <p className="text-sm font-medium">Quality now</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Voice" value={settings.data?.enabled ? 'Enabled' : 'Disabled'} />
              <Row
                label="Outbound"
                value={
                  settings.data?.outbound_mode === 'none'
                    ? 'Off'
                    : health.data?.can_place_calls
                      ? 'Ready'
                      : 'Blocked'
                }
              />
              <Row label="Assistant sync" value={sync?.status || 'unknown'} />
              <Row label="Policy prompt" value={sync?.policy_instructions_current ? 'Current' : 'Needs sync'} />
              <Row label="LLM spend" value={usage.data ? `$${usage.data.spend_usd.toFixed(2)} / $${usage.data.budget_usd.toFixed(0)}` : '—'} />
            </dl>
            {!health.data?.can_place_calls && health.data?.readiness_blockers?.length ? (
              <p className="mt-3 rounded-xl bg-[var(--calls-warning-soft)] p-3 text-xs text-[var(--calls-warning)]">
                {health.data.readiness_blockers.join(' ')}
              </p>
            ) : null}
          </section>
          <section className="calls-panel bg-[var(--calls-ai-soft)] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--calls-ai)]">
              <Sparkles className="h-4 w-4" />
              Live identity
            </p>
            <p className="mt-2 text-sm leading-6">
              {settings.data?.assistant_id || 'No assistant ID configured.'} · {health.data?.provider || settings.data?.provider || 'telnyx'}
            </p>
          </section>
        </aside>
      </div>

      <section className="calls-panel p-5">
        <h3 className="text-lg font-semibold">Capabilities</h3>
        <p className="mt-1 text-sm text-[var(--calls-muted)]">These are the tools currently on the allowlist. Risky ones stay confirmation-gated.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tools.length > 0 ? (
            tools.map((tool) => (
              <div key={tool} className="flex items-center gap-2 rounded-xl bg-[var(--calls-subtle)] px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-[var(--calls-brand)]" />
                <span className="truncate">{toolLabel(tool)}</span>
                {gated.includes(tool) && <span className="calls-chip calls-chip-warning ml-auto">Confirm</span>}
              </div>
            ))
          ) : (
            <div className="col-span-full flex items-center gap-2 text-sm text-[var(--calls-muted)]">
              <AlertCircle className="h-4 w-4" />
              No tools are enabled.
            </div>
          )}
        </div>
        {sync?.missing_tools?.length ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--calls-warning)]">
              Missing on Telnyx: {sync.missing_tools.map(toolLabel).join(', ')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="calls-secondary h-11 shrink-0 rounded-lg"
              disabled={!canManage || health.isError || syncTools.isPending}
              onClick={() => syncTools.mutate()}
            >
              {syncTools.isPending ? 'Syncing…' : 'Sync tools to Telnyx'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--calls-muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
