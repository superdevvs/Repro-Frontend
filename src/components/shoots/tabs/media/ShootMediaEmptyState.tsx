import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyStateArtwork } from '@/components/ui/empty-state';
import { formatMediaRequirementCount, type ShootMediaRequirements } from './shootMediaRequirements';
import { ShootMediaRequirementsDialog } from './ShootMediaRequirementsDialog';

interface Props {
  title: string;
  description: string;
  uploadLabel: string;
  onUpload?: () => void;
  requirements?: ShootMediaRequirements;
}

/** Counts occupy one line in the existing empty state; service details never expand it. */
export function ShootMediaEmptyState({ title, description, uploadLabel, onUpload, requirements: r }: Props) {
  const icon = /video/i.test(title) ? 'videos' : /floor|tour|3d/i.test(title) ? 'tours' : 'photos';
  const compact = Boolean(r);
  return <div data-testid={compact ? 'shoot-media-empty-state' : undefined} className={compact
    ? 'mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-3 py-6 text-center'
    : 'mx-auto flex max-w-md flex-col items-center justify-center p-6 text-center'}>
    <EmptyStateArtwork icon={icon} className={compact ? 'mb-3 h-12 w-12' : 'mx-auto mb-4 h-24 w-24 sm:h-28 sm:w-28'} />
    <h3 className="mb-2 text-xl font-semibold">{title}</h3>
    <p className={`max-w-lg text-sm text-muted-foreground ${compact ? 'mb-3' : 'mb-6'}`}>{description}</p>
    {r && <div data-testid="shoot-media-counts" className="mb-3 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums sm:text-xs">
      <span><b className="mr-1 text-base font-semibold text-primary">{r.saved > 0 ? `${r.saved} / ${formatMediaRequirementCount(r.expected, r.exact)}` : formatMediaRequirementCount(r.expected, r.exact)}</b><span className="hidden sm:inline">{r.saved > 0 ? 'raw images uploaded' : 'raw images needed'}</span><span className="sm:hidden">{r.saved > 0 ? 'raw uploaded' : 'raw needed'}</span></span>
      <span className="h-3.5 w-px bg-border" aria-hidden="true" />
      <span><b className="mr-1 text-base font-semibold text-foreground">{formatMediaRequirementCount(r.finalCount, r.finalExact)}</b>final target</span>
      <ShootMediaRequirementsDialog requirements={r}>
        <button type="button" className="relative min-h-8 text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary after:absolute after:inset-x-0 after:-inset-y-1.5" aria-label="View shoot image requirements"><span className="hidden sm:inline">View </span>details</button>
      </ShootMediaRequirementsDialog>
    </div>}
    {onUpload && <Button type="button" variant="default" size="lg" className={`bg-blue-600 text-white hover:bg-blue-700 ${compact ? 'h-11 w-full max-w-xs sm:w-auto sm:min-w-60' : ''}`} onClick={onUpload}>
      <Upload className="mr-2 h-4 w-4" />{uploadLabel}
    </Button>}
  </div>;
}
