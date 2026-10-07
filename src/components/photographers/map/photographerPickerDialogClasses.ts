/**
 * Select Photographer DialogContent sizing.
 *
 * - Below xl (<1280): edge-to-edge full screen (~100dvh × 100vw) for iPad
 *   portrait/landscape and other mid widths that use the Dialog (not Drawer) path.
 * - xl+ (≥1280): centered inset modal (prior desktop sizing).
 *
 * Overrides Dialog defaults (left/top 50% + translate) via !important utilities
 * so the sheet pins to the viewport on tablet. Desktop positioning overrides
 * must also be important to win over those tablet defaults. Keep full class strings as
 * literals so Tailwind content detection retains every utility.
 */

/** Book flow (SchedulingPhotographerSection) — 52rem desktop height cap. */
export const PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_BOOK =
  'flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-0 p-0 !left-0 !top-0 !translate-x-0 !translate-y-0 xl:!left-[50%] xl:!top-[50%] xl:h-[min(88dvh,52rem)] xl:max-h-[92dvh] xl:w-[96vw] xl:max-w-6xl xl:!translate-x-[-50%] xl:!translate-y-[-50%] xl:rounded-lg'

/** Approve / Modify / Overview — 48rem desktop height cap. */
export const PHOTOGRAPHER_PICKER_DIALOG_DESKTOP_H_COMPACT =
  'flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-0 p-0 !left-0 !top-0 !translate-x-0 !translate-y-0 xl:!left-[50%] xl:!top-[50%] xl:h-[min(88dvh,48rem)] xl:max-h-[92dvh] xl:w-[96vw] xl:max-w-6xl xl:!translate-x-[-50%] xl:!translate-y-[-50%] xl:rounded-lg'
