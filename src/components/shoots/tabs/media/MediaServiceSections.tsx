import type { ReactNode } from 'react';

import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';

import { groupMediaFilesByService, shouldShowServiceSections } from './mediaServiceGroups';

/**
 * Service-subgrouped media grid rendering.
 *
 * Extracted verbatim from `useShootDetailsMediaTab` to keep that module within
 * its recorded file-size baseline. Grouping, heading copy, section keys and the
 * single-group fallback are unchanged.
 */
export function MediaServiceSections({
  files,
  shoot,
  renderGrid,
}: {
  files: MediaFile[];
  shoot: ShootData;
  renderGrid: (paneFiles: MediaFile[]) => ReactNode;
}) {
  // Media kind picked the tab; the booked service picks the section inside it. A shoot
  // with one service (or no attribution) renders exactly as before, with no heading.
  const serviceGroups = groupMediaFilesByService(files, shoot);
  const showSections = shouldShowServiceSections(serviceGroups);

  if (!showSections) {
    return <>{renderGrid(files)}</>;
  }

  return (
    <div className="space-y-4">
      {serviceGroups.map((group) => (
        <section key={group.serviceId || 'unassigned'} aria-label={group.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b px-1 pb-1">
            <h4
              className={`truncate text-xs font-semibold uppercase tracking-wide ${
                group.isExtras ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {group.label}
            </h4>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {group.files.length}
            </span>
          </div>
          {renderGrid(group.files)}
        </section>
      ))}
    </div>
  );
}
