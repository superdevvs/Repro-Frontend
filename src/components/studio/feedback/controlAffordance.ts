import { cn } from '@/lib/utils';

/**
 * Shared control affordance rules for Studio controls (ai-editing-studio-revamp,
 * task 16.4).
 *
 * One pure resolver decides a control's accessible name (Req 12.10) and its
 * tooltip content (Req 12.2), so the *same* string is used for pointer hover and
 * keyboard focus (Req 12.3) and icon-only or disabled controls can never ship
 * without equivalent text content.
 */

export interface ControlAffordanceInput {
  /** Human label for the control. Required — it is the accessible name source. */
  label: string;
  /** Optional extra help shown in the tooltip when the control is enabled. */
  description?: string | null;
  /** True when the control renders only an icon (no visible text label). */
  iconOnly?: boolean;
  /** True when the control cannot be activated. */
  disabled?: boolean;
  /** Server- or client-provided reason the control is disabled. */
  disabledReason?: string | null;
}

export interface ControlAffordance {
  /** Accessible name for the control (Req 12.10). Always non-empty. */
  accessibleName: string;
  /** Tooltip content shown on hover and focus alike (Req 12.2, 12.3). */
  tooltip: string | null;
  /** True when a tooltip must be present: icon-only or disabled controls. */
  requiresTooltip: boolean;
  isDisabled: boolean;
}

const clean = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Resolves the accessible name and tooltip for a control.
 *
 * - Accessible name is the label, so hover, focus, and assistive technology all
 *   refer to the control the same way (Req 12.10).
 * - A disabled control describes *why* it is disabled; an icon-only control
 *   describes what it does. Either way the tooltip is non-empty whenever the
 *   control has no visible text or cannot be activated (Req 12.2).
 */
export function resolveControlAffordance(input: ControlAffordanceInput): ControlAffordance {
  const label = clean(input.label);
  const description = clean(input.description);
  const disabledReason = clean(input.disabledReason);
  const isDisabled = Boolean(input.disabled);
  const iconOnly = Boolean(input.iconOnly);
  const accessibleName = label || description || disabledReason || 'Control';

  let tooltip: string | null;
  if (isDisabled) {
    tooltip = disabledReason || description || `${accessibleName} is unavailable`;
  } else {
    tooltip = description || (iconOnly ? accessibleName : null);
  }

  return {
    accessibleName,
    tooltip,
    requiresTooltip: isDisabled || iconOnly,
    isDisabled,
  };
}

/** Hover affordance for enabled interactive surfaces (Req 12.1). */
export const STUDIO_HOVER_CLASS =
  'transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground';

/** Visible keyboard focus ring that survives every deep-navy surface (Req 11.10). */
export const STUDIO_FOCUS_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Styling for a control that is present but not activatable (Req 12.2). */
export const STUDIO_DISABLED_CLASS = 'cursor-not-allowed opacity-60';

/**
 * Class list for an interactive Studio surface: hover state only while enabled,
 * a persistent focus ring, and a non-color disabled treatment.
 */
export function studioInteractiveClass(
  options: { disabled?: boolean; className?: string } = {},
): string {
  return cn(
    STUDIO_FOCUS_CLASS,
    options.disabled ? STUDIO_DISABLED_CLASS : STUDIO_HOVER_CLASS,
    options.className,
  );
}

/**
 * ARIA props for a control. Disabled controls use `aria-disabled` instead of the
 * native `disabled` attribute so they stay focusable and can expose the same
 * tooltip content to keyboard users (Req 12.3).
 */
export function controlAriaProps(affordance: ControlAffordance): {
  'aria-label': string;
  'aria-disabled'?: true;
} {
  return {
    'aria-label': affordance.accessibleName,
    ...(affordance.isDisabled ? { 'aria-disabled': true as const } : {}),
  };
}
