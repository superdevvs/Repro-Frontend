import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Check, Mail, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api';
import { toApiError } from '../api';
import { cn } from '@/lib/utils';
import { useCrmMeta, useCrmQuery } from '../hooks';
import { ago, scheduleTimeLabel, shortDay, time } from '../format';
import { useCrmRobbie, useRobbieWhere } from '../robbie/useCrmRobbie';
import type { CrmEvent, Person } from '../types';
import { FilterSelect } from '../ui/fields';
import { Card, Chip, CrmPage, Empty, ErrorNote, Loading, TabBar } from '../ui/primitives';
import { EventTypeSettings } from '../components/EventTypeSettings';
import { CompleteEventDialog, ScheduleEventDialog } from '../components/EventDialogs';

interface FollowUps {
  user: Person | null;
  groups: { overdue: CrmEvent[]; today: CrmEvent[]; upcoming: CrmEvent[] };
  recently_done: CrmEvent[];
  calendar: { connected: boolean; crm_sync?: boolean; sync_enabled?: boolean; email?: string | null; message?: string | null } | null;
}
type Tab = 'due' | 'upcoming' | 'done';
const ICON: Record<string, React.ElementType> = { call: Phone, checkin_call: Phone, email: Mail, checkin_email: Mail, meeting: Users };

/** Follow-ups (frame 06; phones M3): overdue first, then today, the next 7 days, and recently done. */
export default function FollowUpsPage() {
  useRobbieWhere({ page: 'follow_ups' });
  const { data: meta } = useCrmMeta();
  const robbie = useCrmRobbie();
  const [tab, setTab] = useState<Tab>('due');
  const [userId, setUserId] = useState('');
  const q = useCrmQuery<FollowUps>(['crm', 'follow-ups', userId], '/follow-ups', { user_id: userId || undefined, days: 7 });
  const [completing, setCompleting] = useState<CrmEvent | null>(null);
  const [moving, setMoving] = useState<CrmEvent | undefined>();
  const [settings, setSettings] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const connectCalendar = async () => {
    setConnecting(true);
    try {
      const { data } = await apiClient.post<{ data?: { authorization_url?: string } }>('/crm/calendar/connect', { source: 'crm' });
      if (data.data?.authorization_url) window.location.assign(data.data.authorization_url);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setConnecting(false);
    }
  };

  const g = q.data?.groups;
  const due = (g?.overdue.length ?? 0) + (g?.today.length ?? 0);
  const calendar = q.data?.calendar;
  const syncOn = Boolean(calendar?.connected && calendar.crm_sync && calendar.sync_enabled);

  return (
    <CrmPage
      title="Follow-ups"
      description={q.data?.user && meta?.me.id !== q.data.user.id ? `For ${q.data.user.name} · ${scheduleTimeLabel()}` : scheduleTimeLabel()}
      actions={<>
        {meta?.can.view_all && <FilterSelect label="Person" allLabel="Me" value={userId} onChange={setUserId} options={(meta.reps ?? []).filter((r) => r.id !== meta.me.id).map((r) => ({ value: String(r.id), label: r.name }))} />}
        {meta?.can.manage_event_types && <Button size="sm" variant="outline" onClick={() => setSettings(true)}>Follow-up types</Button>}
        <Button size="sm" variant="outline" className="h-8" onClick={() => robbie?.ask('Plan my day')}>Plan my day</Button>
      </>}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'due', label: 'Due', count: due }, { key: 'upcoming', label: 'Next 7 days', count: g?.upcoming.length }, { key: 'done', label: 'Done', count: q.data?.recently_done.length }]} />}
    >
      {calendar && (!userId || Number(userId) === meta?.me.id) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-[9rem] flex-1 break-words">
            <h2 className="text-sm font-semibold">Google Calendar</h2>
            <p className="text-xs text-muted-foreground">{calendar.connected
              ? calendar.email ?? 'Account connected'
              : calendar.crm_sync ? 'Sync follow-ups and calendar changes both ways.' : 'Connect your account ahead of activation.'}</p>
          </div>
          {calendar.connected
            ? <Chip tone={syncOn ? 'green' : 'line'}>{syncOn ? 'Two-way sync on' : 'Sync off'}</Chip>
            : <Button size="sm" variant="outline" disabled={connecting} onClick={() => void connectCalendar()}>{connecting ? 'Opening Google…' : 'Connect Google Calendar'}</Button>}
        </div>
      )}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {g && tab === 'due' && (
        due === 0 ? <Card bodyClassName="p-0"><Empty icon={<CalendarCheck className="h-5 w-5" />} title="No follow-ups due." /></Card> : (
          <>
            {g.overdue.length > 0 && <Section title="Overdue" tone="bad" events={g.overdue} onComplete={setCompleting} onMove={setMoving} />}
            {g.today.length > 0 && <Section title="Today" events={g.today} onComplete={setCompleting} onMove={setMoving} />}
          </>
        )
      )}
      {g && tab === 'upcoming' && (g.upcoming.length === 0 ? <Card bodyClassName="p-0"><Empty icon={<CalendarDays className="h-5 w-5" />} title="No follow-ups in the next 7 days." /></Card> : <Section title="Coming up" events={g.upcoming} onComplete={setCompleting} onMove={setMoving} />)}
      {q.data && tab === 'done' && (
        q.data.recently_done.length === 0 ? <Empty title="Nothing completed in the last week." /> : (
          <ul className="divide-y rounded-xl border bg-card">
            {q.data.recently_done.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <Chip tone={e.status === 'done' ? 'green' : 'amber'}>{e.status === 'done' ? 'Done' : 'Missed'}</Chip>
                <span className="font-medium">{e.type?.label}</span>
                {e.contact && <Link to={`/crm/contacts/${e.contact.id}`} className="hover:underline">{e.contact.name}</Link>}
                <span className="text-muted-foreground">{e.outcome_note}</span>
                <span className="ml-auto text-xs text-muted-foreground">{ago(e.completed_at)}</span>
              </li>
            ))}
          </ul>
        )
      )}
      {settings && <EventTypeSettings onClose={() => setSettings(false)} />}
      <CompleteEventDialog event={completing} onClose={() => setCompleting(null)} />
      <ScheduleEventDialog open={moving !== undefined} onOpenChange={(o) => !o && setMoving(undefined)} event={moving} contactName={moving?.contact?.name} />
    </CrmPage>
  );
}

function Section({ title, tone, events, onComplete, onMove }: { title: string; tone?: 'bad'; events: CrmEvent[]; onComplete: (e: CrmEvent) => void; onMove: (e: CrmEvent) => void }) {
  return (
    <Card title={title} actions={<Chip tone={tone === 'bad' ? 'red' : 'line'}>{events.length.toLocaleString()}</Chip>} bodyClassName="p-0">
      <ul className="divide-y">
        {events.map((e) => {
          const Icon = ICON[e.type?.key ?? ''] ?? CalendarCheck;
          const who = e.contact ?? (e.applicant ? { id: e.applicant.id, name: e.applicant.name, company: null } : null);
          return (
            <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3.5 py-3 sm:items-center">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 break-words">
                <p className="text-sm font-medium">
                  {who ? <Link to={e.contact ? `/crm/contacts/${who.id}` : `/crm/recruiting/applicants/${who.id}`} className="hover:underline">{who.name}</Link> : e.type?.label ?? 'Follow-up'}
                  {e.contact?.company && <span className="font-normal text-muted-foreground"> · {e.contact.company}</span>}
                </p>
                <p className={cn('text-xs', e.overdue ? 'crm-text-red' : 'text-muted-foreground')}>
                  {who && e.type?.label ? `${e.type.label} · ` : ''}{e.overdue ? `${e.late} late · was ${shortDay(e.starts_at)}` : `${shortDay(e.starts_at)} · ${time(e.starts_at)} · ${e.duration_min} min`}
                </p>
                {e.note && <p className="mt-1 text-xs text-muted-foreground">{e.note}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5 max-sm:w-full">
                {e.on_calendar && <Chip tone="line">Calendar</Chip>}
                {e.via_robbie && <Chip tone="blue">via Robbie</Chip>}
                <Button type="button" size="sm" variant="ghost" onClick={() => onMove(e)}>Reschedule</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onComplete(e)} aria-label={`Complete ${e.type?.label ?? 'follow-up'}${who ? ` with ${who.name}` : ''}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />Complete</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
