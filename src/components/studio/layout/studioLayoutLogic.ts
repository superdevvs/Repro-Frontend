/**
 * Responsive layout logic for the Studio (ai-editing-studio-revamp, task 16.1).
 *
 * Every responsive decision lives in this module as pure functions plus the
 * class-name strings the primitives in `StudioLayout.tsx` apply, so the layout
 * contract is testable without a browser:
 *
 *   - `>= 1280px`  multi-column primary content + Live_Queue        (Req 11.3)
 *   - `768–1279px` stacked sections, no horizontal page overflow     (Req 11.4)
 *   - `< 768px`    single-column reading order, no overflow          (Req 11.5)
 *   - any width    fits the viewport left over by the Application_Sidebar,
 *                  collapsed or expanded                             (Req 11.6)
 *   - media regions reserve aspect-ratio space before load           (Req 11.8)
 *
 * The breakpoints are expressed as Tailwind media queries (`md:` = 768px,
 * `xl:` = 1280px) on a **single DOM tree**: reflow never remounts or swaps
 * subtrees, which is what keeps filters, selected records, pending media, and
 * launcher state alive across ranges (Req 11.7).
 */

/** Viewport widths (CSS px) where the Studio layout changes. */
export const STUDIO_BREAKPOINTS = Object.freeze({
  /** Single column below this width. */
  stacked: 768,
  /** Multi-column primary + Live_Queue at or above this width. */
  multiColumn: 1280,
});

/** Layout arrangement for a viewport width. */
export type StudioLayoutMode = 'single' | 'stacked' | 'multi';

/** Resolves the layout mode for a viewport width in CSS pixels. */
export function resolveStudioLayoutMode(viewportWidth: number): StudioLayoutMode {
  if (!Number.isFinite(viewportWidth) || viewportWidth < STUDIO_BREAKPOINTS.stacked) {
    return 'single';
  }
  if (viewportWidth < STUDIO_BREAKPOINTS.multiColumn) {
    return 'stacked';
  }
  return 'multi';
}

/** Number of primary columns rendered for a layout mode. */
export function studioColumnCount(mode: StudioLayoutMode): number {
  return mode === 'multi' ? 2 : 1;
}

/** True when the mode places primary content and the Live_Queue side by side. */
export function isStudioMultiColumn(mode: StudioLayoutMode): boolean {
  return studioColumnCount(mode) > 1;
}

/**
 * Classes that make a block consume only the width it is given.
 *
 * `w-full` + `max-w-full` + `min-w-0` stop intrinsically wide content (long
 * addresses, media, tables) from pushing the page wider than the viewport the
 * Application_Sidebar leaves behind (Req 11.4, 11.5, 11.6).
 */
export const STUDIO_FIT_WIDTH_CLASSES = 'w-full min-w-0 max-w-full';

/** Root shell classes: fits the remaining viewport and clips stray horizontal overflow. */
export const STUDIO_SHELL_CLASSES = `studio-theme studio-scope flex flex-col ${STUDIO_FIT_WIDTH_CLASSES} overflow-x-hidden text-studio-text`;

/**
 * Column container classes. `minmax(0,1fr)` tracks (Tailwind's `grid-cols-*`
 * uses them) are what keep grid children from overflowing their track.
 */
export const STUDIO_COLUMNS_CLASSES = `grid ${STUDIO_FIT_WIDTH_CLASSES} grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start`;

/** Primary (left) column: everything except the Live_Queue rail. */
export const STUDIO_MAIN_CLASSES = `${STUDIO_FIT_WIDTH_CLASSES} space-y-6`;

/** Live_Queue rail: below the primary column until `xl`, beside it from `xl`. */
export const STUDIO_ASIDE_CLASSES = `${STUDIO_FIT_WIDTH_CLASSES} space-y-6 xl:sticky xl:top-4`;

/** Section shell: navy surface, hairline border, no-overflow sizing. */
export const STUDIO_SECTION_CLASSES = `${STUDIO_FIT_WIDTH_CLASSES} rounded-xl border border-studio-border bg-studio-surface p-4 sm:p-6`;

/** Focus-visible ring that stays visible on every navy surface (Req 11.10). */
export const STUDIO_FOCUS_RING_CLASSES =
  'outline-none focus-visible:ring-2 focus-visible:ring-studio-ring focus-visible:ring-offset-2 focus-visible:ring-offset-studio-base';

/** Supported media aspect ratios for reserved image space. */
export type StudioAspectRatio = '16/9' | '4/3' | '3/2' | '1/1' | '9/16';

/** Inline style reserving aspect-ratio space before an image loads (Req 11.8). */
export function studioAspectRatioStyle(ratio: StudioAspectRatio): { aspectRatio: string } {
  return { aspectRatio: ratio };
}

/** Media frame classes: reserved box, clipped content, navy placeholder surface. */
export const STUDIO_MEDIA_FRAME_CLASSES = `relative ${STUDIO_FIT_WIDTH_CLASSES} overflow-hidden rounded-lg bg-studio-surface-raised`;

/**
 * Grid classes for a responsive card grid (Workflow_Gallery, Metrics_Strip,
 * Recent_Projects) that never overflows: one column below `md`, `columns` from
 * `xl`, and a middle step in between.
 */
export function studioCardGridClasses(columns: 2 | 3 | 4): string {
  const middle = columns >= 3 ? 'md:grid-cols-2' : 'md:grid-cols-2';
  const wide =
    columns === 2 ? 'xl:grid-cols-2' : columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4';
  return `grid ${STUDIO_FIT_WIDTH_CLASSES} grid-cols-1 gap-4 ${middle} ${wide}`;
}
