import type { DashboardShootServiceTag } from '@/types/dashboard';

export type DeliveryIllustration = 'tour' | 'floorplan' | 'video' | 'drone' | 'photo' | 'media';
export type DeliverySpotlightService = { label: string; illustration: DeliveryIllustration; description: string };

const describeService = (label: string): DeliverySpotlightService | null => {
  const value = label.toLowerCase().replace(/[_-]/g, ' ');
  // Billing-only lines are not deliverables. Do not hide editing services just
  // because their name includes "fee" (e.g. Object removal fee).
  if (/^(?:travel|mileage|rush\b|on\s?site cancellation|cancellation|reschedul|no\s?show|discount|coupon|tax\b)/i.test(value)) return null;
  if (/\bi\s?guide\b/.test(value)) return { label: 'iGUIDE', illustration: 'tour', description: '360° virtual tour' };
  if (/matterport/.test(value)) return { label: 'Matterport', illustration: 'tour', description: '3D property tour' };
  if (/zillow.*3d|3d.*zillow/.test(value)) return { label: 'Zillow 3D', illustration: 'tour', description: '3D property tour' };
  if (/floor\s?plans?|cubicasa/.test(value)) return { label: 'Floor plan', illustration: 'floorplan', description: 'Property layout' };
  if (/virtual tour|3d tour|360.*tour/.test(value)) return { label: 'Virtual tour', illustration: 'tour', description: 'Explore the property' };
  if (/drone|aerial/.test(value)) return { label: /video/.test(value) ? 'Drone video' : 'Drone', illustration: 'drone', description: 'Aerial media' };
  if (/video|reels?|walk\s?(?:through|thru)/.test(value)) return { label: /reel|social|vertical/.test(value) ? 'Social video' : 'Video', illustration: 'video', description: 'Property film' };
  if (/virtual staging|object removal|enhancement|editing|architectural edits/.test(value)) return { label, illustration: 'media', description: 'Property media' };
  if (/photos?|photography|hdr|flash|twilight/.test(value)) return { label: /twilight|dusk/.test(value) ? 'Twilight photos' : 'Photos', illustration: 'photo', description: 'Property photography' };
  return { label, illustration: 'media', description: 'Property media' };
};

/** Summarize the actual catalog tags, including bundles, without inventing services. */
export const getDeliverySpotlightServices = (
  tags: readonly DashboardShootServiceTag[] | null | undefined,
): DeliverySpotlightService[] => {
  const services = new Map<string, DeliverySpotlightService>();
  for (const tag of tags ?? []) {
    if (tag.type?.startsWith('invoice_adjustment_')) continue;
    const label = (tag.label ?? '').replace(/^historical package:\s*/i, '').replace(/&amp;/gi, '&').trim();
    // The catalog includes "Premium iGuide with Floor plans" and
    // "HDR Photos, Video & 3D Matterport" as single booked service lines.
    for (const part of label.split(/\s*(?:\+|&|,|\bwith\b|\band\b|\bw\s*\/)\s*/i)) {
      const clean = part.trim();
      if (!clean) continue;
      const service = describeService(clean);
      if (service && !services.has(service.label.toLowerCase())) {
        services.set(service.label.toLowerCase(), service);
      }
    }
  }
  return [...services.values()];
};

export const getDeliverySpotlightDescription = (services: readonly DeliverySpotlightService[]): string => {
  if (services.length > 2) return `+${services.length - 2} more`;
  if (services.length === 1) return services[0].description;
  if (services.some(service => service.illustration === 'tour') && services.some(service => service.illustration === 'floorplan')) {
    return 'Tour & property layout';
  }
  return 'Property media';
};
