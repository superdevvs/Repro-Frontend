import { LANDOR_STYLE_IDS, LEGACY_LANDOR_STYLE_IDS, type LandorStyleId } from './landor/landorRegistry';
import { resolvePublicTourPalette, type PublicTourPalette } from './landor/landorPalettes';

export type PublicTourStyle = 'default' | 'neo' | 'homeify' | LandorStyleId;
export type { PublicTourPalette, LandorStyleId };
export { resolvePublicTourPalette };

const PREVIEW_STYLES = new Set<string>(['homeify', ...LANDOR_STYLE_IDS]);
const SAVED_STYLES = new Set<string>(['neo', 'homeify', ...LANDOR_STYLE_IDS]);
const LEGACY_LANDOR = new Set<string>(LEGACY_LANDOR_STYLE_IDS);

/** Coerce removed Landor home ids to Signature before allow-list checks. */
function coerceStyleCandidate(style: unknown): string | null {
  if (typeof style !== 'string') return null;
  if (LEGACY_LANDOR.has(style)) return 'landor';
  return style;
}

export function isLandorTourStyle(style: unknown): style is LandorStyleId {
  return typeof style === 'string' && (LANDOR_STYLE_IDS as readonly string[]).includes(style);
}

/** Preview choices are explicit so arbitrary query values never select a component. */
export function resolvePublicTourStyle(savedStyle: unknown, previewStyle: unknown): PublicTourStyle {
  const preview = coerceStyleCandidate(previewStyle);
  if (preview && PREVIEW_STYLES.has(preview)) return preview as PublicTourStyle;
  const saved = coerceStyleCandidate(savedStyle);
  if (saved && SAVED_STYLES.has(saved)) return saved as PublicTourStyle;
  return 'default';
}
