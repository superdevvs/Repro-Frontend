export type PublicTourPalette = 'repro' | 'navy' | 'charcoal' | 'sand' | 'emerald';

export const PUBLIC_TOUR_PALETTES: { id: PublicTourPalette; label: string }[] = [
  { id: 'repro', label: 'RePro red' },
  { id: 'navy', label: 'Navy' },
  { id: 'charcoal', label: 'Charcoal' },
  { id: 'sand', label: 'Sand' },
  { id: 'emerald', label: 'Emerald' },
];

const PALETTE_IDS = new Set(PUBLIC_TOUR_PALETTES.map((item) => item.id));

/** Preview query values are allow-listed so unknown palette names never tint the tour. */
export function resolvePublicTourPalette(saved: unknown, preview: unknown): PublicTourPalette {
  if (typeof preview === 'string' && PALETTE_IDS.has(preview as PublicTourPalette)) return preview as PublicTourPalette;
  if (typeof saved === 'string' && PALETTE_IDS.has(saved as PublicTourPalette)) return saved as PublicTourPalette;
  return 'repro';
}
