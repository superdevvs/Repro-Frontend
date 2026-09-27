import type { ShootData, ShootUnit } from '@/types/shoots';
import { projectShootForUnit, getUnitKey } from './shootUnitData';

export const INHERITED_TOUR_SETTINGS = ['tour_style', 'tour_palette', 'header_position', 'tour_version', 'realtor_info', 'realtor_client_id', 'autoplay', 'show_garage'];
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

export function projectUnitTour(shoot: ShootData, unit: ShootUnit, lineIds: { iguide?: string; cubicasa?: string } = {}): ShootData {
  const projected = { ...projectShootForUnit(shoot, getUnitKey(unit)) } as ShootData & Record<string, unknown>;
  const original = record(shoot);
  const unitData = record(unit);
  const buildingLinks = record(original.tourLinks ?? original.tour_links);
  const links = { ...Object.fromEntries(INHERITED_TOUR_SETTINGS.filter(key => key in buildingLinks).map(key => [key, buildingLinks[key]])), ...record(unit.tour_links) };
  for (const key of Object.keys(projected)) {
    if (/^(iguide|cubicasa)/i.test(key)) delete projected[key];
  }
  const provider = { ...record(unitData.provider_data) };
  for (const prefix of ['iguide', 'cubicasa'] as const) {
    const lineId = lineIds[prefix];
    if (!lineId) continue;
    if (provider[`${prefix}_service_line_id`] && String(provider[`${prefix}_service_line_id`]) !== lineId) {
      for (const key of Object.keys(provider)) if (key.startsWith(`${prefix}_`)) delete provider[key];
    }
    const data = record(record(record(unitData.provider_data).lines)[lineId]);
    for (const [key, value] of Object.entries(data)) if (key.startsWith(`${prefix}_`)) provider[key] = value;
  }
  const details = { ...record(unitData.property_details), beds: unit.beds, bedrooms: unit.beds, baths: unit.baths, bathrooms: unit.baths, sqft: unit.sqft, apt_suite: unit.label };
  return { ...projected, ...provider, tourLinks: links, tour_links: links, propertyDetails: details, property_details: details,
    bedrooms: unit.beds, bathrooms: unit.baths, sqft: unit.sqft, mlsId: links.property_mls ?? null, mls_id: links.property_mls ?? null,
    propertyStatus: unitData.property_status ?? 'available', property_status: unitData.property_status ?? 'available',
    listingType: unitData.listing_type ?? shoot.listingType, listing_type: unitData.listing_type ?? shoot.listing_type,
  } as ShootData;
}

export function withTourUnit(url: string, unitId?: string | number | null): string {
  if (!unitId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}unitId=${encodeURIComponent(unitId)}`;
}

export function buildTourUrl(baseUrl: string, shootId: string | number, type: string, links: Record<string, string>, unitId?: string | number): string {
  if (!shootId) return '';
  const query = `shootId=${encodeURIComponent(shootId)}${unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''}`;
  const paths: Record<string, string> = { branded: 'branded', mls: 'mls', genericMls: 'g-mls', video_branded: 'video/branded', video_mls: 'video/mls', video_generic: 'video/generic' };
  if (paths[type]) return `${baseUrl}/tour/${paths[type]}?${query}`;
  const providers: Record<string, [string, string]> = { matterport_branded: ['matterport', 'branded'], matterport_mls: ['matterport', 'mls'], iguide_branded: ['iguide', 'branded'], iguide_mls: ['iguide', 'mls'], zillow_3d: ['zillow', 'branded'] };
  if (providers[type]) return links[type] ? `${baseUrl}/tour/3d/${providers[type][1]}?${query}&provider=${providers[type][0]}` : '';
  return links[type] || '';
}
