import { LANDOR_STYLE_IDS, type LandorStyleId } from './landor/landorRegistry';
import { resolvePublicTourPalette, type PublicTourPalette } from './landor/landorPalettes';

export type PublicTourStyle = 'default' | 'neo' | 'homeify' | LandorStyleId;
export type { PublicTourPalette, LandorStyleId };
export { resolvePublicTourPalette };

const PREVIEW_STYLES = new Set<string>(['homeify', ...LANDOR_STYLE_IDS]);
const SAVED_STYLES = new Set<string>(['neo', 'homeify', ...LANDOR_STYLE_IDS]);

export function isLandorTourStyle(style: unknown): style is LandorStyleId {
  return typeof style === 'string' && (LANDOR_STYLE_IDS as readonly string[]).includes(style);
}

/** Preview choices are explicit so arbitrary query values never select a component. */
export function resolvePublicTourStyle(savedStyle: unknown, previewStyle: unknown): PublicTourStyle {
  if (typeof previewStyle === 'string' && PREVIEW_STYLES.has(previewStyle)) return previewStyle as PublicTourStyle;
  if (typeof savedStyle === 'string' && SAVED_STYLES.has(savedStyle)) return savedStyle as PublicTourStyle;
  return 'default';
}
