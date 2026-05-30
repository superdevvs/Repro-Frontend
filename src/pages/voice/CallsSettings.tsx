import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { getVoiceSettings, getVoiceLlmUsage, updateVoiceSettings } from '@/services/voice';
import type { VoiceSettings } from '@/types/voice';

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
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const usage = useQuery({ queryKey: ['voice-llm-usage'], queryFn: getVoiceLlmUsage });
  const [draft, setDraft] = useState<Partial<VoiceSettings>>({});
  const save = useMutation({
    mutationFn: updateVoiceSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-settings'], data);
    },
  });

  useEffect(() => {
    if (settings.data) {
      setDraft(settings.data);
    }
  }, [settings.data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4 text-blue-600" /> Voice Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
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
