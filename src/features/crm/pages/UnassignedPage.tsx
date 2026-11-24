import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { ago, when } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { Contact, Person } from '../types';
import { Select } from '../ui/fields';
import { Avatar, Chip, CrmPage, Empty, ErrorNote, Loading, TabBar } from '../ui/primitives';

interface Alert { id: number; attempted_by: Person | null; match_type: 'email' | 'phone' | 'name'; payload: Record<string, string | null>; origin: string; created_at: string; matched_contact: Contact | null }
interface Queue { leads: Contact[]; duplicate_attempts: Alert[] }
type Tab = 'leads' | 'duplicates';

/** Unassigned queue (frame 05): website leads waiting for a rep, with Robbie's suggestion, and duplicate attempts. */
export default function UnassignedPage() {
  useRobbieWhere({ page: 'unassigned' });
  const { data: meta } = useCrmMeta();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'duplicates' ? 'duplicates' : 'leads');
  const q = useCrmQuery<Queue>(['crm', 'queue'], '/queue/unassigned', undefined, Boolean(meta?.can.assign));
  const [choice, setChoice] = useState<Record<number, string>>({});
  const assign = useCrmMutation(({ id, rep }: { id: number; rep: number }) => crmApi.post(`/contacts/${id}/assign`, { rep_id: rep }), { success: 'Assigned' });
  const resolve = useCrmMutation(({ id, outcome }: { id: number; outcome: string }) => crmApi.post(`/queue/duplicates/${id}/resolve`, { resolution: outcome }), { success: 'Resolved' });

  if (meta && !meta.can.assign) return <CrmPage title="Unassigned"><Empty title="Only admins see the unassigned queue." /></CrmPage>;

  return (
    <CrmPage
      title="Unassigned"
      description="New website leads wait here until an admin gives them to a rep. Reps who try to add an existing contact show up under duplicates."
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'leads', label: 'Leads', count: q.data?.leads.length }, { key: 'duplicates', label: 'Duplicate attempts', count: q.data?.duplicate_attempts.length }]} />}
    >
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}

      {q.data && tab === 'leads' && (q.data.leads.length === 0 ? <Empty icon={<Inbox className="h-5 w-5" />} title="Every lead has a rep." /> : (
        <ul className="flex flex-col gap-2">
          {q.data.leads.map((c) => {
            const picked = choice[c.id] ?? (c.suggestion ? String(c.suggestion.rep.id) : '');
            return (
              <li key={c.id} className="flex flex-wrap items-start gap-4 rounded-[10px] border p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/crm/contacts/${c.id}`} className="text-sm font-semibold hover:underline">{c.name}</Link>
                    <Chip tone="blue">{c.lead_source_label}</Chip>
                    <Chip tone="line">{c.segment === 'commercial' ? 'Commercial' : 'Residential'}</Chip>
                    {c.market && <span className="text-xs text-muted-foreground">{c.market}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{[c.company, c.email, c.phone].filter(Boolean).join(' · ')} · waiting {ago(c.created_at)}</p>
                  {c.inquiry?.message && <p className="mt-2 line-clamp-3 rounded-lg crm-bg-thead p-2.5 text-[13px]">“{c.inquiry.message}”</p>}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-64">
                  {c.suggestion && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Robbie suggests <b className="text-foreground">{c.suggestion.rep.name}</b>: {c.suggestion.reason}</p>}
                  <div className="flex gap-2">
                    <Select aria-label={`Rep for ${c.name}`} value={picked} onChange={(e) => setChoice({ ...choice, [c.id]: e.target.value })} placeholder="Choose a rep…" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />
                    <Button size="sm" className="h-8 shrink-0" disabled={!picked || assign.isPending} onClick={() => assign.mutate({ id: c.id, rep: Number(picked) })}>Assign</Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ))}

      {q.data && tab === 'duplicates' && (q.data.duplicate_attempts.length === 0 ? <Empty icon={<ShieldAlert className="h-5 w-5" />} title="No duplicate attempts to review." /> : (
        <ul className="flex flex-col gap-2">
          {q.data.duplicate_attempts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-4 rounded-[10px] border p-4">
              <Avatar person={a.attempted_by} />
              <div className="min-w-0 flex-1 text-[13px]">
                <p><b>{a.attempted_by?.name ?? 'Someone'}</b> tried to add <b>{a.payload.name ?? 'a contact'}</b> ({a.payload.email ?? a.payload.phone ?? 'no email'}) · same {a.match_type} · {when(a.created_at)}{a.origin !== 'form' ? ` · via ${a.origin}` : ''}</p>
                {a.matched_contact && (
                  <p className="mt-1 text-muted-foreground">Already in the CRM as <Link to={`/crm/contacts/${a.matched_contact.id}`} className="font-medium text-foreground hover:underline">{a.matched_contact.name}</Link> · {a.matched_contact.stage_label} · {a.matched_contact.assigned_rep?.name ?? 'Unassigned'}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => resolve.mutate({ id: a.id, outcome: 'kept' })}>Keep current owner</Button>
                {a.match_type === 'name' && <Button size="sm" variant="outline" className="h-8" onClick={() => resolve.mutate({ id: a.id, outcome: 'allowed_different' })}>Different person: add it</Button>}
                {a.matched_contact && a.attempted_by && <Button size="sm" className="h-8" onClick={() => resolve.mutate({ id: a.id, outcome: 'reassigned' })}>Give to {a.attempted_by.name.split(' ')[0]}</Button>}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </CrmPage>
  );
}
