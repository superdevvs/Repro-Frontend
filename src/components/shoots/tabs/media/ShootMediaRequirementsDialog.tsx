import type { ReactElement } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatMediaRequirementCount, type ShootMediaRequirements } from './shootMediaRequirements';

/** Read-only requirements from the same scoped contract as the media gallery. */
export function ShootMediaRequirementsDialog({ requirements: r, children }: { requirements: ShootMediaRequirements; children: ReactElement }) {
  return <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent data-testid="shoot-media-requirements-dialog" className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-border p-5 sm:p-6 [&>button]:h-11 [&>button]:w-11">
      <DialogHeader className="pr-8 text-left">
        <DialogTitle>Shoot image requirements</DialogTitle>
        <DialogDescription>Each service uses its own image target. Extra images for one service do not cover another service.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-xs text-muted-foreground tabular-nums">
        <span>Raw images <b className="text-foreground">{r.saved} / {formatMediaRequirementCount(r.expected, r.exact)}</b></span>
        <span>Final target <b className="text-foreground">{formatMediaRequirementCount(r.finalCount, r.finalExact)}</b></span>
      </div>
      {r.services.length > 0 ? <ul className="divide-y divide-border">
        {r.services.map(service => <li key={service.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{service.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{service.finalCount === null ? 'Photo count not set' : `${service.finalCount} final photos${service.rawPerFinal === null ? '' : ` × ${service.rawPerFinal} raw ${service.rawPerFinal === 1 ? 'image' : 'images'}`}`}</p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            <p className="text-sm font-semibold">{service.saved} <span className="font-normal text-muted-foreground">/ {service.required ?? 'Not set'}</span></p>
            <p className={`mt-1 text-[10px] ${service.missing === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>{service.missing === null ? 'Count not set' : service.missing > 0 ? `${service.missing} still needed` : 'Count met'}</p>
          </div>
        </li>)}
      </ul> : <p className="text-xs text-muted-foreground">Service image targets are not available for this shoot.</p>}
      {r.videoServices.length > 0 && <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium">Video services</p>
        {r.videoServices.map(service => <div key={service.id} className="flex items-center justify-between gap-3 text-xs">
          <span>{service.label}</span><span className="text-right text-[10px] text-muted-foreground">Video files are separate from photo counts</span>
        </div>)}
      </div>}
      {!r.exact && <p className="text-[11px] text-muted-foreground">Totals marked + include only known targets. Services with unset counts may need additional images.</p>}
      {r.unassigned > 0 && <p className="text-[11px] text-muted-foreground">{r.unassigned} saved raw images have no service assignment and are included in the shoot total. Service rows show assigned images.</p>}
    </DialogContent>
  </Dialog>;
}
