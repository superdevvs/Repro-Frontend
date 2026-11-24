import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, Sparkles, StopCircle } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi, toApiError } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { ago, day, when } from '../../format';
import { useCrmRobbie } from '../../robbie/useCrmRobbie';
import type { Contact } from '../../types';
import { Field, Select, TextArea } from '../../ui/fields';
import { Card, Chip, HealthChip, KeyValues, Note } from '../../ui/primitives';

/** Right column of the contact record: details, drip, Robbie's brief. */
export function ContactSide({ contact }: { contact: Contact }) {
  const { data: meta } = useCrmMeta();
  const robbie = useCrmRobbie();
  const [reviewNote, setReviewNote] = useState('');
  const review = useCrmMutation(() => crmApi.post(`/contacts/${contact.id}/review`, { note: reviewNote.trim() }), { success: 'Review completed' });
  const [enrolling, setEnrolling] = useState(false);
  const [brief, setBrief] = useState<{ summary: string; ai: boolean } | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const stop = useCrmMutation(() => crmApi.post(`/contacts/${contact.id}/drip/stop`), { success: 'Drip stopped' });
  const replied = useCrmMutation(() => crmApi.post(`/contacts/${contact.id}/replied`), { success: 'Marked as replied; the drip stopped' });

  const loadBrief = async (ai: boolean) => {
    setBriefing(true);
    setBriefError(null);
    try {
      setBrief(await crmApi.get<{ summary: string; ai: boolean }>(`/robbie/contacts/${contact.id}/brief`, { ai: ai ? 1 : undefined }));
    } catch (e) {
      setBriefError(toApiError(e).message);
    } finally {
      setBriefing(false);
    }
  };

  const drip = contact.drip;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 rounded-[10px] border crm-bg-thead p-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent"><ReproAiIcon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1 text-[13px] leading-[18px]">
          <p className="mb-1 text-xs font-semibold">Robbie’s brief</p>
          {brief ? <p>{brief.summary}</p> : <p className="text-muted-foreground">A quick summary before you call: stage, last contact, emails, shoots and what’s next.</p>}
          {briefError && <p className="crm-text-red mt-1">{briefError}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={briefing} onClick={() => void loadBrief(Boolean(brief))}>
              <Sparkles className="mr-1 h-3 w-3" />{briefing ? 'Thinking…' : brief ? 'Robbie’s take' : 'Brief me'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => robbie?.ask(`What should I do next with ${contact.name}?`)}>Ask Robbie</Button>
          </div>
        </div>
      </div>

      <Card title="Details" bodyClassName="p-4">
        <KeyValues rows={[
          ['Email', contact.email ? <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a> : null],
          ['Phone', contact.phone ? <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a> : null],
          ['Company', contact.company_id ? <Link to={`/crm/companies/${contact.company_id}`} className="hover:underline">{contact.company}</Link> : contact.company],
          ['Market', contact.market],
          ['Segment', <span key="s" className="capitalize">{contact.segment}</span>],
          ['Client type', contact.client_type ? (contact.client_type === 'one_off' ? 'One-off' : 'Recurring') : null],
          ['Rep', contact.assigned_rep?.name ?? <Chip tone="amber">Unassigned</Chip>],
          ['Source', contact.lead_source_label],
          ['Added', day(contact.created_at)],
          ['Last contact', contact.last_contacted_at ? ago(contact.last_contacted_at) : 'Never'],
          ...(contact.first_shoot_date ? [['First shoot', day(contact.first_shoot_date)] as [string, React.ReactNode]] : []),
          ...(contact.health ? [['Health', <span key="h" className="flex items-center gap-2"><HealthChip health={contact.health} />{contact.usual_gap_days ? <span className="text-xs text-muted-foreground">every ~{contact.usual_gap_days} days</span> : null}</span>] as [string, React.ReactNode]] : []),
        ]} />
        {contact.email_opted_out && <Note tone="warn" className="mt-3">Unsubscribed from email. Marketing and drips won’t reach them.</Note>}
        {contact.needs_review && <Note tone="warn" className="mt-3">
          <p className="font-semibold">Import review</p>
          <p>{contact.review_reasons.map((r) => r.replaceAll('_', ' ')).join(' · ') || 'Check imported details.'}</p>
          {meta?.can.assign && <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (reviewNote.trim()) review.mutate(undefined); }}>
            <Field label="Review note">{(id) => <TextArea id={id} required maxLength={1000} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="What did you verify?" />}</Field>
            <Button type="submit" size="sm" disabled={!reviewNote.trim() || review.isPending}>Complete review</Button>
          </form>}
        </Note>}
      </Card>

      <Card title="Drip" actions={!drip || drip.status !== 'active' ? (meta?.can.enrol_drips && !contact.email_opted_out && contact.stage !== 'lost' ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEnrolling(true)}><Repeat className="mr-1 h-3 w-3" />Enrol</Button> : null) : undefined}>
        {drip && drip.status === 'active' ? (
          <div className="flex flex-col gap-2 text-[13px]">
            <p className="font-medium">{drip.campaign?.name}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (drip.step / Math.max(drip.steps_total, 1)) * 100)}%` }} /></div>
            <p className="text-xs text-muted-foreground">Step {drip.step} of {drip.steps_total} · week {drip.week}{drip.next_send_at ? ` · next ${when(drip.next_send_at)}` : ''}</p>
            <p className="text-xs text-muted-foreground">{drip.emails_sent} sent · {drip.opened} opened · {drip.clicked} clicked</p>
            {contact.can.edit && (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => replied.mutate(undefined)}>They replied</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => stop.mutate(undefined)}><StopCircle className="mr-1 h-3 w-3" />Stop</Button>
              </div>
            )}
          </div>
        ) : drip ? (
          <p className="text-[13px] text-muted-foreground">{drip.campaign?.name} {drip.status === 'completed' ? 'finished' : `stopped${drip.stop_reason ? ` (${drip.stop_reason.replace('_', ' ')})` : ''}`}.</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">Not on a drip.</p>
        )}
      </Card>

      <EnrolDialog contactId={contact.id} open={enrolling} onOpenChange={setEnrolling} />
    </div>
  );
}

function EnrolDialog({ contactId, open, onOpenChange }: { contactId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const drips = useCrmQuery<{ data: { id: number; name: string; status: string; length_label?: string; steps?: number }[] }>(['crm', 'drips'], '/drips', undefined, open);
  const [value, setValue] = useState('');
  const enrol = useCrmMutation(() => crmApi.post(`/contacts/${contactId}/drip`, { campaign_id: Number(value) }), { success: 'Enrolled' });
  const live = (drips.data?.data ?? []).filter((d) => d.status === 'live');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Enrol in a drip</DialogTitle>
          <DialogDescription>A contact is on one drip at a time. It stops on its own when they reply, book, unsubscribe or are marked lost.</DialogDescription>
        </DialogHeader>
        {live.length === 0 && !drips.isLoading ? <Note tone="info">No drips are live yet. An admin publishes them under Email → Drips.</Note> : (
          <Field label="Drip">{(id) => <Select id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Choose…" options={live.map((d) => ({ value: String(d.id), label: d.name }))} />}</Field>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!value || enrol.isPending} onClick={() => enrol.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>Enrol</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
