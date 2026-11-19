import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PublicTourData } from '../publicTourData';
import type { PublicTourPalette } from './landorPalettes';

/**
 * Lazy layouts adapted from purchased templates. Landor Signature came first, so
 * the registry keeps its name; Ofen and Maison share its routing and settings list.
 */
export type LandorStyleId = 'landor' | 'ofen' | 'maison';

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
  { id: 'ofen', label: 'Ofen', source: 'Ofen listings/[slug] detail page', description: 'Quiet editorial listing page with a photo mosaic and fact sheet' },
  { id: 'maison', label: 'Maison', source: 'Maison property-detail.html', description: 'Cream and navy luxury layout with serif headings' },
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
  ofen: () => import('../ofen/OfenTour').then((module) => ({ default: module.OfenTour as ComponentType<LandorThemeProps> })),
  maison: () => import('../maison/MaisonTour').then((module) => ({ default: module.MaisonTour as ComponentType<LandorThemeProps> })),
};

export const landorThemeLoaders = loaders;

export function lazyLandorTheme(styleId: LandorStyleId): LazyExoticComponent<ComponentType<LandorThemeProps>> {
  return lazy(loaders[styleId] ?? loaders.landor);
}
