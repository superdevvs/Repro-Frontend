import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PublicTourData } from '../publicTourData';
import type { PublicTourPalette } from './landorPalettes';

export type LandorStyleId = 'landor';

export type LandorThemeMeta = {
  id: LandorStyleId;
  label: string;
  source: string;
  description: string;
};

export type LandorThemeProps = { data: PublicTourData; palette?: PublicTourPalette };

/** Removed Landor home themes; resolvePublicTourStyle maps these to Signature (`landor`). */
export const LEGACY_LANDOR_STYLE_IDS = [
  'landor-estate',
  'landor-solid',
  'landor-beyond',
  'landor-vision',
  'landor-leader',
  'landor-living',
] as const;

export const LANDOR_THEMES: LandorThemeMeta[] = [
  { id: 'landor', label: 'Signature', source: 'index.html / project-details.html', description: 'Classic property-details banner layout' },
];

export const LANDOR_STYLE_IDS = LANDOR_THEMES.map((theme) => theme.id) as LandorStyleId[];

export function landorThemeLabel(styleId: string): string {
  const match = LANDOR_THEMES.find((theme) => theme.id === styleId);
  if (match) return match.label;
  if ((LEGACY_LANDOR_STYLE_IDS as readonly string[]).includes(styleId)) return 'Signature';
  const cleaned = styleId.replace(/^landor-?/, '').replace(/-/g, ' ');
  return cleaned ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Signature';
}

const loaders: Record<LandorStyleId, () => Promise<{ default: ComponentType<LandorThemeProps> }>> = {
  landor: () => import('./LandorTour').then((module) => ({ default: module.LandorTour as ComponentType<LandorThemeProps> })),
};

export const landorThemeLoaders = loaders;

export function lazyLandorTheme(styleId: LandorStyleId): LazyExoticComponent<ComponentType<LandorThemeProps>> {
  return lazy(loaders[styleId] ?? loaders.landor);
}
