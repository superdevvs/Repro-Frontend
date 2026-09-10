import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PublicTourData } from '../publicTourData';
import type { PublicTourPalette } from './landorPalettes';

export type LandorStyleId =
  | 'landor'
  | 'landor-estate'
  | 'landor-solid'
  | 'landor-beyond'
  | 'landor-vision'
  | 'landor-leader'
  | 'landor-living';

export type LandorThemeMeta = {
  id: LandorStyleId;
  label: string;
  source: string;
  description: string;
};

export type LandorThemeProps = { data: PublicTourData; palette?: PublicTourPalette };

export const LANDOR_THEMES: LandorThemeMeta[] = [
  { id: 'landor', label: 'Signature', source: 'index.html / project-details.html', description: 'Classic property-details banner layout' },
  { id: 'landor-estate', label: 'Estate', source: 'index-2.html', description: 'Full-bleed overlay hero with split title' },
  { id: 'landor-solid', label: 'Solid', source: 'index-3.html', description: 'Solid hero panel with badge and growth headline' },
  { id: 'landor-beyond', label: 'Beyond', source: 'index-4.html', description: 'Gray banner hero with oversized typography' },
  { id: 'landor-vision', label: 'Vision', source: 'index-5.html', description: 'Multi-slide hero carousel' },
  { id: 'landor-leader', label: 'Leader', source: 'index-6.html', description: 'Video-backed solid hero with fact strip' },
  { id: 'landor-living', label: 'Living', source: 'index-7.html', description: 'Centered sustainable living hero' },
];

export const LANDOR_STYLE_IDS = LANDOR_THEMES.map((theme) => theme.id) as LandorStyleId[];

export function landorThemeLabel(styleId: string): string {
  const match = LANDOR_THEMES.find((theme) => theme.id === styleId);
  if (match) return match.label;
  const cleaned = styleId.replace(/^landor-?/, '').replace(/-/g, ' ');
  return cleaned ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Signature';
}

const loaders: Record<LandorStyleId, () => Promise<{ default: ComponentType<LandorThemeProps> }>> = {
  landor: () => import('./LandorTour').then((module) => ({ default: module.LandorTour as ComponentType<LandorThemeProps> })),
  'landor-estate': () => import('./landorThemes/EstateTour'),
  'landor-solid': () => import('./landorThemes/SolidTour'),
  'landor-beyond': () => import('./landorThemes/BeyondTour'),
  'landor-vision': () => import('./landorThemes/VisionTour'),
  'landor-leader': () => import('./landorThemes/LeaderTour'),
  'landor-living': () => import('./landorThemes/LivingTour'),
};

export const landorThemeLoaders = loaders;

export function lazyLandorTheme(styleId: LandorStyleId): LazyExoticComponent<ComponentType<LandorThemeProps>> {
  return lazy(loaders[styleId]);
}
