import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { QuoteBooking, PropertyLocation } from './QuoteBooking';
import { QUOTE_LABEL, quoteTone } from './quoteStatus';

interface CatalogItem { id: number; name: string; price: number; pricing_type: string | null; allow_multiple?: boolean; category: string | null }
interface Line { key: string; service_id: number | null; name: string; quantity: number; unit_price: number }

const newKey = () => Math.random().toString(36).slice(2);

/** Quote builder (frame F3). New quotes come from a contact; saved quotes open by id. */
export default function QuoteEditorPage() {
  const { id, contactId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
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
  const [location, setLocation] = useState({ city: '', state: '', zip: '' });
  const [notes, setNotes] = useState('');
  const [pick, setPick] = useState('');

  useEffect(() => {
    if (quote?.items) {
      setLines(quote.items.map((i) => ({ key: newKey(), service_id: i.service_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price })));
      setDiscount(String(quote.discount_percent ?? 0));
      setAddress(quote.property_address ?? '');
      setNotes(quote.notes ?? '');
      setSqft(quote.sqft == null ? '' : String(quote.sqft));
      setLocation({ city: quote.property_city ?? '', state: quote.property_state ?? '', zip: quote.property_zip ?? '' });
    }
  }, [quote]);

  const canEdit = Boolean(contactQ.data?.contact.can.edit);
  const editable = canEdit && (isNew || ['draft', 'pending_approval', 'approved'].includes(quote?.status ?? ''));
  const available = (catalog.data?.data ?? []).filter((s) => !lines.some((line) => line.service_id === s.id));
  const sizeChanged = (sqft ? Number(sqft) : null) !== (quote?.sqft ?? null);
  const priceFor = (line: Line) => line.service_id && sizeChanged ? catalog.data?.data.find((s) => s.id === line.service_id)?.price ?? line.unit_price : line.unit_price;
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * priceFor(line), 0);
  const linesChanged = lines.length !== quote?.items?.length || lines.some((line, index) => {
    const saved = quote?.items?.[index];
    return !saved || line.service_id !== saved.service_id || line.name !== saved.name || line.quantity !== saved.quantity || line.unit_price !== saved.unit_price;
  });
  const changed = isNew || linesChanged || sizeChanged || address !== (quote?.property_address ?? '') || notes !== (quote?.notes ?? '')
    || Number(discount) !== Number(quote?.discount_percent) || location.city !== (quote?.property_city ?? '')
    || location.state !== (quote?.property_state ?? '') || location.zip !== (quote?.property_zip ?? '');
  const pctOff = Math.max(0, Math.min(100, Number(discount) || 0));
  const total = subtotal - Math.round(subtotal * pctOff) / 100;
  const threshold = catalog.data?.approval_percent ?? meta?.settings.quote_discount_approval_percent ?? 10;
  const needsApproval = pctOff > threshold && (changed || !quote?.approved_by);

  const body = () => ({
    items: lines.map((l) => ({ service_id: l.service_id, name: l.name, quantity: l.quantity, unit_price: l.service_id ? undefined : l.unit_price })),
    property_city: location.city || null, property_state: location.state || null, property_zip: location.zip || null,
    discount_percent: pctOff, property_address: address || null, notes: notes || null, sqft: sqft ? Number(sqft) : null,
  });
  const save = useCrmMutation(() => (isNew ? crmApi.post<{ quote: Quote }>(`/contacts/${cid}/quotes`, body()) : crmApi.patch<{ quote: Quote }>(`/quotes/${id}`, body())), { success: 'Quote saved' });
  type Action = 'submit' | 'approve' | 'send' | 'accept' | 'decline';
  const act = useCrmMutation(({ quoteId, action }: { quoteId: number; action: Action }) => crmApi.post<{ quote: Quote }>(`/quotes/${quoteId}/${action}`), { success: (r) => `Quote ${QUOTE_LABEL[r.quote.status].toLowerCase()}` });

  const saveThen = async (action?: Action) => {
    let saved = quote;
    try {
      if (changed) saved = (await save.mutateAsync(undefined)).quote;
      if (!saved) return;
      if (action) await act.mutateAsync({ quoteId: saved.id, action });
    } catch {
      // A provider timeout or discount check can change state even when the API returns a validation error.
      await client.invalidateQueries({ queryKey: crmKeys.all });
    } finally {
      if (isNew && saved) navigate(`/crm/quotes/${saved.id}`, { replace: true });
    }
  };

  const addService = () => {
    const item = available.find((c) => String(c.id) === pick);
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
        {editable && <Button variant="outline" size="sm" className="h-8" disabled={!changed || !lines.length || save.isPending || act.isPending} onClick={() => void saveThen()}>Save draft</Button>}
        {!isNew && quote?.status === 'pending_approval' && meta?.can.approve_quotes && <Button size="sm" className="h-8" disabled={changed || act.isPending} onClick={() => act.mutate({ quoteId: quote.id, action: 'approve' })}><Check className="mr-1.5 h-3.5 w-3.5" />Approve discount</Button>}
        {editable && needsApproval && !meta?.can.approve_quotes && quote?.status !== 'pending_approval' && (
          <Button size="sm" className="h-8" disabled={!lines.length || save.isPending || act.isPending} onClick={() => void saveThen('submit')}>Ask for approval</Button>
        )}
        {editable && quote?.status !== 'pending_approval' && (!needsApproval || meta?.can.approve_quotes) && (
          <Button size="sm" className="h-8" disabled={lines.length === 0 || save.isPending || act.isPending || !contact?.email} onClick={() => void saveThen('send')}>
            <Send className="mr-1.5 h-3.5 w-3.5" />Save and send
          </Button>
        )}
        {canEdit && quote?.status === 'sent' && <>
          <Button variant="outline" size="sm" className="h-8" disabled={act.isPending} onClick={() => act.mutate({ quoteId: quote.id, action: 'decline' })}>Mark declined</Button>
          <Button size="sm" className="h-8" disabled={act.isPending} onClick={() => act.mutate({ quoteId: quote.id, action: 'accept' })}>Mark accepted</Button>
        </>}
      </>}
    >
      {contact && !contact.email && editable && <Note tone="warn">Add an email address to {contact.name} to send this quote.</Note>}
      {quote?.status === 'sending' && <Note tone="warn"><div className="flex flex-wrap items-center justify-between gap-3">
        <span>Delivery is being confirmed. The quote is locked while the provider checks the original message.</span>
        {canEdit && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ quoteId: quote.id, action: 'send' }, { onError: () => { void client.invalidateQueries({ queryKey: crmKeys.all }); } })}>Check delivery</Button>}
      </div></Note>}
      {needsApproval && editable && <Note tone="warn">A {pctOff}% discount is above {threshold}%, so an admin approves it before it can be sent.{quote?.status === 'pending_approval' ? ' Waiting for approval.' : ''}</Note>}
      {quote?.status === 'accepted' && <QuoteBooking quote={quote} canEdit={Boolean(contactQ.data?.contact.can.edit)} />}
      {quote?.public_url && (
        <Note tone="info">
          <div className="flex flex-wrap items-center gap-2">
            <span>{quote.status === 'sent' ? `Sent ${when(quote.sent_at)} · valid until ${day(quote.valid_until)}. The client can accept online.` : quote.status === 'accepted' ? `Accepted ${when(quote.accepted_at)}. The contact moved to Booked.` : quote.status === 'declined' ? `Declined${quote.decline_reason ? `: ${quote.decline_reason}` : ''}.` : 'Expired.'}</span>
            <button type="button" className="ml-auto inline-flex items-center gap-1 font-medium underline underline-offset-2" onClick={() => { void navigator.clipboard.writeText(quote.public_url!); toast.success('Link copied'); }}><Copy className="h-3.5 w-3.5" />Copy client link</button>
          </div>
        </Note>
      )}

      <div className="grid gap-5 crm-detail-grid">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 crm-quote-address">
            <Field label="Property address">{(fid) => <TextInput id={fid} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!editable} placeholder="123 Main St" />}</Field>
            <Field label="Square feet" hint="For size-based prices.">{(fid, d) => <TextInput id={fid} aria-describedby={d} type="number" min={0} value={sqft} onChange={(e) => setSqft(e.target.value)} disabled={!editable} />}</Field>
          </div>
          <PropertyLocation value={location} onChange={setLocation} disabled={!editable} />
          <div className="overflow-x-auto rounded-[10px] border">
            <table className="crm-table">
              <thead><tr><th>Service</th><th className="r w-[90px]">Qty</th><th className="r w-[120px]">Price</th><th className="r w-[120px]">Total</th>{editable && <th className="w-10" />}</tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Add services from the price list below.</td></tr>}
                {lines.map((l, i) => {
                  const price = priceFor(l);
                  const multiple = !l.service_id || catalog.data?.data.find((s) => s.id === l.service_id)?.allow_multiple !== false;
                  return (
                    <tr key={l.key}>
                      <td>{l.service_id || !editable ? l.name : <TextInput aria-label="Item name" value={l.name} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}</td>
                      <td className="r">{editable && multiple ? <TextInput aria-label="Quantity" type="number" min={1} max={999} step={1} className="w-16 text-right" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.min(999, Math.max(1, Math.floor(Number(e.target.value) || 1))) } : x)))} /> : l.quantity}</td>
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
              <Field label="Add from the price list" className="min-w-[240px] flex-1">{(fid) => <Select id={fid} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Choose a service…" options={available.map((c) => ({ value: String(c.id), label: `${c.name} · ${money(c.price)}` }))} />}</Field>
              <Button variant="outline" size="sm" className="h-8" disabled={!pick || !available.some((item) => String(item.id) === pick)} onClick={addService}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
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
