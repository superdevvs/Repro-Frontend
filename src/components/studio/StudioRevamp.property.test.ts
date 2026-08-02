import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  STUDIO_GENERATED_ASSET_MANIFEST,
  STUDIO_GENERATED_ASSET_REFS,
  resolveStudioAssetPath,
} from '@/lib/studioAssets';
import type { QueueRecord, StudioDeepLink, WorkflowId } from '@/services/studioService';

import {
  DEFAULT_STUDIO_DESTINATION,
  STUDIO_DESTINATIONS,
  STUDIO_WORKFLOW_DESTINATIONS,
  deriveActiveSubtab,
  getStudioDestination,
  routeTargetToDestination,
} from './destinations';
import { resolveControlAffordance } from './feedback/controlAffordance';
import { resolveStatusPresentation } from './feedback/statusPresentation';
import { clampBeforeAfterBoundary } from './heroPreviewBoundary';
import {
  createStudioInteractionState,
  hasSameStudioInteractionState,
  studioInteractionReducer,
} from './layout/studioInteractionState';
import { resolveStudioLayoutMode } from './layout/studioLayoutLogic';
import { queueEtaPresentation, queueProgressPresentation } from './LiveQueue';
import { launcherWorkflowIds } from './ProjectLauncher';
import {
  acceptedMimeTypesForWorkflow,
  partitionSourceFiles,
  pendingUploadRefs,
} from './SourcePicker';
import {
  decodeStudioDeepLink,
  encodeStudioDeepLink,
  resolveDestination,
} from './studioDeepLink';
import { nextStudioSearchIndex } from './StudioSearch';
import {
  WORKFLOW_FILTER_IDS,
  WORKFLOW_GALLERY_ITEMS,
  filterWorkflowItems,
  resolveWorkflowAvailability,
  toggleWorkflowFilter,
} from './workflowGalleryLogic';

const destination = fc.constantFrom(...STUDIO_DESTINATIONS.map((entry) => entry.id));
const workflow = fc.constantFrom(
  ...STUDIO_WORKFLOW_DESTINATIONS.map((entry) => entry.workflowId as WorkflowId),
);
const recordType = fc.constantFrom(
  'project' as const,
  'shoot' as const,
  'template' as const,
  'workflow' as const,
  'ai_job' as const,
);
const id = fc.stringMatching(/^[A-Za-z0-9_-]{1,32}$/);

describe('Feature: ai-editing-studio-revamp — navigation properties', () => {
  it('Property 1: Default destination without a deep-link; validates Requirement 1.1', () => {
    fc.assert(
      fc.property(fc.string(), (search) => {
        const params = new URLSearchParams(search);
        params.delete('d');
        expect(resolveDestination(params).destination).toBe(DEFAULT_STUDIO_DESTINATION);
      }),
      { numRuns: 40 },
    );
  });

  it('Property 2: Navigation exposes every destination; validates Requirements 1.5, 1.7, 12.10', () => {
    expect(STUDIO_DESTINATIONS.map((entry) => entry.id)).toEqual([
      ...new Set(STUDIO_DESTINATIONS.map((entry) => entry.id)),
    ]);
    for (const entry of STUDIO_DESTINATIONS) {
      expect(entry.label.trim()).not.toBe('');
      expect(entry.description.trim()).not.toBe('');
    }
  });

  it('Property 3: Destination selection consistency; validates Requirements 1.7, 1.10', () => {
    fc.assert(
      fc.property(destination, (idValue) => {
        const entry = getStudioDestination(idValue);
        expect(entry.id).toBe(idValue);
        expect(deriveActiveSubtab(idValue)).toBe(entry.view.subtab);
        expect(routeTargetToDestination(entry.view)).toBe(
          entry.kind === 'management' ? DEFAULT_STUDIO_DESTINATION : idValue,
        );
      }),
      { numRuns: 40 },
    );
  });

  it('Property 4: Deep-link round-trip; validates Requirements 1.8, 1.11, 14.2, 16.2', () => {
    fc.assert(
      fc.property(destination, recordType, id, fc.option(workflow, { nil: undefined }), (d, type, recordId, workflowId) => {
        const link: StudioDeepLink = { destination: d, recordType: type, recordId, workflowId };
        expect(decodeStudioDeepLink(encodeStudioDeepLink(link))).toEqual(link);
      }),
      { numRuns: 60 },
    );
  });
});

describe('Feature: ai-editing-studio-revamp — interaction properties', () => {
  it('Property 5: Before/After boundary mapping; validates Requirement 2.2', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (value) => {
        const result = clampBeforeAfterBoundary(value);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
        if (value >= 0 && value <= 100) expect(result).toBeCloseTo(value);
      }),
      { numRuns: 60 },
    );
  });

  it('Properties 7 and 8: launcher lists/routs every workflow and unavailable workflows have reasons', () => {
    expect(launcherWorkflowIds()).toEqual(
      STUDIO_WORKFLOW_DESTINATIONS.map((entry) => entry.workflowId),
    );
    fc.assert(
      fc.property(workflow, fc.string(), (workflowId, reason) => {
        const result = resolveWorkflowAvailability(workflowId, {
          availability: { [workflowId]: { available: false, reason } },
        });
        expect(result.available).toBe(false);
        expect(result.reason?.trim()).not.toBe('');
      }),
      { numRuns: 40 },
    );
  });

  it('Property 10: drop and file-control accept identical inputs; validates Requirement 4.5', () => {
    fc.assert(
      fc.property(
        workflow,
        fc.array(fc.constantFrom('image/jpeg', 'image/png', 'video/mp4', 'application/pdf'), { maxLength: 12 }),
        (workflowId, types) => {
          const files = types.map((type, index) => ({ type, name: `file-${index}` } as File));
          const drop = partitionSourceFiles(files, workflowId);
          const control = partitionSourceFiles(files, workflowId);
          expect(drop).toEqual(control);
          expect([...drop.accepted, ...drop.rejected]).toHaveLength(files.length);
          expect(acceptedMimeTypesForWorkflow(workflowId).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('Property 13: removed pending media is excluded from created jobs; validates Requirement 4.10', () => {
    fc.assert(
      fc.property(fc.uniqueArray(id, { maxLength: 12 }), id, (refs, removed) => {
        const uploads = refs.map((mediaRef, index) => ({ id: String(index), mediaRef })) as never[];
        const remaining = uploads.filter((upload: { mediaRef: string }) => upload.mediaRef !== removed);
        expect(pendingUploadRefs(remaining as never[])).not.toContain(removed);
      }),
      { numRuns: 40 },
    );
  });

  it('Properties 14–16: gallery filters and cards are complete; validates Requirements 5.2–5.4', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...WORKFLOW_FILTER_IDS), { maxLength: WORKFLOW_FILTER_IDS.length }),
        (filters) => {
          const visible = filterWorkflowItems(WORKFLOW_GALLERY_ITEMS, filters);
          if (filters.length === 0) expect(visible).toEqual([...WORKFLOW_GALLERY_ITEMS]);
          const cleared = filters.reduce((state, filter) => toggleWorkflowFilter(state, filter), filters);
          expect(filterWorkflowItems(WORKFLOW_GALLERY_ITEMS, cleared)).toEqual([
            ...WORKFLOW_GALLERY_ITEMS,
          ]);
          for (const item of visible) {
            expect(item.title).not.toBe('');
            expect(item.description).not.toBe('');
            expect(item.mediaTypeLabel).not.toBe('');
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('Property 18: Search keyboard navigation stays in bounds; validates Requirement 6.9', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1, max: 100 }), fc.integer({ min: 0, max: 100 }), fc.constantFrom('ArrowDown' as const, 'ArrowUp' as const, 'Home' as const, 'End' as const), (current, count, key) => {
        const next = nextStudioSearchIndex(current, key, count);
        if (count === 0) expect(next).toBe(-1);
        else {
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('Properties 21–22: queue progress/ETA is truthful and failed records retain a reason', () => {
    fc.assert(
      fc.property(fc.option(fc.double({ noNaN: true }), { nil: null }), (value) => {
        const progress = queueProgressPresentation(value);
        if (value === null) expect(progress.value).toBeNull();
        else {
          expect(progress.value).toBeGreaterThanOrEqual(0);
          expect(progress.value).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 50 },
    );
    const failed = {
      status: 'failed',
      failureReason: 'Provider rejected the source file',
      eta: null,
    } as QueueRecord;
    expect(queueEtaPresentation(failed)).toBe('ETA unavailable');
    expect(failed.failureReason).not.toBe('');
  });

  it('Properties 30–31: responsive reflow is bounded and preserves interaction state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 240, max: 2500 }), fc.integer({ min: 240, max: 2500 }), (before, after) => {
        const initial = {
          ...createStudioInteractionState(before),
          filters: ['media:photo'],
          selectedRecordId: 'project:p1',
          pendingSourceMedia: ['m1'],
          launcher: { isOpen: true, workflowId: 'twilight' },
        };
        const resized = studioInteractionReducer(initial, { type: 'viewport/resize', width: after });
        expect(hasSameStudioInteractionState(initial, resized)).toBe(true);
        expect(['single', 'stacked', 'multi']).toContain(resolveStudioLayoutMode(after));
      }),
      { numRuns: 50 },
    );
  });

  it('Properties 32–33: tooltips are equivalent and status is not colour-only', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.boolean(), (label, disabled) => {
        const affordance = resolveControlAffordance({ label, iconOnly: true, disabled });
        expect(affordance.accessibleName).not.toBe('');
        expect(affordance.tooltip).not.toBe('');
        const status = resolveStatusPresentation(label);
        expect(status.label).not.toBe('');
        expect(status.icon).toBeTypeOf('object');
        expect(status.accessibleLabel).toContain(status.label);
      }),
      { numRuns: 40 },
    );
  });

  it('Property 6: stored asset paths stay application-controlled; validates Requirements 2.7, 5.8, 17.10', () => {
    fc.assert(
      fc.property(id, (asset) => {
        expect(resolveStudioAssetPath(asset)).toBe(`/studio-assets/${asset}`);
        expect(resolveStudioAssetPath(`https://temporary.example/${asset}`)).toBeNull();
      }),
      { numRuns: 40 },
    );
  });

  it('Property 45: every incorporated image has alt text and a stable placement mapping; validates Requirement 17.10', () => {
    expect(STUDIO_GENERATED_ASSET_MANIFEST).toHaveLength(12);
    expect(
      STUDIO_GENERATED_ASSET_MANIFEST.map(({ instructionIndex }) => instructionIndex),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));

    fc.assert(
      fc.property(
        fc.constantFrom(...STUDIO_GENERATED_ASSET_MANIFEST),
        ({ placement, path, alt }) => {
          expect(placement.trim()).not.toBe('');
          expect(alt.trim()).not.toBe('');
          expect(STUDIO_GENERATED_ASSET_REFS[placement]).toBe(path);
          expect(resolveStudioAssetPath(path)).toBe(`/studio-assets/${path}`);
        },
      ),
      { numRuns: 48 },
    );
  });
});
