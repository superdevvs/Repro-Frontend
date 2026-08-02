import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FilterX, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { WorkflowId } from './destinations';
import type { RouteToCapability } from './types';
import {
  WORKFLOW_FILTER_OPTIONS,
  WORKFLOW_GALLERY_ITEMS,
  filterWorkflowItems,
  resolveWorkflowAvailability,
  resolveWorkflowPreview,
  toggleWorkflowFilter,
  type WorkflowAvailabilityMap,
  type WorkflowFilterId,
  type WorkflowGalleryItem,
} from './workflowGalleryLogic';
import { WorkflowCard } from './WorkflowCard';

/**
 * WorkflowGallery (ai-editing-studio-revamp, task 13.1) — extends the original
 * `StudioFeatureCards` into the image-rich, filterable Workflow_Gallery.
 *
 * Renders one Workflow_Card per launchable workflow (Req 5.1), filters the set by
 * supported media or capability category (Req 5.3), restores the full authorized
 * set when filters are cleared (Req 5.4), routes a card's launch control to that
 * workflow's functional destination (Req 5.5), and shows an Empty_State with a
 * filter-reset control when no card satisfies the selection (Req 5.7).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
 */
export interface WorkflowGalleryProps {
  /** Centralized navigation handler from the Studio shell. */
  routeToCapability: RouteToCapability;
  /** Existing role gate, used when no server availability map is supplied. */
  canUseAutoenhance?: boolean;
  /** Server-provided per-workflow availability and unavailability reasons. */
  availability?: WorkflowAvailabilityMap;
  /** Reason shown when an unavailable workflow carries no server reason. */
  unavailableReason?: string;
  /** Authorized Workflow_Cards; defaults to the six registry workflows. */
  workflows?: readonly WorkflowGalleryItem[];
  /** Stored asset overrides per workflow (populated by the asset process). */
  previewImages?: Partial<Record<WorkflowId, string | null>>;
  /** Controlled filter selection; falls back to internal state when omitted. */
  selectedFilters?: readonly WorkflowFilterId[];
  onSelectedFiltersChange?: (filters: WorkflowFilterId[]) => void;
  heading?: string;
  compact?: boolean;
  className?: string;
}

export function WorkflowGallery({
  routeToCapability,
  canUseAutoenhance = false,
  availability,
  unavailableReason,
  workflows = WORKFLOW_GALLERY_ITEMS,
  previewImages,
  selectedFilters,
  onSelectedFiltersChange,
  heading = 'Choose a workflow',
  compact = false,
  className,
}: WorkflowGalleryProps) {
  const [internalFilters, setInternalFilters] = useState<WorkflowFilterId[]>([]);
  const activeFilters = selectedFilters ?? internalFilters;

  const applyFilters = useCallback(
    (next: WorkflowFilterId[]) => {
      if (selectedFilters === undefined) setInternalFilters(next);
      onSelectedFiltersChange?.(next);
    },
    [onSelectedFiltersChange, selectedFilters],
  );

  const toggleFilter = useCallback(
    (filter: WorkflowFilterId) => {
      applyFilters(toggleWorkflowFilter(activeFilters, filter));
    },
    [activeFilters, applyFilters],
  );

  // Clearing every filter restores exactly the authorized card set (Req 5.4).
  const clearFilters = useCallback(() => applyFilters([]), [applyFilters]);

  const visibleItems = useMemo(
    () => filterWorkflowItems(workflows, activeFilters),
    [workflows, activeFilters],
  );

  const hasFilters = activeFilters.length > 0;

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="workflow-gallery-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="workflow-gallery-heading" className="text-lg font-semibold tracking-tight">
          {heading}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5" role="group" aria-label="Filter workflows">
            <Button
              type="button"
              size="sm"
              variant={!hasFilters ? 'default' : 'ghost'}
              aria-pressed={!hasFilters}
              className="h-7 rounded-md px-4 text-xs"
              onClick={clearFilters}
            >
              All
            </Button>
            {WORKFLOW_FILTER_OPTIONS.filter((option) => !compact || option.group === 'media').map((option) => {
              const isActive = activeFilters.includes(option.id);

              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'ghost'}
                  className="h-7 rounded-md px-4 text-xs"
                  aria-pressed={isActive}
                  onClick={() => toggleFilter(option.id)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          {hasFilters && !compact ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              <FilterX className="mr-1 h-4 w-4" aria-hidden="true" />
              Clear all filters
            </Button>
          ) : null}
        </div>
      </div>

      <p className={cn('text-sm text-muted-foreground', compact && 'sr-only')} aria-live="polite">
        {`Showing ${visibleItems.length} of ${workflows.length} workflows`}
      </p>

      {visibleItems.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center"
          data-testid="workflow-gallery-empty"
        >
          <SearchX className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No workflows match the selected filters.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className={cn(
          'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3',
          compact && '2xl:grid-cols-6',
        )}>
          {visibleItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className="h-full"
            >
              <WorkflowCard
                item={item}
                compact={compact}
                availability={resolveWorkflowAvailability(item.id, {
                  availability,
                  canLaunch: canUseAutoenhance,
                  ...(unavailableReason ? { fallbackReason: unavailableReason } : {}),
                })}
                previewImage={resolveWorkflowPreview(item.id, previewImages)}
                onLaunch={(launched) => routeToCapability(launched.target)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

export default WorkflowGallery;
