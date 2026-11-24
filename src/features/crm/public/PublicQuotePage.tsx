import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicCrmApi, toApiError } from '../api';
import { day, money } from '../format';
import { TextInput } from '../ui/fields';
import { Note } from '../ui/primitives';
import { PublicShell } from './PublicShell';
import '../crm.css';

interface PublicQuote {
  number: string; status: string; for: string | null; company: string | null; property_address: string | null; valid_until: string | null;
  items: { name: string; quantity: number; unit_price: number; total: number }[]; subtotal: number; discount_percent: number; discount_amount: number; total: number;
  notes: string | null; can_respond: boolean;
}

/** The client's quote page, opened from the quote email (/q/:token). */
export default function PublicQuotePage() {
  const { token } = useParams();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['public-quote', token], queryFn: () => publicCrmApi.get<{ quote: PublicQuote }>(`/quotes/${token}`), retry: false });
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (action: 'accept' | 'decline') => {
    setBusy(true);
    setError(null);
    try {
      const res = await publicCrmApi.post<{ quote: PublicQuote }>(`/quotes/${token}/${action}`, action === 'decline' ? { reason: reason || null } : {});
      client.setQueryData(['public-quote', token], res);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <PublicShell><p className="text-sm text-muted-foreground">Loading…</p></PublicShell>;
  if (q.isError || !q.data) return <PublicShell><p className="text-sm">This quote link isn’t valid. Please contact your R/E Pro Photos rep.</p></PublicShell>;
  const x = q.data.quote;

  return (
    <PublicShell>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quote {x.number}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{x.property_address ?? 'Your photography quote'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">For {x.for}{x.company ? `, ${x.company}` : ''}{x.valid_until ? ` · valid until ${day(x.valid_until)}` : ''}</p>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <table className="crm-table">
          <thead><tr><th>Service</th><th className="r">Qty</th><th className="r">Total</th></tr></thead>
          <tbody>
            {x.items.map((i, n) => <tr key={n}><td>{i.name}</td><td className="r">{i.quantity}</td><td className="r tabular-nums">{money(i.total)}</td></tr>)}
            {x.discount_amount > 0 && <tr><td>Discount ({x.discount_percent}%)</td><td /><td className="r tabular-nums">−{money(x.discount_amount)}</td></tr>}
            <tr><td className="font-semibold">Total</td><td /><td className="r text-base font-semibold tabular-nums">{money(x.total)}</td></tr>
          </tbody>
        </table>
      </div>
      {x.notes && <p className="mt-4 whitespace-pre-wrap text-[15px]">{x.notes}</p>}

      {x.status === 'accepted' && <Note tone="ok" icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />} className="mt-6 text-[15px]">Accepted. Your rep will be in touch to book the shoot.</Note>}
      {x.status === 'declined' && <Note tone="info" className="mt-6">You declined this quote. Thanks for letting us know.</Note>}
      {x.status === 'expired' && <Note tone="warn" className="mt-6">This quote has expired. Ask your rep for an updated one.</Note>}
      {error && <Note tone="bad" className="mt-4">{error}</Note>}

      {x.can_respond && (
        <div className="mt-6 flex flex-col gap-3">
          {!declining ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void respond('accept')}>Accept quote</Button>
              <Button variant="outline" disabled={busy} onClick={() => setDeclining(true)}>Decline</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput aria-label="Reason (optional)" className="min-w-[240px] flex-1" placeholder="Anything we should know? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="outline" disabled={busy} onClick={() => void respond('decline')}>Decline quote</Button>
              <Button variant="ghost" onClick={() => setDeclining(false)}>Back</Button>
            </div>
          )}
        </div>
      )}
    </PublicShell>
  );
}
