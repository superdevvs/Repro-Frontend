import { describe, expect, it } from 'vitest';
import { sentenceDraftIssue, sentenceVisitLines } from './bookingSentenceModel';
import type { BookShootController } from '@/pages/useBookShootController';

function fixture(changes: Partial<BookShootController> = {}) {
  return {
    client: '101', isClientAccount: false, address: '123 QA Main St', city: 'Rockville', state: 'MD', zip: '20850',
    selectedServices: [{ id: 'photo', name: 'Photos', price: 100, description: '', photographer_required: true, shoot_duration_minutes: 45 }, { id: 'video', name: 'Video', price: 200, description: '', photographer_required: true, shoot_duration_minutes: 60 }],
    canCreateNoProductShoot: false, date: new Date(2026, 9, 23), time: '13:00', photographer: '201',
    servicePhotographers: { video: '202' }, serviceSchedules: { video: { date: '2026-10-24', time: '15:00', duration_minutes: 75 } },
    photographers: [{ id: '201', name: 'QA One' }, { id: '202', name: 'QA Two' }], propertySqft: 1500, propertyDetails: { aptSuite: '333', presenceOption: 'lockbox' },
    unitBooking: { enabled: false }, ...changes,
  } as BookShootController;
}

describe('sentence booking draft and itinerary', () => {
  it('keeps separate service dates, photographers and duration overrides', () => {
    const lines = sentenceVisitLines(fixture());
    expect(lines[0]).toMatchObject({ name: 'Photos', date: '2026-10-23', time: '13:00', person: 'QA One', duration: 45, unit: '333' });
    expect(lines[1]).toMatchObject({ name: 'Video', date: '2026-10-24', time: '15:00', person: 'QA Two', duration: 75 });
    expect(sentenceDraftIssue(fixture())).toBeNull();
  });
  it('directs missing details to a usable panel without submitting', () => {
    expect(sentenceDraftIssue(fixture({ address: ' ' }))?.section).toBe('property');
    expect(sentenceDraftIssue(fixture({ selectedServices: [] }))?.section).toBe('services');
    expect(sentenceDraftIssue(fixture({ photographer: '', servicePhotographers: {} }))?.section).toBe('schedule');
  });
  it('does not invent a photographer or travel duration for editing-only services', () => {
    const c = fixture({ photographer: '', selectedServices: [{ id: 'edit', name: 'Editing', description: '', price: 25, photographer_required: false, quantity: 3, duration_minutes: 60 }] });
    expect(sentenceVisitLines(c)[0]).toMatchObject({ person: 'No on-site photographer', duration: 0, quantity: 3 });
    expect(sentenceDraftIssue(c)).toBeNull();
  });
  it('keeps the wizard property and access validation when fields are edited freely', () => {
    expect(sentenceDraftIssue(fixture({ propertySqft: null }))?.message).toBe('Square footage is required');
    expect(sentenceDraftIssue(fixture({ state: 'Maryland' }))?.section).toBe('property');
    expect(sentenceDraftIssue(fixture({ propertyDetails: { bedrooms: -1 } }))?.section).toBe('property');
    expect(sentenceDraftIssue(fixture({ propertyDetails: {} }))).toEqual({ section: 'services', message: 'Choose who will be at the property.' });
  });
  it('shows independent repeated services across units and validates every unit', () => {
    const c = fixture();
    c.unitBooking = { enabled: true, catalog: c.selectedServices,
      draft: { units: [{ client_key: 'u1', label: '333' }, { client_key: 'u2', label: '334' }] },
      propertyErrors: {}, errors: {}, schedule: { errors: [], lines: [
        { client_key: 'l1', service_id: 'photo', unit_client_key: 'u1', scheduled_date: '2026-10-23', start_time: '13:00', photographer_id: '201', duration: 45, quantity: 1 },
        { client_key: 'l2', service_id: 'photo', unit_client_key: 'u2', scheduled_date: '2026-10-24', start_time: '14:00', photographer_id: '202', duration: 60, quantity: 2 },
      ] },
    } as BookShootController['unitBooking'];
    expect(sentenceVisitLines(c)).toEqual([
      expect.objectContaining({ unit: '333', time: '13:00', person: 'QA One', quantity: 1 }),
      expect.objectContaining({ unit: '334', time: '14:00', person: 'QA Two', quantity: 2 }),
    ]);
    expect(sentenceDraftIssue(c)).toBeNull();
    c.unitBooking.schedule.errors = ['334: overlaps another unit'];
    expect(sentenceDraftIssue(c)).toEqual({ section: 'schedule', message: '334: overlaps another unit' });
  });
});
