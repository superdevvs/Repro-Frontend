import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, FileText, Mail, MessageSquare, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { crmApi } from '../../api';
import { crmKeys, useCrmMutation, useCrmQuery } from '../../hooks';
import { money, when } from '../../format';
import type { EmailSend, Quote } from '../../types';
import { Field, Select } from '../../ui/fields';
import { Chip, Empty, ErrorNote, Loading, Note } from '../../ui/primitives';
import { EmailFrame } from '../../components/RichText';
import { QUOTE_LABEL, QUOTE_TONE } from '../quotes/quoteStatus';

/** Emails sent to this contact from the CRM, with delivery, opens and replies. */
export function EmailsList({ contactId }: { contactId: number }) {
  const q = useCrmQuery<{ data: EmailSend[] }>(crmKeys.contactPart(contactId, 'emails'), `/contacts/${contactId}/emails`);
  const [open, setOpen] = useState<number | null>(null);
  const detail = useCrmQuery<{ send: EmailSend }>(['crm', 'send', open], `/contacts/${contactId}/emails/${open}`, undefined, open !== null);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.data ?? [];
  if (items.length === 0) return <Empty icon={<Mail className="h-5 w-5" />} title="No emails yet." />;
  return (
    <>
      <div className="overflow-x-auto rounded-[10px] border">
        <table className="crm-table">
          <thead><tr><th>Subject</th><th>Type</th><th>Sent</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} data-href onClick={() => setOpen(s.id)}>
                <td className="max-w-[320px] truncate font-medium">{s.subject}</td>
                <td className="capitalize text-muted-foreground">{s.source_type.replace('_', '-')}</td>
                <td className="text-muted-foreground">{when(s.sent_at ?? s.created_at)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {s.recorded_only ? <Chip tone="line">Recorded (test mode)</Chip> : s.status === 'failed' || s.status === 'blocked' ? <Chip tone="red">{s.status}</Chip> : <Chip tone="green">Sent</Chip>}
                    {s.opened && <Chip tone="blue">Opened{s.open_count > 1 ? ` ×${s.open_count}` : ''}</Chip>}
                    {s.replied_at && <Chip tone="violet">Replied</Chip>}
                    {s.bounced_at && <Chip tone="red">Bounced</Chip>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="crm-root max-h-[92dvh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader><DialogTitle>{detail.data?.send.subject ?? 'Email'}</DialogTitle></DialogHeader>
          {detail.data?.send && <p className="text-xs text-muted-foreground">From {detail.data.send.from_name} &lt;{detail.data.send.from}&gt; to {detail.data.send.to} · {when(detail.data.send.sent_at)}</p>}
          {detail.data?.send.html ? <EmailFrame html={detail.data.send.html} title="Sent email" /> : <Loading />}
        </DialogContent>
      </Dialog>
    </>
  );
}


export function QuotesList({ contactId, canEdit }: { contactId: number; canEdit: boolean }) {
  const q = useCrmQuery<{ data: Quote[] }>(crmKeys.contactPart(contactId, 'quotes'), `/contacts/${contactId}/quotes`);
  return (
    <div className="flex flex-col gap-3">
      {canEdit && <Button asChild size="sm" variant="outline" className="self-start"><Link to={`/crm/contacts/${contactId}/quotes/new`}><Plus className="mr-1.5 h-3.5 w-3.5" />New quote</Link></Button>}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.data.length === 0 && <Empty icon={<FileText className="h-5 w-5" />} title="No quotes yet." />}
      {q.data?.data.map((quote) => (
        <Link key={quote.id} to={`/crm/quotes/${quote.id}`} className="flex flex-wrap items-center gap-3 rounded-[10px] border p-3 hover:bg-secondary/50">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{quote.number}{quote.property_address ? ` · ${quote.property_address}` : ''}</p>
            <p className="text-xs text-muted-foreground">{quote.sent_at ? `Sent ${when(quote.sent_at)}` : `Created ${when(quote.created_at)}`}{quote.valid_until ? ` · valid until ${quote.valid_until}` : ''}</p>
          </div>
          <span className="font-semibold tabular-nums">{money(quote.total)}</span>
          <Chip tone={QUOTE_TONE[quote.status]}>{QUOTE_LABEL[quote.status]}</Chip>
        </Link>
      ))}
    </div>
  );
}

interface ConversationItem { channel: 'email' | 'sms' | 'call'; direction: 'in' | 'out'; at: string; title: string | null; body: string | null; status: string; opened?: boolean; replied?: boolean; id: string }
interface Conversation { items: ConversationItem[]; sms: { consent: boolean; consent_at: string | null; source: string | null; can_send: boolean } }

/** Conversations (frame F5): emails, texts and calls in one thread, with SMS consent. */
export function ConversationTab({ contactId, canEdit, hasPhone }: { contactId: number; canEdit: boolean; hasPhone: boolean }) {
  const q = useCrmQuery<Conversation>(crmKeys.contactPart(contactId, 'conversation'), `/contacts/${contactId}/conversation`);
  const [source, setSource] = useState('');
  const consent = useCrmMutation((value: boolean) => crmApi.post(`/contacts/${contactId}/sms-consent`, { consent: value, source: value ? source : null }), { success: 'SMS consent updated' });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data!;
  const ICON = { email: Mail, sms: MessageSquare, call: Phone } as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border p-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Text messages</span>
          {data.sms.consent ? <Chip tone="green">Consent recorded{data.sms.source ? ` (${data.sms.source.replace('_', ' ')})` : ''}</Chip> : <Chip tone="line">No consent</Chip>}
          {canEdit && data.sms.consent && <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => consent.mutate(false)}>Withdraw</Button>}
        </div>
        {!data.sms.consent && canEdit && hasPhone && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label="How did they agree?" className="w-[220px]">{(id) => <Select id={id} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Choose…" options={[{ value: 'verbal', label: 'Said yes on a call' }, { value: 'written', label: 'In writing' }, { value: 'website', label: 'Website form' }, { value: 'text_reply', label: 'Texted us first' }]} />}</Field>
            <Button size="sm" className="h-8" disabled={!source || consent.isPending} onClick={() => consent.mutate(true)}>Record consent</Button>
          </div>
        )}
        {!hasPhone && <p className="mt-1 text-xs text-muted-foreground">Add a phone number to text this contact.</p>}
        {data.sms.consent && !data.sms.can_send && <Note tone="info" className="mt-2">Texting from the CRM switches on when the SMS integration goes live. Until then, texts sent from Messaging appear here.</Note>}
      </div>
      {data.items.length === 0 && <Empty title="No conversations yet." />}
      <ol className="flex flex-col gap-2">
        {data.items.map((item) => {
          const Icon = ICON[item.channel];
          return (
            <li key={item.id} className={cn('flex max-w-[88%] gap-2.5 rounded-[12px] border p-3', item.direction === 'in' ? 'self-start bg-card' : 'self-end bg-accent/60')}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.direction === 'in' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {item.channel === 'call' ? `Call${item.title ? ` · ${item.title}` : ''}` : item.channel === 'sms' ? 'Text' : 'Email'} · {when(item.at)}
                  {item.opened && <Chip tone="blue">Opened</Chip>}{item.replied && <Chip tone="violet">Replied</Chip>}
                </p>
                {item.channel === 'email' && item.title && <p className="text-[13px] font-medium">{item.title}</p>}
                {item.body && <p className="line-clamp-4 whitespace-pre-wrap text-[13px]">{item.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
