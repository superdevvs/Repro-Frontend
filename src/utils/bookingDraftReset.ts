// Booking-wizard reset helper (the "Book Another Shoot" reset).
//
// Feature: booking-scheduling-fixes, Property 13: Reset returns the wizard to
// its initial state.
// Validates: Requirements 10.1, 10.3, 10.4
//
// This module is the single source of truth for:
//   - the canonical INITIAL booking-wizard draft state (services, dates, times,
//     address fields, photographer, per-service schedules, pricing inputs, and
//     the review/step pointer),
//   - the booking-complete flags reset,
//   - the booking-draft localStorage cache key, and
//   - the navigation target used after "Book Another Shoot".
//
// `BookShoot.tsx` consumes these so the wizard reset and the test below agree on
// exactly one definition. Resetting NEVER touches authentication state
// (auth tokens live under separate localStorage keys and are left intact).

/**
 * localStorage key under which the in-progress booking draft is cached.
 * Resetting removes ONLY this key — never auth tokens.
 */
export const BOOKING_FORM_CACHE_KEY = 'bookShoot_form_cache';

/**
 * Working booking entry route used after a reset. This replaces the broken
 * `/shoots` target whose route-match failure produced console errors on
 * re-entry (Req 10.3).
 */
export const BOOK_ANOTHER_SHOOT_NAV_TARGET = '/book-shoot';

/**
 * Auth-related localStorage keys. Listed here ONLY so the reset can assert it
 * leaves them untouched; the reset itself does not write or remove these.
 */
export const AUTH_STORAGE_KEYS = ['authToken', 'token', 'access_token'] as const;

/**
 * The shape of the resettable booking-wizard draft state. Generic over the
 * selected-service type (`S`) and the per-service schedule map type (`M`) so the
 * BookShoot page can supply its own concrete types.
 */
export interface BookingDraftState<
  S = unknown,
  M extends Record<string, unknown> = Record<string, unknown>,
> {
  client: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  date: Date | undefined;
  time: string;
  photographer: string;
  servicePhotographers: Record<string, string>;
  serviceSchedules: M;
  selectedServices: S[];
  notes: string;
  companyNotes: string;
  photographerNotes: string;
  editorNotes: string;
  bypassPayment: boolean;
  sendNotification: boolean;
  adjustedTotalInput: string;
  step: number;
  propertyDetails: unknown | null;
  propertySqft: number | null;
  formErrors: Record<string, string>;
}

/**
 * The booking-complete flags that are cleared alongside the draft so a fresh
 * wizard does not show the previous completion screen.
 */
export interface BookingCompletionState {
  isComplete: boolean;
  completedBooking: unknown | null;
  createdShootId: string | number | undefined;
}

/**
 * The canonical initial booking-wizard draft state. Every field equals the
 * value a brand-new wizard starts with: empty selections, no dates/times, blank
 * address, no photographer, empty per-service schedules, cleared pricing inputs,
 * and the review/step pointer back at step 1.
 */
export function createInitialBookingDraftState<
  S = unknown,
  M extends Record<string, unknown> = Record<string, unknown>,
>(): BookingDraftState<S, M> {
  return {
    client: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    date: undefined,
    time: '',
    photographer: '',
    servicePhotographers: {},
    serviceSchedules: {} as M,
    selectedServices: [] as S[],
    notes: '',
    companyNotes: '',
    photographerNotes: '',
    editorNotes: '',
    bypassPayment: false,
    sendNotification: true,
    adjustedTotalInput: '',
    step: 1,
    propertyDetails: null,
    propertySqft: null,
    formErrors: {},
  };
}

/** The canonical initial booking-complete flags (no completion shown). */
export function createInitialBookingCompletionState(): BookingCompletionState {
  return {
    isComplete: false,
    completedBooking: null,
    createdShootId: undefined,
  };
}

/**
 * Produce the reset draft state from any prior state.
 *
 * The result equals {@link createInitialBookingDraftState} for every field with
 * one documented exception: when the current session is a client account, the
 * bound `client` value is preserved (a client cannot reassign the booking to
 * another client), matching `BookShoot.clearBookingDraftState`.
 */
export function resetBookingDraftState<
  S = unknown,
  M extends Record<string, unknown> = Record<string, unknown>,
>(
  prev: BookingDraftState<S, M>,
  options: { isClientAccount?: boolean } = {},
): BookingDraftState<S, M> {
  const initial = createInitialBookingDraftState<S, M>();
  if (options.isClientAccount) {
    return { ...initial, client: prev.client };
  }
  return initial;
}

/**
 * Clear ONLY the booking-draft cache from storage, leaving every other key
 * (including auth tokens) intact. Returns nothing; safe when storage is absent.
 */
export function clearBookingFormCache(
  storage: Pick<Storage, 'removeItem'> | null | undefined,
  cacheKey: string = BOOKING_FORM_CACHE_KEY,
): void {
  if (!storage) return;
  storage.removeItem(cacheKey);
}
