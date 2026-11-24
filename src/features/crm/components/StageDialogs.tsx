import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation } from '../hooks';
import type { Contact, StageKey } from '../types';
import { Field, Select, TextArea, TextInput } from '../ui/fields';
import { Note } from '../ui/primitives';

type Kind = 'lost' | 'reopen' | 'first_shoot' | 'assign' | null;

/** Mark lost (needs a reason), reopen to any stage, first shoot completed, and assign (admins). Frame 14. */
export function StageDialogs({ contact, kind, onClose }: { contact: Contact; kind: Kind; onClose: () => void }) {
  const { data: meta } = useCrmMeta();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clientType, setClientType] = useState('');
  const [rep, setRep] = useState('');

  useEffect(() => {
    if (!kind) return;
    setReason(''); setNote('');
    setStage(contact.stage_before_lost && contact.stage_before_lost !== 'lost' ? contact.stage_before_lost : 'outreach');
    setRep(contact.assigned_rep ? String(contact.assigned_rep.id) : '');
    setClientType(contact.client_type ?? '');
  }, [kind, contact]);

  const run = useCrmMutation(
    () => {
      switch (kind) {
        case 'lost': return crmApi.post(`/contacts/${contact.id}/lost`, { reason, note: note || null });
        case 'reopen': return crmApi.post(`/contacts/${contact.id}/reopen`, { stage });
        case 'first_shoot': return crmApi.post(`/contacts/${contact.id}/first-shoot`, { date, client_type: clientType || null });
        case 'assign': return crmApi.post(`/contacts/${contact.id}/assign`, { rep_id: rep ? Number(rep) : null });
        default: return Promise.resolve(null);
      }
    },
    { success: kind === 'lost' ? 'Marked lost' : kind === 'reopen' ? 'Reopened' : kind === 'first_shoot' ? 'Moved to the client pool' : 'Rep updated' },
  );

  const reopenStages: { value: StageKey; label: string }[] = (meta?.stages ?? [])
    .filter((s) => s.key !== 'lost')
    .map((s) => ({ value: s.key as StageKey, label: s.label }));

  const titles: Record<Exclude<Kind, null>, [string, string]> = {
    lost: [`Mark ${contact.name} as lost`, 'Lost contacts leave the board but stay in the CRM, with their history. You can reopen them any time.'],
    reopen: [`Reopen ${contact.name}`, 'Choose where they go back in. The move is recorded in their history.'],
    first_shoot: ['First shoot completed', 'Moves the contact to the client pool. This normally happens on its own when the shoot is marked complete in the Dashboard.'],
    assign: ['Assign rep', 'Only admins can change who owns a contact. Every change is logged.'],
  };

  const valid = kind === 'lost' ? Boolean(reason) : kind === 'reopen' ? Boolean(stage) : kind === 'first_shoot' ? Boolean(date) : true;

  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      {kind && (
        <DialogContent className="crm-root sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{titles[kind][0]}</DialogTitle>
            <DialogDescription>{titles[kind][1]}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {kind === 'lost' && (
              <>
                <Field label="Reason" required>{(id) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason…" options={(meta?.lost_reasons ?? []).map((r) => ({ value: r.key, label: r.label }))} />}</Field>
                <Field label="Note">{(id) => <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? Helps whoever reopens this later." />}</Field>
                {contact.drip?.status === 'active' && <Note tone="info">Their drip will stop, and planned follow-ups will be cancelled.</Note>}
              </>
            )}
            {kind === 'reopen' && (
              <>
                {contact.lost_reason_label && <Note tone="warn">Lost: {contact.lost_reason_label}{contact.lost_note ? ` · ${contact.lost_note}` : ''}</Note>}
                <Field label="Reopen into">{(id) => <Select id={id} value={stage} onChange={(e) => setStage(e.target.value)} options={reopenStages} />}</Field>
              </>
            )}
            {kind === 'first_shoot' && (
              <>
                <Field label="Shoot date" required>{(id) => <TextInput id={id} type="date" max={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
                <Field label="Client type">{(id) => <Select id={id} value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="Decide later" options={(meta?.client_types ?? []).map((c) => ({ value: c.key, label: c.label }))} />}</Field>
              </>
            )}
            {kind === 'assign' && (
              <Field label="Rep">{(id) => <Select id={id} value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Unassigned" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />}</Field>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant={kind === 'lost' ? 'destructive' : 'default'} disabled={!valid || run.isPending} onClick={() => run.mutate(undefined, { onSuccess: onClose })}>
              {run.isPending ? 'Saving…' : kind === 'lost' ? 'Mark lost' : kind === 'reopen' ? 'Reopen' : kind === 'first_shoot' ? 'Move to client pool' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export type StageDialogKind = Kind;
