import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, Send, Undo2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { toLocalInput, when } from '../../format';
import type { ContentCheck, Person } from '../../types';
import { Field, Select, TextInput } from '../../ui/fields';
import { Card, Chip, CrmPage, ErrorNote, Loading, Note } from '../../ui/primitives';
import { EmailFrame, RichText } from '../../components/RichText';
import { CAMPAIGN_STATUS } from './campaignStatus';

interface Audience { segment?: string | null; client_type?: string | null; stage?: string | null; market_state?: string | null; rep_id?: number | null }
interface Campaign {
  id: number; name: string; status: string; owner: Person | null; subject: string; audience: Audience; submitted_at: string | null; scheduled_at: string | null;
  sent_at: string | null; recipient_count: number | null; reviewed_by: Person | null; review_comment: string | null; content_check: ContentCheck | null; updated_at: string | null;
  template: { id: number; name: string }; body_html: string; image_url: string | null; from: { name: string; email: string } | null;
  audience_summary: { total: number; reachable: number; opted_out: number; bounced: number }; rendered: { subject: string; html: string };
}

/**
 * Custom campaign (frame 08): the owner writes and picks an audience (only
 * their own contacts unless they see everyone); an admin approves or sends
 * it back; any edit after approval goes back for review.
 */
export default function CampaignPage() {
  const { id } = useParams();
  const { data: meta } = useCrmMeta();
  const q = useCrmQuery<{ campaign: Campaign }>(['crm', 'campaign', id], `/campaigns/${id}`);
  const c = q.data?.campaign;
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>({});
  const [comment, setComment] = useState('');
  const [at, setAt] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (c) { setSubject(c.subject); setBody(c.body_html); setAudience(c.audience ?? {}); setDirty(false); } }, [c]);

  const save = useCrmMutation(() => crmApi.patch(`/campaigns/${id}`, { subject, body_html: body, audience }), { success: 'Saved' });
  const action = useCrmMutation((a: { name: 'submit' | 'approve' | 'send-back' | 'schedule'; body?: object }) => crmApi.post(`/campaigns/${id}/${a.name}`, a.body ?? {}), {
    success: (r: unknown) => { const s = (r as { campaign?: { status: string } })?.campaign?.status ?? ''; return CAMPAIGN_STATUS[s]?.[0] ?? 'Done'; },
  });

  if (q.isLoading) return <CrmPage title="Campaign"><Loading /></CrmPage>;
  if (q.error || !c) return <CrmPage title="Campaign" crumbs={[{ label: 'Email', to: '/crm/email' }]}><ErrorNote error={q.error} /></CrmPage>;

  const isOwner = meta?.me.id === c.owner?.id;
  const canApprove = Boolean(meta?.can.approve_campaigns);
  const editable = (isOwner || canApprove) && !['sending', 'sent', 'scheduled'].includes(c.status);
  const setAud = (k: keyof Audience) => (e: React.ChangeEvent<HTMLSelectElement>) => { setAudience({ ...audience, [k]: e.target.value || null }); setDirty(true); };
  const issues = c.content_check?.issues ?? [];

  return (
    <CrmPage
      crumbs={[{ label: 'Email', to: '/crm/email' }, { label: 'Campaigns', to: '/crm/email' }]}
      title={<span className="flex items-center gap-2">{c.name}<Chip tone={CAMPAIGN_STATUS[c.status]?.[1] ?? 'neutral'}>{CAMPAIGN_STATUS[c.status]?.[0] ?? c.status}</Chip></span>}
      description={`By ${c.owner?.name ?? '—'} · from ${c.template.name}${c.from ? ` · sends as ${c.from.name} <${c.from.email}>` : ''}`}
      actions={<>
        {editable && <Button variant="outline" size="sm" className="h-8" disabled={!dirty || save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>}
        {isOwner && ['draft', 'sent_back'].includes(c.status) && <Button size="sm" className="h-8" disabled={save.isPending || action.isPending} onClick={() => (dirty ? save.mutate(undefined, { onSuccess: () => action.mutate({ name: 'submit' }) }) : action.mutate({ name: 'submit' }))}><Send className="mr-1.5 h-3.5 w-3.5" />Submit for review</Button>}
      </>}
    >
      {c.status === 'sent_back' && c.review_comment && <Note tone="bad">{c.reviewed_by?.name} sent this back: {c.review_comment}</Note>}
      {c.status === 'approved' && <Note tone="ok">Approved by {c.reviewed_by?.name}. Any edit now sends it back for review.</Note>}
      {c.status === 'sent' && <Note tone="ok">Sent {when(c.sent_at)} to {c.recipient_count} people.</Note>}
      {c.status === 'scheduled' && <Note tone="info">Scheduled for {when(c.scheduled_at)}.</Note>}

      {c.status === 'submitted' && canApprove && (
        <Card title="Review">
          {issues.length > 0 ? (
            <Note tone="warn" icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />} className="mb-3">
              <p className="font-medium">The content check flagged:</p>
              <ul className="mt-1 list-disc pl-4">{issues.map((i, n) => <li key={n}>{i.quote ? `“${i.quote}”: ` : ''}{i.message}</li>)}</ul>
            </Note>
          ) : <Note tone="ok" className="mb-3">The content check found nothing to fix.</Note>}
          <div className="flex flex-wrap gap-2">
            <TextInput aria-label="Comment for the owner" className="min-w-[240px] flex-1" placeholder="What should change? (needed to send back)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button variant="outline" size="sm" className="h-8" disabled={!comment.trim()} onClick={() => action.mutate({ name: 'send-back', body: { comment } })}><Undo2 className="mr-1 h-3.5 w-3.5" />Send back</Button>
            <Button size="sm" className="h-8" onClick={() => action.mutate({ name: 'approve' })}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
          </div>
        </Card>
      )}

      {c.status === 'approved' && (isOwner || canApprove) && (
        <Card title="Send">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="When" hint="Leave empty to send now.">{(fid, d) => <TextInput id={fid} aria-describedby={d} type="datetime-local" min={toLocalInput(new Date())} value={at} onChange={(e) => setAt(e.target.value)} />}</Field>
            <Button size="sm" className="h-8" onClick={() => action.mutate({ name: 'schedule', body: { at: at ? new Date(at).toISOString() : null } })}><CalendarClock className="mr-1.5 h-3.5 w-3.5" />{at ? 'Schedule' : 'Send now'} to {c.audience_summary.reachable}</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Card title={<h2 className="flex items-center gap-2 text-[13px] font-semibold"><Users className="h-4 w-4 text-muted-foreground" />Audience</h2>}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Segment">{(fid) => <Select id={fid} disabled={!editable} value={audience.segment ?? ''} onChange={setAud('segment')} placeholder="All" options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
              <Field label="Client type">{(fid) => <Select id={fid} disabled={!editable} value={audience.client_type ?? ''} onChange={setAud('client_type')} placeholder="All" options={(meta?.client_types ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
              <Field label="Stage">{(fid) => <Select id={fid} disabled={!editable} value={audience.stage ?? ''} onChange={setAud('stage')} placeholder="All but lost" options={(meta?.stages ?? []).filter((s) => s.key !== 'lost').map((s) => ({ value: s.key, label: s.label }))} />}</Field>
              <Field label="Market">{(fid) => <Select id={fid} disabled={!editable} value={audience.market_state ?? ''} onChange={setAud('market_state')} placeholder="All" options={(meta?.markets ?? []).map((m) => ({ value: m, label: m }))} />}</Field>
              {meta?.can.view_all && <Field label="Rep" className="col-span-2">{(fid) => <Select id={fid} disabled={!editable} value={audience.rep_id ? String(audience.rep_id) : ''} onChange={(e) => { setAudience({ ...audience, rep_id: e.target.value ? Number(e.target.value) : null }); setDirty(true); }} placeholder="Owner’s contacts" options={meta.reps.map((r) => ({ value: String(r.id), label: r.name }))} />}</Field>}
            </div>
            <p className="mt-3 text-[13px]"><b className="tabular-nums">{c.audience_summary.reachable}</b> will receive it{c.audience_summary.opted_out + c.audience_summary.bounced > 0 && <span className="text-muted-foreground"> · {c.audience_summary.opted_out} unsubscribed and {c.audience_summary.bounced} bounced are left out</span>}.{dirty && <span className="text-muted-foreground"> Save to update the count.</span>}</p>
          </Card>
          <Field label="Subject">{(fid) => <TextInput id={fid} disabled={!editable} value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} />}</Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Message</span>
            {editable ? <RichText label="Message" value={body} onChange={(html) => { setBody(html); setDirty(true); }} minHeight={220} /> : <div className="rounded-lg border p-3 text-[13px]" dangerouslySetInnerHTML={{ __html: body }} />}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium">Preview{dirty ? ' (save to refresh)' : ''}</span>
          <EmailFrame html={c.rendered.html} title="Campaign preview" height={680} />
        </div>
      </div>
    </CrmPage>
  );
}
