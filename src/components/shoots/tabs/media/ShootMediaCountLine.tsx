import type { ShootMediaRequirements } from './shootMediaRequirements';
import { ShootMediaRequirementsDialog } from './ShootMediaRequirementsDialog';

export function ShootMediaCountLine({ requirements: r, compact = false }: { requirements: ShootMediaRequirements; compact?: boolean }) {
  const expected = r.exact ? r.expected : r.expected > 0 ? `${r.expected}+` : 'Not set';
  return <div data-testid="shoot-media-counts" title={r.breakdown || 'Source image requirement for this shoot'} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
    <ShootMediaRequirementsDialog requirements={r}><button type="button" aria-label="View shoot image requirements" className="text-left hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-primary">{compact ? 'Sources' : 'Source images'} <b className="font-semibold text-foreground">{r.saved} / {expected}</b></button></ShootMediaRequirementsDialog>
    <span>Final target <b className="font-semibold text-foreground">{r.finalExact ? r.finalCount : r.finalCount > 0 ? `${r.finalCount}+` : 'Not set'}</b></span>
    {(r.exact || r.missing > 0) && <span className={r.missing > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>{r.missing > 0 ? `${r.exact ? '' : 'At least '}${r.missing} still needed` : 'All required sources uploaded'}</span>}
  </div>;
}
