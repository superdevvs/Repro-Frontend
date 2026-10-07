import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { approveWeeklyInvoice, submitWeeklyInvoiceForApproval, type WeeklyInvoice, type WeeklyInvoiceItem } from '@/services/invoiceService';
import { fetchPayoutEditor, removePayoutInvoiceItem, savePayoutInvoiceItem, type PayoutEditInput, type PayoutEditorRole } from '@/services/payoutInvoiceEditorService';
import { PayoutShootPicker } from './PayoutShootPicker';
import { PayoutWorkForm } from './PayoutWorkForm';

const money = (value: number | string | undefined | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
interface Props {
  open: boolean;
  onClose: () => void;
  invoice: WeeklyInvoice;
  role: PayoutEditorRole;
  initialEdit?: boolean;
  onInvoiceChange: (invoice: WeeklyInvoice) => void;
  onComplete: () => void | Promise<void>;
}

export function PayoutInvoiceEditor({ open, onClose, invoice, role, initialEdit = false, onInvoiceChange, onComplete }: Props) {
  const [current, setCurrent] = useState(invoice);
  const [editing, setEditing] = useState(initialEdit);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState('');
  const [reconcileHistory, setReconcileHistory] = useState(false);
  const [form, setForm] = useState<'shoot' | 'external' | 'expense' | null>(null);
  const [editItem, setEditItem] = useState<WeeklyInvoiceItem | null>(null);
  const [itemDraft, setItemDraft] = useState({ description: '', amount: '', quantity: '1', verified: false });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setLoaded(false); setError(''); setNotes(''); setReason(''); setOverride(''); setReconcileHistory(false); setForm(null); setEditItem(null); setEditing(initialEdit);
    fetchPayoutEditor(role, invoice.id, controller.signal).then(({ invoice: result }) => { setCurrent(result); setLoaded(true); }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load invoice');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, role, invoice.id, initialEdit]);

  const paid = current.is_paid || current.paid_at || current.status === 'paid' || Number(current.amount_paid) > 0;
  const canEdit = loaded && !paid && (role === 'admin'
    ? ['pending', 'pending_approval', 'rejected'].includes(current.approval_status)
    : current.can_edit !== false && ['pending', 'rejected'].includes(current.approval_status));
  const changed = current.payout_review?.has_changes || current.approval_status === 'rejected';
  const canSubmit = role !== 'admin' && canEdit;
  const canApprove = loaded && role === 'admin' && !paid && ['pending', 'pending_approval'].includes(current.approval_status);
  const lastReturn = current.payout_review?.last_return_reason || current.rejection_reason;
  const recovery = current.payout_review?.recovery_required;
  const warnings = [...(current.unresolved_warnings || []), ...(recovery && !current.unresolved_warnings?.some(warning => warning.code === 'historical_edit_recovery') ? [{ code: 'historical_edit_recovery', message: `${recovery.message} Before regeneration ${money(recovery.before_total)}; after ${money(recovery.after_total)}.` }] : [])];

  const apply = (result: WeeklyInvoice) => { setCurrent(result); onInvoiceChange(result); };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save invoice'); }
    finally { setBusy(false); }
  };
  const add = (data: PayoutEditInput) => run(async () => {
    const result = await savePayoutInvoiceItem(role, current, { ...data, reason: data.reason || reason, reconcile_history: reconcileHistory });
    apply(result.invoice); setForm(null);
  });
  const saveItem = () => run(async () => {
    if (!editItem) return;
    if (!itemDraft.description.trim() || !itemDraft.amount.trim() || Number(itemDraft.amount) < 0 || Number(itemDraft.quantity) < 1) throw new Error('Enter a description, amount, and positive quantity.');
    const result = await savePayoutInvoiceItem(role, current, {
      description: itemDraft.description.trim(), amount: Number(itemDraft.amount), quantity: Number(itemDraft.quantity), reason,
      reconcile_history: reconcileHistory,
      ...(role === 'admin' && editItem.meta?.source === 'external_work' ? { verified: itemDraft.verified } : {}),
    }, editItem.id);
    apply(result.invoice); setEditItem(null);
  });
  const submit = () => run(async () => {
    if (changed && !notes.trim()) throw new Error('Explain your changes before submitting this invoice.');
    const result = await submitWeeklyInvoiceForApproval(current.id, current.role ?? (role === 'salesRep' ? 'salesRep' : 'photographer'), notes.trim() || undefined, current.payout_review?.revision);
    apply(result.invoice); await onComplete(); onClose();
  });
  const approve = () => run(async () => {
    if (warnings.length && !override.trim()) throw new Error('Verify the warnings or provide an accounts override reason.');
    const result = await approveWeeklyInvoice(current.id, override.trim() || undefined, current.payout_review?.revision);
    apply(result.invoice); await onComplete(); onClose();
  });

  return <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
        <DialogTitle>{editing ? 'Edit invoice' : 'View invoice'} · W-{invoice.id}</DialogTitle>
        <DialogDescription>{invoice.billing_period_start.slice(0, 10)} – {invoice.billing_period_end.slice(0, 10)} · Sunday–Saturday · Based on completed / verified work</DialogDescription>
      </DialogHeader>
      {loading ? <div className="flex min-h-40 items-center justify-center gap-2"><InlineSpinner /> Loading invoice…</div> : !loaded ? <div className="p-5 text-sm text-muted-foreground">Invoice unavailable. Close and reopen it to try again.</div> : <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-medium">{current.photographer?.name || current.salesRep?.name || 'Weekly payout'}</p><Badge variant="outline" className="mt-2">{current.payout_review?.label || current.approval_status}</Badge></div>
          <div className="text-right"><p className="text-xs text-muted-foreground">Invoice total</p><p className="text-2xl font-semibold tabular-nums">{money(current.total_amount)}</p>{current.payout_review?.before_total != null && <p className="text-xs text-muted-foreground">Before edits {money(current.payout_review.before_total)}</p>}</div>
        </div>
        {lastReturn && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><strong>Previous return reason</strong><p className="mt-1 whitespace-pre-wrap">{lastReturn}</p></div>}
        {recovery && editing && role === 'admin' && <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 p-3 text-sm"><input type="checkbox" className="mt-1" checked={reconcileHistory} onChange={(event) => setReconcileHistory(event.target.checked)} />I reconciled every historical edit against the original work and previous payouts. Record this acknowledgement with my next saved correction.</label>}
        {current.modification_notes && <div className="rounded-lg bg-muted/40 p-3 text-sm"><strong>Submission explanation</strong><p className="mt-1 whitespace-pre-wrap">{current.modification_notes}</p></div>}
        {canEdit && !editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit invoice</Button>}
        {editing && canEdit && role === 'admin' && <div className="space-y-2"><Label htmlFor="payout-admin-reason">Reason for correction (required)</Label><Textarea id="payout-admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why accounts is changing this invoice." /></div>}
        <div className="space-y-2" aria-label="Invoice lines">{(current.items || []).filter((item) => item.type !== 'payment').map((item) => <div key={item.id} className="rounded-lg border p-3">
          {editItem?.id === item.id ? <div className="space-y-3">
            <Label htmlFor={`line-description-${item.id}`}>Description</Label><Input id={`line-description-${item.id}`} value={itemDraft.description} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} />
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`line-amount-${item.id}`}>Unit amount</Label><Input id={`line-amount-${item.id}`} type="number" min="0" step="0.01" value={itemDraft.amount} onChange={(event) => setItemDraft({ ...itemDraft, amount: event.target.value })} /></div><div><Label htmlFor={`line-quantity-${item.id}`}>Quantity</Label><Input id={`line-quantity-${item.id}`} type="number" min="1" step="1" value={itemDraft.quantity} onChange={(event) => setItemDraft({ ...itemDraft, quantity: event.target.value })} /></div></div>
            {role === 'admin' && item.meta?.source === 'external_work' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemDraft.verified} onChange={(event) => setItemDraft({ ...itemDraft, verified: event.target.checked })} />Accounts verified this external work</label>}
            <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={saveItem}>Save correction</Button><Button size="sm" variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button></div>
          </div> : <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.description}</p><p className="mt-1 text-xs text-muted-foreground">{item.type} · {item.quantity} × {money(item.unit_amount)}{item.shoot_id ? ` · Shoot #${item.shoot_id}` : ''}</p>{item.meta?.source === 'external_work' && <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">External work · {String(item.meta.reference ?? '')} · {item.meta.verified ? 'Verified by accounts' : 'Awaiting accounts verification'}</p>}</div>
            <div className="text-right"><strong className="text-sm tabular-nums">{money(item.total_amount)}</strong>{editing && canEdit && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditItem(item); setItemDraft({ description: item.description, amount: String(item.unit_amount), quantity: String(item.quantity), verified: Boolean(item.meta?.verified) }); }}>Edit line</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => { apply((await removePayoutInvoiceItem(role, current, item.id, reason)).invoice); })}>Remove</Button></div>}</div>
          </div>}
        </div>)}</div>
        {editing && canEdit && <div className="flex flex-wrap gap-2">{current.role !== 'salesRep' && role !== 'salesRep' && <><Button size="sm" variant="outline" onClick={() => setForm('shoot')}>Add shoot</Button><Button size="sm" variant="outline" onClick={() => setForm('external')}>Add external / legacy work</Button></>}<Button size="sm" variant="outline" onClick={() => setForm('expense')}>{current.role === 'salesRep' || role === 'salesRep' ? 'Add adjustment' : 'Add expense'}</Button></div>}
        {form === 'shoot' && <PayoutShootPicker invoice={current} role={role} busy={busy} adminReason={reason} onAdd={add} onCancel={() => setForm(null)} />}
        {(form === 'external' || form === 'expense') && <PayoutWorkForm key={form} kind={form} role={role} busy={busy} adminReason={reason} onAdd={add} onCancel={() => setForm(null)} />}
        {canSubmit && <div className="space-y-2"><Label htmlFor="payout-submit-notes">{changed ? 'Explanation of changes (required)' : 'Note to accounts (optional)'}</Label><Textarea id="payout-submit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={changed ? 'Explain the shoots, amounts, or expenses you changed.' : 'Any context for accounts?'} /></div>}
        {!!warnings.length && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><strong>Accounts verification required</strong>{warnings.map((warning, index) => <p key={index} className="mt-1">{warning.message}</p>)}{canApprove && <div className="mt-3 space-y-2"><Label htmlFor="payout-override">Accounts override reason</Label><Textarea id="payout-override" value={override} onChange={(event) => setOverride(event.target.value)} /></div>}</div>}
        {!canEdit && <p className="text-sm text-muted-foreground">{current.edit_locked_reason || 'This invoice is locked.'}</p>}
        {!!current.payout_review?.changes?.length && <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Change history · {current.payout_review.changes.length}</summary><div className="mt-3 space-y-2">{current.payout_review.changes.map((change, index) => <div key={index}><p>{change.summary}</p>{typeof change.metadata?.reason === 'string' && <p className="text-muted-foreground">{change.metadata.reason}</p>}</div>)}</div></details>}
      </div>}
      <div className="shrink-0 space-y-2 border-t bg-background px-5 py-3">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{editing ? 'Each saved correction is recorded in the invoice history.' : 'Viewing an invoice does not submit it.'}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>{canSubmit && <Button disabled={busy || loading || (changed && !notes.trim())} onClick={submit}>{busy && <InlineSpinner className="mr-2 size-4" />}{changed ? 'Submit changes' : 'Confirm invoice is correct'}</Button>}{canApprove && <Button disabled={busy || loading} onClick={approve}>Approve amount</Button>}</div></div>
      </div>
    </DialogContent>
  </Dialog>;
}
