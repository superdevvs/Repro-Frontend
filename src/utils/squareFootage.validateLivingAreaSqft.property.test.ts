// Property-based + unit test for the Square_Footage_Validator.
//
// Feature: booking-scheduling-fixes, Property 11: Square footage accepts only
// plausible living area within a configurable threshold.
//
// Property 11 states: for any autocomplete-provided value and any configured
// plausibility threshold, the value is applied to pricing if and only if it is
// a recognized living-area field with a known unit, converted to square feet
// (square metres explicitly converted), and within the configurable threshold;
// lot-area values are never substituted for living area, a legitimate large
// value is accepted whenever the configured threshold permits it (not rejected
// by a hard-coded universal cap), and when no plausible living-area value
// exists the square-footage field is left blank for manual entry with pricing
// input unchanged.
//
// The contract is realized by the pure validator from task 7.1:
//   validateLivingAreaSqft(field, config)
//     -> { sqft }            (apply to pricing)
//     -> { rejected, reason} (out of the configurable range; do NOT apply)
//     -> { manualEntry }     (no plausible living-area value; leave blank)
//
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  validateLivingAreaSqft,
  SQM_TO_SQFT,
  type LivingAreaSqftConfig,
  type LivingAreaSqftResult,
} from '@/utils/squareFootage';
import { DEFAULT_LIVING_AREA_SQFT_CONFIG } from '@/config/squareFootageDefaults';

// --- Result narrowing helpers -------------------------------------------------

const isAccepted = (r: LivingAreaSqftResult): r is { sqft: number } =>
  'sqft' in r;
const isRejected = (r: LivingAreaSqftResult): r is { rejected: true; reason: string } =>
  'rejected' in r;
const isManual = (r: LivingAreaSqftResult): r is { manualEntry: true } =>
  'manualEntry' in r;

// --- Token vocabularies -------------------------------------------------------

// Living/finished building-area type labels recognized by the validator. The
// empty label is also valid (it skips the type check and is treated as a
// candidate living-area value).
const LIVING_AREA_TYPES = [
  '',
  'Living Building Area',
  'Living Area',
  'Finished',
  'Finished Area',
  'Floor Area',
  'Gross Building Area',
  'Interior',
  'Heated Area',
];

// Lot/parcel labels that must NEVER be substituted for living area.
const LOT_AREA_TYPES = ['Lot Size', 'Lot', 'Parcel', 'Parcel Area', 'Acreage', 'Acres'];

// Recognized-but-non-living / unknown type labels => manual entry.
const UNKNOWN_AREA_TYPES = ['Frontage', 'Description', 'Random Label', 'Garage', 'Basement'];

// Square-foot and square-metre unit tokens accepted by the validator.
const SQFT_UNITS = ['sqft', 'sf', 'ft2', 'ft²', 'sq ft', 'square feet'];
const SQM_UNITS = ['m2', 'm²', 'sqm', 'sq m', 'square meters', 'square metres'];

// Explicit but unrecognized units => the value cannot be trusted.
const UNKNOWN_UNITS = ['miles', 'km', 'kg', 'parsecs', 'banana', 'acres'];

// --- Config generator ---------------------------------------------------------

// A configurable plausibility threshold. The upper bound spans well beyond any
// hard-coded universal cap so the "legitimate large estate" case is exercised.
const configArb: fc.Arbitrary<LivingAreaSqftConfig> = fc
  .record({
    min: fc.integer({ min: 50, max: 500 }),
    span: fc.integer({ min: 5_000, max: 2_000_000 }),
  })
  .map(({ min, span }) => ({ min, plausibleMax: min + span }));

const livingTypeArb = fc.constantFrom(...LIVING_AREA_TYPES);
const sqftUnitArb = fc.constantFrom(...SQFT_UNITS);
const sqmUnitArb = fc.constantFrom(...SQM_UNITS);

describe('Square_Footage_Validator — Property 11 (configurable living-area threshold)', () => {
  it('accepts an in-range living-area value supplied in square feet (Req 8.1, 8.4, 8.5)', () => {
    fc.assert(
      fc.property(
        configArb,
        livingTypeArb,
        sqftUnitArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (config, areaType, unit, frac) => {
          // Pick an integer square-foot value strictly inside [min, plausibleMax].
          const lo = config.min;
          const hi = config.plausibleMax;
          const value = Math.round(lo + frac * (hi - lo));
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isAccepted(result)).toBe(true);
          if (isAccepted(result)) {
            // No conversion for sqft units; value applied verbatim (rounded).
            expect(result.sqft).toBe(Math.round(value));
            expect(result.sqft).toBeGreaterThanOrEqual(config.min);
            expect(result.sqft).toBeLessThanOrEqual(config.plausibleMax);
          }
        },
      ),
    );
  });

  it('converts square metres to square feet via SQM_TO_SQFT and accepts when in range (Req 8.3)', () => {
    fc.assert(
      fc.property(
        configArb,
        livingTypeArb,
        sqmUnitArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (config, areaType, unit, frac) => {
          // Choose a square-metre value whose converted+rounded square footage
          // sits safely inside the configured range (with a small margin so
          // floating-point rounding never crosses the boundary).
          const loSqm = Math.ceil((config.min + 5) / SQM_TO_SQFT);
          const hiSqm = Math.floor((config.plausibleMax - 5) / SQM_TO_SQFT);
          // Guard: the range must be non-empty for the generated config.
          if (hiSqm <= loSqm) return; // pre-condition not satisfiable; skip
          const value = Math.round(loSqm + frac * (hiSqm - loSqm));
          const expected = Math.round(value * SQM_TO_SQFT);
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isAccepted(result)).toBe(true);
          if (isAccepted(result)) {
            expect(result.sqft).toBe(expected);
          }
        },
      ),
    );
  });

  it('never substitutes lot / parcel / acre area for living area (Req 8.2)', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.constantFrom(...LOT_AREA_TYPES),
        fc.oneof(sqftUnitArb, sqmUnitArb),
        fc.double({ min: 1, max: 5_000_000, noNaN: true }),
        (config, areaType, unit, value) => {
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          // Lot area is dropped to manual entry — it is never applied to pricing.
          expect(isManual(result)).toBe(true);
        },
      ),
    );
  });

  it('rejects living-area values outside the configurable threshold (Req 8.4, 8.5)', () => {
    fc.assert(
      fc.property(
        configArb,
        livingTypeArb,
        sqftUnitArb,
        fc.boolean(),
        fc.double({ min: 1, max: 5_000_000, noNaN: true }),
        (config, areaType, unit, tooHigh, magnitude) => {
          // Build a value that is clearly outside [min, plausibleMax] in sqft.
          let value: number;
          if (tooHigh) {
            value = config.plausibleMax + 1 + Math.round(magnitude);
          } else {
            // Below the floor. If min <= 1 there is no positive value below the
            // floor, so force the high case instead.
            if (config.min <= 1) {
              value = config.plausibleMax + 1 + Math.round(magnitude);
            } else {
              value = Math.max(1, config.min - 1 - Math.round((magnitude / 5_000_000) * (config.min - 1)));
            }
          }
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isRejected(result)).toBe(true);
          if (isRejected(result)) {
            expect(typeof result.reason).toBe('string');
            expect(result.reason.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });

  it('falls back to manual entry for an explicit but unrecognized unit (Req 8.1, 8.6)', () => {
    fc.assert(
      fc.property(
        configArb,
        livingTypeArb,
        fc.constantFrom(...UNKNOWN_UNITS),
        fc.double({ min: 1, max: 100_000, noNaN: true }),
        (config, areaType, unit, value) => {
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isManual(result)).toBe(true);
        },
      ),
    );
  });

  it('falls back to manual entry for a recognized-but-non-living / unknown area type (Req 8.2, 8.6)', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.constantFrom(...UNKNOWN_AREA_TYPES),
        fc.oneof(sqftUnitArb, sqmUnitArb),
        fc.double({ min: 1, max: 100_000, noNaN: true }),
        (config, areaType, unit, value) => {
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isManual(result)).toBe(true);
        },
      ),
    );
  });

  it('falls back to manual entry when no numeric value exists (Req 8.6)', () => {
    fc.assert(
      fc.property(
        configArb,
        livingTypeArb,
        sqftUnitArb,
        fc.constantFrom<number | string | null>(null, '', 'not-a-number', NaN, 0, -10),
        (config, areaType, unit, value) => {
          const result = validateLivingAreaSqft({ areaType, unit, value }, config);
          expect(isManual(result)).toBe(true);
        },
      ),
    );
  });
});

// --- Canonical example unit tests --------------------------------------------

describe('Square_Footage_Validator — canonical examples', () => {
  const config = DEFAULT_LIVING_AREA_SQFT_CONFIG;

  it('exposes the explicit square-metre conversion factor', () => {
    expect(SQM_TO_SQFT).toBeCloseTo(10.7639, 4);
  });

  it('accepts a plausible living area in square feet', () => {
    expect(validateLivingAreaSqft({ areaType: 'Living Area', unit: 'sqft', value: 2400 }, config)).toEqual({
      sqft: 2400,
    });
  });

  it('converts square metres to square feet (200 m² => 2153 ft²)', () => {
    expect(validateLivingAreaSqft({ areaType: 'Living Area', unit: 'm2', value: 200 }, config)).toEqual({
      sqft: Math.round(200 * SQM_TO_SQFT),
    });
  });

  it('accepts a legitimate large estate when the configured threshold permits it', () => {
    const generous: LivingAreaSqftConfig = { min: 100, plausibleMax: 500_000 };
    expect(validateLivingAreaSqft({ areaType: 'Living Area', unit: 'sqft', value: 250_000 }, generous)).toEqual({
      sqft: 250_000,
    });
  });

  it('never substitutes lot area for living area', () => {
    expect(validateLivingAreaSqft({ areaType: 'Lot Size', unit: 'sqft', value: 43_560 }, config)).toEqual({
      manualEntry: true,
    });
  });

  it('rejects an implausibly large living-area value under the default threshold', () => {
    const result = validateLivingAreaSqft({ areaType: 'Living Area', unit: 'sqft', value: 5_000_000 }, config);
    expect(isRejected(result)).toBe(true);
  });
});
