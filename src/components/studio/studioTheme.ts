/**
 * Deep-navy Studio visual system (ai-editing-studio-revamp, task 16.1).
 *
 * The palette is declared once here as role → CSS custom property, and defined
 * in `src/index.css` under the `.studio-theme` scope. Scoping matters: the class
 * is applied by `StudioSurface` on the Studio_Page only, so the navy roles (and
 * the shadcn token remaps that ride along with them) never leak into other
 * pages' theming (Req 11.1).
 *
 * The module is pure data so tests can assert palette completeness, focus-ring
 * contrast, and the responsive breakpoints without rendering anything.
 *
 * Requirements: 11.1, 11.3, 11.4, 11.5, 11.10
 */

/** Class that activates the deep-navy palette for a subtree. */
export const STUDIO_THEME_CLASS = 'studio-theme';

/** The palette roles Requirement 11.1 requires the Studio_Page to define. */
export const STUDIO_PALETTE_ROLE_NAMES = [
  'base',
  'surface',
  'text',
  'accent',
  'border',
  'success',
  'warning',
  'error',
] as const;

export type StudioPaletteRoleName = (typeof STUDIO_PALETTE_ROLE_NAMES)[number];

export interface StudioPaletteRole {
  /** CSS custom property holding the role's `H S% L%` triplet. */
  variable: string;
  /** Tailwind color key exposed as `bg-studio-*` / `text-studio-*` utilities. */
  token: string;
  /** Lightness of the role colour, used for contrast reasoning in tests. */
  lightness: number;
  /** Role that provides legible text on top of this role. */
  on: StudioPaletteRoleName | 'text';
  description: string;
}

/**
 * Role definitions. `lightness` mirrors the L component of the corresponding
 * custom property in `index.css`; keep the two in sync.
 */
export const STUDIO_PALETTE: Record<StudioPaletteRoleName, StudioPaletteRole> = {
  base: {
    variable: '--studio-base',
    token: 'studio-base',
    lightness: 7,
    on: 'text',
    description: 'Page canvas behind every Studio destination.',
  },
  surface: {
    variable: '--studio-surface',
    token: 'studio-surface',
    lightness: 13,
    on: 'text',
    description: 'Cards, panels, and raised regions on the navy canvas.',
  },
  text: {
    variable: '--studio-text',
    token: 'studio-text',
    lightness: 98,
    on: 'base',
    description: 'Primary high-contrast body and heading text.',
  },
  accent: {
    variable: '--studio-accent',
    token: 'studio-accent',
    lightness: 58,
    on: 'base',
    description: 'Primary actions, active navigation, and highlights.',
  },
  border: {
    variable: '--studio-border',
    token: 'studio-border',
    lightness: 24,
    on: 'text',
    description: 'Dividers and outlines between navy surfaces.',
  },
  success: {
    variable: '--studio-success',
    token: 'studio-success',
    lightness: 47,
    on: 'base',
    description: 'Completed jobs and successful mutations.',
  },
  warning: {
    variable: '--studio-warning',
    token: 'studio-warning',
    lightness: 58,
    on: 'base',
    description: 'Queued/at-risk states and non-blocking notices.',
  },
  error: {
    variable: '--studio-error',
    token: 'studio-error',
    lightness: 63,
    on: 'base',
    description: 'Failures, rejected uploads, and error states.',
  },
};

/** Muted body text role (still ≥4.5:1 on every navy surface). */
export const STUDIO_TEXT_MUTED_LIGHTNESS = 75;

/** Focus-visible ring role, kept separate so its contrast can be asserted. */
export const STUDIO_FOCUS_RING = {
  variable: '--studio-ring',
  token: 'studio-ring',
  lightness: 68,
} as const;

/** Navy surface roles a focus ring can be drawn against (Req 11.10). */
export const STUDIO_NAVY_SURFACE_ROLES: readonly StudioPaletteRoleName[] = [
  'base',
  'surface',
  'border',
];

/**
 * Relative-luminance-free contrast proxy: the WCAG ratio for two greys of the
 * given L values. It is only used to keep the palette honest in tests, not for
 * rendering.
 */
export function approximateContrast(lightnessA: number, lightnessB: number): number {
  const luminance = (lightness: number) => {
    const channel = lightness / 100;

    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  const a = luminance(lightnessA);
  const b = luminance(lightnessB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Shared focus-visible ring. Every interactive Studio control uses this so the
 * keyboard focus indicator stays visible against every navy surface (Req 11.10).
 */
export const STUDIO_FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ring focus-visible:ring-offset-2 focus-visible:ring-offset-studio-base';

/** Responsive ranges the Command_Center layout switches between (Req 11.3–11.5). */
export const STUDIO_BREAKPOINTS = {
  /** Below this width the Command_Center is a single reading column (Req 11.5). */
  singleColumnMax: 767,
  /** Sections stack without horizontal overflow from here up (Req 11.4). */
  stackedMin: 768,
  /** Primary content and the Live_Queue sit side by side from here up (Req 11.3). */
  multiColumnMin: 1280,
} as const;

export type StudioLayoutMode = 'single-column' | 'stacked' | 'multi-column';

/** Pure viewport-width → layout mode mapping, shared by layout and tests. */
export function studioLayoutMode(viewportWidth: number): StudioLayoutMode {
  if (viewportWidth >= STUDIO_BREAKPOINTS.multiColumnMin) return 'multi-column';
  if (viewportWidth >= STUDIO_BREAKPOINTS.stackedMin) return 'stacked';

  return 'single-column';
}

/** Aspect ratios used to reserve media space before images load (Req 11.8). */
export const STUDIO_MEDIA_RATIOS = {
  hero: '16 / 9',
  card: '4 / 3',
  thumbnail: '1 / 1',
  video: '16 / 9',
} as const;

export type StudioMediaRatio = keyof typeof STUDIO_MEDIA_RATIOS;
