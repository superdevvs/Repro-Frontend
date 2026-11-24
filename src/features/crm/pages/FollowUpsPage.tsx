import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Mail, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api';
import { toApiError } from '../api';
import { cn } from '@/lib/utils';
import { useCrmMeta, useCrmQuery } from '../hooks';
import { ago, shortDay, time } from '../format';
import { useCrmRobbie, useRobbieWhere } from '../robbie/useCrmRobbie';
import type { CrmEvent, Person } from '../types';
import { FilterSelect } from '../ui/fields';
import { Chip, CrmPage, Empty, ErrorNote, Loading, Note, TabBar } from '../ui/primitives';
import { CompleteEventDialog, ScheduleEventDialog } from '../components/EventDialogs';

interface FollowUps {
  user: Person | null;
  groups: { overdue: CrmEvent[]; today: CrmEvent[]; upcoming: CrmEvent[] };
  recently_done: CrmEvent[];
  calendar: { connected: boolean; sync_enabled?: boolean; email?: string | null; message?: string | null } | null;
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
  const [connecting, setConnecting] = useState(false);
  const connectCalendar = async () => {
    setConnecting(true);
    try {
      const { data } = await apiClient.post<{ data?: { authorization_url?: string } }>('/google-calendar/connect', { source: 'crm' });
      if (data.data?.authorization_url) window.location.assign(data.data.authorization_url);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setConnecting(false);
    }
  };

  const g = q.data?.groups;
  const due = (g?.overdue.length ?? 0) + (g?.today.length ?? 0);

  return (
    <CrmPage
      title="Follow-ups"
      description={q.data?.user && meta?.me.id !== q.data.user.id ? `For ${q.data.user.name}` : 'Your calls, emails and meetings.'}
      actions={<>
        {meta?.can.view_all && <FilterSelect label="Person" allLabel="Me" value={userId} onChange={setUserId} options={(meta.reps ?? []).filter((r) => r.id !== meta.me.id).map((r) => ({ value: String(r.id), label: r.name }))} />}
        <Button size="sm" variant="outline" className="h-8" onClick={() => robbie?.ask('Plan my day')}>Plan my day</Button>
      </>}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'due', label: 'Due', count: due }, { key: 'upcoming', label: 'Next 7 days', count: g?.upcoming.length }, { key: 'done', label: 'Done', count: q.data?.recently_done.length }]} />}
    >
      {q.data?.calendar && !q.data.calendar.connected && (!userId || Number(userId) === meta?.me.id) && (
        <Note tone="info">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Connect Google Calendar to see follow-ups next to your other meetings. Moving one in either place moves it in both.</span>
            <Button size="sm" variant="outline" className="h-7 bg-card" disabled={connecting} onClick={() => void connectCalendar()}>{connecting ? 'Opening Google…' : 'Connect Google Calendar'}</Button>
          </div>
        </Note>
      )}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {g && tab === 'due' && (
        due === 0 ? <Empty icon={<CalendarCheck className="h-5 w-5" />} title="Nothing due. Nice." /> : (
          <>
            {g.overdue.length > 0 && <Section title="Overdue" tone="bad" events={g.overdue} onComplete={setCompleting} onMove={setMoving} />}
            {g.today.length > 0 && <Section title="Today" events={g.today} onComplete={setCompleting} onMove={setMoving} />}
          </>
        )
      )}
      {g && tab === 'upcoming' && (g.upcoming.length === 0 ? <Empty title="Nothing planned for the next week." /> : <Section title="Coming up" events={g.upcoming} onComplete={setCompleting} onMove={setMoving} />)}
      {q.data && tab === 'done' && (
        q.data.recently_done.length === 0 ? <Empty title="Nothing completed in the last week." /> : (
          <ul className="divide-y rounded-[10px] border">
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
      <CompleteEventDialog event={completing} onClose={() => setCompleting(null)} />
      <ScheduleEventDialog open={moving !== undefined} onOpenChange={(o) => !o && setMoving(undefined)} event={moving} contactName={moving?.contact?.name} />
    </CrmPage>
  );
}

function Section({ title, tone, events, onComplete, onMove }: { title: string; tone?: 'bad'; events: CrmEvent[]; onComplete: (e: CrmEvent) => void; onMove: (e: CrmEvent) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={cn('text-xs font-semibold uppercase tracking-wide', tone === 'bad' ? 'crm-text-red' : 'text-muted-foreground')}>{title} · {events.length}</h2>
      <ul className="divide-y overflow-hidden rounded-[10px] border">
        {events.map((e) => {
          const Icon = ICON[e.type?.key ?? ''] ?? CalendarCheck;
          const who = e.contact ?? (e.applicant ? { id: e.applicant.id, name: e.applicant.name, company: null } : null);
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 bg-card px-4 py-3">
              <button type="button" onClick={() => onComplete(e)} className="h-5 w-5 shrink-0 rounded-md border-[1.5px] hover:border-primary" aria-label={`Complete ${e.type?.label}`} />
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {e.type?.label} · {who ? <Link to={e.contact ? `/crm/contacts/${who.id}` : `/crm/recruiting/applicants/${who.id}`} className="hover:underline">{who.name}</Link> : 'No contact'}
                  {e.contact?.company && <span className="font-normal text-muted-foreground"> · {e.contact.company}</span>}
                </p>
                <p className={cn('text-xs', e.overdue ? 'crm-text-red' : 'text-muted-foreground')}>
                  {e.overdue ? `${e.late} late · was ${shortDay(e.starts_at)}` : `${shortDay(e.starts_at)} · ${time(e.starts_at)} · ${e.duration_min} min`}{e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              {e.on_calendar && <Chip tone="line">Calendar</Chip>}
              {e.via_robbie && <Chip tone="blue">via Robbie</Chip>}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onMove(e)}>Move</Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
