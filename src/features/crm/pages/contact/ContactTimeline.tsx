import React, { useState } from 'react';
import { Bot, CalendarClock, CheckCircle2, Clock, GitBranch, Mail, Pencil, StickyNote, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { crmKeys, useCrmMutation, useCrmQuery } from '../../hooks';
import { ago, when } from '../../format';
import type { Activity, CrmEvent, Note as CrmNote } from '../../types';
import { TextArea } from '../../ui/fields';
import { Avatar, Chip, Empty, ErrorNote, Loading } from '../../ui/primitives';
import { CompleteEventDialog, ScheduleEventDialog } from '../../components/EventDialogs';

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  note: StickyNote, stage_changed: GitBranch, stage: GitBranch, lost: GitBranch, reopened: GitBranch, assigned: UserRound,
  email_sent: Mail, email_reply: Mail, event_scheduled: CalendarClock, event_done: CheckCircle2, event_missed: Clock,
};

/** History, newest first. "via Robbie" marks what was confirmed from a Robbie suggestion. */
export function ActivityList({ contactId }: { contactId: number }) {
  const q = useCrmQuery<{ data: Activity[] }>(crmKeys.contactPart(contactId, 'activity'), `/contacts/${contactId}/activity`);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.data ?? [];
  if (items.length === 0) return <Empty title="No history yet." />;
  return (
    <ol className="relative flex flex-col">
      {items.map((a) => {
        const Icon = ACTIVITY_ICON[a.type] ?? Clock;
        return (
          <li key={a.id} className="flex gap-3 py-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">{a.summary}</p>
              {typeof a.data.excerpt === 'string' && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.data.excerpt}</p>}
              {typeof a.data.message === 'string' && <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">“{a.data.message}”</p>}
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {a.actor?.name ?? 'System'} · {when(a.occurred_at)}
                {a.via_robbie && <Chip tone="blue"><Bot className="h-3 w-3" aria-hidden="true" />via Robbie</Chip>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Notes: anyone with edit rights adds; only the author edits; earlier versions are kept. */
export function NotesList({ contactId, canAdd }: { contactId: number; canAdd: boolean }) {
  const q = useCrmQuery<{ data: CrmNote[] }>(crmKeys.contactPart(contactId, 'notes'), `/contacts/${contactId}/notes`);
  const [body, setBody] = useState('');
  const [history, setHistory] = useState<number | null>(null);
  const versions = useCrmQuery<{ note: CrmNote; versions: { id: number; saved_at: string; body: string }[] }>(
    crmKeys.contactPart(contactId, `note-${history}-versions`), `/contacts/${contactId}/notes/${history}/versions`, undefined, history !== null,
  );
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const add = useCrmMutation(() => crmApi.post(`/contacts/${contactId}/notes`, { body }), { success: 'Note added' });
  const save = useCrmMutation(() => crmApi.patch(`/contacts/${contactId}/notes/${editing!.id}`, { body: editing!.body }), { success: 'Note updated' });

  return (
    <div className="flex flex-col gap-3">
      {canAdd && (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(undefined, { onSuccess: () => setBody('') }); }} className="flex flex-col gap-2">
          <label htmlFor="crm-note-new" className="sr-only">New note</label>
          <TextArea id="crm-note-new" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note. It’s timestamped and kept in the history." />
          <Button type="submit" size="sm" className="self-end" disabled={!body.trim() || add.isPending}>{add.isPending ? 'Saving…' : 'Add note'}</Button>
        </form>
      )}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty title="No notes yet." />}
      {q.data?.data.map((n) => (
        <article key={n.id} className="rounded-[10px] border p-3">
          <header className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar person={n.author} size="sm" /><span className="font-medium text-foreground">{n.author?.name ?? 'Unknown'}</span>· {when(n.created_at)}
            {n.edited_at && <button type="button" className="font-medium text-accent-foreground underline" onClick={() => setHistory(n.id)}>Version history</button>}
            {n.via_robbie && <Chip tone="blue">via Robbie</Chip>}
            {n.can_edit && editing?.id !== n.id && <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" aria-label="Edit note" onClick={() => setEditing({ id: n.id, body: n.body })}><Pencil className="h-3 w-3" /></Button>}
          </header>
          {editing?.id === n.id ? (
            <div className="flex flex-col gap-2">
              <TextArea aria-label="Edit note" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" disabled={!editing.body.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => setEditing(null) })}>Save</Button>
              </div>
            </div>
          ) : <p className="whitespace-pre-wrap text-[13px]">{n.body}</p>}
        </article>
      ))}
      <Dialog open={history !== null} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent className="crm-root max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Note history</DialogTitle></DialogHeader>
          {versions.isLoading && <Loading />}{versions.error && <ErrorNote error={versions.error} onRetry={() => versions.refetch()} />}
          {versions.data && <div className="space-y-4"><div><h3 className="font-semibold">Current version</h3><p className="mt-1 whitespace-pre-wrap">{versions.data.note.body}</p></div>
            {versions.data.versions.map((v) => <article className="border-t pt-3" key={v.id}><h3 className="text-xs text-muted-foreground">{when(v.saved_at)}</h3><p className="mt-1 whitespace-pre-wrap">{v.body}</p></article>)}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Planned and past follow-ups for this contact. */
export function EventsList({ contactId, contactName, canEdit }: { contactId: number; contactName: string; canEdit: boolean }) {
  const q = useCrmQuery<{ data: CrmEvent[] }>(crmKeys.contactPart(contactId, 'events'), `/contacts/${contactId}/events`);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState<CrmEvent | undefined>();
  const [completing, setCompleting] = useState<CrmEvent | null>(null);
  const events = q.data?.data ?? [];
  const planned = events.filter((e) => e.status === 'planned').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => e.status !== 'planned');

  return (
    <div className="flex flex-col gap-3">
      {canEdit && <Button size="sm" variant="outline" className="self-start" onClick={() => { setEditing(undefined); setScheduling(true); }}><CalendarClock className="mr-1.5 h-3.5 w-3.5" />Schedule follow-up</Button>}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data && events.length === 0 && <Empty title="No follow-ups yet." />}
      {planned.length > 0 && <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planned</h3>}
      {planned.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{e.type?.label} · <span className={e.overdue ? 'crm-text-red' : ''}>{when(e.starts_at)}{e.overdue ? ` (${e.late})` : ''}</span></p>
            {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
            <p className="text-xs text-muted-foreground">{e.assigned_user?.name}{e.on_calendar ? ' · on Google Calendar' : ''}{e.via_robbie ? ' · via Robbie' : ''}</p>
          </div>
          {canEdit && <><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(e); setScheduling(true); }}>Move</Button><Button size="sm" className="h-7 text-xs" onClick={() => setCompleting(e)}>Complete</Button></>}
        </div>
      ))}
      {past.length > 0 && <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Done</h3>}
      {past.map((e) => (
        <div key={e.id} className="rounded-[10px] border p-3 text-[13px]">
          <p><span className="font-medium">{e.type?.label}</span> · {when(e.starts_at)} · <Chip tone={e.status === 'done' ? 'green' : e.status === 'missed' ? 'amber' : 'line'}>{e.status}</Chip></p>
          {e.outcome_note && <p className="mt-1 text-muted-foreground">{e.outcome_note}</p>}
          {e.completed_at && <p className="mt-0.5 text-xs text-muted-foreground">{ago(e.completed_at)}</p>}
        </div>
      ))}
      <ScheduleEventDialog open={scheduling} onOpenChange={setScheduling} contactId={contactId} contactName={contactName} event={editing} />
      <CompleteEventDialog event={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}
