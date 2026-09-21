import { usePageLoading } from '@/hooks/use-page-loading';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { getVoiceSettings, getVoiceLlmUsage, updateVoiceSettings } from '@/services/voice';
import type { VoiceSettings } from '@/types/voice';
import CallsNumbers from './CallsNumbers';
import OutboundModeControl from './workspace/OutboundModeControl';
import { useToast } from '@/hooks/use-toast';
import { CallsQueryError } from './workspace/CallsQueryError';
import { usePermissions } from '@/context/PermissionsContext';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { BrowserPhoneConnectButton } from '@/components/voice/BrowserPhoneControls';

const voiceTools = [
  'verify_caller',
  'get_shoot_details',
  'list_shoots',
  'get_payment_status',
  'get_availability',
  'book_shoot',
  'reschedule_shoot',
  'cancel_shoot',
  'create_payment_link',
  'handoff_to_staff',
  'transfer_to_staff',
];

export default function CallsSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canManage = can('voice-calls', 'manage');
  const phone = useBrowserPhone();
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const usage = useQuery({ queryKey: ['voice-llm-usage'], queryFn: getVoiceLlmUsage });
  usePageLoading(settings.isLoading || usage.isLoading);

  const [draft, setDraft] = useState<Partial<VoiceSettings>>({});
  const save = useMutation({
    mutationFn: updateVoiceSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['voice-health'] });
      toast({ title: 'Call settings saved' });
    },
    onError: (error) => toast({ title: 'Could not save call settings', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });

  useEffect(() => {
    if (settings.data) {
      setDraft(settings.data);
    }
  }, [settings.data]);

  if (settings.isError) return <CallsQueryError message="Could not load call settings. Your saved settings have not changed." retry={() => void settings.refetch()} />;
  if (!settings.data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[28px] font-semibold leading-9">The lines, the rules, the quiet parts.</h2>
        <p className="mt-1 text-sm text-[var(--calls-muted)]">Numbers, recording, routing, and the tools Robbie may use. Nothing here is decorative.</p>
        {!permissionsLoading && !canManage && <p className="mt-2 text-sm text-[var(--calls-muted)]">You can review these settings. Manage Calls permission is required to change them.</p>}
      </div>
      <CallsNumbers />
      <section className="calls-panel p-5">
        <h3 className="text-lg font-semibold">Team live calling</h3>
        <p className="mt-2 text-sm text-[var(--calls-muted)]">
          {phone.config?.ready ? 'Staff can call from the browser, select audio devices, mute, hold callers and use the keypad. Authorized supervisors can listen, coach staff privately, or join a supported call.' : phone.config?.blockers?.[0] || 'Browser calling readiness is unavailable. Calls permissions and a configured phone connection are required.'}
        </p>
        <div className="mt-3"><BrowserPhoneConnectButton /></div>
      </section>
      <fieldset disabled={!canManage} className="min-w-0 space-y-4">
      <section className="calls-panel space-y-4 p-5">
        <OutboundModeControl
          mode={draft.outbound_mode}
          canaryNumbers={draft.canary_numbers}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
        />
        <ToggleRow
          title="Voice AI enabled"
          description="Controls whether the AI receptionist should answer and route calls."
          checked={draft.enabled ?? false}
          onChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
        />
        <ToggleRow
          title="Recording enabled"
          description="Only starts after disclosure and caller consent."
          checked={draft.recording_enabled ?? false}
          onChange={(checked) => setDraft((current) => ({ ...current, recording_enabled: checked }))}
        />
        <ToggleRow
          title="Allow unverified transfer"
          description="Permit transfer_to_staff before caller verification."
          checked={draft.allow_unverified_transfer ?? false}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, allow_unverified_transfer: checked }))
          }
        />
        <div className="space-y-1">
          <label className="text-sm font-medium">Support handoff number</label>
          <Input
            value={draft.support_handoff_number ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, support_handoff_number: event.target.value }))
            }
            placeholder="+12025550100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Initial routing prompt</label>
          <Textarea
            className="min-h-20"
            value={draft.gather_prompt ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, gather_prompt: event.target.value }))
            }
            placeholder="Tell me what you need, or press 1 for booking..."
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Quiet hours start</label>
            <Input
              type="time"
              value={draft.quiet_hours?.start ?? '20:00'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quiet_hours: { ...(current.quiet_hours ?? {}), start: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quiet hours end</label>
            <Input
              type="time"
              value={draft.quiet_hours?.end ?? '08:00'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quiet_hours: { ...(current.quiet_hours ?? {}), end: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Timezone</label>
            <Input
              value={draft.quiet_hours?.timezone ?? 'UTC'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quiet_hours: { ...(current.quiet_hours ?? {}), timezone: event.target.value },
                }))
              }
            />
          </div>
        </div>
        <ToggleRow
          title="Respect quiet hours"
          description="Defers scheduled callbacks until the quiet window ends."
          checked={draft.quiet_hours?.enabled ?? false}
          onChange={(checked) =>
            setDraft((current) => ({
              ...current,
              quiet_hours: { ...(current.quiet_hours ?? {}), enabled: checked },
            }))
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Callback retry delay minutes</label>
            <Input
              type="number"
              min={5}
              value={draft.callback_retry_delay_minutes ?? 60}
              onChange={(event) =>
                setDraft((current) => ({ ...current, callback_retry_delay_minutes: Number(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Max callback attempts</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={draft.callback_max_attempts ?? 3}
              onChange={(event) =>
                setDraft((current) => ({ ...current, callback_max_attempts: Number(event.target.value) }))
              }
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['missed_call_callback', 'Missed call callback'],
            ['failed_transfer_callback', 'Failed transfer callback'],
            ['shoot_reminder', 'Shoot reminder calls'],
            ['delivery_follow_up', 'Delivery follow-up calls'],
            ['unpaid_invoice_reminder', 'Unpaid invoice reminders'],
          ].map(([key, label]) => (
            <ToggleRow
              key={key}
              title={label}
              description="Enable this proactive voice automation."
              checked={draft.automation_toggles?.[key] ?? false}
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  automation_toggles: { ...(current.automation_toggles ?? {}), [key]: checked },
                }))
              }
            />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Enabled AI tools</h3>
              <p className="text-xs text-muted-foreground">Controls which voice tool bridge actions Robbie can use.</p>
            </div>
            {voiceTools.map((tool) => (
              <ToggleRow
                key={tool}
                title={tool}
                description="Allow this tool in voice conversations."
                checked={(draft.tool_allowlist ?? voiceTools).includes(tool)}
                onChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    tool_allowlist: toggleList(current.tool_allowlist ?? voiceTools, tool, checked),
                  }))
                }
              />
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Confirmation-gated tools</h3>
              <p className="text-xs text-muted-foreground">Require explicit confirmation before risky actions execute.</p>
            </div>
            {voiceTools.map((tool) => (
              <ToggleRow
                key={tool}
                title={tool}
                description="Require confirmation before this tool runs."
                checked={(draft.confirmation_gated_tools ?? ['book_shoot', 'reschedule_shoot', 'cancel_shoot', 'create_payment_link']).includes(tool)}
                onChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    confirmation_gated_tools: toggleList(
                      current.confirmation_gated_tools ?? ['book_shoot', 'reschedule_shoot', 'cancel_shoot', 'create_payment_link'],
                      tool,
                      checked
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Robbie Intelligence</h3>
              <p className="text-xs text-muted-foreground">Event-triggered enrichment with a monthly LLM budget.</p>
            </div>
            {usage.data && (
              <span className="text-xs text-muted-foreground">
                ${usage.data.spend_usd.toFixed(2)} / ${usage.data.budget_usd.toFixed(0)}
              </span>
            )}
          </div>
          {usage.data?.exceeded && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Robbie intelligence paused — monthly budget reached. Realtime signals still active.
            </div>
          )}
          <ToggleRow
            title="Intelligence enabled"
            description="Master switch for Robbie's mid-call enrichment."
            checked={draft.intelligence?.enabled ?? true}
            onChange={(checked) =>
              setDraft((current) => ({
                ...current,
                intelligence: { ...(current.intelligence ?? {}), enabled: checked },
              }))
            }
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">Monthly LLM budget (USD, 0 = unlimited)</label>
            <Input
              type="number"
              min={0}
              value={draft.intelligence?.monthly_llm_budget_usd ?? 50}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  intelligence: { ...(current.intelligence ?? {}), monthly_llm_budget_usd: Number(event.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Disclosure text</label>
          <Textarea
            className="min-h-28"
            value={draft.disclosure_text ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, disclosure_text: event.target.value }))
            }
            placeholder="Played to every caller before recording starts."
          />
        </div>
        <div className="flex justify-end">
          <Button className="calls-primary h-11 rounded-lg" onClick={() => canManage && save.mutate(draft)} disabled={!canManage || save.isPending}>
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </section>
      </fieldset>
    </div>
  );
}

function toggleList(items: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return items.includes(value) ? items : [...items, value];
  }

  return items.filter((item) => item !== value);
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
