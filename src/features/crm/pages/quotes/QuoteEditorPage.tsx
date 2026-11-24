import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { crmKeys, useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { day, money, when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import type { Contact, Quote } from '../../types';
import { Field, Select, TextArea, TextInput } from '../../ui/fields';
import { Card, Chip, CrmPage, ErrorNote, Loading, Note } from '../../ui/primitives';
import { QUOTE_LABEL, quoteTone } from './quoteStatus';

interface CatalogItem { id: number; name: string; price: number; pricing_type: string | null; category: string | null }
interface Line { key: string; service_id: number | null; name: string; quantity: number; unit_price: number }

const newKey = () => Math.random().toString(36).slice(2);

/** Quote builder (frame F3). New quotes come from a contact; saved quotes open by id. */
export default function QuoteEditorPage() {
  const { id, contactId } = useParams();
  const navigate = useNavigate();
  const { data: meta } = useCrmMeta();
  const isNew = !id;
  const quoteQ = useCrmQuery<{ quote: Quote }>(['crm', 'quote', id], `/quotes/${id}`, undefined, !isNew);
  const quote = quoteQ.data?.quote;
  const cid = isNew ? Number(contactId) : quote?.contact?.id;
  const contactQ = useCrmQuery<{ contact: Contact }>(crmKeys.contact(cid ?? 0), `/contacts/${cid}`, undefined, Boolean(cid));
  const [sqft, setSqft] = useState('');
  const catalog = useCrmQuery<{ data: CatalogItem[]; approval_percent: number }>(['crm', 'quote-catalog', sqft], '/quotes/catalog', { sqft: sqft || undefined });
  useRobbieWhere({ page: 'quote', entityType: cid ? 'crm_contact' : undefined, entityId: cid, label: contactQ.data?.contact.name });

  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('0');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [pick, setPick] = useState('');

  useEffect(() => {
    if (quote?.items) {
      setLines(quote.items.map((i) => ({ key: newKey(), service_id: i.service_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price })));
      setDiscount(String(quote.discount_percent ?? 0));
      setAddress(quote.property_address ?? '');
      setNotes(quote.notes ?? '');
    }
  }, [quote]);

  const editable = isNew || ['draft', 'pending_approval', 'approved'].includes(quote?.status ?? '');
  const subtotal = useMemo(() => lines.reduce((n, l) => n + l.quantity * (l.service_id ? (catalog.data?.data.find((c) => c.id === l.service_id)?.price ?? l.unit_price) : l.unit_price), 0), [lines, catalog.data]);
  const pctOff = Math.max(0, Math.min(100, Number(discount) || 0));
  const total = subtotal - Math.round(subtotal * pctOff) / 100;
  const threshold = catalog.data?.approval_percent ?? meta?.settings.quote_discount_approval_percent ?? 10;
  const needsApproval = pctOff > threshold && !quote?.approved_by;

  const body = () => ({
    items: lines.map((l) => ({ service_id: l.service_id, name: l.name, quantity: l.quantity, unit_price: l.service_id ? undefined : l.unit_price })),
    discount_percent: pctOff, property_address: address || null, notes: notes || null, sqft: sqft ? Number(sqft) : null,
  });
  const save = useCrmMutation(() => (isNew ? crmApi.post<{ quote: Quote }>(`/contacts/${cid}/quotes`, body()) : crmApi.patch<{ quote: Quote }>(`/quotes/${id}`, body())), { success: 'Quote saved' });
  const act = useCrmMutation((action: 'submit' | 'approve' | 'send' | 'accept' | 'decline') => crmApi.post<{ quote: Quote }>(`/quotes/${id}/${action}`), { success: (r) => `Quote ${QUOTE_LABEL[r.quote.status].toLowerCase()}` });

  const saveThen = (then?: (q: Quote) => void) => save.mutate(undefined, { onSuccess: (r) => { if (isNew) navigate(`/crm/quotes/${r.quote.id}`, { replace: true }); then?.(r.quote); } });

  const addService = () => {
    const item = catalog.data?.data.find((c) => String(c.id) === pick);
    if (!item) return;
    setLines([...lines, { key: newKey(), service_id: item.id, name: item.name, quantity: 1, unit_price: item.price }]);
    setPick('');
  };

  if (!isNew && quoteQ.isLoading) return <CrmPage title="Quote"><Loading /></CrmPage>;
  if (!isNew && (quoteQ.error || !quote)) return <CrmPage title="Quote" crumbs={[{ label: 'Quotes', to: '/crm/quotes' }]}><ErrorNote error={quoteQ.error} /></CrmPage>;
  const contact = contactQ.data?.contact;

  return (
    <CrmPage
      crumbs={[{ label: 'Quotes', to: '/crm/quotes' }, ...(contact ? [{ label: contact.name, to: `/crm/contacts/${contact.id}` }] : [])]}
      title={<span className="flex items-center gap-2">{isNew ? 'New quote' : quote!.number}{quote && <Chip tone={quoteTone(quote.status)}>{QUOTE_LABEL[quote.status]}</Chip>}</span>}
      description={contact ? `For ${contact.name}${contact.company ? ` · ${contact.company}` : ''}` : undefined}
      actions={<>
        {editable && <Button variant="outline" size="sm" className="h-8" disabled={lines.length === 0 || save.isPending} onClick={() => saveThen()}>Save draft</Button>}
        {!isNew && quote?.status === 'pending_approval' && meta?.can.approve_quotes && <Button size="sm" className="h-8" onClick={() => act.mutate('approve')}><Check className="mr-1.5 h-3.5 w-3.5" />Approve discount</Button>}
        {editable && needsApproval && !meta?.can.approve_quotes && quote?.status !== 'pending_approval' && (
          <Button size="sm" className="h-8" disabled={lines.length === 0 || save.isPending} onClick={() => saveThen((saved) => act.mutate('submit', { onSuccess: () => navigate(`/crm/quotes/${saved.id}`) }))}>Ask for approval</Button>
        )}
        {editable && (!needsApproval || meta?.can.approve_quotes) && (
          <Button size="sm" className="h-8" disabled={lines.length === 0 || save.isPending || act.isPending || !contact?.email} onClick={() => saveThen((saved) => act.mutate('send', { onSuccess: () => navigate(`/crm/quotes/${saved.id}`) }))}>
            <Send className="mr-1.5 h-3.5 w-3.5" />Save and send
          </Button>
        )}
        {quote?.status === 'sent' && <>
          <Button variant="outline" size="sm" className="h-8" onClick={() => act.mutate('decline')}>Mark declined</Button>
          <Button size="sm" className="h-8" onClick={() => act.mutate('accept')}>Mark accepted</Button>
        </>}
      </>}
    >
      {contact && !contact.email && editable && <Note tone="warn">Add an email address to {contact.name} to send this quote.</Note>}
      {needsApproval && editable && <Note tone="warn">A {pctOff}% discount is above {threshold}%, so an admin approves it before it can be sent.{quote?.status === 'pending_approval' ? ' Waiting for approval.' : ''}</Note>}
      {quote?.public_url && (
        <Note tone="info">
          <div className="flex flex-wrap items-center gap-2">
            <span>{quote.status === 'sent' ? `Sent ${when(quote.sent_at)} · valid until ${day(quote.valid_until)}. The client can accept online.` : quote.status === 'accepted' ? `Accepted ${when(quote.accepted_at)}. The contact moved to Booked.` : quote.status === 'declined' ? `Declined${quote.decline_reason ? `: ${quote.decline_reason}` : ''}.` : 'Expired.'}</span>
            <button type="button" className="ml-auto inline-flex items-center gap-1 font-medium underline underline-offset-2" onClick={() => { void navigator.clipboard.writeText(quote.public_url!); toast.success('Link copied'); }}><Copy className="h-3.5 w-3.5" />Copy client link</button>
          </div>
        </Note>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Property address">{(fid) => <TextInput id={fid} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!editable} placeholder="123 Main St, Bethesda, MD" />}</Field>
            <Field label="Square feet" hint="For size-based prices.">{(fid, d) => <TextInput id={fid} aria-describedby={d} type="number" min={0} value={sqft} onChange={(e) => setSqft(e.target.value)} disabled={!editable} />}</Field>
          </div>
          <div className="overflow-x-auto rounded-[10px] border">
            <table className="crm-table">
              <thead><tr><th>Service</th><th className="r w-[90px]">Qty</th><th className="r w-[120px]">Price</th><th className="r w-[120px]">Total</th>{editable && <th className="w-10" />}</tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Add services from the price list below.</td></tr>}
                {lines.map((l, i) => {
                  const price = l.service_id ? (catalog.data?.data.find((c) => c.id === l.service_id)?.price ?? l.unit_price) : l.unit_price;
                  return (
                    <tr key={l.key}>
                      <td>{l.service_id || !editable ? l.name : <TextInput aria-label="Item name" value={l.name} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}</td>
                      <td className="r">{editable ? <TextInput aria-label="Quantity" type="number" min={1} className="w-16 text-right" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} /> : l.quantity}</td>
                      <td className="r tabular-nums">{l.service_id || !editable ? money(price) : <TextInput aria-label="Price" type="number" min={0} step="0.01" className="w-24 text-right" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: Math.max(0, Number(e.target.value) || 0) } : x)))} />}</td>
                      <td className="r font-medium tabular-nums">{money(price * l.quantity)}</td>
                      {editable && <td><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${l.name}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Add from the price list" className="min-w-[240px] flex-1">{(fid) => <Select id={fid} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Choose a service…" options={(catalog.data?.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} · ${money(c.price)}` }))} />}</Field>
              <Button variant="outline" size="sm" className="h-8" disabled={!pick} onClick={addService}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setLines([...lines, { key: newKey(), service_id: null, name: 'Custom item', quantity: 1, unit_price: 0 }])}>Custom line</Button>
            </div>
          )}
          <Field label="Note to the client">{(fid) => <TextArea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} placeholder="Anything they should know: timing, access, what’s included." />}</Field>
        </div>

        <Card title="Summary" className="h-fit">
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground"><label htmlFor="crm-quote-discount">Discount %</label></dt>
              <dd><TextInput id="crm-quote-discount" type="number" min={0} max={100} step="0.5" className="w-20 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={!editable} /></dd>
            </div>
            {pctOff > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{money(Math.round(subtotal * pctOff) / 100)}</dd></div>}
            <div className="mt-1 flex justify-between border-t pt-2 text-[15px] font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(total)}</dd></div>
          </dl>
          {quote?.approved_by && <p className="mt-3 text-xs text-muted-foreground">Discount approved by {quote.approved_by.name}.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Prices come from the Dashboard’s service list. Sending moves an early lead to Estimate and books a follow-up in 5 working days.</p>
        </Card>
      </div>
    </CrmPage>
  );
}
