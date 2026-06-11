/**
 * Default configuration for the Square_Footage_Validator (Req 8.4).
 *
 * The plausibility threshold is CONFIGURABLE on purpose: it is sourced from
 * this config rather than baked into the validator as a hard-coded universal
 * maximum, so legitimate large estates are not rejected solely by a fixed cap.
 * Operators can raise `plausibleMax` for exceptional properties without code
 * changes to the validator.
 */

import type { LivingAreaSqftConfig } from '@/utils/squareFootage';

/**
 * Generous default living-area plausibility threshold (in square feet).
 *
 *  - `min`: implausibly small floor; values below this are rejected.
 *  - `plausibleMax`: generous upper bound that comfortably accommodates large
 *    estates while still rejecting clearly bad data (e.g. lot/parcel areas or
 *    millions of square feet mistakenly supplied as living area).
 */
export const DEFAULT_LIVING_AREA_SQFT_CONFIG: Readonly<LivingAreaSqftConfig> = {
  min: 100,
  plausibleMax: 100000,
} as const;
