import { useMemo } from 'react';
import {
  TRACKED_MEDIA_TYPES,
  bracketAppliesToUploadService,
  createEmptyMediaTypeCounts,
  getMediaTypeCards,
  resolveUploadServiceExpectedCount,
  type UploadQueueMediaType,
  type UploadServiceTarget,
} from './mediaUploadUtils';

interface RawUploadSummaryInput {
  existingCounts: Record<UploadQueueMediaType, number>;
  queueCounts: Record<UploadQueueMediaType, number>;
  expectedCount: number;
  existingRawCount: number;
  uploadedCount: number;
  missingCount: number;
  serviceTargets: UploadServiceTarget[];
  bracketOverrides: Record<string, number | null>;
}

export function useRawUploadSummary({
  existingCounts,
  queueCounts,
  expectedCount,
  existingRawCount,
  uploadedCount,
  missingCount,
  serviceTargets,
  bracketOverrides,
}: RawUploadSummaryInput) {
  const combinedCounts = useMemo(() => {
    const nextCounts = createEmptyMediaTypeCounts();
    TRACKED_MEDIA_TYPES.forEach((mediaType) => {
      nextCounts[mediaType] = existingCounts[mediaType] + queueCounts[mediaType];
    });
    return nextCounts;
  }, [existingCounts, queueCounts]);
  const specialCountCards = useMemo(() => getMediaTypeCards(combinedCounts), [combinedCounts]);

  /**
   * Batch progress: the four numbers that describe "how far along is this
   * upload", kept together as one block. Missing is one of them rather than a
   * separate banner, because it is just Expected minus what is here.
   */
  const primaryStats = useMemo(
    () => [
      { key: 'expected', label: 'Expected', value: expectedCount },
      { key: 'existing', label: 'Existing', value: existingRawCount },
      { key: 'selected', label: 'Selected', value: uploadedCount },
      // Extras sits with the progress counters rather than the per-service tags:
      // it is a property of the batch, not a purchased service, including both
      // stored files and newly tagged selections.
      { key: 'extras', label: 'Extras', value: combinedCounts.extra },
      { key: 'missing', label: 'Missing', value: missingCount, alert: missingCount > 0 },
    ],
    [combinedCounts.extra, expectedCount, existingRawCount, missingCount, uploadedCount],
  );

  /**
   * Per-service tallies (Virtual Staging / Green Grass / Twilight / Drone /
   * Floorplan) in their own row, since they answer a different question than the
   * progress counters: which services were tagged, not how much is left.
   * `getMediaTypeCards` already drops zero counts, so the row disappears
   * entirely on a shoot with nothing tagged instead of rendering lone zeros.
   */
  const tagStats = useMemo(
    () => specialCountCards
      .filter((card) => card.type !== 'extra')
      .map((card) => ({ key: card.type, label: card.summaryLabel, value: card.count })),
    [specialCountCards],
  );

  /**
   * The per-service make-up of `Expected` on one line instead of one line per
   * service. Full text stays available via the title attribute when it has to
   * truncate.
   */
  const expectedBreakdown = useMemo(() => {
    // Built from the service targets so each service shows its own size. The old
    // form applied one multiplier to every service and then printed a single
    // "N final x M brackets" summary, which misstates a shoot running two sizes.
    const photoTargets = serviceTargets.filter((target) => target.supportsPhotoIntake);
    if (photoTargets.length === 0) {
      return '';
    }

    return photoTargets
      .map((target) => {
        const mode = bracketOverrides[target.id] ?? target.bracketMode;
        const expected = resolveUploadServiceExpectedCount(target, mode);

        // An unconfigured count is reported as unset. Printing a number derived from
        // booking quantity is what made floor plans and virtual staging appear to owe
        // five raw files each.
        if (expected === null) {
          return `${target.label} not set`;
        }

        const suffix = bracketAppliesToUploadService(target) && mode ? ` (${target.photoCount}x${mode})` : '';

        return `${target.label} ${expected}${suffix}`;
      })
      .join(' · ');
  }, [bracketOverrides, serviceTargets]);

  return { primaryStats, tagStats, expectedBreakdown };
}
