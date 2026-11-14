import type { ShootData } from '@/types/shoots';
import { Button } from '@/components/ui/button';
import { getShootDeliveryProgress } from '@/utils/shootDeliveryProgress';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';

export function ClientDeliveryNotice({ shoot, onPayNow }: { shoot: ShootData; onPayNow?: () => void }) {
  const progress = getShootDeliveryProgress(shoot);
  const payment = normalizeShootPaymentSummary(shoot);
  const bypass = Boolean(shoot.bypassPaywall ?? shoot.bypass_paywall);
  const due = !bypass && payment.paymentStatus !== 'paid' && payment.totalQuote - payment.totalPaid > 0.01;
  if (!progress.hasReleasedContent) return null;
  return <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs" role="status">
    <p className="min-w-0 flex-1 text-muted-foreground">
      {due ? payment.totalPaid > 0 ? 'Your payment is recorded. Delivered services unlock when their balance is paid.'
        : 'Preview your delivered photos. Payment unlocks downloads and paid content.' : 'Your delivered content is unlocked.'}
      {progress.isDelivering && ' Remaining services are coming soon.'}
    </p>
    {due && onPayNow && <Button size="sm" variant="ghost" className="min-h-10 shrink-0 rounded-lg px-2 font-semibold text-amber-700 dark:text-amber-300" onClick={onPayNow}>Pay now →</Button>}
  </div>;
}
