import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { day, money } from '../format';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { Person } from '../types';
import { Field, FilterSelect, Select, TextInput } from '../ui/fields';
import { Avatar, Card, CrmPage, ErrorNote, Loading, StatStrip } from '../ui/primitives';

interface Report {
  period: { from: string; to: string };
  funnel: { stage: string; label: string; entered: number }[];
  conversion: { from: string; to: string; rate: number | null }[];
  lost_reasons: { reason: string; label: string; count: number }[];
  lead_sources: { source: string; label: string; contacts: number; clients: number }[];
  time_to_first_shoot_days: number | null;
  activity: { follow_ups_done: number; emails_sent: number; emails_opened: number; emails_replied: number; notes: number };
  quotes: { sent: number; accepted: number; accepted_value: number };
  by_rep: { rep: Person | null; contacts: number; pipeline: number; clients: number; booked_in_period: number }[] | null;
}

const RANGES = [{ value: 'month', label: 'This month' }, { value: 'last_month', label: 'Last month' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }, { value: 'quarter', label: 'This quarter' }, { value: 'year', label: 'This year' }];
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

/** Reports (frame F2). Reps see their own numbers; admins see everyone and can narrow to one rep. */
export default function ReportsPage() {
  useRobbieWhere({ page: 'reports' });
  const compact = useIsMobile();
  const { data: meta } = useCrmMeta();
  const [range, setRange] = useState('month');
  const [rep, setRep] = useState('');
  const [goals, setGoals] = useState(false);
  const q = useCrmQuery<Report>(['crm', 'reports', range, rep], '/reports', { range, rep_id: rep || undefined });
  const r = q.data;

  return (
    <CrmPage
      title="Reports"
      description={r ? `${day(r.period.from)} to ${day(r.period.to)}${meta?.can.view_all ? '' : ' · your contacts'}` : undefined}
      actions={<>
        <FilterSelect label="Period" allLabel="This month" value={range === 'month' ? '' : range} onChange={(v) => setRange(v || 'month')} options={RANGES.slice(1)} />
        {meta?.can.view_all && <FilterSelect label="Rep" allLabel="Everyone" value={rep} onChange={setRep} options={meta.reps.map((x) => ({ value: String(x.id), label: x.name }))} />}
        {meta?.can.assign && <Button size="sm" variant="outline" className="h-8" onClick={() => setGoals(true)}>Set goals</Button>}
      </>}
    >
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {r && (
        <>
          <StatStrip stats={[
            { key: 'booked', label: 'Booked', value: r.funnel.find((f) => f.stage === 'booked')?.entered ?? 0, delta: null, series: null },
            { key: 'first', label: 'First shoots', value: r.funnel.find((f) => f.stage === 'client_pool')?.entered ?? 0, delta: null, series: null },
            { key: 'quotes', label: 'Quotes accepted', value: r.quotes.accepted, delta: null, series: null },
            { key: 'days', label: 'Days to first shoot (median)', value: r.time_to_first_shoot_days ?? 0, delta: null, series: null },
          ]} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Funnel: contacts entering each stage">
              <div className="h-[220px]" role="img" aria-label={r.funnel.map((f) => `${f.label} ${f.entered}`).join(', ')}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.funnel} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" interval={compact ? 'preserveStartEnd' : 0} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="entered" name="Contacts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {r.conversion.map((c) => <span key={c.from}>{r.funnel.find((f) => f.stage === c.from)?.label} → {r.funnel.find((f) => f.stage === c.to)?.label}: <b className="text-foreground">{pct(c.rate)}</b></span>)}
              </div>
            </Card>
            <Card title="Why deals were lost">
              {r.lost_reasons.every((l) => l.count === 0) ? <p className="text-[13px] text-muted-foreground">No lost contacts in this period.</p> : (
                <ul className="flex flex-col gap-2.5">
                  {r.lost_reasons.filter((l) => l.count > 0).sort((a, b) => b.count - a.count).map((l) => {
                    const max = Math.max(...r.lost_reasons.map((x) => x.count), 1);
                    return (
                      <li key={l.reason} className="grid crm-loss-row items-center gap-3 text-[13px]">
                        <span className="truncate">{l.label}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-rose-400" style={{ width: `${(l.count / max) * 100}%` }} /></span>
                        <span className="text-right tabular-nums">{l.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card title="Lead sources" bodyClassName="overflow-x-auto p-0">
              <table className="crm-table">
                <thead><tr><th>Source</th><th className="r">New contacts</th><th className="r">Became clients</th><th className="r">Rate</th></tr></thead>
                <tbody>
                  {r.lead_sources.length === 0 && <tr><td colSpan={4} className="text-muted-foreground">No new contacts in this period.</td></tr>}
                  {r.lead_sources.map((s) => <tr key={s.source}><td>{s.label}</td><td className="r">{s.contacts}</td><td className="r">{s.clients}</td><td className="r">{s.contacts ? pct(s.clients / s.contacts) : '—'}</td></tr>)}
                </tbody>
              </table>
            </Card>
            <Card title="Activity">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {([['Follow-ups done', r.activity.follow_ups_done], ['Notes', r.activity.notes], ['Emails sent', r.activity.emails_sent], ['Opened', r.activity.emails_opened], ['Replied', r.activity.emails_replied], ['Quotes sent', r.quotes.sent]] as const).map(([label, value]) => (
                  <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xl font-semibold tabular-nums">{value}</dd></div>
                ))}
                <div><dt className="text-xs text-muted-foreground">Accepted value</dt><dd className="text-xl font-semibold tabular-nums">{money(r.quotes.accepted_value)}</dd></div>
              </dl>
            </Card>
          </div>
          {r.by_rep && r.by_rep.length > 0 && (
            <Card title="By rep" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead><tr><th>Rep</th><th className="r">Contacts</th><th className="r">In pipeline</th><th className="r">Clients</th><th className="r">Booked this period</th></tr></thead>
                  <tbody>{r.by_rep.map((x) => <tr key={x.rep?.id}><td><span className="flex items-center gap-2"><Avatar person={x.rep} size="sm" />{x.rep?.name}</span></td><td className="r">{x.contacts}</td><td className="r">{x.pipeline}</td><td className="r">{x.clients}</td><td className="r font-medium">{x.booked_in_period}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      <GoalsDialog open={goals} onOpenChange={setGoals} />
    </CrmPage>
  );
}

function GoalsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: meta } = useCrmMeta();
  const [userId, setUserId] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [targets, setTargets] = useState<Record<string, string>>({});
  const current = useCrmQuery<{ people: { user: Person; goals: { metric: string; label: string; target: number | null }[] }[] }>(['crm', 'goals', userId, month], '/goals', { user_id: userId, month }, open && Boolean(userId));
  React.useEffect(() => {
    const goals = current.data?.people[0]?.goals;
    if (goals) setTargets(Object.fromEntries(goals.map((g) => [g.metric, g.target === null ? '' : String(g.target)])));
  }, [current.data]);
  const save = useCrmMutation(() => crmApi.put('/goals', { user_id: Number(userId), month, targets: Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, v === '' ? null : Number(v)])) }), { success: 'Goals saved' });
  const goals = current.data?.people[0]?.goals ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root sm:max-w-md">
        <DialogHeader><DialogTitle>Monthly goals</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Person">{(id) => <Select id={id} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Choose…" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />}</Field>
          <Field label="Month">{(id) => <TextInput id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
          {goals.map((g) => <Field key={g.metric} label={g.label}>{(id) => <TextInput id={id} type="number" min={0} value={targets[g.metric] ?? ''} onChange={(e) => setTargets({ ...targets, [g.metric]: e.target.value })} placeholder="No goal" />}</Field>)}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!userId || save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
