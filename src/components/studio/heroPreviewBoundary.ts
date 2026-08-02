/**
 * Before_After_Control boundary math (ai-editing-studio-revamp, task 12.1).
 *
 * Kept as pure functions, separate from `HeroPreview`, so the boundary rule
 * (Req 2.2 / Property 5) is verifiable without rendering.
 */

export const BEFORE_AFTER_MIN = 0;
export const BEFORE_AFTER_MAX = 100;
export const BEFORE_AFTER_DEFAULT = 50;

/**
 * Clamp a Before_After_Control position into the inclusive range 0–100.
 *
 * Finite values are clamped exactly; values that are not finite numbers
 * (`NaN`, `Infinity`, non-numeric input) have no position on the axis, so the
 * midpoint default is used rather than inventing a boundary.
 */
export function clampBeforeAfterBoundary(position: unknown): number {
  const numeric = typeof position === 'number' ? position : Number(position);
  if (!Number.isFinite(numeric)) return BEFORE_AFTER_DEFAULT;
  if (numeric <= BEFORE_AFTER_MIN) return BEFORE_AFTER_MIN;
  if (numeric >= BEFORE_AFTER_MAX) return BEFORE_AFTER_MAX;
  return numeric;
}

/**
 * Convert a pointer position over the comparison frame into a clamped
 * boundary percentage. A zero-width frame yields the midpoint default.
 */
export function boundaryFromPointer(
  clientX: number,
  frame: { left: number; width: number },
): number {
  if (!Number.isFinite(clientX) || !frame || !Number.isFinite(frame.width) || frame.width <= 0) {
    return BEFORE_AFTER_DEFAULT;
  }

  return clampBeforeAfterBoundary(((clientX - frame.left) / frame.width) * 100);
}

/** Percentage string used for CSS positioning of the boundary. */
export function boundaryToCssPercent(position: unknown): string {
  return `${clampBeforeAfterBoundary(position)}%`;
}
