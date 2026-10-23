import { Button } from '@/components/ui/button';
import type { HostedPaymentReturnState } from '@/hooks/useHostedPaymentReturn';

export function HostedPaymentReturnNotice({ state, onCheck }: { state: HostedPaymentReturnState; onCheck: () => void }) {
  if (state.kind === 'idle') return null;
  const pending = state.kind === 'confirming' || state.kind === 'pending';
  const title = state.kind === 'confirming' ? 'Confirming payment…'
    : state.kind === 'confirmed' ? 'Payment confirmed'
    : state.kind === 'refunded' ? 'Payment refunded'
    : state.kind === 'closed' ? 'Checkout not completed'
    : state.kind === 'pending' ? 'Payment confirmation pending' : 'Payment confirmation unavailable';
  return <section aria-label="Payment confirmation" className={`mb-4 rounded-lg border p-4 ${pending ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'}`}>
    <h2 className="font-semibold">{title}</h2>
    <p role="status" className="mt-1 text-sm text-muted-foreground">{state.message || 'Checking this checkout session. Please wait before making another payment.'}</p>
    {state.kind === 'pending' && <Button className="mt-3" variant="outline" onClick={onCheck}>Check payment status</Button>}
  </section>;
}
