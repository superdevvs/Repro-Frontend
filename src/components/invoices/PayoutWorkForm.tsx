import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PayoutEditInput, PayoutEditorRole } from '@/services/payoutInvoiceEditorService';

export function PayoutWorkForm({ kind, role, busy, adminReason, onAdd, onCancel }: {
  kind: 'external' | 'expense'; role: PayoutEditorRole; busy: boolean; adminReason: string;
  onAdd: (data: PayoutEditInput) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState({ description: '', amount: '', reference: '', work_date: '', address: '', reason: '', verified: false });
  const set = (key: string, value: string) => setDraft({ ...draft, [key]: value });
  const external = kind === 'external';
  const valid = draft.description.trim() && Number(draft.amount) > 0 && (!external || (draft.reference.trim() && draft.work_date && draft.address.trim() && (draft.reason || adminReason).trim()));
  return <form className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label={external ? 'Add external work' : 'Add expense'} onSubmit={(event) => {
    event.preventDefault();
    if (valid) void onAdd({ ...draft, description: draft.description.trim(), amount: Number(draft.amount), action: external ? 'add_external' : 'add_expense', reason: draft.reason || adminReason });
  }}>
    <h3 className="text-sm font-semibold">{external ? 'External / legacy work' : 'Expense / adjustment'}</h3>
    {external && <p className="text-xs text-muted-foreground">Use this for work missing from the dashboard. Accounts must verify it before approval. Enter the original job ID or URL so it cannot be claimed twice.</p>}
    <div><Label htmlFor="payout-work-description">{external ? 'Service / work description' : 'Description'}</Label><Input id="payout-work-description" required maxLength={500} value={draft.description} onChange={(event) => set('description', event.target.value)} /></div>
    <div><Label htmlFor="payout-work-amount">Payout amount</Label><Input id="payout-work-amount" type="number" required min="0.01" max="100000" step="0.01" value={draft.amount} onChange={(event) => set('amount', event.target.value)} /></div>
    {external && <><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="payout-work-date">Work date</Label><Input id="payout-work-date" type="date" required value={draft.work_date} onChange={(event) => set('work_date', event.target.value)} /></div><div><Label htmlFor="payout-work-reference">Original job ID / URL</Label><Input id="payout-work-reference" required maxLength={255} value={draft.reference} onChange={(event) => set('reference', event.target.value)} /></div></div><div><Label htmlFor="payout-work-address">Address</Label><Input id="payout-work-address" required value={draft.address} onChange={(event) => set('address', event.target.value)} /></div><div><Label htmlFor="payout-work-reason">Explanation (required)</Label><Textarea id="payout-work-reason" value={draft.reason} onChange={(event) => set('reason', event.target.value)} placeholder="Why is this work missing, and why should it be included?" /></div>{role === 'admin' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.verified} onChange={(event) => setDraft({ ...draft, verified: event.target.checked })} />Accounts verified this external work</label>}</>}
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !valid} type="submit">{role === 'admin' ? 'Save correction' : 'Add to invoice'}</Button><Button size="sm" variant="ghost" disabled={busy} type="button" onClick={onCancel}>Cancel addition</Button></div>
  </form>;
}
