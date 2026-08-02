import { cn } from '@/lib/utils';

/**
 * BeforeAfterControl — the interactive Before_After_Control of the Hero_Preview
 * (ai-editing-studio-revamp, task 12.1).
 *
 * Renders a full-frame draggable slider that moves the visible
 * original-to-processed boundary. The underlying control is a native
 * `input[type=range]`, so pointer dragging, touch dragging, and keyboard
 * interaction (arrows / Home / End) all work and a visible focus ring is
 * preserved against the deep-navy frame (Req 2.2, 11.10, 12.10).
 *
 * The boundary position is always normalized through
 * {@link clampBoundaryPosition} so a caller can never drive the frame outside
 * the inclusive 0–100 range (Req 2.2, design Property 5).
 */

/** Lowest Before_After_Control position (all processed / "After" visible). */
export const BEFORE_AFTER_MIN_POSITION = 0;

/** Highest Before_After_Control position (all original / "Before" visible). */
export const BEFORE_AFTER_MAX_POSITION = 100;

/** Position used when no valid position is available. */
export const DEFAULT_BEFORE_AFTER_POSITION = 50;

/**
 * Clamps any Before_After_Control position onto the inclusive range 0–100.
 *
 * `NaN` (an unusable position) falls back to the default centre position;
 * infinities clamp onto the corresponding bound.
 */
export function clampBoundaryPosition(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_BEFORE_AFTER_POSITION;
  return Math.min(
    BEFORE_AFTER_MAX_POSITION,
    Math.max(BEFORE_AFTER_MIN_POSITION, value),
  );
}

export interface BeforeAfterControlProps {
  /** Current boundary position; clamped to 0–100 before use. */
  position: number;
  /** Called with the clamped next position whenever the Client moves the control. */
  onPositionChange: (next: number) => void;
  /** Accessible name for the control. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function BeforeAfterControl({
  position,
  onPositionChange,
  label = 'Before and after comparison position',
  disabled = false,
  className,
}: BeforeAfterControlProps) {
  const clamped = clampBoundaryPosition(position);
  const rounded = Math.round(clamped);

  return (
    <div className={cn('absolute inset-0', className)}>
      {/* Boundary indicator — purely decorative, the range input owns semantics. */}
      <div
        aria-hidden="true"
        data-testid="before-after-divider"
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white/85 shadow-[0_0_12px_rgba(0,0,0,0.45)]"
        style={{ left: `${clamped}%` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/20 backdrop-blur-sm"
        style={{ left: `${clamped}%` }}
      >
        <span className="h-3 w-0.5 rounded bg-white/90" />
        <span className="ml-1 h-3 w-0.5 rounded bg-white/90" />
      </div>
      <input
        type="range"
        min={BEFORE_AFTER_MIN_POSITION}
        max={BEFORE_AFTER_MAX_POSITION}
        step={1}
        value={rounded}
        disabled={disabled}
        onChange={(event) => onPositionChange(clampBoundaryPosition(Number(event.target.value)))}
        aria-label={label}
        aria-valuetext={`${rounded}% original image visible`}
        data-testid="before-after-control"
        className={cn(
          'absolute inset-0 z-20 h-full w-full cursor-ew-resize appearance-none bg-transparent',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          // Transparent track, slim visible thumb spanning the frame height.
          '[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-transparent',
          '[&::-moz-range-track]:h-full [&::-moz-range-track]:bg-transparent',
          '[&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent',
        )}
      />
    </div>
  );
}

export default BeforeAfterControl;
