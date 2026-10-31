import { ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { Link, useMatch } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudioAccount } from '@/hooks/useStudioAccount';
import { canManageStudioBilling, isStudioManagedAccount, studioBillingRole } from '@/lib/studioBillingAccess';
import { cn } from '@/lib/utils';
import { studioDate, studioMoney } from '@/components/listing-studio/client/studioPresentation';

interface Props { isCollapsed?: boolean; onNavigate?: () => void }
const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro', studio: 'Studio' };

export function StudioCreditCard({ isCollapsed = false, onNavigate }: Props) {
  const { user, isAuthenticated, isLoading, isImpersonating } = useAuth();
  const match = useMatch('/listing-studio/manage/:clientId');
  if (!isAuthenticated || isLoading || isImpersonating || user?.isActive === false) return null;
  const staff = canManageStudioBilling(user?.role);
  if (!staff && studioBillingRole(user?.role) !== 'client') return null;
  const clientId = staff && /^\d+$/.test(match?.params.clientId ?? '') ? match!.params.clientId : undefined;
  if (staff && !clientId) return <div className="mb-3 mt-3 shrink-0">
    <CreditLink to="/listing-studio/manage" label="Client plans & credit" isCollapsed={isCollapsed} onNavigate={onNavigate}>
      <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!isCollapsed && <span className="text-xs font-medium leading-5">Client plans & credit</span>}
    </CreditLink>
  </div>;
  return <AccountCreditCard managedClientId={clientId} isCollapsed={isCollapsed} onNavigate={onNavigate} />;
}

function CreditLink({ to, label, isCollapsed, onNavigate, children }: Props & { to: string; label: string; children: React.ReactNode }) {
  const link = <Link to={to} onClick={onNavigate} aria-label={label} className={cn(
    'flex min-h-11 w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    isCollapsed && 'flex-col justify-center gap-1 px-1 py-2',
  )}>{children}</Link>;
  return isCollapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : link;
}

function AccountCreditCard({ managedClientId, isCollapsed, onNavigate }: Props & { managedClientId?: string }) {
  const account = useStudioAccount(managedClientId);
  const data = account.data;
  const client = isStudioManagedAccount(data) ? data.client : undefined;
  const destination = managedClientId ? `/listing-studio/manage/${encodeURIComponent(managedClientId)}?tab=billing` : '/listing-studio?tab=billing';
  const unavailable = account.isError || (!data && !account.isPending);
  const available = data ? studioMoney(data.credits.availableCents) : '';
  const reserved = data && data.credits.reservedCents > 0 ? studioMoney(data.credits.reservedCents) : '';
  const subscription = data?.subscription && !['canceled', 'incomplete_expired'].includes(data.subscription.status) ? data.subscription : null;
  const planCode = subscription?.planCode;
  const plan = planCode ? planNames[planCode] ?? planCode : null;
  const label = unavailable ? 'Editing credit balance unavailable' : !data ? 'Loading editing credit' : `${client ? `${client.name}: ` : ''}${available} editing credit available${reserved ? `, ${reserved} reserved` : ''}. Open Credit & plan`;

  return <section aria-label="Editing credit" className="mb-3 mt-3 shrink-0">
    {unavailable ? <div className="space-y-2 rounded-xl border border-border/70 bg-muted/40 p-2 text-center">
      <span className="block text-xs text-muted-foreground">{isCollapsed ? '—' : 'Balance unavailable'}</span>
      <button type="button" aria-label="Retry editing credit balance" disabled={account.isFetching} onClick={() => void account.refetch()} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-2 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <RefreshCw aria-hidden="true" className={cn('h-3.5 w-3.5', account.isFetching && 'animate-spin motion-reduce:animate-none')} />{!isCollapsed && 'Retry'}
      </button>
    </div> : <CreditLink to={destination} label={label} isCollapsed={isCollapsed} onNavigate={onNavigate}>
      {isCollapsed ? <><Wallet className="h-4 w-4" aria-hidden="true" /><span className="max-w-full truncate text-[10px] font-semibold tabular-nums">{data ? available : '…'}</span></> : <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet aria-hidden="true" className="h-3.5 w-3.5" /><span>Editing credit</span></div>
        {client && <p className="truncate text-xs font-medium" title={client.name}>{client.name}</p>}
        {!data ? <span role="status" className="block py-2 text-xs text-muted-foreground">Loading balance…</span> : <>
          <p className="text-xl font-semibold tabular-nums">{available}<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">available</span></p>
          {reserved && <p className="text-[11px] text-muted-foreground">{reserved} reserved</p>}
          {plan && <p className="text-[11px] text-muted-foreground">{plan}{data.credits.expiresAt ? ` · Expires ${studioDate(data.credits.expiresAt)}` : ''}</p>}
          <span className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">{subscription ? 'Credit & plan' : 'View plans'}<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></span>
        </>}
      </div>}
    </CreditLink>}
  </section>;
}
