/**
 * Square_Footage_Validator (Req 8).
 *
 * Validates an autocomplete-provided square-footage value before it is applied
 * to pricing. The validation performs ordered checks rather than applying a
 * single hard-coded universal maximum:
 *
 *   1. Validate the field TYPE and UNIT first (Req 8.1).
 *   2. Distinguish living-area from lot-area; lot area is NEVER substituted for
 *      living area (Req 8.2).
 *   3. Convert square metres to square feet explicitly (Req 8.3).
 *   4. Apply a CONFIGURABLE plausibility threshold so legitimate large estates
 *      are not rejected by a universal hard-coded cap (Req 8.4, 8.5).
 *   5. Fall back to manual entry when no plausible living-area value exists,
 *      leaving the pricing input untouched (Req 8.6).
 */

/**
 * Configurable plausibility threshold — NOT a fixed universal cap.
 * Sourced from config so legitimate large properties are not rejected solely
 * by a hard-coded number.
 */
export interface LivingAreaSqftConfig {
  /** Implausibly small floor (e.g. 100). */
  min: number;
  /** Configurable upper threshold (default generous, override-able). */
  plausibleMax: number;
}

/** Input field as provided by an autocomplete/property source. */
export interface LivingAreaSqftField {
  /** The provider's area-type label (e.g. "Living Building Area", "Lot Size"). */
  areaType?: string;
  /** The provider's unit (e.g. "sqft", "ft2", "m2", "sqm"). */
  unit?: string;
  /** The raw value as provided. */
  value: number | string | null;
}

export type LivingAreaSqftResult =
  | { sqft: number }
  | { rejected: true; reason: string }
  | { manualEntry: true };

/** Explicit square-metre → square-foot conversion factor (Req 8.3). */
export const SQM_TO_SQFT = 10.7639;

/** Recognized square-foot unit tokens (normalized: lowercased, no spaces/dots). */
const SQFT_UNITS = new Set([
  'sqft', 'sf', 'ft2', 'ft²', 'sqfeet', 'squarefeet', 'squarefoot', 'feet', 'foot',
]);

/** Recognized square-metre unit tokens (normalized). */
const SQM_UNITS = new Set([
  'm2', 'm²', 'sqm', 'sqmeters', 'sqmetres', 'squaremeters', 'squaremetres', 'meters', 'metres',
]);

const normalizeToken = (value?: string): string =>
  (value ?? '').toLowerCase().replace(/[\s.]/g, '');

/**
 * True when the area-type label denotes a lot/parcel area that must never be
 * substituted for living area (Req 8.2).
 */
const isLotAreaType = (areaType: string): boolean => /lot|parcel|acre/.test(areaType);

/**
 * True when the area-type label denotes an eligible living/finished building
 * area (Req 8.2).
 */
const isLivingAreaType = (areaType: string): boolean =>
  /living|finished|building\s*area|floor\s*area|gross|interior|heated/.test(areaType);

/**
 * Validate a provider-supplied living-area square-footage value.
 *
 * Returns one of:
 *   - `{ sqft }`         — a plausible living-area value (in square feet) to apply,
 *   - `{ rejected, reason }` — a living-area value that falls outside the
 *                          configurable threshold and must NOT be applied,
 *   - `{ manualEntry }`  — no plausible living-area value exists; leave the field
 *                          blank for manual entry and leave pricing untouched.
 */
export function validateLivingAreaSqft(
  field: LivingAreaSqftField,
  config: LivingAreaSqftConfig,
): LivingAreaSqftResult {
  // 1. Validate field TYPE and UNIT first (Req 8.1).
  const unitToken = normalizeToken(field.unit);
  const isSqm = SQM_UNITS.has(unitToken);
  const isSqft = SQFT_UNITS.has(unitToken);
  // An explicit but unrecognized unit means we cannot trust the value.
  if (unitToken !== '' && !isSqm && !isSqft) {
    return { manualEntry: true };
  }

  // 2. Distinguish living area vs lot area (Req 8.2).
  const areaTypeToken = (field.areaType ?? '').toLowerCase();
  if (areaTypeToken !== '') {
    if (isLotAreaType(areaTypeToken)) {
      // Lot area is never substituted for living area.
      return { manualEntry: true };
    }
    if (!isLivingAreaType(areaTypeToken)) {
      // Recognized-but-non-living or unknown area type ⇒ manual entry.
      return { manualEntry: true };
    }
  }

  // Parse the numeric value; missing/non-numeric ⇒ manual entry.
  if (field.value === null || field.value === undefined || field.value === '') {
    return { manualEntry: true };
  }
  const numericValue = typeof field.value === 'number' ? field.value : Number(field.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { manualEntry: true };
  }

  // 3. Convert square metres to square feet explicitly (Req 8.3).
  const valueInSqft = isSqm ? numericValue * SQM_TO_SQFT : numericValue;
  const roundedSqft = Math.round(valueInSqft);

  // 4. Apply the configurable plausibility threshold (Req 8.4, 8.5).
  if (roundedSqft < config.min || roundedSqft > config.plausibleMax) {
    return {
      rejected: true,
      reason: `Living-area square footage ${roundedSqft} ft² is outside the plausible range ` +
        `(${config.min}–${config.plausibleMax} ft²).`,
    };
  }

  return { sqft: roundedSqft };
}
