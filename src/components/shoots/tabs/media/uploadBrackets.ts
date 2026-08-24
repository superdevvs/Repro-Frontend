/**
 * Bracket arithmetic for one service on one shoot.
 *
 * Bracket size is execution state, not a property of the catalogue or of the whole
 * shoot: the same shoot can be Exterior HDR at 5x by one photographer and Interior
 * HDR at 3x by another. Every helper here therefore works from a single service's
 * own size rather than a shoot-wide multiplier.
 *
 * The type import is deliberately type-only, so this module has no runtime
 * dependency back on mediaUploadUtils.
 */

import type { UploadServiceTarget } from './mediaUploadUtils';

/** The sizes the product offers. */
export const BRACKET_MODE_OPTIONS = [3, 5] as const;

/** Used when nothing else states a size. Mirrors the backend resolver's default. */
export const DEFAULT_BRACKET_MODE = 5;

/**
 * Whether a bracket size means anything for this service.
 *
 * This is catalogue data (`services.uses_hdr_brackets`), not a guess. The rule it
 * replaced — a photo service with a positive photo count — wrongly included drone
 * photography, which sits in the Photography category with a photo count of its own
 * and is not captured as exposure stacks.
 */
export function bracketAppliesToUploadService(target: UploadServiceTarget): boolean {
  // Both halves are required: the service must be able to receive photo capture at
  // all, and the catalogue must say that capture is exposure-stacked. Requiring photo
  // capability keeps video-only and non-intake work out without special-casing them,
  // and it no longer depends on a count — a variable HDR product still brackets even
  // though its contracted count is unset.
  return target.usesHdrBrackets && target.supportsPhotoIntake;
}

/** The size a bracketed group should submit, or null when it does not bracket. */
export function resolveUploadServiceBracketMode(
  target: UploadServiceTarget | undefined,
  override?: number | null,
): number | null {
  if (!target || !bracketAppliesToUploadService(target)) return null;

  return override ?? target.bracketMode ?? DEFAULT_BRACKET_MODE;
}

/**
 * Raw files this one service owes.
 *
 * Only bracketed work multiplies, and it multiplies by its own size. A shoot
 * running Exterior at 5x and Interior at 3x owes 30x5 + 12x3, which is why this
 * takes a size per service rather than one shoot-wide multiplier.
 */
export function resolveUploadServiceExpectedCount(
  target: UploadServiceTarget,
  bracketMultiplier?: number | null,
): number | null {
  // Owes no photos at all — a fee, an enhancement, a dedicated tour, video-only work.
  if (!target.supportsPhotoIntake) return 0;

  // Owes photos, but the product does not fix how many. Null so callers can say
  // "not set" instead of inventing a denominator.
  if (target.photoCount === null) return null;
  if (target.photoCount <= 0) return null;

  if (!bracketAppliesToUploadService(target)) return target.photoCount;

  const multiplier = bracketMultiplier ?? target.bracketMode ?? 1;

  return target.photoCount * Math.max(1, multiplier);
}

export function isUploadServiceFulfilled(
  target: UploadServiceTarget,
  uploadedCount: number,
  bracketMultiplier?: number | null,
): boolean {
  const expected = resolveUploadServiceExpectedCount(target, bracketMultiplier);
  // With no expected count to compare against, "has any file at all" is the only
  // signal available for whether this service has been shot yet.
  return expected !== null && expected > 0 ? uploadedCount >= expected : uploadedCount > 0;
}
