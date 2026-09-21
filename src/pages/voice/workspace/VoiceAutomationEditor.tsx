import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, Check, Clock3, Filter, FlaskConical, ListTodo, PhoneCall, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  automationError, previewVoiceAutomationRule, saveVoiceAutomationRule,
  type VoiceAutomationCondition, type VoiceAutomationDraft, type VoiceAutomationPreview, type VoiceAutomationRule,
  type VoiceAutomationSample, type VoiceAutomationTrigger,
} from '@/services/voiceAutomations';
import { formatWhen } from './callDisplay';
import { automationTriggers } from './voiceAutomationCatalog';
const fields: Record<VoiceAutomationTrigger, string[]> = {
  missed_call_callback: ['known_caller', 'direction', 'intent'], failed_transfer_callback: ['known_caller', 'direction', 'intent'],
  shoot_reminder: ['known_caller', 'shoot_status'], delivery_follow_up: ['known_caller', 'shoot_status'],
  unpaid_invoice_reminder: ['known_caller', 'amount_due', 'days_overdue'],
};
const fieldLabels: Record<string, string> = { known_caller: 'Customer matched', direction: 'Call direction', intent: 'Call intent', shoot_status: 'Shoot status', amount_due: 'Balance due ($)', days_overdue: 'Days overdue' };
const selectClass = 'h-11 min-w-0 w-full rounded-md border border-[var(--calls-border)] bg-[var(--calls-surface)] px-3 text-sm';
const defaultCondition = (field: string): VoiceAutomationCondition => ({ field, operator: ['amount_due', 'days_overdue'].includes(field) ? 'gte' : 'eq', value: field === 'known_caller' ? true : field === 'direction' ? 'INBOUND' : ['amount_due', 'days_overdue'].includes(field) ? 0 : '' });

const newAutomationDraft = (): VoiceAutomationDraft => ({
  name: '', trigger_type: 'missed_call_callback', enabled: false, conditions: [], delay_minutes: 60,
  quiet_hours: { enabled: true, start: '20:00', end: '08:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
  max_attempts: 3, retry_delay_minutes: 60, action_type: 'ai_callback', action_config: {},
});

export function VoiceAutomationEditor({ rule, assignees, onClose, onSaved }: {
  rule?: VoiceAutomationRule; assignees: { id: number; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<VoiceAutomationDraft>(() => rule ? structuredClone(rule) : newAutomationDraft());
  const [creationKey] = useState(() => crypto.randomUUID());
  const taskDraft = useRef<VoiceAutomationDraft['action_config']>(rule?.action_type === 'internal_task'
    ? structuredClone(rule.action_config) : { task_title: '', assigned_to_user_id: null });
  const [preview, setPreview] = useState<VoiceAutomationPreview | null>(null);
  const [sample, setSample] = useState<VoiceAutomationSample>({ known_caller: true, direction: 'INBOUND', intent: 'booking_or_reschedule', shoot_status: 'scheduled', amount_due: 250, days_overdue: 3, target_phone: '+12025550124' });
  const save = useMutation({ mutationFn: saveVoiceAutomationRule, onSuccess: onSaved });
  const dryRun = useMutation({ mutationFn: previewVoiceAutomationRule, onSuccess: setPreview });
  const change = (values: Partial<VoiceAutomationDraft>) => { setDraft((current) => ({ ...current, ...values })); setPreview(null); dryRun.reset(); save.reset(); };
  const changeSample = (values: Partial<VoiceAutomationSample>) => { setSample((current) => ({ ...current, ...values })); setPreview(null); dryRun.reset(); };
  const condition = (index: number, value: VoiceAutomationCondition) => change({ conditions: draft.conditions.map((item, i) => i === index ? value : item) });
  const chooseAction = (action: VoiceAutomationDraft['action_type']) => {
    if (draft.action_type === action) return;
    if (draft.action_type === 'internal_task') taskDraft.current = structuredClone(draft.action_config);
    change({ action_type: action, action_config: action === 'internal_task' ? structuredClone(taskDraft.current) : {} });
  };
  const isCall = ['missed_call_callback', 'failed_transfer_callback'].includes(draft.trigger_type);
  const isInvoice = draft.trigger_type === 'unpaid_invoice_reminder';

  return <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="calls-workspace max-w-3xl">
      <DialogHeader>
        <DialogTitle>{rule ? 'Edit automation' : 'Build an automation'}</DialogTitle>
        <DialogDescription>Choose what starts the workflow, when it runs and what it creates.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ id: rule?.id, draft, creationKey }); }}>
        <fieldset className="min-w-0 space-y-4" disabled={save.isPending || dryRun.isPending}>
        <div className="space-y-2"><Label htmlFor="automation-name">Rule name</Label><Input id="automation-name" required maxLength={100} value={draft.name} onChange={(event) => change({ name: event.target.value })} placeholder="Follow up with known customers" /></div>
        <section className="calls-panel space-y-3 p-4" aria-labelledby="trigger-title">
          <p id="trigger-title" className="flex items-center gap-2 font-medium"><Zap className="h-4 w-4 text-[var(--calls-brand)]" />1. When this happens</p>
          <Label className="sr-only" htmlFor="automation-trigger">Trigger</Label>
          <select id="automation-trigger" className={selectClass} value={draft.trigger_type} disabled={!!rule} onChange={(event) => change({ trigger_type: event.target.value as VoiceAutomationTrigger, conditions: [] })}>
            {automationTriggers.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <p className="text-sm text-[var(--calls-muted)]">{automationTriggers.find((item) => item.key === draft.trigger_type)?.detail}{rule && ' Create a new rule to use another trigger.'}</p>
        </section>
        <ArrowDown className="mx-auto h-4 w-4 text-[var(--calls-muted)]" aria-hidden />
        <section className="calls-panel space-y-3 p-4" aria-labelledby="conditions-title">
          <p id="conditions-title" className="flex items-center gap-2 font-medium"><Filter className="h-4 w-4 text-[var(--calls-brand)]" />2. Only when</p>
          <p className="text-sm text-[var(--calls-muted)]">All conditions must match. With no conditions, every eligible event matches.</p>
          {draft.conditions.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_44px] items-end gap-2 rounded-lg bg-[var(--calls-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_44px]">
            <div className="space-y-1"><Label htmlFor={`condition-field-${index}`}>Field</Label><select id={`condition-field-${index}`} className={selectClass} value={item.field} onChange={(event) => condition(index, defaultCondition(event.target.value))}>{fields[draft.trigger_type].map((field) => <option key={field} value={field}>{fieldLabels[field]}</option>)}</select></div>
            <div className="col-start-1 space-y-1 sm:col-start-auto"><Label htmlFor={`condition-operator-${index}`}>Match</Label><select id={`condition-operator-${index}`} className={selectClass} value={item.operator} onChange={(event) => condition(index, { ...item, operator: event.target.value as VoiceAutomationCondition['operator'] })}>{['amount_due', 'days_overdue'].includes(item.field) ? <><option value="gte">At least</option><option value="lte">At most</option></> : <option value="eq">Equals</option>}</select></div>
            <div className="col-start-1 space-y-1 sm:col-start-auto"><Label htmlFor={`condition-value-${index}`}>Value</Label>
              {item.field === 'known_caller' ? <select id={`condition-value-${index}`} className={selectClass} value={String(item.value)} onChange={(event) => condition(index, { ...item, value: event.target.value === 'true' })}><option value="true">Matched</option><option value="false">Unknown</option></select>
                : item.field === 'direction' ? <select id={`condition-value-${index}`} className={selectClass} value={String(item.value)} onChange={(event) => condition(index, { ...item, value: event.target.value })}><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option></select>
                  : <Input id={`condition-value-${index}`} required maxLength={80} type={['amount_due', 'days_overdue'].includes(item.field) ? 'number' : 'text'} min={0} step={item.field === 'amount_due' ? '0.01' : '1'} value={String(item.value)} onChange={(event) => condition(index, { ...item, value: ['amount_due', 'days_overdue'].includes(item.field) ? Number(event.target.value) : event.target.value })} placeholder={item.field === 'intent' ? 'booking_or_reschedule' : 'scheduled'} />}
            </div>
            <Button type="button" className="col-start-2 row-start-1 h-11 w-11 sm:col-start-auto sm:row-start-auto" size="icon" variant="ghost" aria-label={`Remove condition ${index + 1}`} onClick={() => change({ conditions: draft.conditions.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          <Button type="button" variant="outline" className="calls-secondary" disabled={draft.conditions.length >= 10} onClick={() => change({ conditions: [...draft.conditions, defaultCondition('known_caller')] })}><Plus className="h-4 w-4" />Add condition</Button>
        </section>
        <ArrowDown className="mx-auto h-4 w-4 text-[var(--calls-muted)]" aria-hidden />
        <section className="calls-panel space-y-4 p-4" aria-labelledby="timing-title">
          <p id="timing-title" className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4 text-[var(--calls-brand)]" />3. Choose the timing</p>
          <div className="space-y-2"><Label htmlFor="automation-delay">Delay after the event is detected (minutes)</Label><Input id="automation-delay" type="number" required min={0} max={10080} value={draft.delay_minutes} onChange={(event) => change({ delay_minutes: Number(event.target.value) })} /></div>
          <div className="flex items-center justify-between gap-4"><Label htmlFor="automation-quiet">Add rule quiet hours</Label><Switch id="automation-quiet" checked={draft.quiet_hours.enabled} onCheckedChange={(enabled) => change({ quiet_hours: { ...draft.quiet_hours, enabled } })} /></div>
          {draft.quiet_hours.enabled && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="quiet-start">Quiet from</Label><Input id="quiet-start" required type="time" value={draft.quiet_hours.start} onChange={(event) => change({ quiet_hours: { ...draft.quiet_hours, start: event.target.value } })} /></div>
            <div className="space-y-2"><Label htmlFor="quiet-end">Quiet until</Label><Input id="quiet-end" required type="time" value={draft.quiet_hours.end} onChange={(event) => change({ quiet_hours: { ...draft.quiet_hours, end: event.target.value } })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="quiet-timezone">Time zone</Label><Input id="quiet-timezone" required value={draft.quiet_hours.timezone} onChange={(event) => change({ quiet_hours: { ...draft.quiet_hours, timezone: event.target.value } })} placeholder="America/New_York" /></div>
          </div>}
          <p className="text-xs text-[var(--calls-muted)]">Global quiet hours also apply. Calls wait until both windows allow them; task due times use the same timing. Equal start and end means no additional quiet window.</p>
        </section>
        <ArrowDown className="mx-auto h-4 w-4 text-[var(--calls-muted)]" aria-hidden />
        <section className="calls-panel space-y-4 p-4" aria-labelledby="action-title">
          <p id="action-title" className="font-medium">4. Make this happen</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([{ key: 'ai_callback', label: 'Queue an AI callback', Icon: PhoneCall }, { key: 'internal_task', label: 'Create an internal task', Icon: ListTodo }] as const).map(({ key, label, Icon }) => <Button key={key} type="button" variant="outline" className={`h-auto min-h-14 justify-start whitespace-normal p-3 ${draft.action_type === key ? 'border-[var(--calls-brand)] bg-[var(--calls-brand-soft)]' : 'calls-secondary'}`} aria-pressed={draft.action_type === key} onClick={() => chooseAction(key)}><Icon className="h-5 w-5 shrink-0" />{label}</Button>)}
          </div>
          {draft.action_type === 'ai_callback' ? <>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="max-attempts">Maximum call attempts</Label><Input id="max-attempts" required type="number" min={1} max={5} value={draft.max_attempts} onChange={(event) => change({ max_attempts: Number(event.target.value) })} /></div><div className="space-y-2"><Label htmlFor="retry-delay">Retry delay (minutes)</Label><Input id="retry-delay" required type="number" min={1} max={10080} value={draft.retry_delay_minutes} onChange={(event) => change({ retry_delay_minutes: Number(event.target.value) })} /></div></div>
            <p className="text-sm text-[var(--calls-muted)]">The call worker checks line availability and outbound policy before dialing. Queued and accepted calls are separate from completed conversations.</p>
          </> : <>
            <div className="space-y-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" required maxLength={160} value={draft.action_config.task_title || ''} onChange={(event) => change({ action_config: { ...draft.action_config, task_title: event.target.value } })} /></div>
            <div className="space-y-2"><Label htmlFor="task-owner">Assign to</Label><select id="task-owner" className={selectClass} value={draft.action_config.assigned_to_user_id ?? ''} onChange={(event) => change({ action_config: { ...draft.action_config, assigned_to_user_id: event.target.value ? Number(event.target.value) : null } })}><option value="">Unassigned team task</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
            <p className="text-sm text-[var(--calls-muted)]">A task appears in run history with its source call, shoot or invoice. It can be completed or reopened there.</p>
          </>}
        </section>
        <div className="calls-panel flex items-center justify-between gap-4 p-4"><div><Label htmlFor="rule-enabled">Enable this rule</Label><p className="mt-1 text-xs text-[var(--calls-muted)]">Takes effect after saving. Disabled rules pause pending callbacks and retain this trigger.</p></div><Switch id="rule-enabled" checked={draft.enabled} onCheckedChange={(enabled) => change({ enabled })} /></div>
        <details className="calls-panel p-4">
          <summary className="cursor-pointer text-sm font-medium">Preview with a fictional example</summary>
          <p className="mt-3 text-sm text-[var(--calls-muted)]">This sample is editable and is not a live customer. Preview does not save, queue or send anything.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="sample-known">Customer matched</Label><select id="sample-known" className={selectClass} value={String(sample.known_caller)} onChange={(event) => changeSample({ known_caller: event.target.value === 'true' })}><option value="true">Matched</option><option value="false">Unknown</option></select></div>
            {isCall ? <><div className="space-y-2"><Label htmlFor="sample-direction">Direction</Label><select id="sample-direction" className={selectClass} value={sample.direction} onChange={(event) => changeSample({ direction: event.target.value as 'INBOUND' | 'OUTBOUND' })}><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option></select></div><div className="space-y-2"><Label htmlFor="sample-intent">Intent</Label><Input id="sample-intent" value={sample.intent} onChange={(event) => changeSample({ intent: event.target.value })} /></div></> : isInvoice ? <><div className="space-y-2"><Label htmlFor="sample-amount">Balance due ($)</Label><Input id="sample-amount" type="number" min={0} step="0.01" value={sample.amount_due} onChange={(event) => changeSample({ amount_due: Number(event.target.value) })} /></div><div className="space-y-2"><Label htmlFor="sample-overdue">Days overdue</Label><Input id="sample-overdue" type="number" min={0} value={sample.days_overdue} onChange={(event) => changeSample({ days_overdue: Number(event.target.value) })} /></div></> : <div className="space-y-2"><Label htmlFor="sample-shoot">Shoot status</Label><Input id="sample-shoot" value={sample.shoot_status} onChange={(event) => changeSample({ shoot_status: event.target.value })} /></div>}
            {draft.action_type === 'ai_callback' && <div className="space-y-2"><Label htmlFor="sample-phone">Example customer phone</Label><Input id="sample-phone" value={sample.target_phone} onChange={(event) => changeSample({ target_phone: event.target.value })} /></div>}
          </div>
          <Button type="button" variant="outline" className="calls-secondary mt-4" disabled={dryRun.isPending} onClick={() => dryRun.mutate({ rule: draft, sample })}><FlaskConical className="h-4 w-4" />{dryRun.isPending ? 'Calculating…' : 'Run preview'}</Button>
          {dryRun.isError && <p role="alert" className="mt-3 text-sm text-[var(--calls-danger)]">{automationError(dryRun.error)}</p>}
          {preview && <div role="status" className="mt-4 space-y-2 rounded-lg bg-[var(--calls-subtle)] p-4 text-sm"><p className="font-medium">{preview.would_run ? 'This example matches the rule' : 'This example will not run'}</p>{preview.reason && <p>{preview.reason}</p>}{preview.would_run && <p>{preview.action_type === 'ai_callback' ? 'Would queue a callback for' : 'Would create a task due'} {formatWhen(preview.scheduled_at)}{preview.quiet_hours_adjusted ? ' after quiet hours.' : '.'}</p>}{preview.checks.map((check, i) => <p key={i} className="flex items-center gap-2"><Check className={`h-4 w-4 ${check.matched ? 'text-[var(--calls-success)]' : 'text-[var(--calls-muted)]'}`} />{fieldLabels[check.field]}: {check.matched ? 'matched' : 'did not match'} (sample: {String(check.actual ?? 'missing')})</p>)}<p className="text-xs text-[var(--calls-muted)]">{preview.notice}</p></div>}
        </details>
        {save.isError && <p role="alert" className="text-sm text-[var(--calls-danger)]">{automationError(save.error)}</p>}
        <p className="text-xs text-[var(--calls-muted)]">Saving creates no immediate call. Future eligible events are evaluated once per rule. Past run outcomes remain in history. Standard automation for this trigger stays suppressed even if this rule is later disabled or archived.</p>
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[var(--calls-border)] bg-[var(--calls-surface)] py-3"><Button type="button" variant="outline" className="calls-secondary" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" className="calls-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : draft.enabled ? 'Save enabled rule' : 'Save disabled rule'}</Button></div>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}
