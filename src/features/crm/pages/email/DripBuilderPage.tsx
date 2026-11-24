import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Pause, Play, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../../api';
import { useCrmMutation, useCrmQuery } from '../../hooks';
import { day } from '../../format';
import type { EmailTemplate } from '../../types';
import { Field, Select, TextInput } from '../../ui/fields';
import { Chip, CrmPage, ErrorNote, Loading, Note } from '../../ui/primitives';
import { EmailFrame } from '../../components/RichText';

interface Step { id?: number; send_day: number; label: string | null; template_id: number | null; status?: 'placeholder' | 'awaiting_approval' | 'approved'; subject?: string | null; open_rate?: number | null; click_rate?: number | null }
interface Drip { id: number; name: string; length: string; status: 'draft' | 'live' | 'paused' | 'retired'; enrolled: number; has_draft: boolean; published: { version_no: number; published_at: string | null } | null; published_steps: Step[]; draft_steps: Step[] | null }

/**
 * Drip builder (frame 07). Edits go into a draft; publishing makes them live.
 * Contacts already enrolled keep the emails they've had and get only the new
 * future steps. Placeholder steps are skipped until they have a template.
 */
export default function DripBuilderPage() {
  const { id } = useParams();
  const q = useCrmQuery<{ drip: Drip }>(['crm', 'drip', id], `/drips/${id}`);
  const templates = useCrmQuery<{ data: EmailTemplate[] }>(['crm', 'templates', 'drip'], '/templates', { kind: 'drip' });
  const drip = q.data?.drip;
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [dirty, setDirty] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (drip) { setName(drip.name); setSteps((drip.draft_steps ?? drip.published_steps).map((s) => ({ ...s }))); setDirty(false); }
  }, [drip]);

  const save = useCrmMutation(() => crmApi.put(`/drips/${id}`, { name, steps: [...steps].sort((a, b) => a.send_day - b.send_day).map((s) => ({ send_day: s.send_day, template_id: s.template_id, label: s.template_id ? null : s.label || 'Placeholder' })) }), { success: 'Draft saved' });
  const publish = useCrmMutation(() => crmApi.post(`/drips/${id}/publish`), { success: 'Published' });
  const status = useCrmMutation((s: 'live' | 'paused' | 'retired') => crmApi.post(`/drips/${id}/status`, { status: s }), { success: 'Updated' });
  const preview = useCrmQuery<{ steps: { send_day: number; label: string | null; placeholder: boolean; rendered: { subject: string; html: string } | null }[] }>(['crm', 'drip-preview', id], `/drips/${id}/preview`, { draft: 1 }, previewing);

  if (q.isLoading) return <CrmPage title="Drip"><Loading /></CrmPage>;
  if (q.error || !drip) return <CrmPage title="Drip" crumbs={[{ label: 'Email', to: '/crm/email?tab=drips' }]}><ErrorNote error={q.error} /></CrmPage>;

  const update = (i: number, patch: Partial<Step>) => { setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s))); setDirty(true); };
  const approvedTemplates = (templates.data?.data ?? []).filter((t) => t.approved);
  const ready = steps.filter((s) => s.template_id).length;

  return (
    <CrmPage
      crumbs={[{ label: 'Email', to: '/crm/email?tab=drips' }, { label: 'Drips', to: '/crm/email?tab=drips' }]}
      title={<span className="flex flex-wrap items-center gap-2 whitespace-normal"><span className="break-words">{drip.name}</span><Chip tone={drip.status === 'live' ? 'green' : drip.status === 'paused' ? 'amber' : 'line'} className="capitalize">{drip.status}</Chip></span>}
      description={`${drip.length} · ${drip.enrolled} enrolled${drip.published ? ` · live version ${drip.published.version_no} since ${day(drip.published.published_at)}` : ''}`}
      actions={<>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreviewing(true)}><Eye className="mr-1.5 h-3.5 w-3.5" />Preview</Button>
        {drip.status === 'live' && <Button variant="outline" size="sm" className="h-8" onClick={() => status.mutate('paused')}><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</Button>}
        {drip.status === 'paused' && <Button variant="outline" size="sm" className="h-8" onClick={() => status.mutate('live')}><Play className="mr-1.5 h-3.5 w-3.5" />Resume</Button>}
        <Button variant="outline" size="sm" className="h-8" disabled={!dirty || save.isPending} onClick={() => save.mutate(undefined)}>Save draft</Button>
        <Button size="sm" className="h-8" disabled={(!drip.has_draft && !dirty) || publish.isPending || ready === 0} onClick={() => (dirty ? save.mutate(undefined, { onSuccess: () => publish.mutate(undefined) }) : publish.mutate(undefined))}><Upload className="mr-1.5 h-3.5 w-3.5" />Publish</Button>
      </>}
    >
      {drip.has_draft && drip.published && !dirty && <Note tone="warn">People already on this drip get only the new future steps once you publish these changes.</Note>}
      {ready === 0 && <Note tone="info">Every step is still a placeholder. Pick an approved drip template for at least one step to publish.</Note>}
      <Field label="Drip name" className="max-w-sm">{(id) => <TextInput id={id} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />}</Field>

      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.id ?? `new-${i}`} className="relative flex min-w-0 flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
            <div className="crm-sequence-step-top flex items-end gap-2">
              <span aria-hidden="true" className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold tabular-nums">{i + 1}</span>
              <Field label="Send day" className="w-24">{(id) => <TextInput id={id} type="number" min={0} max={365} aria-label={`Send day for step ${i + 1}`} value={s.send_day} onChange={(e) => update(i, { send_day: Math.max(0, Number(e.target.value) || 0) })} />}</Field>
            </div>
            <Field label="Template" className="crm-sequence-template min-w-0">{(id) => (
              <Select id={id} aria-label={`Template for step ${i + 1}`} value={s.template_id ? String(s.template_id) : ''} onChange={(e) => update(i, { template_id: e.target.value ? Number(e.target.value) : null })}
                placeholder="Placeholder (skipped)" options={approvedTemplates.map((t) => ({ value: String(t.id), label: t.approved?.subject && t.approved.subject !== t.name ? `${t.name} · ${t.approved.subject}` : t.name }))} />
            )}</Field>
            {!s.template_id && <Field label="Placeholder label" className="crm-sequence-placeholder min-w-0">{(id) => <TextInput id={id} aria-label={`Placeholder label for step ${i + 1}`} value={s.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} placeholder="What this email will be" />}</Field>}
            {s.status === 'awaiting_approval' && <Chip tone="amber">Template change waiting</Chip>}
            {typeof s.open_rate === 'number' && <span className="text-xs text-muted-foreground">{s.open_rate}% opened · {s.click_rate}% clicked</span>}
            <Button variant="ghost" size="icon" className="crm-line-remove ml-auto h-9 w-9" aria-label={`Remove step ${i + 1}`} onClick={() => { setSteps(steps.filter((_, j) => j !== i)); setDirty(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" className="self-start" onClick={() => { const last = steps.reduce((m, s) => Math.max(m, s.send_day), -7); setSteps([...steps, { send_day: last + 7, label: 'New step', template_id: null }]); setDirty(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Add step</Button>

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="crm-root max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{drip.name} preview</DialogTitle></DialogHeader>
          {dirty && <Note tone="info">This preview uses your saved steps. Save your draft to preview the latest changes.</Note>}
          {preview.isLoading && <Loading />}
          {preview.error && <ErrorNote error={preview.error} onRetry={() => preview.refetch()} />}
          <div className="flex flex-col gap-4">
            {preview.data?.steps.map((s, i) => (
              <section key={i} className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold">Day {s.send_day} · {s.rendered?.subject ?? s.label}{s.placeholder && <Chip tone="line" className="ml-2">Placeholder, skipped</Chip>}</h3>
                {s.rendered && <EmailFrame html={s.rendered.html} title={`Step ${i + 1}`} height={420} />}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </CrmPage>
  );
}
