import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, CreditCard, Loader2, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listingStudioService, type ListingStudioSubscription } from '@/services/listingStudioService';

const statusLabels: Record<string, string> = {
  active: 'Active', trialing: 'Trial', past_due: 'Past due', unpaid: 'Unpaid', canceled: 'Canceled',
  incomplete: 'Incomplete', incomplete_expired: 'Expired', paused: 'Paused',
};
const invoiceLabels: Record<string, string> = {
  paid: 'Paid', open: 'Awaiting payment', uncollectible: 'Uncollectible', void: 'Voided', draft: 'Draft',
};
const accountSetupLabels = { pending: 'Pending send', sent: 'Sent', needs_attention: 'Needs attention' };
const refundLabels: Record<string, string> = { pending: 'Pending', succeeded: 'Succeeded', failed: 'Failed', canceled: 'Canceled', requires_action: 'Action required' };
const dateLabel = (value: string | null): string => {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not available';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
};
const amountLabel = (amountCents: number | null, currency: string | null): string | null => {
  if (amountCents === null || !currency) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return null;
  }
};
const priceLabel = (subscription: ListingStudioSubscription): string => {
  const amount = amountLabel(subscription.amount_cents, subscription.currency);
  if (!amount) return 'Price not available';
  if (!subscription.billing_interval) return amount;
  const count = subscription.billing_interval_count ?? 1;
  return `${amount} / ${count > 1 ? `${count} ${subscription.billing_interval}s` : subscription.billing_interval}`;
};

function SubscriptionCard({ subscription }: { subscription: ListingStudioSubscription }) {
  const needsAttention = subscription.sync_status === 'needs_attention';
  const paymentProblem = ['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(subscription.status);
  const customerName = subscription.client?.name || subscription.customer.name || subscription.customer.email || 'Unknown customer';
  return <article className="min-w-0 rounded-xl border bg-card p-4" aria-label={`Subscription for ${customerName}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-semibold">{customerName}</h3>
        <p className="mt-1 break-all text-xs text-muted-foreground">{subscription.client?.email || subscription.customer.email || 'Email not available'}</p>
      </div>
      <Badge variant={paymentProblem ? 'destructive' : 'secondary'}>{statusLabels[subscription.status] ?? subscription.status.replaceAll('_', ' ')}</Badge>
    </div>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <p className="font-medium">{subscription.plan_name || 'Listing Studio plan'}</p>
      <p className="text-muted-foreground">{priceLabel(subscription)}</p>
    </div>
    {subscription.credits && <section className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3" aria-label="Studio credits">
      <h4 className="text-xs font-medium text-muted-foreground">Available Studio credits</h4>
      <p className="mt-1 text-xl font-semibold">{amountLabel(subscription.credits.available_cents, subscription.credits.currency)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Monthly allowance: {amountLabel(subscription.credits.monthly_allowance_cents, subscription.credits.currency)}</p>
      <p className="mt-3 text-xs text-muted-foreground">{subscription.credits.expires_at ? `Expires ${dateLabel(subscription.credits.expires_at)}.` : 'Expires at the end of the billing period.'} Unused credits do not roll over.</p>
    </section>}
    <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Current period ends</dt><dd className="mt-1 font-medium">{dateLabel(subscription.current_period_end)}</dd></div>
      <div><dt className="text-muted-foreground">Latest invoice</dt><dd className="mt-1 font-medium">{subscription.latest_invoice_status ? (invoiceLabels[subscription.latest_invoice_status] ?? subscription.latest_invoice_status) : 'No invoice yet'}</dd></div>
      <div><dt className="text-muted-foreground">Last successful payment</dt><dd className="mt-1 font-medium">{subscription.last_paid_at ? dateLabel(subscription.last_paid_at) : 'No payment recorded'}</dd></div>
      <div><dt className="text-muted-foreground">Dashboard account</dt><dd className="mt-1 font-medium">{subscription.client ? (subscription.account_created ? 'Created automatically' : 'Linked') : 'Not linked'}</dd></div>
      {subscription.account_setup_status && <div><dt className="text-muted-foreground">Account setup email</dt><dd className={`mt-1 font-medium ${subscription.account_setup_status === 'needs_attention' ? 'text-destructive' : ''}`}>{accountSetupLabels[subscription.account_setup_status]}</dd></div>}
    </dl>
    {subscription.latest_refund && <section className="mt-4 rounded-lg bg-muted/50 p-3" aria-label="Latest refund">
      <h4 className="text-xs font-medium">Latest refund</h4>
      <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Refund status</dt><dd className="mt-1 font-medium">{refundLabels[subscription.latest_refund.status] ?? subscription.latest_refund.status.replaceAll('_', ' ')}</dd></div>
        <div><dt className="text-muted-foreground">Refund amount</dt><dd className="mt-1 font-medium">{amountLabel(subscription.latest_refund.amount_cents, subscription.latest_refund.currency) ?? 'Amount not available'}</dd></div>
        <div><dt className="text-muted-foreground">Refund requested</dt><dd className="mt-1 font-medium">{dateLabel(subscription.latest_refund.created_at)}</dd></div>
      </dl>
    </section>}
    {subscription.cancel_at_period_end && subscription.status !== 'canceled' && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">Cancellation scheduled{subscription.current_period_end ? ` for ${dateLabel(subscription.current_period_end)}` : ' at the end of the current period'}.</p>}
    {subscription.status === 'canceled' && subscription.canceled_at && <p className="mt-3 text-xs text-muted-foreground">Canceled {dateLabel(subscription.canceled_at)}.</p>}
    {needsAttention && <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div className="min-w-0"><p className="font-medium">Needs attention</p><p className="mt-1 break-words text-xs text-muted-foreground">{subscription.attention_reason || 'The subscription needs an admin to review its dashboard connection.'}</p></div></div>}
    {subscription.account_setup_status === 'needs_attention' && <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div className="min-w-0"><p className="font-medium">Account setup email needs attention</p><p className="mt-1 break-words text-xs text-muted-foreground">{subscription.account_setup_attention || 'An admin needs to review the account setup email before this client can finish setting up their account.'}</p></div></div>}
    {subscription.sync_status === 'awaiting_payment' && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">Waiting for payment confirmation.</p>}
  </article>;
}

export function ListingStudioSubscriptions({ identity, canReview }: { identity: string; canReview: boolean }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const subscriptions = useQuery({
    queryKey: ['listing-studio-subscriptions', identity, page, search, status],
    queryFn: () => listingStudioService.subscriptions(page, search, status),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };
  const filtered = Boolean(search || status);
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-muted-foreground">{canReview ? 'Website subscriptions and payments sync here automatically.' : 'Website subscriptions for clients assigned to you appear here automatically.'}</p>
      <Button variant="ghost" size="icon" className="shrink-0" aria-label="Refresh subscriptions" disabled={subscriptions.isFetching} onClick={() => subscriptions.refetch()}><RefreshCw className={`h-4 w-4 ${subscriptions.isFetching ? 'animate-spin' : ''}`} /></Button>
    </div>
    <form onSubmit={submitSearch} className="space-y-3">
      <div className="space-y-1.5"><Label htmlFor="ls-subscription-search">Search subscriptions</Label><div className="flex gap-2"><Input id="ls-subscription-search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Client name, email or plan" maxLength={100} className="min-w-0" /><Button type="submit" variant="outline" className="shrink-0"><Search className="mr-1.5 h-4 w-4" />Search</Button></div></div>
      <div className="space-y-1.5"><Label htmlFor="ls-subscription-status">Subscription status</Label><select id="ls-subscription-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto sm:min-w-48"><option value="">All statuses</option><option value="needs_attention">Needs attention</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </form>
    {subscriptions.isPending && <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading subscriptions…</div>}
    {subscriptions.isError && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p className="text-destructive">Unable to load subscriptions.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => subscriptions.refetch()}>Try again</Button></div>}
    {subscriptions.data && <p className="text-xs text-muted-foreground" role="status">{subscriptions.data.meta.total} {subscriptions.data.meta.total === 1 ? 'subscription' : 'subscriptions'}{filtered ? ' matching your filters' : ''}</p>}
    {subscriptions.data?.data.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><CreditCard className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><h3 className="text-sm font-medium">{filtered ? 'No matching subscriptions' : 'No subscriptions yet'}</h3><p className="mt-1 text-sm text-muted-foreground">{filtered ? 'Try another search or status.' : canReview ? 'Subscriptions will appear after the website sends a payment or subscription update.' : 'Subscriptions will appear here when they are linked to one of your assigned clients.'}</p></div>}
    {subscriptions.data?.data.map(subscription => <SubscriptionCard key={subscription.id} subscription={subscription} />)}
    {subscriptions.data && subscriptions.data.meta.last_page > 1 && <div className="flex items-center justify-between gap-2 border-t pt-3"><Button variant="outline" size="sm" disabled={page === 1 || subscriptions.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-center text-xs text-muted-foreground">Page {subscriptions.data.meta.current_page} of {subscriptions.data.meta.last_page}</span><Button variant="outline" size="sm" disabled={page >= subscriptions.data.meta.last_page || subscriptions.isFetching} onClick={() => setPage(page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>}
  </div>;
}
