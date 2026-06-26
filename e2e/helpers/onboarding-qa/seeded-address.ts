/**
 * Seeded-address provider for the photographer onboarding QA harness.
 *
 * Supplies addresses with FIXED latitude/longitude so distance gating is deterministic and does
 * not depend solely on live geocoding (Requirement 8.2). For each photographer it exposes
 * `inside` (distance < radius — Truth Table T1), `boundary` (distance == radius — Req 8.4), and
 * `outside` (distance > radius — Truth Table T2) fixtures, plus a `multiEligible` fixture for the
 * "more than one photographer eligible / tie-breaker" rows (Req 8.10/8.11) and a `veryLarge`
 * fixture for the very-large-radius row (Req 8.9). An `atDistance` escape hatch lets a spec build
 * any zero / empty / very-large radius scenario (Req 8.7/8.8/8.9) deterministically.
 *
 * Determinism strategy
 * --------------------
 * All fixtures are computed relative to a single fixed ANCHOR coordinate — the
 * `SeedPhotographerTestAddresses` anchor at 6424 Vale Street, Alexandria, VA — which the harness
 * treats as the photographer base location for distance computation. Each fixture is placed due
 * NORTH of the anchor (same longitude) at an exact target distance. Along a meridian the haversine
 * collapses to `meters = earthRadius * Δφ`, so a north-only offset yields a great-circle distance
 * that equals the requested target to floating-point precision. This makes the inside/boundary/
 * outside invariants EXACT relative to each persona's configured radius.
 *
 * The {@link haversineMiles} helper mirrors the backend implementation in
 * `AddressLookupService::approxDistanceByCoordinates` EXACTLY (earth radius 6371000 m; miles =
 * meters / 1609.34) so the distances computed here agree with the distances the Onboarding_System
 * computes during gating (Req 8.6 — consistent unit + rounding).
 *
 * When geocoding is disabled and no Seeded_Address is available for a check, the distance-gating
 * check is recorded as a Blocked_Check with the geocoding dependency noted (Req 8.13) — that
 * recording happens in the spec module / report collector, not here; this provider always returns
 * a usable fixed-coordinate fixture.
 *
 * See design.md "Components and Interfaces → 4. Seeded-address provider (`seeded-address.ts`)".
 */

import type { QaEnv } from './env';
import type { DataFactory } from './data-factory';
import { PERSONAS } from './personas';

/** A geographic coordinate (decimal degrees). */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The shared anchor coordinate: 6424 Vale Street, Alexandria, VA — the first row seeded by the
 * backend `photographers:seed-test-addresses` command. Reused here as the photographer base
 * reference so fixture distances are deterministic and align with the seeded backend data.
 */
export const ANCHOR: LatLng = { lat: 38.8213, lng: -77.1589 };

/** Mean earth radius in meters — matches `AddressLookupService` (`$earth = 6371000`). */
const EARTH_RADIUS_METERS = 6371000;

/** Meters per statute mile — matches the backend conversion (`$meters / 1609.34`). */
const METERS_PER_MILE = 1609.34;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Great-circle distance in statute miles between two coordinates.
 *
 * Mirrors `AddressLookupService::approxDistanceByCoordinates` exactly (haversine over a 6371000 m
 * earth, then meters → miles via /1609.34) so the value here matches what the Onboarding_System
 * computes when it gates a booking by distance.
 */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dPhi = toRadians(b.lat - a.lat);
  const dLambda = toRadians(b.lng - a.lng);
  const phi1 = toRadians(a.lat);
  const phi2 = toRadians(b.lat);

  const h =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const meters = EARTH_RADIUS_METERS * c;

  return meters / METERS_PER_MILE;
}

/**
 * Compute a coordinate exactly `miles` due NORTH of {@link ANCHOR} (same longitude).
 *
 * Because the longitude is unchanged, the haversine reduces to `meters = earthRadius * Δφ`, so the
 * resulting coordinate's great-circle distance from the anchor equals `miles` to floating-point
 * precision — which is what makes the inside/boundary/outside invariants exact.
 */
function coordinateAtDistanceNorth(miles: number): LatLng {
  const meters = miles * METERS_PER_MILE;
  const deltaLatDegrees = toDegrees(meters / EARTH_RADIUS_METERS);
  return { lat: ANCHOR.lat + deltaLatDegrees, lng: ANCHOR.lng };
}

export interface SeededAddress {
  /** Human-readable label, run-id suffixed via the data factory for run-scoped cleanup. */
  label: string;
  /** Fixed latitude (decimal degrees). */
  lat: number;
  /** Fixed longitude (decimal degrees). */
  lng: number;
  /** Precomputed great-circle distance (miles) from the shared photographer-base anchor. */
  distanceMiles: number;
}

export interface AddressFixtures {
  /** distance < radius for the given photographer (Truth Table T1). */
  inside(photographerKey: string): SeededAddress;
  /** distance == radius for the given photographer (Req 8.4 boundary rule). */
  boundary(photographerKey: string): SeededAddress;
  /** distance > radius for the given photographer (Truth Table T2). */
  outside(photographerKey: string): SeededAddress;
  /** An address inside the radius of every radius-bearing photographer, so ≥2 are eligible (Req 8.10/8.11). */
  multiEligible(): SeededAddress;
  /**
   * A far address (well beyond any normal persona radius) used to exercise the very-large-radius
   * row: a photographer configured with a very large radius SHALL still be offered for it (Req 8.9).
   */
  veryLarge(): SeededAddress;
  /**
   * Escape hatch: a deterministic fixture at an arbitrary fixed distance (miles) from the anchor.
   * Lets a spec compose zero-radius (Req 8.7), empty/default-radius (Req 8.8), and very-large-radius
   * (Req 8.9) scenarios without hardcoding coordinates.
   */
  atDistance(miles: number, base?: string): SeededAddress;
}

/** Base distance targets (miles), expressed relative to a photographer's configured radius. */
const INSIDE_RATIO = 0.4; // radius 25 → 10mi (matches Truth Table T1); radius 5 → 2mi.
const MIN_OUTSIDE_MILES = 40; // matches Truth Table T2 (40mi from Photographer B, radius 5mi).
const OUTSIDE_RATIO = 1.5; // for larger radii, stay clearly beyond the boundary.
const MULTI_ELIGIBLE_MILES = 2; // inside the smallest persona radius (Photographer B = 5mi).
const VERY_LARGE_MILES = 100; // far beyond normal radii; within a "very large" configured radius.

/**
 * Resolve a photographer persona's configured Service_Radius (miles) by key.
 *
 * Throws a clear error when the key is unknown or the persona carries no radius, since
 * inside/boundary/outside are defined only relative to a configured radius. (Photographer A = 25mi,
 * Photographer B = 5mi; Photographer C has no radius and is exercised via the service-match rows.)
 */
function radiusForPhotographer(photographerKey: string): number {
  const persona = PERSONAS.find((p) => p.key === photographerKey);
  if (persona === undefined) {
    throw new Error(`seeded-address: unknown photographer key "${photographerKey}"`);
  }
  if (persona.serviceRadiusMiles === undefined) {
    throw new Error(
      `seeded-address: photographer "${photographerKey}" has no serviceRadiusMiles; ` +
        'inside/boundary/outside fixtures require a configured radius',
    );
  }
  return persona.serviceRadiusMiles;
}

/**
 * Create the {@link AddressFixtures} provider.
 *
 * @param env     resolved QA environment (carries the optional `E2E_SEEDED_ADDRESS_SET` pin).
 * @param factory run-id data factory used to suffix every fixture label for run-scoped cleanup.
 */
export function createAddressFixtures(env: QaEnv, factory: DataFactory): AddressFixtures {
  // The fixture-set id is reserved for future multi-set pinning; a single deterministic set is
  // defined today. Referencing it keeps the documented env contract wired without changing output.
  const fixtureSet = env.seededAddressSet ?? 'default';

  /** Build a labeled, run-id-suffixed fixture at an exact north-offset distance from the anchor. */
  function build(base: string, targetMiles: number): SeededAddress {
    const { lat, lng } = coordinateAtDistanceNorth(targetMiles);
    return {
      label: factory.address(`${base} [${fixtureSet}]`),
      lat,
      lng,
      // Recompute via the (backend-mirrored) haversine so distanceMiles is self-consistent with
      // how the Onboarding_System will measure it; equals targetMiles to floating-point precision.
      distanceMiles: haversineMiles(ANCHOR, { lat, lng }),
    };
  }

  return {
    inside(photographerKey: string): SeededAddress {
      const radius = radiusForPhotographer(photographerKey);
      return build(`seeded.inside.${photographerKey}`, radius * INSIDE_RATIO);
    },

    boundary(photographerKey: string): SeededAddress {
      const radius = radiusForPhotographer(photographerKey);
      return build(`seeded.boundary.${photographerKey}`, radius);
    },

    outside(photographerKey: string): SeededAddress {
      const radius = radiusForPhotographer(photographerKey);
      const targetMiles = Math.max(MIN_OUTSIDE_MILES, radius * OUTSIDE_RATIO);
      return build(`seeded.outside.${photographerKey}`, targetMiles);
    },

    multiEligible(): SeededAddress {
      return build('seeded.multi-eligible', MULTI_ELIGIBLE_MILES);
    },

    veryLarge(): SeededAddress {
      return build('seeded.very-large', VERY_LARGE_MILES);
    },

    atDistance(miles: number, base = 'seeded.at-distance'): SeededAddress {
      if (!Number.isFinite(miles) || miles < 0) {
        throw new Error(`seeded-address: atDistance requires a finite, non-negative miles value`);
      }
      return build(base, miles);
    },
  };
}
