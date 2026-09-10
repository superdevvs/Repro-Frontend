export type PublicTourStyle = 'default' | 'neo' | 'homeify' | 'landor';

/** Preview choices are explicit so arbitrary query values never select a component. */
export function resolvePublicTourStyle(savedStyle: unknown, previewStyle: unknown): PublicTourStyle {
  if (previewStyle === 'homeify' || previewStyle === 'landor') return previewStyle;
  if (savedStyle === 'neo' || savedStyle === 'homeify' || savedStyle === 'landor') return savedStyle;
  return 'default';
}
