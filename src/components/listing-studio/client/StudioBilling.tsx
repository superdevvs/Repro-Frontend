import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listingStudioClient, studioCheckoutUrl } from '@/services/listingStudioClientService';
import { normalizeApiError } from '@/services/apiError';
import { forgetStudioAction, studioActionKey } from '@/lib/listingStudioPurchase';
import type { StudioAccount, StudioCatalog, StudioPlan } from '@/types/listingStudioClient';
import { studioDate, studioMoney } from './studioPresentation';
import { StudioBillingView } from './StudioBillingView';

export function StudioCreditSummary({ account }: { account: StudioAccount }) {
  return <section aria-label="Editing credit" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {[
      ['Available credit', account.credits.availableCents, account.credits.expiresAt ? `Expires ${studioDate(account.credits.expiresAt)}` : 'Choose a plan or pay per photo'],
      ['Reserved for edits', account.credits.reservedCents, 'Held while your photos are being edited'],
      ['Credit used this period', account.credits.usedCents, 'Charged for saved, completed edits'],
    ].map(([label, value, detail], index) => <div key={String(label)} className={`space-y-2 rounded-2xl border bg-card p-4 sm:p-5 ${index === 0 ? 'col-span-2 sm:col-span-1' : ''}`}><h2 className="text-xs text-muted-foreground sm:text-sm">{label}</h2><p className="text-2xl font-semibold tabular-nums">{studioMoney(Number(value))}</p><p className="text-xs leading-5 text-muted-foreground">{detail}</p></div>)}
  </section>;
}

export function StudioBilling({ accountId, account, catalog, initialPlanCode, onPlanConsumed, onNewEdit }: { accountId: string; account: StudioAccount; catalog: StudioCatalog; initialPlanCode?: string | null; onPlanConsumed?: () => void; onNewEdit?: () => void }) {
  const [page, setPage] = useState(1); const [selectedPlan, setSelectedPlan] = useState<StudioPlan | null>(() => account.capabilities.canSubscribe ? catalog.plans.find(plan => plan.code === initialPlanCode) ?? null : null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const [notice, setNotice] = useState(''); const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ['studio-client', accountId, 'transactions', page], queryFn: () => listingStudioClient.transactions(page) });
  useEffect(() => { if (initialPlanCode) onPlanConsumed?.(); }, [initialPlanCode, onPlanConsumed]);
  const navigateBilling = async (plan?: StudioPlan) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = plan
        ? await listingStudioClient.subscriptionCheckout(plan.code, studioActionKey(accountId, `subscription:${plan.code}`))
        : await listingStudioClient.billingPortal();
      if (result.url) window.location.assign(studioCheckoutUrl(result.url));
      else if (plan && ['awaiting_webhook', 'paid'].includes(result.status ?? '')) {
        setSelectedPlan(null); setNotice('Your existing checkout is saved. Subscription confirmation will appear here.');
        await queryClient.invalidateQueries({ queryKey: ['studio-client', accountId, 'account'] });
      } else throw new Error('Billing navigation is unavailable.');
    } catch (failure) {
      const details = normalizeApiError(failure);
      const data = (failure as { response?: { data?: { data?: { retryWithNewKey?: boolean }; retryWithNewKey?: boolean } } }).response?.data;
      if (plan && ['checkout_expired', 'checkout_failed'].includes(details.code) && (data?.retryWithNewKey || data?.data?.retryWithNewKey)) forgetStudioAction(accountId, `subscription:${plan.code}`);
      setError(details.message);
    } finally { lock.current = false; setBusy(false); }
  };
  return <StudioBillingView account={account} catalog={catalog} selectedPlan={selectedPlan} setSelectedPlan={plan => { setError(''); setSelectedPlan(plan); }} busy={busy} error={error} notice={notice} navigateBilling={plan => void navigateBilling(plan)} history={history} page={page} setPage={setPage} onNewEdit={onNewEdit} />;
}
