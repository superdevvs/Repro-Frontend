import { Link } from 'react-router-dom';
import type { StudioAccount } from '@/types/listingStudioClient';
import { studioDate } from './studioPresentation';

const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro', studio: 'Studio' };
export function StudioPendingBilling({ account }: { account: StudioAccount }) {
  const change = account.subscriptionManagement?.pendingChange;
  const requests = (account.pendingBilling?.requests ?? []).filter(request =>
    ['pending', 'processing', 'needs_attention'].includes(request.status)
    && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(request.id));
  if (!change && !requests.length) return null;
  const plan = change?.planCode ? planNames[change.planCode] ?? 'Selected plan' : 'Selected plan';
  const changeText = change?.status === 'scheduled'
    ? change.type === 'cancel_renewal' ? `Renewal is cancelled. Your current plan remains available until ${studioDate(change.effectiveAt)}.`
      : `${plan} starts ${studioDate(change.effectiveAt)}. Your current plan and credit remain available through this billing period.`
    : change?.type === 'upgrade' ? 'Your plan upgrade is awaiting payment confirmation. Current benefits stay in place until the upgrade is confirmed.'
      : 'Your subscription change is being checked. Your current plan remains in place while this is resolved.';
  return <section aria-label="Pending billing changes" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
    {change && <div role="status" className="space-y-2"><h2 className="text-sm font-semibold">Upcoming subscription change</h2><p className="text-sm leading-6 text-muted-foreground">{changeText}</p></div>}
    {requests.length > 0 && <div className="space-y-3"><h2 className="text-sm font-semibold">Payment requests for you</h2>{requests.map(request => <Link key={request.id} to={`/listing-studio/payment-requests/${request.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span>{request.kind === 'order_payment' ? 'Photo edit payment' : request.kind === 'subscription_upgrade' ? 'Plan upgrade' : 'New monthly plan'}<span className="ml-2 text-xs text-muted-foreground">From {request.actor.name}</span></span><span className="font-medium text-primary">{request.status === 'pending' ? 'Review request' : 'Check payment status'}</span></Link>)}</div>}
  </section>;
}
