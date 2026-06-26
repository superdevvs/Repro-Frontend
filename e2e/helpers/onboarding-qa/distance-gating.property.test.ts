// Property-based + unit tests for deterministic distance-gating (`service-radius.e2e.ts`).
//
// Feature: photographer-onboarding-qa, Property 3: Distance-gating monotonicity across
// inside/boundary/outside.
//
// For ANY photographer Service_Radius (including zero, negative/"empty", and very-large), and ANY
// seeded address whose distance from the shared ANCHOR is computed via the backend-mirrored
// {@link haversineMiles}, the photographer is offered IF AND ONLY IF the address's distance is
// within the Service_Radius, with the documented inclusive boundary rule applied consistently and
// the documented exception that a radius of zero (or less) offers NOBODY. The gating decision is
// additionally MONOTONIC in distance (closer is never worse) and UNIT-CONSISTENT (the decision is
// invariant under expressing both distance and radius in the same unit, e.g. miles ↔ kilometers).
//
// The unit under test is the EXACT `isOffered(distanceMiles, radiusMiles)` predicate replicated
// from `frontend/e2e/onboarding/service-radius.e2e.ts` so the property exercises the real gating
// rule rather than a paraphrase of it.
//
// Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 23.3

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ANCHOR, haversineMiles, type LatLng } from './seeded-address';

// ---------------------------------------------------------------------------
// Unit under test — replicated EXACTLY from service-radius.e2e.ts
// ---------------------------------------------------------------------------

/**
 * Documented boundary rule (Req 8.4): distance == radius is treated as INSIDE (offered). The
 * gating predicate is therefore inclusive — `offered ⇔ distance <= radius` — and a radius of zero
 * (Req 8.7) is the documented exception that offers NOBODY, even at distance 0.
 */
const BOUNDARY_INCLUSIVE = true;

/**
 * Floating-point epsilon (miles) so a distance that equals the radius to floating-point precision
 * is treated as ON the boundary. Replicated verbatim from the spec module.
 */
const BOUNDARY_EPSILON_MILES = 1e-6;

/** The inclusive-by-default gating predicate; zero/negative radius offers nobody (Req 8.7). */
function isOffered(distanceMiles: number, radiusMiles: number): boolean {
  if (radiusMiles <= 0) {
    return false; // Req 8.7 — zero radius offers nobody, even at distance 0.
  }
  return BOUNDARY_INCLUSIVE
    ? distanceMiles <= radiusMiles + BOUNDARY_EPSILON_MILES
    : distanceMiles < radiusMiles - BOUNDARY_EPSILON_MILES;
}

// ---------------------------------------------------------------------------
// Reference oracle for the documented rule
// ---------------------------------------------------------------------------

/**
 * The documented gating rule expressed independently of the predicate's implementation:
 * `offered ⇔ (radius > 0 AND distance <= radius)`. The predicate's `BOUNDARY_EPSILON_MILES` is a
 * floating-point tolerance for the EXACT-boundary case only; the property generators avoid the
 * razor-thin `(radius, radius + epsilon]` band (see {@link AMBIGUITY_GUARD_MILES}) so the predicate
 * and this oracle agree exactly, giving the iff real teeth without floating-point flakiness.
 */
function offeredByRule(distanceMiles: number, radiusMiles: number): boolean {
  return radiusMiles > 0 && distanceMiles <= radiusMiles;
}

/**
 * Distances within this band of the radius are excluded from the strict-iff property: it is the
 * only region where the predicate's epsilon tolerance and the exact documented rule can disagree.
 * Far smaller than the documented 1-decimal rounding precision, so excluding it never weakens the
 * genuinely-inside / genuinely-outside coverage. The dedicated boundary tests below cover
 * distance == radius explicitly.
 */
const AMBIGUITY_GUARD_MILES = 1e-3;

/** Statute miles → kilometers, for the unit-consistency property (Req 8.6). */
const KM_PER_MILE = 1.60934;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Radii spanning the documented input space: zero (offers nobody, Req 8.7), negative (the
 * "empty"/unset sentinel that also offers nobody under the predicate), ordinary positive radii
 * (the persona radii 5/25 plus a continuous range), and a very-large radius (Req 8.9).
 */
const radiusArb = fc.oneof(
  fc.constantFrom(0, -1, -25, 5, 25),
  fc.double({ min: 0.1, max: 500, noNaN: true, noDefaultInfinity: true }),
  fc.constantFrom(100, 1_000, 100_000), // very-large radii (Req 8.9)
);

/**
 * Seeded coordinates near the shared ANCHOR. Offsetting latitude/longitude by up to ±3 degrees
 * yields great-circle distances from ~0 up to a few hundred miles via {@link haversineMiles}, so
 * generated addresses straddle inside / boundary / outside for the generated radii.
 */
const coordinateArb: fc.Arbitrary<LatLng> = fc
  .record({
    dLat: fc.double({ min: -3, max: 3, noNaN: true, noDefaultInfinity: true }),
    dLng: fc.double({ min: -3, max: 3, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ dLat, dLng }) => ({ lat: ANCHOR.lat + dLat, lng: ANCHOR.lng + dLng }));

// ---------------------------------------------------------------------------
// Property 3
// ---------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 3: Distance-gating monotonicity across inside/boundary/outside', () => {
  it('offers a photographer IFF the seeded address distance is within the Service_Radius (radius<=0 offers nobody)', () => {
    fc.assert(
      fc.property(radiusArb, coordinateArb, (radius, coord) => {
        const distance = haversineMiles(ANCHOR, coord);

        // Skip only the razor-thin band where the epsilon tolerance and the exact rule may differ
        // for a positive radius; everywhere else the predicate must equal the documented rule.
        fc.pre(radius <= 0 || Math.abs(distance - radius) > AMBIGUITY_GUARD_MILES);

        expect(isOffered(distance, radius)).toBe(offeredByRule(distance, radius));
      }),
      { numRuns: 200 },
    );
  });

  it('is monotonic in distance: if offered at distance d, it is offered at every nearer distance less than d (same radius)', () => {
    fc.assert(
      fc.property(
        radiusArb,
        coordinateArb,
        coordinateArb,
        (radius, coordA, coordB) => {
          const dA = haversineMiles(ANCHOR, coordA);
          const dB = haversineMiles(ANCHOR, coordB);
          const near = Math.min(dA, dB);
          const far = Math.max(dA, dB);

          // Monotonicity: being offered at the farther distance implies being offered at the
          // nearer distance for the same radius (closer is never worse).
          if (isOffered(far, radius)) {
            expect(isOffered(near, radius)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is unit-consistent: the gating decision is invariant under a shared distance/radius unit (miles ↔ km)', () => {
    fc.assert(
      fc.property(radiusArb, coordinateArb, (radius, coord) => {
        const distance = haversineMiles(ANCHOR, coord);

        // Avoid the epsilon-sensitive band: the absolute epsilon does not scale with the unit, so
        // only the exact-boundary neighborhood could differ. Genuinely inside/outside cases must
        // agree regardless of unit.
        fc.pre(radius <= 0 || Math.abs(distance - radius) > AMBIGUITY_GUARD_MILES);

        const inMiles = isOffered(distance, radius);
        const inKm = isOffered(distance * KM_PER_MILE, radius * KM_PER_MILE);
        expect(inKm).toBe(inMiles);
      }),
      { numRuns: 200 },
    );
  });

  // --- Concrete inside / boundary / outside anchors (Truth Table T1/T2, Req 8.4/8.7/8.9) -------

  it('applies the documented inclusive boundary rule: distance == radius is offered for a positive radius', () => {
    for (const radius of [0.5, 5, 25, 100, 100_000]) {
      // Exactly on the boundary → inside (inclusive rule).
      expect(isOffered(radius, radius)).toBe(true);
      // Strictly inside and strictly outside behave as expected.
      expect(isOffered(radius * 0.4, radius)).toBe(true); // inside (T1)
      expect(isOffered(radius * 1.5 + 1, radius)).toBe(false); // outside (T2)
    }
  });

  it('offers nobody when the radius is zero or negative, even at distance 0', () => {
    for (const radius of [0, -1, -25]) {
      expect(isOffered(0, radius)).toBe(false); // Req 8.7 — zero radius offers nobody
      expect(isOffered(3, radius)).toBe(false);
    }
  });

  it('offers a far address under a very-large radius (Req 8.9)', () => {
    expect(isOffered(100, 100_000)).toBe(true);
    expect(isOffered(2_500, 100_000)).toBe(true);
  });
});
