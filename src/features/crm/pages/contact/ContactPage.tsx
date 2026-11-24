import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Check, ChevronLeft, FileText, Mail, MoreHorizontal, Phone, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { crmApi } from '../../api';
import { crmKeys, useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import type { Contact, PipelineStage } from '../../types';
import { Chip, CrmPage, ErrorNote, Loading, Note, StageChip, TabBar } from '../../ui/primitives';
import { ContactFormDialog } from '../../components/ContactFormDialog';
import { ComposeEmailDialog } from '../../components/ComposeEmailDialog';
import { ScheduleEventDialog } from '../../components/EventDialogs';
import { StageDialogs, type StageDialogKind } from '../../components/StageDialogs';
import { ContactSide } from './ContactSide';
import { ActivityList, EventsList, NotesList } from './ContactTimeline';
import { ConversationTab, EmailsList, QuotesList } from './ContactTabs';

type Tab = 'activity' | 'notes' | 'follow_ups' | 'emails' | 'quotes' | 'conversation';
const STEPS: { key: PipelineStage; label: string }[] = [
  { key: 'outreach', label: 'Outreach' }, { key: 'inquiry', label: 'Inquiry' }, { key: 'estimate', label: 'Estimate' }, { key: 'booked', label: 'Booked' },
];

/** The contact record (frames 02, R1, F5; phones M4). */
export default function ContactPage() {
  const { id } = useParams();
  const contactId = Number(id);
  const navigate = useNavigate();
  const { data: meta } = useCrmMeta();
  const q = useCrmQuery<{ contact: Contact }>(crmKeys.contact(contactId), `/contacts/${contactId}`, undefined, Number.isFinite(contactId));
  const contact = q.data?.contact;
  useRobbieWhere({ page: 'contact', entityType: 'crm_contact', entityId: contactId, label: contact?.name });

  const [tab, setTab] = useState<Tab>('activity');
  const [editing, setEditing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [dialog, setDialog] = useState<StageDialogKind>(null);
  const move = useCrmMutation((stage: PipelineStage) => crmApi.post(`/contacts/${contactId}/stage`, { stage }), { success: 'Stage updated' });

  if (q.isLoading) return <CrmPage title="Contact"><Loading /></CrmPage>;
  if (q.error || !contact) {
    return (
      <CrmPage title="Contact" crumbs={[{ label: 'Contacts', to: '/crm/contacts' }]}>
        <ErrorNote error={q.error?.status === 404 ? { message: 'This contact doesn’t exist or isn’t assigned to you.' } : q.error} />
      </CrmPage>
    );
  }

  const canEdit = contact.can.edit;
  const inPipeline = STEPS.some((s) => s.key === contact.stage);
  const stepIndex = STEPS.findIndex((s) => s.key === contact.stage);

  return (
    <CrmPage
      crumbs={[{ label: 'Contacts', to: '/crm/contacts' }, { label: contact.name }]}
      title={<span className="flex flex-wrap items-center gap-2">{contact.name}<StageChip stage={contact.stage} label={contact.stage_label} /></span>}
      description={[contact.title, contact.company, contact.market].filter(Boolean).join(' · ') || undefined}
      actions={<>
        <Button variant="ghost" size="sm" className="h-8 md:hidden" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" />Back</Button>
        {contact.phone && <Button asChild variant="outline" size="sm" className="h-8"><a href={`tel:${contact.phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a></Button>}
        {canEdit && contact.email && <Button variant="outline" size="sm" className="h-8" onClick={() => setEmailing(true)}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</Button>}
        {canEdit && <Button size="sm" className="h-8" onClick={() => setScheduling(true)}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Schedule</Button>}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="crm-root w-52">
              <DropdownMenuItem onSelect={() => setEditing(true)}>Edit details</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/crm/contacts/${contact.id}/quotes/new`)}><FileText className="mr-2 h-3.5 w-3.5" />New quote</DropdownMenuItem>
              {contact.stage === 'booked' && <DropdownMenuItem onSelect={() => setDialog('first_shoot')}>First shoot completed</DropdownMenuItem>}
              {meta?.can.assign && <DropdownMenuItem onSelect={() => setDialog('assign')}>Assign rep</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {contact.stage === 'lost'
                ? <DropdownMenuItem onSelect={() => setDialog('reopen')}>Reopen</DropdownMenuItem>
                : <DropdownMenuItem className="text-rose-600" onSelect={() => setDialog('lost')}>Mark lost</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </>}
      tabs={
        <TabBar<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'activity', label: 'Activity' }, { key: 'notes', label: 'Notes' }, { key: 'follow_ups', label: 'Follow-ups' },
            { key: 'emails', label: 'Emails' }, { key: 'quotes', label: 'Quotes' }, { key: 'conversation', label: 'Conversations' },
          ]}
        />
      }
    >
      {contact.stage === 'lost' && (
        <Note tone="bad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Lost {contact.lost_at ? when(contact.lost_at) : ''}: <b>{contact.lost_reason_label}</b>{contact.lost_note ? ` · ${contact.lost_note}` : ''}</span>
            {canEdit && <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => setDialog('reopen')}>Reopen</Button>}
          </div>
        </Note>
      )}

      {inPipeline && (
        <ol className="flex flex-wrap items-center gap-y-2" aria-label="Sales stage">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s.key} className="flex items-center">
                {i > 0 && <span className={cn('mx-2.5 h-[1.5px] w-6', i <= stepIndex ? 'bg-primary' : 'bg-border')} aria-hidden="true" />}
                <button type="button" disabled={!canEdit || current || move.isPending} onClick={() => move.mutate(s.key)}
                  className={cn('flex items-center gap-2 whitespace-nowrap text-[12.5px] text-muted-foreground disabled:cursor-default', current && 'font-semibold text-foreground', canEdit && !current && 'hover:text-foreground')}
                  aria-current={current ? 'step' : undefined} title={canEdit && !current ? `Move to ${s.label}` : undefined}>
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] bg-card text-[10.5px] font-semibold', done && 'border-primary bg-primary text-primary-foreground', current && 'border-primary text-accent-foreground')}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
          {contact.next_event && (
            <li className="ml-auto text-xs text-muted-foreground max-md:ml-0 max-md:w-full">
              Next: <span className={contact.next_event.overdue ? 'crm-text-red font-medium' : 'font-medium text-foreground'}>{contact.next_event.type?.label} · {when(contact.next_event.starts_at)}</span>
            </li>
          )}
        </ol>
      )}

      {contact.inquiry?.message && (
        <Note tone="info" icon={<StickyNote className="mt-0.5 h-4 w-4 shrink-0" />}>
          <p className="font-medium">Website inquiry {contact.inquiry.received_at ? when(contact.inquiry.received_at) : ''}</p>
          <p className="whitespace-pre-wrap">{contact.inquiry.message}</p>
        </Note>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {tab === 'activity' && <ActivityList contactId={contact.id} />}
          {tab === 'notes' && <NotesList contactId={contact.id} canAdd={canEdit} />}
          {tab === 'follow_ups' && <EventsList contactId={contact.id} contactName={contact.name} canEdit={canEdit} />}
          {tab === 'emails' && (
            <div className="flex flex-col gap-3">
              {canEdit && contact.email && <Button size="sm" variant="outline" className="self-start" onClick={() => setEmailing(true)}><Mail className="mr-1.5 h-3.5 w-3.5" />New email</Button>}
              <EmailsList contactId={contact.id} />
            </div>
          )}
          {tab === 'quotes' && <QuotesList contactId={contact.id} canEdit={canEdit} />}
          {tab === 'conversation' && <ConversationTab contactId={contact.id} canEdit={canEdit} hasPhone={Boolean(contact.phone)} />}
        </div>
        <ContactSide contact={contact} />
      </div>

      {contact.company_id && <p className="text-xs text-muted-foreground">Part of <Link to={`/crm/companies/${contact.company_id}`} className="font-medium hover:underline">{contact.company}</Link>{contact.assigned_rep ? <> · owned by {contact.assigned_rep.name}</> : <> · <Chip tone="amber">Unassigned</Chip></>}</p>}

      <ContactFormDialog open={editing} onOpenChange={setEditing} contact={contact} />
      {contact.email && <ComposeEmailDialog open={emailing} onOpenChange={setEmailing} contactId={contact.id} contactName={contact.name} />}
      <ScheduleEventDialog open={scheduling} onOpenChange={setScheduling} contactId={contact.id} contactName={contact.name} />
      <StageDialogs contact={contact} kind={dialog} onClose={() => setDialog(null)} />
    </CrmPage>
  );
}
