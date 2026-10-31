import { Armchair, Check, Leaf, MoonStar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StudioCatalog, StudioPlan } from '@/types/listingStudioClient';
import { studioMoney } from '../client/studioPresentation';

export function StudioPlanCards({ plans, currentPlanCode, onSelect, canSelect, actionLabel, footerNote, busy = false }: {
  plans: StudioPlan[];
  currentPlanCode?: string;
  onSelect?: (plan: StudioPlan) => void;
  canSelect?: (plan: StudioPlan) => boolean;
  actionLabel?: (plan: StudioPlan) => string;
  footerNote?: (plan: StudioPlan) => string | undefined;
  busy?: boolean;
}) {
  return <div className="grid gap-4 md:grid-cols-3">
    {plans.map(plan => <article key={plan.code} className={cn('relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm lg:p-6', plan.code === 'pro' && 'border-primary/35 bg-primary/[0.035]')}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
        {currentPlanCode === plan.code && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">Current plan</span>}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">{studioMoney(plan.monthlyPriceCents)}<span className="ml-1 text-xs font-normal tracking-normal text-muted-foreground">/ month</span></p>
      <div className="my-5 rounded-xl border border-border/60 bg-background/60 px-4 py-3">
        <p className="text-lg font-semibold tabular-nums">{studioMoney(plan.monthlyCreditCents)} <span className="text-xs font-normal text-muted-foreground">editing credit / month</span></p>
      </div>
      <ul className="mb-5 flex-1 space-y-2.5 text-xs leading-5 text-muted-foreground">
        <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Credit works across all photo services</li>
        <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{plan.revisionDiscountPercent ? plan.revisionDiscountPercent + '% off team revisions' : 'Optional team revisions at standard pricing'}</li>
      </ul>
      {footerNote?.(plan) ? <p className="flex min-h-10 items-center justify-center rounded-lg bg-muted/50 px-3 py-2 text-center text-xs leading-5 text-muted-foreground">{footerNote(plan)}</p> : onSelect && <Button className="w-full" variant={plan.code === 'pro' ? 'default' : 'outline'} disabled={busy || (canSelect ? !canSelect(plan) : false)} onClick={() => onSelect(plan)}>{actionLabel?.(plan) ?? 'Choose a client'}</Button>}
    </article>)}
  </div>;
}

const serviceIcons = { staging: Armchair, decluttering: Sparkles, grass: Leaf, twilight: MoonStar };
export function StudioServicePricing({ catalog }: { catalog: StudioCatalog }) {
  return <section aria-labelledby="studio-photo-pricing" className="space-y-4">
    <div><h2 id="studio-photo-pricing" className="text-lg font-semibold tracking-tight">Pay per photo</h2><p className="mt-1 text-sm text-muted-foreground">One photo, one service. Use editing credit or pay for an individual edit.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {catalog.services.map(service => { const Icon = serviceIcons[service.id]; return <article key={service.id} className="min-w-0 rounded-2xl border bg-card p-4 lg:p-5">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" /></span><h3 className="text-sm font-semibold">{service.name}</h3></div>
        <p className="text-2xl font-semibold tabular-nums">{studioMoney(service.aiPriceCents)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ photo</span></p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Team revision {studioMoney(service.revisionBasePriceCents)} before any plan discount.</p>
        {!service.aiAvailable && <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">Temporarily unavailable</p>}
      </article>; })}
    </div>
  </section>;
}
