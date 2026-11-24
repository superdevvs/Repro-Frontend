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

type Tab = 'campaigns' | 'drips' | 'templates' | 'signatures';
interface DripRow { id: number; name: string; length_key: string; length: string; status: 'draft' | 'live' | 'paused' | 'retired'; enrolled: number; has_draft: boolean; published: { version_no: number; published_at: string | null } | null }
interface CampaignRow { id: number; name: string; status: string; owner: Person | null; subject: string; submitted_at: string | null; scheduled_at: string | null; sent_at: string | null; recipient_count: number | null; updated_at: string | null }

const TEMPLATE_KIND: Record<string, string> = { one_off: 'One-off', drip: 'Drip', campaign: 'Campaign', recruiting: 'Recruiting' };

/** Email: campaigns, drips, templates and signatures (frames 07, 08, 09, 18). */
export default function EmailPage() {
  useRobbieWhere({ page: 'email' });
  const { data: meta } = useCrmMeta();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'campaigns');
  const [creating, setCreating] = useState<'campaign' | 'template' | null>(null);

  return (
    <CrmPage
      title="Email"
      description="Every email uses an approved template, a reviewed signature and an unsubscribe link."
      actions={<>
        {tab === 'campaigns' && meta?.can.create_campaigns && <Button size="sm" className="h-8" onClick={() => setCreating('campaign')}><Plus className="mr-1.5 h-3.5 w-3.5" />New campaign</Button>}
        {tab === 'templates' && meta?.can.approve_templates && <Button size="sm" className="h-8" onClick={() => setCreating('template')}><Plus className="mr-1.5 h-3.5 w-3.5" />New template</Button>}
      </>}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'campaigns', label: 'Campaigns' }, { key: 'drips', label: 'Drips' }, { key: 'templates', label: 'Templates' }, { key: 'signatures', label: 'Signatures' }]} />}
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
  if (rows.length === 0) return <Empty icon={<Mail className="h-5 w-5" />} title="No campaigns yet.">Write one from an approved campaign template. An admin reviews it before it goes out.</Empty>;
  return (
    <div className="overflow-x-auto rounded-[10px] border">
      <table className="crm-table">
        <thead><tr><th>Campaign</th><th>Status</th>{q.data?.can_approve && <th>Owner</th>}<th className="r">Recipients</th><th>Updated</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} data-href onClick={() => navigate(`/crm/email/campaigns/${c.id}`)}>
              <td><Link to={`/crm/email/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{c.name}</Link><span className="block max-w-[360px] truncate text-xs text-muted-foreground">{c.subject}</span></td>
              <td><Chip tone={CAMPAIGN_STATUS[c.status]?.[1] ?? 'neutral'}>{CAMPAIGN_STATUS[c.status]?.[0] ?? c.status}</Chip>{c.scheduled_at && c.status === 'scheduled' && <span className="ml-1.5 text-xs text-muted-foreground">{when(c.scheduled_at)}</span>}</td>
              {q.data?.can_approve && <td>{c.owner?.name}</td>}
              <td className="r tabular-nums">{c.recipient_count ?? '—'}</td>
              <td className="text-muted-foreground">{ago(c.updated_at)}</td>
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
    <div className="grid gap-3 md:grid-cols-3">
      {rows.map((d) => (
        <button key={d.id} type="button" onClick={() => q.data?.can_manage && navigate(`/crm/email/drips/${d.id}`)} className="flex flex-col gap-2 rounded-[10px] border p-4 text-left hover:bg-secondary/50 disabled:cursor-default" disabled={!q.data?.can_manage}>
          <div className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" /><span className="font-semibold">{d.name}</span><Chip tone={tone[d.status]} className="ml-auto capitalize">{d.status}</Chip></div>
          <p className="text-xs text-muted-foreground">{d.length} · {d.enrolled} enrolled{d.published ? ` · version ${d.published.version_no}` : ' · not published yet'}</p>
          {d.has_draft && <Chip tone="amber" className="self-start">Unpublished changes</Chip>}
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
      <div className="flex gap-1.5">{['', 'one_off', 'campaign', 'drip', 'recruiting'].map((k) => (
        <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`h-7 rounded-full border px-3 text-xs font-medium ${kind === k ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>{k ? TEMPLATE_KIND[k] : 'All'}</button>
      ))}</div>
      {(q.data?.data.length ?? 0) === 0 ? <Empty title="No templates here." /> : (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="crm-table">
            <thead><tr><th>Template</th><th>Kind</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {q.data!.data.map((t) => (
                <tr key={t.id} data-href onClick={() => navigate(`/crm/email/templates/${t.id}`)}>
                  <td><Link to={`/crm/email/templates/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{t.name}</Link><span className="block max-w-[380px] truncate text-xs text-muted-foreground">{(t.approved ?? t.latest)?.subject}</span></td>
                  <td>{TEMPLATE_KIND[t.kind]}</td>
                  <td className="flex flex-wrap gap-1">
                    {t.approved ? <Chip tone="green">Approved v{t.approved.version_no}</Chip> : <Chip tone="line">Not approved</Chip>}
                    {t.latest?.status === 'pending' && <Chip tone="amber">Waiting for review</Chip>}
                    {t.latest?.status === 'rejected' && <Chip tone="red">Changes requested</Chip>}
                    {t.status === 'retired' && <Chip>Retired</Chip>}
                  </td>
                  <td className="text-muted-foreground">{ago(t.updated_at)}</td>
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
      <DialogContent className="crm-root sm:max-w-[440px]">
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
