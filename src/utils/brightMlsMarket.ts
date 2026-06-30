// Shared Bright MLS market-support gate.
//
// Bright MLS media sync is only valid in supported markets. Unsupported markets
// (e.g. New Jersey / Garden State MLS) must NOT expose the "Publish to Bright MLS"
// action anywhere in the UI. Keeping this in one place ensures the shoot-details
// modal, the integrations section, and history rows all gate consistently.

const BRIGHT_MLS_UNSUPPORTED_STATES = new Set(['NJ']);

export const isBrightMlsSupportedForShoot = (
  shoot: { state?: string | null; listing_source?: string | null } | null | undefined,
): boolean => {
  if (!shoot) return true;
  const state = String(shoot.state || '').trim().toUpperCase();
  const listingSource = String(shoot.listing_source || '').trim().toLowerCase();

  if (BRIGHT_MLS_UNSUPPORTED_STATES.has(state)) {
    return false;
  }

  if (listingSource.includes('garden state')) {
    return false;
  }

  return true;
};
