/**
 * Deep-navy palette for the AI Editing Studio (ai-editing-studio-revamp, task 16.1).
 *
 * The palette is defined once, here, as HSL role tokens and is emitted as CSS
 * custom properties (`--studio-*`) consumed by Tailwind (`bg-studio-surface`,
 * `text-studio-text`, `ring-studio-ring`, …) and by the layout primitives in
 * `../layout`. Defining the roles in TypeScript keeps them verifiable: the
 * accompanying tests assert that every text role clears WCAG AA contrast on
 * every navy surface and that the focus-visible ring clears 3:1 against every
 * surface (Req 11.1, 11.10).
 */

/** Palette role names required by Requirement 11.1. */
export type StudioPaletteRole =
  | 'base'
  | 'surface'
  | 'surfaceRaised'
  | 'text'
  | 'textMuted'
  | 'accent'
  | 'accentForeground'
  | 'border'
  | 'ring'
  | 'success'
  | 'warning'
  | 'error';

/** An HSL triple: hue in degrees, saturation and lightness in percent. */
export interface StudioHsl {
  h: number;
  s: number;
  l: number;
}

/**
 * The deep-navy palette. Surfaces stay in the 215–222° navy band with low
 * lightness; text and status roles are lifted until they clear AA contrast on
 * the darkest and lightest navy surface alike.
 */
export const STUDIO_PALETTE: Readonly<Record<StudioPaletteRole, StudioHsl>> = Object.freeze({
  /** Page canvas — the deepest navy. */
  base: { h: 220, s: 47, l: 7 },
  /** Cards, panels, and section shells sitting on the canvas. */
  surface: { h: 219, s: 42, l: 11 },
  /** Nested/raised surfaces (hovered rows, popovers, media frames). */
  surfaceRaised: { h: 218, s: 38, l: 16 },
  /** Primary body and heading text. */
  text: { h: 210, s: 40, l: 98 },
  /** Secondary text: labels, captions, metadata. */
  textMuted: { h: 213, s: 28, l: 76 },
  /** Interactive accent (primary actions, active navigation). */
  accent: { h: 199, s: 89, l: 64 },
  /** Text/icon color placed on top of the accent. */
  accentForeground: { h: 220, s: 60, l: 8 },
  /** Hairlines and dividers between navy surfaces. */
  border: { h: 217, s: 30, l: 26 },
  /** Focus-visible ring — must clear 3:1 against every navy surface. */
  ring: { h: 195, s: 95, l: 70 },
  success: { h: 152, s: 62, l: 60 },
  warning: { h: 38, s: 94, l: 64 },
  error: { h: 4, s: 88, l: 68 },
});

/** Roles that content is rendered on top of. */
export const STUDIO_SURFACE_ROLES: readonly StudioPaletteRole[] = Object.freeze([
  'base',
  'surface',
  'surfaceRaised',
]);

/** Roles rendered as text or icons on a studio surface. */
export const STUDIO_TEXT_ROLES: readonly StudioPaletteRole[] = Object.freeze([
  'text',
  'textMuted',
  'success',
  'warning',
  'error',
]);

/** WCAG AA minimum contrast ratio for body text. */
export const STUDIO_TEXT_CONTRAST_MIN = 4.5;
/** WCAG AA minimum contrast ratio for non-text indicators (focus rings, borders of controls). */
export const STUDIO_NON_TEXT_CONTRAST_MIN = 3;

/** `--studio-{kebab-role}` custom-property name for a palette role. */
export function studioCssVariableName(role: StudioPaletteRole): string {
  return `--studio-${role.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}

/** Tailwind-compatible `H S% L%` channel string for a role. */
export function studioHslChannels(role: StudioPaletteRole): string {
  const { h, s, l } = STUDIO_PALETTE[role];
  return `${h} ${s}% ${l}%`;
}

/** The full `--studio-*` custom-property map, ready to spread into a style attribute. */
export function studioCssVariables(): Record<string, string> {
  return (Object.keys(STUDIO_PALETTE) as StudioPaletteRole[]).reduce<Record<string, string>>(
    (vars, role) => {
      vars[studioCssVariableName(role)] = studioHslChannels(role);
      return vars;
    },
    {},
  );
}

/** Converts an HSL triple to sRGB channels in the 0–1 range. */
export function hslToRgb({ h, s, l }: StudioHsl): [number, number, number] {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = (((h % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness - chroma / 2;

  const [r, g, b] =
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return [r + match, g + match, b + match];
}

/** WCAG relative luminance of an HSL color. */
export function relativeLuminance(color: StudioHsl): number {
  const [r, g, b] = hslToRgb(color).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two palette colors (1–21). */
export function contrastRatio(a: StudioHsl, b: StudioHsl): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Contrast ratio between two palette roles. */
export function roleContrastRatio(a: StudioPaletteRole, b: StudioPaletteRole): number {
  return contrastRatio(STUDIO_PALETTE[a], STUDIO_PALETTE[b]);
}

export default STUDIO_PALETTE;
