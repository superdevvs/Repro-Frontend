// Clean "Book Another Shoot" reset test (MANDATORY).
//
// Feature: booking-scheduling-fixes, Property 13: Reset returns the wizard to
// its initial state.
// Validates: Requirements 10.1, 10.3, 10.4
//
// "Book Another Shoot" must start a clean booking: for ANY prior wizard state,
// the reset returns selected services, dates, times, address fields,
// photographer, per-service schedules, pricing inputs, and the review/step
// pointer to their initial defaults, while authentication state is left
// untouched. Re-entry must land on a working route ('/book-shoot') rather than
// the broken '/shoots' target that produced console errors on re-entry.
//
// Mounting the full BookShoot page is heavy (many providers/effects). The reset
// behavior is therefore exercised at its most robust level: the pure
// `bookingDraftReset` helpers that BookShoot.tsx itself consumes as the single
// source of truth for the reset shape, the cache key, and the navigation
// target.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  AUTH_STORAGE_KEYS,
  BOOKING_FORM_CACHE_KEY,
  BOOK_ANOTHER_SHOOT_NAV_TARGET,
  clearBookingFormCache,
  createInitialBookingCompletionState,
  createInitialBookingDraftState,
  resetBookingDraftState,
  type BookingDraftState,
} from './bookingDraftReset';

// Concrete stand-ins for the BookShoot generic params.
type Service = { id: string; name: string; price: number };
type ScheduleMap = Record<string, { date?: string; time?: string }>;

// ---- Generators ---------------------------------------------------------

const serviceArb: fc.Arbitrary<Service> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }),
  name: fc.string({ maxLength: 12 }),
  price: fc.integer({ min: 0, max: 100000 }),
});

const scheduleMapArb: fc.Arbitrary<ScheduleMap> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 6 }),
  fc.record({
    date: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
    time: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
  }),
  { maxKeys: 5 },
);

// An arbitrary "dirty" prior wizard state — every resettable field is populated
// with non-default values so the reset has something to clear.
const dirtyStateArb: fc.Arbitrary<BookingDraftState<Service, ScheduleMap>> = fc.record({
  client: fc.string({ minLength: 1, maxLength: 8 }),
  address: fc.string({ minLength: 1, maxLength: 20 }),
  city: fc.string({ minLength: 1, maxLength: 12 }),
  state: fc.string({ minLength: 1, maxLength: 4 }),
  zip: fc.string({ minLength: 1, maxLength: 6 }),
  date: fc.date({ noInvalidDate: true }),
  time: fc.string({ minLength: 1, maxLength: 8 }),
  photographer: fc.string({ minLength: 1, maxLength: 6 }),
  servicePhotographers: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 4 }),
    fc.string({ minLength: 1, maxLength: 4 }),
    { maxKeys: 4 },
  ),
  serviceSchedules: scheduleMapArb,
  selectedServices: fc.array(serviceArb, { minLength: 1, maxLength: 5 }),
  notes: fc.string({ maxLength: 20 }),
  companyNotes: fc.string({ maxLength: 20 }),
  photographerNotes: fc.string({ maxLength: 20 }),
  editorNotes: fc.string({ maxLength: 20 }),
  bypassPayment: fc.boolean(),
  sendNotification: fc.boolean(),
  adjustedTotalInput: fc.string({ maxLength: 8 }),
  step: fc.integer({ min: 1, max: 4 }),
  propertyDetails: fc.option(fc.object(), { nil: null }),
  propertySqft: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: null }),
  formErrors: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 4 }),
    fc.string({ minLength: 1, maxLength: 8 }),
    { maxKeys: 4 },
  ),
});

// ---- Tests --------------------------------------------------------------

describe('Feature: booking-scheduling-fixes, Property 13: "Book Another Shoot" reset returns the wizard to its initial state', () => {
  it('resets every wizard field to its initial default for a non-client session (Req 10.1, 10.4)', () => {
    fc.assert(
      fc.property(dirtyStateArb, (prev) => {
        const reset = resetBookingDraftState(prev, { isClientAccount: false });
        const initial = createInitialBookingDraftState<Service, ScheduleMap>();

        // Whole-state equality: nothing from the prior wizard carries over.
        expect(reset).toEqual(initial);

        // Spell out the acceptance-criteria fields explicitly.
        expect(reset.selectedServices).toEqual([]);
        expect(reset.date).toBeUndefined();
        expect(reset.time).toBe('');
        expect(reset.address).toBe('');
        expect(reset.city).toBe('');
        expect(reset.state).toBe('');
        expect(reset.zip).toBe('');
        expect(reset.photographer).toBe('');
        expect(reset.servicePhotographers).toEqual({});
        expect(reset.serviceSchedules).toEqual({});
        expect(reset.adjustedTotalInput).toBe('');
        expect(reset.bypassPayment).toBe(false);
        expect(reset.propertyDetails).toBeNull();
        expect(reset.propertySqft).toBeNull();
        expect(reset.step).toBe(1);
        expect(reset.formErrors).toEqual({});
      }),
      { numRuns: 300 },
    );
  });

  it('is idempotent: resetting an already-reset state yields the same initial state', () => {
    const once = resetBookingDraftState(createInitialBookingDraftState<Service, ScheduleMap>());
    const twice = resetBookingDraftState(once);
    expect(twice).toEqual(createInitialBookingDraftState<Service, ScheduleMap>());
  });

  it('preserves only the bound client for a client-account session, resetting all other fields', () => {
    fc.assert(
      fc.property(dirtyStateArb, (prev) => {
        const reset = resetBookingDraftState(prev, { isClientAccount: true });
        const initial = createInitialBookingDraftState<Service, ScheduleMap>();

        // Client identity is preserved (a client cannot reassign the booking)...
        expect(reset.client).toBe(prev.client);
        // ...but every other field is back to its initial default.
        expect({ ...reset, client: initial.client }).toEqual(initial);
      }),
      { numRuns: 200 },
    );
  });

  it('clears the booking-complete flags on reset', () => {
    const completion = createInitialBookingCompletionState();
    expect(completion.isComplete).toBe(false);
    expect(completion.completedBooking).toBeNull();
    expect(completion.createdShootId).toBeUndefined();
  });
});

describe('Feature: booking-scheduling-fixes, Property 13: reset leaves authentication untouched (Req 10.4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('removes only the booking-draft cache key and never the auth tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }), // authToken
        fc.string({ minLength: 1, maxLength: 40 }), // token
        fc.string({ minLength: 1, maxLength: 40 }), // access_token
        fc.string({ minLength: 1, maxLength: 60 }), // cached draft
        (authToken, token, accessToken, draft) => {
          localStorage.clear();
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('token', token);
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem(BOOKING_FORM_CACHE_KEY, draft);

          clearBookingFormCache(localStorage);

          // The draft cache is gone...
          expect(localStorage.getItem(BOOKING_FORM_CACHE_KEY)).toBeNull();
          // ...while every auth token is preserved exactly.
          expect(localStorage.getItem('authToken')).toBe(authToken);
          expect(localStorage.getItem('token')).toBe(token);
          expect(localStorage.getItem('access_token')).toBe(accessToken);
          for (const key of AUTH_STORAGE_KEYS) {
            expect(localStorage.getItem(key)).not.toBeNull();
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is safe when storage is unavailable', () => {
    expect(() => clearBookingFormCache(null)).not.toThrow();
    expect(() => clearBookingFormCache(undefined)).not.toThrow();
  });
});

describe('Feature: booking-scheduling-fixes, Property 13: re-entry uses a working route, not the broken /shoots (Req 10.3)', () => {
  it('navigates to the working booking entry point and never to the broken /shoots route', () => {
    expect(BOOK_ANOTHER_SHOOT_NAV_TARGET).toBe('/book-shoot');
    expect(BOOK_ANOTHER_SHOOT_NAV_TARGET).not.toBe('/shoots');
  });

  it('performing the reset produces no console errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const prev = createInitialBookingDraftState<Service, ScheduleMap>();
      resetBookingDraftState({ ...prev, address: '123 Old St', time: '09:30', step: 3 });
      localStorage.setItem(BOOKING_FORM_CACHE_KEY, 'stale');
      clearBookingFormCache(localStorage);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      localStorage.clear();
    }
  });
});
