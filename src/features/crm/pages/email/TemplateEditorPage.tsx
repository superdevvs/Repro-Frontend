import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, Eye, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { when } from '../../format';
import type { EmailTemplate, TemplateVersion } from '../../types';
import { Field, TextInput } from '../../ui/fields';
import { Card, Chip, CrmPage, ErrorNote, Loading, Note } from '../../ui/primitives';
import { EmailFrame, RichText } from '../../components/RichText';

type Content = { subject: string; preheader: string; body_html: string; image_url: string; cta_label: string; cta_url: string };
const fromVersion = (v: TemplateVersion | null): Content => ({
  subject: v?.subject ?? '', preheader: v?.preheader ?? '', body_html: v?.body_html ?? '', image_url: v?.image_url ?? '', cta_label: v?.cta_label ?? '', cta_url: v?.cta_url ?? '',
});
const MERGE = ['{{first_name}}', '{{company}}', '{{market}}', '{{rep_name}}', '{{rep_phone}}'];

/** Template editor (frame 18): edit, preview in the locked layout, submit, approve or send back. */
export default function TemplateEditorPage() {
  const { id } = useParams();
  const { data: meta } = useCrmMeta();
  const q = useCrmQuery<{ template: EmailTemplate }>(['crm', 'template', id], `/templates/${id}`);
  const t = q.data?.template;
  const [name, setName] = useState('');
  const [c, setC] = useState<Content>(fromVersion(null));
  const [preview, setPreview] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => { if (t) { setName(t.name); setC(fromVersion(t.latest ?? t.approved)); } }, [t]);

  const clean = () => ({ name, subject: c.subject, preheader: c.preheader || null, body_html: c.body_html, image_url: c.image_url || null, cta_label: c.cta_label || null, cta_url: c.cta_url || null });
  const save = useCrmMutation(() => crmApi.put(`/templates/${id}`, clean()), { success: 'Draft saved' });
  const submit = useCrmMutation(() => crmApi.post<{ version: TemplateVersion }>(`/templates/${id}/submit`), { success: 'Submitted for review' });
  const approve = useCrmMutation(() => crmApi.post(`/template-versions/${t!.latest!.id}/approve`), { success: 'Approved' });
  const reject = useCrmMutation(() => crmApi.post(`/template-versions/${t!.latest!.id}/reject`, { comment }), { success: 'Sent back' });
  const retire = useCrmMutation(() => crmApi.post(`/templates/${id}/retire`), { success: 'Retired' });
  const render = useCrmMutation(() => crmApi.post<{ html: string }>('/templates/preview', clean()), { invalidate: [] });

  if (q.isLoading) return <CrmPage title="Template"><Loading /></CrmPage>;
  if (q.error || !t) return <CrmPage title="Template" crumbs={[{ label: 'Email', to: '/crm/email?tab=templates' }]}><ErrorNote error={q.error} /></CrmPage>;

  const canEdit = Boolean(meta?.can.approve_templates);
  const pending = t.latest?.status === 'pending';
  const check = t.latest?.content_check;
  const set = (k: keyof Content) => (e: React.ChangeEvent<HTMLInputElement>) => { setC({ ...c, [k]: e.target.value }); setPreview(null); };

  return (
    <CrmPage
      crumbs={[{ label: 'Email', to: '/crm/email?tab=templates' }, { label: 'Templates', to: '/crm/email?tab=templates' }]}
      title={<span className="flex flex-wrap items-center gap-2 whitespace-normal"><span className="break-words">{t.name}</span>{t.approved ? <Chip tone="green">Approved v{t.approved.version_no}</Chip> : <Chip tone="line">Not approved</Chip>}{pending && <Chip tone="amber">Waiting for review</Chip>}</span>}
      description="The layout, logo, footer and unsubscribe link are fixed. You write the subject and message."
      actions={canEdit ? <>
        {t.status !== 'retired' && t.approved && <Button variant="ghost" size="sm" className="h-8" onClick={() => retire.mutate(undefined)}>Retire</Button>}
        <Button variant="outline" size="sm" className="h-8" disabled={save.isPending || !c.subject || !c.body_html} onClick={() => save.mutate(undefined)}>Save draft</Button>
        <Button size="sm" className="h-8" disabled={submit.isPending || !t.has_pending_changes || pending} onClick={() => save.mutate(undefined, { onSuccess: () => submit.mutate(undefined) })}><Send className="mr-1.5 h-3.5 w-3.5" />Submit for review</Button>
      </> : undefined}
    >
      {t.latest?.status === 'rejected' && t.latest.review_comment && <Note tone="bad">{t.latest.reviewed_by?.name} asked for changes: {t.latest.review_comment}</Note>}
      {pending && canEdit && (
        <Card title="Review this version" className="border-amber-300/60">
          {check && !check.passed && (
            <Note tone="warn" icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />} className="mb-3">
              <p className="font-medium">The content check flagged {check.issues.length} thing{check.issues.length === 1 ? '' : 's'}:</p>
              <ul className="mt-1 list-disc pl-4">{check.issues.map((i, n) => <li key={n}>{i.quote ? `“${i.quote}”: ` : ''}{i.message}</li>)}</ul>
            </Note>
          )}
          {check?.passed && <Note tone="ok" className="mb-3">The content check found nothing to fix.</Note>}
          <div className="flex flex-wrap gap-2">
            <TextInput aria-label="Comment" className="crm-review-comment min-w-0" placeholder="What should change? (needed to send back)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button variant="outline" size="sm" className="h-8" disabled={!comment.trim() || reject.isPending} onClick={() => reject.mutate(undefined)}><X className="mr-1 h-3.5 w-3.5" />Send back</Button>
            <Button size="sm" className="h-8" disabled={approve.isPending} onClick={() => approve.mutate(undefined)}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
          </div>
        </Card>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Template name">{(fid) => <TextInput id={fid} value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />}</Field>
          <Field label="Subject" required>{(fid) => <TextInput id={fid} value={c.subject} onChange={set('subject')} disabled={!canEdit} />}</Field>
          <Field label="Preview text" hint="Shown after the subject in most inboxes.">{(fid, d) => <TextInput id={fid} aria-describedby={d} value={c.preheader} onChange={set('preheader')} disabled={!canEdit} />}</Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Message</span>
            {canEdit ? <RichText label="Message" value={c.body_html} onChange={(html) => { setC({ ...c, body_html: html }); setPreview(null); }} minHeight={240} /> : <div className="rounded-lg border p-3 text-[13px]" dangerouslySetInnerHTML={{ __html: c.body_html }} />}
            {canEdit && <p className="flex flex-wrap gap-1 text-xs text-muted-foreground">Merge fields: {MERGE.map((m) => <code key={m} className="rounded bg-secondary px-1">{m}</code>)}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Image URL" className="sm:col-span-2">{(fid) => <TextInput id={fid} value={c.image_url} onChange={set('image_url')} disabled={!canEdit} placeholder="https://…" />}</Field>
            <Field label="Button label">{(fid) => <TextInput id={fid} value={c.cta_label} onChange={set('cta_label')} disabled={!canEdit} placeholder="Book a shoot" />}</Field>
            <Field label="Button link">{(fid) => <TextInput id={fid} value={c.cta_url} onChange={set('cta_url')} disabled={!canEdit} placeholder="https://reprophotos.com/book" />}</Field>
          </div>
        </div>
        <Card title="Email preview" className="h-fit min-w-0" bodyClassName={preview ? 'p-2' : undefined}
          actions={<Button variant="outline" size="sm" disabled={render.isPending || !c.subject || !c.body_html} onClick={() => render.mutate(undefined, { onSuccess: (r) => setPreview(r.html) })}><Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{render.isPending ? 'Loading…' : preview ? 'Refresh' : 'Show preview'}</Button>}>
          {preview ? <EmailFrame html={preview} title="Template preview" height={640} /> : <div className="flex min-h-32 items-center justify-center px-3 text-center text-sm text-muted-foreground">See the branded email with your signature.</div>}
        </Card>
      </div>

      {t.versions && t.versions.length > 0 && (
        <Card title="Versions" bodyClassName="p-0">
          <table className="crm-table">
            <thead><tr><th>Version</th><th>Status</th><th>By</th><th>Reviewed</th></tr></thead>
            <tbody>{t.versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.version_no}{t.approved?.id === v.id && <Chip tone="green" className="ml-1.5">In use</Chip>}</td>
                <td className="capitalize">{v.status}</td>
                <td>{v.created_by?.name}</td>
                <td className="text-muted-foreground">{v.reviewed_by ? `${v.reviewed_by.name} · ${when(v.reviewed_at)}` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </CrmPage>
  );
}
