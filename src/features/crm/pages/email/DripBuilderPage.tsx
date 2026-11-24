import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, GripVertical, Pause, Play, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../../api';
import { useCrmMutation, useCrmQuery } from '../../hooks';
import { day } from '../../format';
import type { EmailTemplate } from '../../types';
import { Select, TextInput } from '../../ui/fields';
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
      title={<span className="flex items-center gap-2">{drip.name}<Chip tone={drip.status === 'live' ? 'green' : drip.status === 'paused' ? 'amber' : 'line'} className="capitalize">{drip.status}</Chip></span>}
      description={`${drip.length} · ${drip.enrolled} enrolled${drip.published ? ` · live version ${drip.published.version_no} since ${day(drip.published.published_at)}` : ''}`}
      actions={<>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreviewing(true)}><Eye className="mr-1.5 h-3.5 w-3.5" />Preview</Button>
        {drip.status === 'live' && <Button variant="outline" size="sm" className="h-8" onClick={() => status.mutate('paused')}><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</Button>}
        {drip.status === 'paused' && <Button variant="outline" size="sm" className="h-8" onClick={() => status.mutate('live')}><Play className="mr-1.5 h-3.5 w-3.5" />Resume</Button>}
        <Button variant="outline" size="sm" className="h-8" disabled={!dirty || save.isPending} onClick={() => save.mutate(undefined)}>Save draft</Button>
        <Button size="sm" className="h-8" disabled={(!drip.has_draft && !dirty) || publish.isPending || ready === 0} onClick={() => (dirty ? save.mutate(undefined, { onSuccess: () => publish.mutate(undefined) }) : publish.mutate(undefined))}><Upload className="mr-1.5 h-3.5 w-3.5" />Publish</Button>
      </>}
    >
      {drip.has_draft && !dirty && <Note tone="warn">There are unpublished changes. People already on this drip get only the new future steps once you publish.</Note>}
      {ready === 0 && <Note tone="info">Every step is still a placeholder. Pick an approved drip template for at least one step to publish.</Note>}
      <TextInput aria-label="Drip name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} className="max-w-sm" />

      <ol className="flex flex-col gap-2">
        {[...steps].map((s, i) => (
          <li key={s.id ?? `new-${i}`} className="flex flex-wrap items-center gap-3 rounded-[10px] border bg-card p-3">
            <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{i + 1}</span>
            <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">Day
              <TextInput type="number" min={0} max={365} aria-label={`Day for step ${i + 1}`} className="w-20" value={s.send_day} onChange={(e) => update(i, { send_day: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <Select aria-label={`Template for step ${i + 1}`} className="min-w-[220px] flex-1" value={s.template_id ? String(s.template_id) : ''} onChange={(e) => update(i, { template_id: e.target.value ? Number(e.target.value) : null })}
              placeholder="Placeholder (skipped)" options={approvedTemplates.map((t) => ({ value: String(t.id), label: `${t.name} · ${t.approved?.subject}` }))} />
            {!s.template_id && <TextInput aria-label={`Placeholder label for step ${i + 1}`} className="w-[200px]" value={s.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} placeholder="What this email will be" />}
            {s.status === 'awaiting_approval' && <Chip tone="amber">Template change waiting</Chip>}
            {typeof s.open_rate === 'number' && <span className="text-xs text-muted-foreground">{s.open_rate}% opened · {s.click_rate}% clicked</span>}
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" aria-label={`Remove step ${i + 1}`} onClick={() => { setSteps(steps.filter((_, j) => j !== i)); setDirty(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </li>
        ))}
      </ol>
      <Button variant="outline" size="sm" className="self-start" onClick={() => { const last = steps.reduce((m, s) => Math.max(m, s.send_day), -7); setSteps([...steps, { send_day: last + 7, label: 'New step', template_id: null }]); setDirty(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Add step</Button>

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="crm-root max-h-[92dvh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader><DialogTitle>{drip.name}: every step</DialogTitle></DialogHeader>
          {preview.isLoading && <Loading />}
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
