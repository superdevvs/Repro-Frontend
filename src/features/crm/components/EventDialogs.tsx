import React, { useEffect, useState } from 'react';
import { addDays, setHours, setMinutes } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi, toApiError } from '../api';
import { useEventTypes } from './eventTypes';
import { useCrmMutation } from '../hooks';
import { toLocalInput, when } from '../format';
import type { CrmEvent } from '../types';
import { Field, Select, TextArea, TextInput } from '../ui/fields';


const defaultStart = () => toLocalInput(setMinutes(setHours(addDays(new Date(), 1), 10), 0));
const iso = (local: string) => new Date(local).toISOString();

/** Schedule or move a follow-up (Phase 3). Synced to Google Calendar when the owner connected it. */
export function ScheduleEventDialog({ open, onOpenChange, contactId, contactName, event }: {
  open: boolean; onOpenChange: (open: boolean) => void; contactId?: number; contactName?: string; event?: CrmEvent;
}) {
  const { data: types } = useEventTypes();
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(defaultStart());
  const [duration, setDuration] = useState('15');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setTypeId(event?.type ? String(event.type.id) : String(types?.data.find((t) => t.key === 'call')?.id ?? ''));
    setStart(event ? toLocalInput(event.starts_at) : defaultStart());
    setDuration(String(event?.duration_min ?? 15));
    setNote(event?.note ?? '');
  }, [open, event, types]);

  const save = useCrmMutation(
    () => {
      const body = { type_id: Number(typeId), starts_at: iso(start), duration_min: Number(duration), note: note || null };
      return event ? crmApi.patch(`/events/${event.id}`, body) : crmApi.post(`/contacts/${contactId}/events`, body);
    },
    { success: event ? 'Follow-up moved' : 'Follow-up scheduled' },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit follow-up' : 'Schedule follow-up'}</DialogTitle>
          {contactName && <DialogDescription>With {contactName}</DialogDescription>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" className="col-span-2">{(id) => <Select id={id} value={typeId} onChange={(e) => setTypeId(e.target.value)} options={(types?.data ?? []).filter((t) => t.is_active || String(t.id) === typeId).map((t) => ({ value: String(t.id), label: t.label }))} />}</Field>
          <Field label="When">{(id) => <TextInput id={id} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Length">{(id) => <Select id={id} value={duration} onChange={(e) => setDuration(e.target.value)} options={[['5', '5 min'], ['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 hour'], ['90', '1.5 hours']].map(([value, label]) => ({ value, label }))} />}</Field>
          <Field label="Note" className="col-span-2">{(id) => <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s it about?" />}</Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!typeId || !start || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>{save.isPending ? 'Saving…' : event ? 'Save' : 'Schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Done or missed, with an outcome note Robbie can draft, and optionally the next follow-up. */
export function CompleteEventDialog({ event, onClose }: { event: CrmEvent | null; onClose: () => void }) {
  const { data: types } = useEventTypes();
  const [status, setStatus] = useState<'done' | 'missed'>('done');
  const [outcome, setOutcome] = useState('');
  const [next, setNext] = useState(false);
  const [nextType, setNextType] = useState('');
  const [nextStart, setNextStart] = useState(defaultStart());
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setStatus('done'); setOutcome(''); setNext(false); setDraftError(null);
    setNextType(String(event.type?.id ?? '')); setNextStart(defaultStart());
  }, [event]);

  const save = useCrmMutation(
    () => crmApi.post(`/events/${event!.id}/complete`, {
      status, outcome_note: outcome || null,
      next: next ? { type_id: Number(nextType), starts_at: iso(nextStart) } : undefined,
    }),
    { success: status === 'done' ? 'Marked done' : 'Marked missed' },
  );

  const draft = async () => {
    if (!event) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await crmApi.post<{ note: string }>(`/robbie/events/${event.id}/draft-outcome`, { hint: outcome || null });
      if (res.note) setOutcome(res.note);
    } catch (e) {
      setDraftError(toApiError(e).message);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <Dialog open={event !== null} onOpenChange={(o) => !o && onClose()}>
      {event && (
        <DialogContent className="crm-root sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{event.type?.label ?? 'Follow-up'}{event.contact ? ` · ${event.contact.name}` : ''}</DialogTitle>
            <DialogDescription>Planned {when(event.starts_at)}{event.note ? ` · ${event.note}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Outcome" className="grid grid-cols-2 gap-2">
              {(['done', 'missed'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}
                  className={`h-9 rounded-lg border text-[13px] font-medium ${status === s ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                  {s === 'done' ? 'Done' : 'Missed / no answer'}
                </button>
              ))}
            </div>
            <Field label="Outcome" hint={draftError ?? 'A line or two for the history. Type a few words and let Robbie tidy it up.'}>
              {(id, d) => <TextArea id={id} aria-describedby={d} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Left a voicemail; she’s listing two homes in March." />}
            </Field>
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void draft()} disabled={drafting}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{drafting ? 'Drafting…' : 'Draft with Robbie'}
            </Button>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={next} onChange={(e) => setNext(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />Schedule the next follow-up</label>
            {next && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">{(id) => <Select id={id} value={nextType} onChange={(e) => setNextType(e.target.value)} options={(types?.data ?? []).filter((t) => t.is_active).map((t) => ({ value: String(t.id), label: t.label }))} />}</Field>
                <Field label="When">{(id) => <TextInput id={id} type="datetime-local" value={nextStart} onChange={(e) => setNextStart(e.target.value)} />}</Field>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={save.isPending || (next && !nextType)} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
