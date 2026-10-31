import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { beginStudioSubscriptionAction, forgetStudioSubscriptionAction, readStudioSubscriptionAction } from '@/lib/listingStudioSubscriptionAction';
import { studioManagedActionScope, studioManagedScope } from '@/lib/listingStudioStaff';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import { normalizeApiError } from '@/services/apiError';
import type { StudioPlan } from '@/types/listingStudioClient';
import type { StudioManagedAccount, StudioSubscriptionActionInput } from '@/types/listingStudioStaff';
import { studioDate, studioMoney } from '../client/studioPresentation';

const labels = { schedule_downgrade: 'Schedule plan downgrade', cancel_renewal: 'Cancel renewal', undo_cancel: 'Keep subscription renewing', undo_downgrade: 'Undo scheduled downgrade' };
export function StudioSubscriptionManagement({ actorId, clientId, account, plans, onChanged }: { actorId: string; clientId: string; account: StudioManagedAccount; plans: StudioPlan[]; onChanged: () => void }) {
  const scope = studioManagedActionScope(actorId, clientId); const queryClient = useQueryClient(); const summary = account.management.subscription;
  const [selected, setSelected] = useState<StudioSubscriptionActionInput | null>(null); const [planCode, setPlanCode] = useState('');
  const [pending, setPending] = useState(() => readStudioSubscriptionAction(scope)); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const current = plans.find(plan => plan.code === account.subscription?.planCode); const lower = plans.filter(plan => current && plan.monthlyPriceCents < current.monthlyPriceCents);
  const execute = async () => {
    if (lock.current || !account.management.canManageSubscription || (!pending && !selected)) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const attempt = pending ?? beginStudioSubscriptionAction(scope, selected!); setPending(attempt);
      const result = await listingStudioStaff.subscriptionAction(clientId, attempt.input, attempt.key);
      await queryClient.invalidateQueries({ queryKey: studioManagedScope(actorId, clientId) }); onChanged();
      if (['scheduled', 'completed', 'cancelled', 'expired'].includes(result.action.status)) { forgetStudioSubscriptionAction(scope); setPending(null); }
      setSelected(null); setNotice(result.action.status === 'scheduled' ? 'The change is scheduled for the next billing period.' : result.action.status === 'completed' ? 'The subscription change is confirmed.' : 'The existing change is being reconciled. Check this same change before starting another.');
    } catch (failure) { setError(normalizeApiError(failure).message); } finally { lock.current = false; setBusy(false); }
  };
  if (!account.subscription || (!account.management.canManageSubscription && !summary?.pendingChange)) return null;
  return <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Subscription controls</h2><p className="text-sm text-muted-foreground">Changes apply to {account.client.name}’s subscription. Existing accepted photo orders keep their reserved credit.</p>
    {summary?.pendingChange && <div role="status" className="space-y-1 rounded-xl bg-muted p-3 text-sm"><p className="font-medium">{summary.pendingChange.type.replaceAll('_', ' ')} · {summary.pendingChange.status.replaceAll('_', ' ')}</p>{summary.pendingChange.planCode && <p className="capitalize">Plan: {summary.pendingChange.planCode}</p>}{summary.pendingChange.effectiveAt && <p>Effective {studioDate(summary.pendingChange.effectiveAt)}</p>}{summary.pendingChange.errorCode && <p>This change needs review before another change can start.</p>}</div>}
    {pending ? <div className="space-y-3"><p className="text-sm">A previous subscription change is saved. Recover it before starting another change.</p><Button variant="outline" disabled={busy || !account.management.canManageSubscription} onClick={() => void execute()}>{busy ? 'Checking change…' : 'Check existing change'}</Button></div> : <div className="space-y-4">
      {account.management.canManageSubscription && summary?.capabilities.canScheduleDowngrade && lower.length > 0 && <div className="flex flex-wrap items-end gap-3"><div className="min-w-48 space-y-2"><Label htmlFor="studio-downgrade-plan">Plan from next period</Label><select id="studio-downgrade-plan" value={planCode} onChange={event => setPlanCode(event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 text-sm"><option value="">Choose a lower plan</option>{lower.map(plan => <option key={plan.code} value={plan.code}>{plan.name} · {studioMoney(plan.monthlyPriceCents)} / month</option>)}</select></div><Button variant="outline" disabled={busy || !planCode} onClick={() => setSelected({ action: 'schedule_downgrade', planCode })}>Schedule downgrade</Button></div>}
      <div className="flex flex-wrap gap-2">{account.management.canManageSubscription && summary?.capabilities.canCancelRenewal && <Button variant="outline" disabled={busy} onClick={() => setSelected({ action: 'cancel_renewal' })}>Cancel renewal</Button>}{account.management.canManageSubscription && summary?.capabilities.canUndoCancel && <Button variant="outline" disabled={busy} onClick={() => setSelected({ action: 'undo_cancel' })}>Keep subscription renewing</Button>}{account.management.canManageSubscription && summary?.capabilities.canUndoDowngrade && <Button variant="outline" disabled={busy} onClick={() => setSelected({ action: 'undo_downgrade' })}>Undo scheduled downgrade</Button>}</div>
    </div>}
    {!summary && <p className="text-sm text-muted-foreground">Refresh this client’s account to load available subscription actions.</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!busy && !open) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>{selected ? labels[selected.action] : 'Confirm subscription change'}</DialogTitle><DialogDescription>For {account.client.name} · {account.client.email}</DialogDescription></DialogHeader><p className="text-sm leading-6">{selected?.action === 'cancel_renewal' ? 'The current paid period remains available. The subscription will stop renewing at period end.' : selected?.action === 'schedule_downgrade' ? 'The lower plan starts at the next billing period. This does not refund or remove the current period’s credit.' : 'This reverses the scheduled change if it has not taken effect. The server will check the current subscription before applying it.'}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Back</Button><Button disabled={busy} onClick={() => void execute()}>{busy ? 'Confirming…' : 'Confirm change'}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
