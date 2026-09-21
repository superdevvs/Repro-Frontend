import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowRight, Check, Clock3, History, ListTodo, Pencil, PhoneCall, Plus, RotateCcw, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/context/PermissionsContext';
import { useToast } from '@/hooks/use-toast';
import {
  archiveVoiceAutomationRule, automationError, getVoiceAutomationRules, getVoiceAutomationRuns,
  toggleVoiceAutomationRule, updateVoiceAutomationTask, type VoiceAutomationRule,
} from '@/services/voiceAutomations';
import { VoiceAutomationEditor } from './VoiceAutomationEditor';
import { automationTriggers } from './voiceAutomationCatalog';
import { formatWhen } from './callDisplay';

export function VoiceAutomationBuilder() {
  const { can } = usePermissions();
  const manage = can('voice-calls', 'manage');
  const operate = can('voice-calls', 'operate');
  const { toast } = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState<VoiceAutomationRule | 'new' | null>(null);
  const [page, setPage] = useState(1);
  const [ruleFilter, setRuleFilter] = useState<number | undefined>();
  const rules = useQuery({ queryKey: ['voice-automation-rules'], queryFn: getVoiceAutomationRules });
  const runs = useQuery({ queryKey: ['voice-automation-runs', page, ruleFilter], queryFn: () => getVoiceAutomationRuns(page, ruleFilter), refetchInterval: 15000 });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['voice-automation-rules'] });
    void client.invalidateQueries({ queryKey: ['voice-automation-runs'] });
    void client.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
    void client.invalidateQueries({ queryKey: ['voice-calls'] });
  };
  const toggle = useMutation({ mutationFn: toggleVoiceAutomationRule, onSuccess: refresh, onError: (error) => toast({ title: 'Could not change rule', description: automationError(error), variant: 'destructive' }) });
  const archive = useMutation({ mutationFn: archiveVoiceAutomationRule, onSuccess: () => { refresh(); toast({ title: 'Rule archived', description: 'Pending callbacks were cancelled. Existing tasks and run history remain. Standard automation stays suppressed.' }); }, onError: (error) => toast({ title: 'Could not archive rule', description: automationError(error), variant: 'destructive' }) });
  const task = useMutation({ mutationFn: updateVoiceAutomationTask, onSuccess: refresh, onError: (error) => toast({ title: 'Could not update task', description: automationError(error), variant: 'destructive' }) });

  return <section className="space-y-4" aria-labelledby="custom-rules-title">
    <div className="calls-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--calls-border)] p-5">
        <div><h3 id="custom-rules-title" className="flex items-center gap-2 text-lg font-semibold"><Workflow className="h-5 w-5 text-[var(--calls-brand)]" />Your workflows</h3><p className="mt-1 text-sm text-[var(--calls-muted)]">From an event to a useful next step.</p></div>
        <Button className="calls-primary" disabled={!manage || !rules.data || rules.isError} onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Build rule</Button>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {rules.isLoading && <p role="status" className="text-sm text-[var(--calls-muted)]">Loading saved workflows…</p>}
        {rules.isError && <div role="alert"><p className="text-sm text-[var(--calls-danger)]">Could not load saved workflows.</p><Button variant="outline" className="calls-secondary mt-2" onClick={() => void rules.refetch()}>Try again</Button></div>}
        {rules.data?.rules.map((rule) => <article key={rule.id} className="rounded-xl border border-[var(--calls-border)] p-4">
          <div className="flex items-start justify-between gap-4"><div><h4 className="font-medium">{rule.name}</h4><p className="mt-1 text-xs text-[var(--calls-muted)]">{rule.enabled ? 'Enabled for eligible events' : 'Disabled · pending callbacks are paused'}</p></div><Switch aria-label={`Enable ${rule.name}`} checked={rule.enabled} disabled={!manage || toggle.isPending || archive.isPending || rules.isError} onCheckedChange={(enabled) => toggle.mutate({ id: rule.id, enabled })} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-md bg-[var(--calls-subtle)] px-3 py-2">{automationTriggers.find((item) => item.key === rule.trigger_type)?.label}</span><ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--calls-muted)]" /><span className="rounded-md bg-[var(--calls-subtle)] px-3 py-2">{rule.conditions.length ? `${rule.conditions.length} condition${rule.conditions.length === 1 ? '' : 's'}` : 'All eligible events'}</span><ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--calls-muted)]" /><span className="inline-flex items-center gap-2 rounded-md bg-[var(--calls-brand-soft)] px-3 py-2">{rule.action_type === 'ai_callback' ? <PhoneCall className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}{rule.action_type === 'ai_callback' ? 'AI callback' : 'Internal task'}</span></div>
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--calls-muted)]"><Clock3 className="h-3.5 w-3.5 shrink-0" />{rule.delay_minutes} minute delay{rule.action_type === 'ai_callback' ? ` · up to ${rule.max_attempts} attempts · ${rule.retry_delay_minutes} minutes between retries` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-1"><Button variant="ghost" onClick={() => { setRuleFilter(rule.id); setPage(1); }}><History className="h-4 w-4" />History</Button><Button variant="ghost" disabled={!manage || rules.isError} onClick={() => setEditing(rule)}><Pencil className="h-4 w-4" />Edit</Button><Button variant="ghost" disabled={!manage || archive.isPending || toggle.isPending || rules.isError} onClick={() => archive.mutate(rule.id)}><Archive className="h-4 w-4" />Archive</Button></div>
        </article>)}
        {rules.data && rules.data.rules.length === 0 && <div className="py-6 text-center"><Workflow className="mx-auto mb-3 h-7 w-7 text-[var(--calls-muted)]" /><p className="font-medium">Make the follow-up fit your team.</p><p className="mx-auto mt-2 max-w-lg text-sm text-[var(--calls-muted)]">Build a callback with conditions and a retry budget, or turn a missed call, shoot, delivery or invoice into an internal task.</p></div>}
        {(rules.data?.managed_triggers.length ?? 0) > 0 && <p className="text-xs text-[var(--calls-muted)]">Custom rules own their triggers, including after disabling or archiving. The matching standard toggle stays suppressed. Multiple enabled rules can create separate actions for the same event.</p>}
      </div>
    </div>
    <div className="calls-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-[var(--calls-brand)]" />Workflow run history</h3><label className="flex items-center gap-2 text-sm"><span>Show</span><select aria-label="Filter workflow history" className="h-11 max-w-64 rounded-md border border-[var(--calls-border)] bg-[var(--calls-surface)] px-2" value={ruleFilter ?? ''} onChange={(event) => { setRuleFilter(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}><option value="">All rules, including archived</option>{rules.data?.rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label></div>
      <p className="mt-2 text-xs text-[var(--calls-muted)]">One recorded outcome per rule and source event. Callback status follows the actual call; a queued call is not yet a completed conversation.</p>
      <div className="mt-4 space-y-3">
        {runs.isLoading && <p role="status" className="text-sm text-[var(--calls-muted)]">Loading run history…</p>}
        {runs.isError && <div role="alert"><p className="text-sm text-[var(--calls-danger)]">Could not load run history.</p><Button variant="outline" className="calls-secondary mt-2" onClick={() => void runs.refetch()}>Try again</Button></div>}
        {runs.data?.data.map((run) => <article key={run.id} className="rounded-xl bg-[var(--calls-subtle)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{run.rule_snapshot.name}</p><p className="mt-1 text-xs text-[var(--calls-muted)]">{run.context.voice_call_id ? `Call #${run.context.voice_call_id}` : run.context.related_invoice_id ? `Invoice #${run.context.related_invoice_id}` : `Shoot #${run.context.related_shoot_id}`} · {formatWhen(run.created_at)}</p></div><span className="rounded-full border border-[var(--calls-border)] px-2.5 py-1 text-xs">{run.effective_status.replaceAll('_', ' ')}</span></div>
          {(run.context.summary || run.context.target_phone) && <p className="mt-2 text-sm text-[var(--calls-muted)]">{run.context.summary || run.context.target_phone}</p>}
          {run.reason && <p className="mt-2 text-sm">{run.reason}</p>}
          {run.scheduled_call && <p className="mt-2 text-sm">{run.scheduled_call.target_phone} · {run.scheduled_call.attempts}/{run.scheduled_call.max_attempts} attempts{run.scheduled_call.next_attempt_at ? ` · Next ${formatWhen(run.scheduled_call.next_attempt_at)}` : ''}</p>}
          {!run.reason && run.scheduled_call?.last_error && <p className="mt-2 text-sm text-[var(--calls-danger)]">{run.scheduled_call.last_error}</p>}
          {run.task && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--calls-border)] p-3"><div><p className="flex items-center gap-2 font-medium"><ListTodo className="h-4 w-4" />{run.task.title}</p><p className="mt-1 text-xs text-[var(--calls-muted)]">Due {formatWhen(run.task.due_at)} · {rules.data?.assignees.find((user) => user.id === run.task?.assigned_to_user_id)?.name || 'Unassigned'}</p></div><Button variant="outline" className="calls-secondary" disabled={!operate || task.isPending || runs.isError} onClick={() => task.mutate({ id: run.task!.id, status: run.task!.status === 'open' ? 'completed' : 'open' })}>{run.task.status === 'open' ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}{run.task.status === 'open' ? 'Complete task' : 'Reopen task'}</Button></div>}
        </article>)}
        {runs.data && runs.data.data.length === 0 && <p className="py-6 text-center text-sm text-[var(--calls-muted)]">No workflow runs yet. Saved rules wait for eligible events; previews do not appear here.</p>}
      </div>
      {runs.data && runs.data.last_page > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[var(--calls-muted)]">Page {runs.data.current_page} of {runs.data.last_page} · {runs.data.total} runs</p><div className="flex gap-2"><Button variant="outline" className="calls-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="outline" className="calls-secondary" disabled={page >= runs.data.last_page} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
    </div>
    {editing && manage && <VoiceAutomationEditor rule={editing === 'new' ? undefined : editing} assignees={rules.data?.assignees ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); toast({ title: 'Workflow saved', description: 'Eligible events will use the saved configuration. No immediate call was placed.' }); }} />}
  </section>;
}
