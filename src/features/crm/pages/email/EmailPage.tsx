import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Plus, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { ago, when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import type { EmailTemplate, Person } from '../../types';
import { Field, Select, TextInput } from '../../ui/fields';
import { Chip, CrmPage, Empty, ErrorNote, Loading, TabBar, type Tone } from '../../ui/primitives';
import { SignaturesTab } from './SignaturesTab';
import { CAMPAIGN_STATUS } from './campaignStatus';

const EMAIL_TABS = [
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'drips', label: 'Drips' },
  { key: 'templates', label: 'Templates' },
  { key: 'signatures', label: 'Signatures' },
] as const;
type Tab = (typeof EMAIL_TABS)[number]['key'];
interface DripRow { id: number; name: string; length_key: string; length: string; status: 'draft' | 'live' | 'paused' | 'retired'; enrolled: number; has_draft: boolean; published: { version_no: number; published_at: string | null } | null }
interface CampaignRow { id: number; name: string; status: string; owner: Person | null; subject: string; submitted_at: string | null; scheduled_at: string | null; sent_at: string | null; recipient_count: number | null; updated_at: string | null }

const TEMPLATE_KIND: Record<string, string> = { one_off: 'One-off', drip: 'Drip', campaign: 'Campaign', recruiting: 'Recruiting' };

/** Email: campaigns, drips, templates and signatures (frames 07, 08, 09, 18). */
export default function EmailPage() {
  useRobbieWhere({ page: 'email' });
  const { data: meta } = useCrmMeta();
  const [params, setParams] = useSearchParams();
  const tab = EMAIL_TABS.find((item) => item.key === params.get('tab'))?.key ?? 'campaigns';
  const setTab = (next: Tab) => setParams((current) => {
    const updated = new URLSearchParams(current);
    if (next === 'campaigns') updated.delete('tab');
    else updated.set('tab', next);
    return updated;
  }, { replace: true });
  const [creating, setCreating] = useState<'campaign' | 'template' | null>(null);

  return (
    <CrmPage
      title="Email"
      description="Marketing emails use approved templates and signatures with an unsubscribe link."
      actions={<>
        {tab === 'campaigns' && meta?.can.create_campaigns && <Button size="sm" className="h-8" onClick={() => setCreating('campaign')}><Plus className="mr-1.5 h-3.5 w-3.5" />New campaign</Button>}
        {tab === 'templates' && meta?.can.approve_templates && <Button size="sm" className="h-8" onClick={() => setCreating('template')}><Plus className="mr-1.5 h-3.5 w-3.5" />New template</Button>}
      </>}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[...EMAIL_TABS]} />}
    >
      {tab === 'campaigns' && <CampaignsTab status={params.get('status') ?? ''} />}
      {tab === 'drips' && <DripsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'signatures' && <SignaturesTab />}
      <CreateDialog kind={creating} onClose={() => setCreating(null)} />
    </CrmPage>
  );
}

function CampaignsTab({ status }: { status: string }) {
  const navigate = useNavigate();
  const q = useCrmQuery<{ data: CampaignRow[]; can_approve: boolean }>(['crm', 'campaigns'], '/campaigns');
  const rows = (q.data?.data ?? []).filter((c) => !status || c.status === status);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  if (rows.length === 0) return <Empty icon={<Mail className="h-5 w-5" />} title={status ? 'No campaigns match this status.' : 'No campaigns yet.'}>{!status && 'Write one from an approved campaign template. An admin reviews it before it goes out.'}</Empty>;
  return (
    <div className="overflow-x-auto rounded-[10px] border">
      <table className="crm-table crm-workflow-table">
        <thead><tr><th className="w-3/5 lg:w-auto">Campaign</th><th>Status</th>{q.data?.can_approve && <th className="crm-wide-cell">Owner</th>}<th className="r hidden lg:table-cell">Recipients</th><th className="hidden lg:table-cell">Updated</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} data-href onClick={() => navigate(`/crm/email/campaigns/${c.id}`)}>
              <td>
                <Link to={`/crm/email/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} className="break-words font-medium hover:underline">{c.name}</Link>
                <span className="mt-0.5 block max-w-[360px] break-words text-xs text-muted-foreground">{c.subject}</span>
                {q.data?.can_approve && c.owner?.name && <span className="mt-1 block break-words text-xs text-muted-foreground xl:hidden">By {c.owner.name}</span>}
                <span className="mt-1 block text-xs text-muted-foreground lg:hidden">{c.recipient_count != null ? `${c.recipient_count.toLocaleString()} recipients · ` : ''}{ago(c.updated_at)}</span>
              </td>
              <td><div className="flex flex-col items-start gap-1"><Chip tone={CAMPAIGN_STATUS[c.status]?.[1] ?? 'neutral'} className="crm-workflow-status">{CAMPAIGN_STATUS[c.status]?.[0] ?? c.status}</Chip>{c.scheduled_at && c.status === 'scheduled' && <span className="text-xs text-muted-foreground">{when(c.scheduled_at)}</span>}</div></td>
              {q.data?.can_approve && <td className="crm-wide-cell">{c.owner?.name}</td>}
              <td className="r hidden tabular-nums lg:table-cell">{c.recipient_count ?? '—'}</td>
              <td className="hidden text-muted-foreground lg:table-cell">{ago(c.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DripsTab() {
  const navigate = useNavigate();
  const q = useCrmQuery<{ data: DripRow[]; can_manage: boolean }>(['crm', 'drips'], '/drips');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data?.data ?? [];
  if (rows.length === 0) return <Empty icon={<Repeat className="h-5 w-5" />} title="No live drips yet.">An admin builds and publishes the drips. Enrol contacts from their record once one is live.</Empty>;
  const tone: Record<string, Tone> = { draft: 'line', live: 'green', paused: 'amber', retired: 'neutral' };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((d) => (
        <button key={d.id} type="button" onClick={() => navigate(`/crm/email/drips/${d.id}`)} className="crm-drip-tile flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors disabled:cursor-default" disabled={!q.data?.can_manage}>
          <div className="flex w-full flex-wrap items-center gap-2"><Repeat className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 break-words font-semibold">{d.name}</span><Chip tone={tone[d.status]} className="shrink-0 capitalize">{d.status}</Chip></div>
          <p className="text-xs text-muted-foreground">{d.length} · {d.enrolled} enrolled{d.published ? ` · Version ${d.published.version_no}` : ''}</p>
          {d.has_draft && d.published && <Chip tone="amber" className="self-start">Unpublished changes</Chip>}
        </button>
      ))}
    </div>
  );
}

function TemplatesTab() {
  const navigate = useNavigate();
  const [kind, setKind] = useState('');
  const q = useCrmQuery<{ data: EmailTemplate[]; can_edit: boolean }>(['crm', 'templates', kind], '/templates', { kind: kind || undefined });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by template type">{['', 'one_off', 'campaign', 'drip', 'recruiting'].map((k) => (
        <Button key={k} type="button" size="sm" variant={kind === k ? 'secondary' : 'outline'} aria-pressed={kind === k} onClick={() => setKind(k)} className="min-h-9 px-3">{k ? TEMPLATE_KIND[k] : 'All'}</Button>
      ))}</div>
      {(q.data?.data.length ?? 0) === 0 ? <Empty title="No templates here." /> : (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table crm-workflow-table">
            <thead><tr><th className="w-3/5 lg:w-auto">Template</th><th className="hidden lg:table-cell">Kind</th><th>Status</th><th className="hidden lg:table-cell">Updated</th></tr></thead>
            <tbody>
              {q.data!.data.map((t) => (
                <tr key={t.id} data-href onClick={() => navigate(`/crm/email/templates/${t.id}`)}>
                  <td>
                    <Link to={`/crm/email/templates/${t.id}`} onClick={(e) => e.stopPropagation()} className="break-words font-medium hover:underline">{t.name}</Link>
                    {t.name !== (t.approved ?? t.latest)?.subject && <span className="mt-0.5 block max-w-sm break-words text-xs text-muted-foreground">{(t.approved ?? t.latest)?.subject}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground lg:hidden">{TEMPLATE_KIND[t.kind]} · {ago(t.updated_at)}</span>
                  </td>
                  <td className="hidden lg:table-cell">{TEMPLATE_KIND[t.kind]}</td>
                  <td><div className="crm-workflow-statuses flex flex-wrap gap-1">
                    {t.approved ? <Chip tone="green">Approved v{t.approved.version_no}</Chip> : <Chip tone="line">Not approved</Chip>}
                    {t.latest?.status === 'pending' && <Chip tone="amber">Waiting for review</Chip>}
                    {t.latest?.status === 'rejected' && <Chip tone="red">Changes requested</Chip>}
                    {t.status === 'retired' && <Chip>Retired</Chip>}
                  </div></td>
                  <td className="hidden text-muted-foreground lg:table-cell">{ago(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateDialog({ kind, onClose }: { kind: 'campaign' | 'template' | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [templateKind, setTemplateKind] = useState('one_off');
  const [templateId, setTemplateId] = useState('');
  const templates = useCrmQuery<{ data: EmailTemplate[] }>(['crm', 'templates', 'campaign-approved'], '/templates', { kind: 'campaign', approved_only: 1 }, kind === 'campaign');
  type Created = { campaign?: { id: number }; template?: { id: number } };
  const create = useCrmMutation<void, Created>(() => kind === 'campaign'
    ? crmApi.post<Created>('/campaigns', { name, template_id: Number(templateId) })
    : crmApi.post<Created>('/templates', { name, kind: templateKind, subject: name, body_html: '<p>Hi {{first_name}},</p><p></p>' }));
  React.useEffect(() => { setName(''); setTemplateId(''); }, [kind]);
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="crm-root max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === 'campaign' ? 'New campaign' : 'New template'}</DialogTitle>
          <DialogDescription>{kind === 'campaign' ? 'Start from an approved campaign template, then choose who receives it.' : 'Write it, then submit it for review. Only approved versions can be sent.'}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Name" required>{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
          {kind === 'campaign' && <Field label="Template" required>{(id) => <Select id={id} value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Choose…" options={(templates.data?.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))} />}</Field>}
          {kind === 'template' && <Field label="Used for">{(id) => <Select id={id} value={templateKind} onChange={(e) => setTemplateKind(e.target.value)} options={Object.entries(TEMPLATE_KIND).map(([value, label]) => ({ value, label }))} />}</Field>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || (kind === 'campaign' && !templateId) || create.isPending} onClick={() => create.mutate(undefined, {
            onSuccess: (r) => { onClose(); navigate(r.campaign ? `/crm/email/campaigns/${r.campaign.id}` : `/crm/email/templates/${r.template?.id}`); },
          })}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
