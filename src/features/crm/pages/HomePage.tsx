import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, Bell, CalendarCheck, Phone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { useCrmMutation, useCrmQuery } from '../hooks';
import { ago, shortDay, time, when } from '../format';
import { useCrmRobbie, useRobbieWhere } from '../robbie/useCrmRobbie';
import type { CrmEvent, Insight, Stat } from '../types';
import { Card, Chip, CrmPage, Empty, ErrorNote, Loading, StatStrip } from '../ui/primitives';
import { CompleteEventDialog } from '../components/EventDialogs';

interface Home {
  greeting_name: string;
  today: CrmEvent[];
  overdue_count: number;
  goals: { metric: string; label: string; target: number | null; actual: number }[];
  pipeline: Stat[];
  at_risk: { id: number; name: string; company: string | null; usual_gap_days: number | null; last_shoot_on: string | null }[];
  new_leads: { id: number; name: string; company: string | null; lead_source: string; first_contact_due_at: string | null; late: boolean }[];
  notices: { id: number; type: string; title: string; body: string | null; contact_id: number | null; data: Record<string, unknown> | null; created_at: string }[];
  insights: Insight[];
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/** Home, "my day" (frame F1; phones M7). */
export default function HomePage() {
  useRobbieWhere({ page: 'home' });
  const robbie = useCrmRobbie();
  const q = useCrmQuery<Home>(['crm', 'home'], '/home');
  const [completing, setCompleting] = useState<CrmEvent | null>(null);
  const readAll = useCrmMutation(() => crmApi.post('/notices/read', { all: true }));

  if (q.isLoading) return <CrmPage title="Home"><Loading /></CrmPage>;
  if (q.error || !q.data) return <CrmPage title="Home"><ErrorNote error={q.error} onRetry={() => q.refetch()} /></CrmPage>;
  const d = q.data;
  const overdue = d.today.filter((e) => e.overdue);
  const today = d.today.filter((e) => !e.overdue);

  return (
    <CrmPage
      title={`${greeting()}, ${d.greeting_name}`}
      description={`${format(new Date(), 'EEEE d MMMM')} · ${d.today.length} follow-up${d.today.length === 1 ? '' : 's'} due${d.overdue_count ? `, ${d.overdue_count} overdue` : ''}`}
      actions={<Button size="sm" variant="outline" className="h-8" onClick={() => robbie?.ask('Plan my day')}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Plan my day</Button>}
    >
      <StatStrip stats={d.pipeline} className="max-md:grid-cols-2" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {d.new_leads.length > 0 && (
            <Card title={<h2 className="flex items-center gap-2 text-[13px] font-semibold">New leads · contact within a day</h2>} bodyClassName="p-0">
              <ul className="divide-y">
                {d.new_leads.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/crm/contacts/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
                      <p className={cn('text-xs', l.late ? 'crm-text-red' : 'text-muted-foreground')}>{l.first_contact_due_at ? (l.late ? `Was due ${when(l.first_contact_due_at)}` : `Due ${when(l.first_contact_due_at)}`) : 'No target set'}{l.company ? ` · ${l.company}` : ''}</p>
                    </div>
                    <Button asChild size="icon" variant="outline" className="h-8 w-8"><Link to={`/crm/contacts/${l.id}`} aria-label={`Open ${l.name}`}><Phone className="h-3.5 w-3.5" /></Link></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={<h2 className="flex items-center gap-2 text-[13px] font-semibold"><CalendarCheck className="h-4 w-4 text-muted-foreground" />Today</h2>} actions={<Link to="/crm/follow-ups" className="text-xs font-medium text-accent-foreground hover:underline">All follow-ups</Link>} bodyClassName="p-0">
            {d.today.length === 0 ? <Empty title="Nothing due today.">A good moment to check on clients who haven’t booked in a while.</Empty> : (
              <ul className="divide-y">
                {[...overdue, ...today].map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button type="button" onClick={() => setCompleting(e)} className="h-5 w-5 shrink-0 rounded-md border-[1.5px] hover:border-primary" aria-label={`Complete ${e.type?.label} with ${e.contact?.name ?? e.applicant?.name ?? ''}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{e.type?.label} · {e.contact ? <Link to={`/crm/contacts/${e.contact.id}`} className="hover:underline">{e.contact.name}</Link> : e.applicant ? <Link to={`/crm/recruiting/applicants/${e.applicant.id}`} className="hover:underline">{e.applicant.name}</Link> : 'No contact'}</p>
                      <p className={cn('text-xs', e.overdue ? 'crm-text-red' : 'text-muted-foreground')}>{e.overdue ? `${e.late} late · ${shortDay(e.starts_at)}` : `${time(e.starts_at)} · ${e.duration_min} min`}{e.note ? ` · ${e.note}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.at_risk.length > 0 && (
            <Card title={<h2 className="flex items-center gap-2 text-[13px] font-semibold"><AlertTriangle className="h-4 w-4 crm-text-amber" />Clients who haven’t booked in a while</h2>} actions={<Link to="/crm/client-pool?health=at_risk" className="text-xs font-medium text-accent-foreground hover:underline">See all</Link>} bodyClassName="p-0">
              <ul className="divide-y">
                {d.at_risk.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/crm/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <p className="text-xs text-muted-foreground">{c.company ? `${c.company} · ` : ''}usually every {c.usual_gap_days} days · last shoot {c.last_shoot_on ? ago(c.last_shoot_on) : '—'}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => robbie?.ask(`Draft a check-in email to ${c.name} (contact ${c.id})`)}>Check in</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Goals this month">
            {d.goals.every((g) => g.target === null) ? <p className="text-[13px] text-muted-foreground">No goals set for this month.</p> : (
              <ul className="flex flex-col gap-3">
                {d.goals.filter((g) => g.target !== null).map((g) => {
                  const pct = g.target ? Math.min(100, Math.round((g.actual / g.target) * 100)) : 0;
                  return (
                    <li key={g.metric}>
                      <div className="flex justify-between text-[13px]"><span>{g.label}</span><span className="tabular-nums"><b>{g.actual}</b> <span className="text-muted-foreground">of {g.target}</span></span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={g.label}>
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={<h2 className="flex items-center gap-2 text-[13px] font-semibold"><Bell className="h-4 w-4 text-muted-foreground" />Updates</h2>} actions={d.notices.length > 0 ? <button type="button" onClick={() => readAll.mutate(undefined)} className="text-xs font-medium text-accent-foreground hover:underline">Mark all read</button> : undefined} bodyClassName="p-0">
            {d.notices.length === 0 ? <p className="px-4 py-3 text-[13px] text-muted-foreground">You’re all caught up.</p> : (
              <ul className="divide-y">
                {d.notices.map((n) => (
                  <li key={n.id} className="px-4 py-2.5">
                    {n.contact_id ? <Link to={`/crm/contacts/${n.contact_id}`} className="text-[13px] font-medium hover:underline">{n.title}</Link> : <p className="text-[13px] font-medium">{n.title}</p>}
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground">{ago(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.insights.length > 0 && (
            <Card title="Robbie noticed" bodyClassName="flex flex-col gap-2 p-3">
              {d.insights.map((i) => (
                <button key={i.key} type="button" onClick={() => robbie?.ask(i.prompt)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-secondary">
                  <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', i.tone === 'warning' ? 'bg-amber-500' : 'bg-primary')} aria-hidden="true" />{i.text}
                  <Chip tone="line" className="ml-auto">Ask</Chip>
                </button>
              ))}
            </Card>
          )}
        </div>
      </div>
      <CompleteEventDialog event={completing} onClose={() => setCompleting(null)} />
    </CrmPage>
  );
}
