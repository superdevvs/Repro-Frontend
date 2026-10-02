import { describe, expect, it } from 'vitest';
import { hydrateBookedServiceSelection, restoreCachedServiceQuantities, syncDraftServiceDurations } from './bookShootServiceSelection';
import { resolveSelectedServiceSubtotal, type ServicePackage } from './bookShootModel';
import { resolveServiceShootDuration } from '@/utils/shootDuration';

const catalog: ServicePackage[] = [{ id: '7', name: '10 Photos', description: '', price: 100, quantity: 10,
  allow_multiple: true, pricing_type: 'variable', sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, price: 125, duration: 60, photographer_pay: 40 }] }];

describe('booking quantity and price snapshots', () => {
  it('refreshes duration tiers without replacing cached tier pricing or changing booked snapshots', () => {
    const cached = { ...catalog[0], shoot_duration_minutes: 60, quantity: 3 };
    const current = { ...catalog[0], price: 200, shoot_duration_minutes: 15,
      sqft_ranges: [{ sqft_from: 1, sqft_to: 1500, duration: 15, price: 200, photographer_pay: 80 },
        { sqft_from: 1501, sqft_to: 3000, duration: 30, price: 250, photographer_pay: 100 }] };
    const [synced] = syncDraftServiceDurations([cached], [current]);
    expect(resolveServiceShootDuration(synced, 1000)).toBe(15);
    expect(resolveServiceShootDuration(synced, 2467)).toBe(30);
    expect(synced.sqft_ranges).toBe(cached.sqft_ranges);
    expect(synced).toMatchObject({ price: 100, quantity: 3 });
    expect(resolveSelectedServiceSubtotal(synced, 1000)).toBe(375);
    expect(syncDraftServiceDurations([synced], [current])[0]).toBe(synced);
    const [booked] = hydrateBookedServiceSelection([current], { service_items: [{ service_id: 7, duration_minutes: 60, price: 90 }] });
    expect(resolveServiceShootDuration(booked, 1000)).toBe(60);
  });

  it('migrates pre-quantity drafts without mistaking package photo counts for ordered multiples', () => {
    expect(restoreCachedServiceQuantities(catalog, undefined)[0].quantity).toBe(1);
    expect(restoreCachedServiceQuantities([{ ...catalog[0], quantity: 3 }], 1)[0].quantity).toBe(3);
  });
  it('hydrates booked quantities and unit prices without reusing catalog deliverable counts', () => {
    const [service] = hydrateBookedServiceSelection(catalog, {
      services: [{ id: 7, quantity: 10, pivot: { quantity: 2, price: 90 } }],
      service_items: [{ service_id: 7, quantity: 3, price: 80 }],
    });
    expect(service).toMatchObject({ quantity: 3, price: 80, booked_price: 80 });
    expect(resolveSelectedServiceSubtotal(service, 1000)).toBe(240);
    expect(resolveSelectedServiceSubtotal({ ...service, quantity: 4 }, 1000)).toBe(320);
  });

  it('keeps booked quantities when catalog multiples are later disabled and defaults legacy counts to one', () => {
    const [saved] = hydrateBookedServiceSelection([{ ...catalog[0], allow_multiple: false }], {
      service_items: [{ service_id: 7, quantity: 2, price: 70 }],
    });
    expect(saved).toMatchObject({ quantity: 2, allow_multiple: false });
    expect(resolveSelectedServiceSubtotal(saved, 1000)).toBe(140);
    expect(hydrateBookedServiceSelection(catalog, { services: [{ id: 7, quantity: 10 }] })[0].quantity).toBe(1);
  });

  it('prices a new variable service per item while keeping independent-unit aggregates intact', () => {
    expect(resolveSelectedServiceSubtotal({ ...catalog[0], quantity: 3 }, 1000)).toBe(375);
    expect(resolveSelectedServiceSubtotal({ ...catalog[0], quantity: 5, total_price: 650 }, 1000)).toBe(650);
  });
});
