/**
 * Compute the pay owed to a specific photographer for a single shoot.
 *
 * This is the "your pay" figure shown to a photographer when they open a shoot's details. It mirrors
 * the backend rollup (`Shoot::getTotalPhotographerPayAttribute` / `getPhotographerPayByPhotographer`):
 * each service's per-unit `photographer_pay` is multiplied by its `quantity`, and only services
 * resolved to THIS photographer are summed — so a multi-photographer shoot shows each photographer
 * only their own portion.
 *
 * Resolution order:
 *  1. Sum per-service pay for services whose resolved/assigned photographer is `userId`.
 *  2. If no per-service photographer is assigned anywhere (legacy single-photographer shoots) but
 *     the viewer is the shoot's primary photographer, fall back to the shoot-level
 *     `totalPhotographerPay` rollup.
 *
 * The backend only sends `photographer_pay` to non-editor roles (editors receive `null`), so this
 * returns `null` when no pay figure is resolvable rather than a misleading `$0.00`.
 */

type PayService = {
  photographer_pay?: number | null;
  photographerPay?: number | null;
  quantity?: number | null;
  resolved_photographer_id?: string | number | null;
  photographer_id?: string | number | null;
};

type PayShoot = {
  services?: unknown[] | null;
  service_items?: unknown[] | null;
  serviceItems?: unknown[] | null;
  totalPhotographerPay?: number | null;
  photographerPay?: number | null;
  photographer?: { id?: string | number | null } | null;
  photographer_id?: string | number | null;
  photographerId?: string | number | null;
};

const sameId = (a: unknown, b: unknown): boolean =>
  a != null && b != null && String(a) === String(b);

const toNum = (value: unknown): number => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function computePhotographerPayForShoot(
  shoot: PayShoot | null | undefined,
  userId: string | number | null | undefined,
): number | null {
  if (!shoot || userId == null) {
    return null;
  }

  const services = shoot.services ?? shoot.service_items ?? shoot.serviceItems ?? [];

  let mineTotal = 0;
  let matchedAnyMine = false;
  let anyPhotographerAssigned = false;

  for (const rawService of services) {
    if (!rawService || typeof rawService !== 'object') {
      continue;
    }

    const service = rawService as PayService;
    const assigned = service.resolved_photographer_id ?? service.photographer_id ?? null;
    if (assigned != null) {
      anyPhotographerAssigned = true;
    }
    if (sameId(assigned, userId)) {
      const perUnit = service.photographer_pay ?? service.photographerPay;
      if (perUnit != null) {
        const quantity = service.quantity != null ? toNum(service.quantity) || 1 : 1;
        mineTotal += toNum(perUnit) * quantity;
        matchedAnyMine = true;
      }
    }
  }

  if (matchedAnyMine) {
    return mineTotal;
  }

  // Legacy fallback: no per-service photographer assignment, but the viewer is the shoot's
  // primary photographer → the shoot-level rollup is theirs.
  const primaryPhotographerId = shoot.photographer?.id ?? shoot.photographer_id ?? shoot.photographerId ?? null;
  const isPrimary = !anyPhotographerAssigned || sameId(primaryPhotographerId, userId);
  if (isPrimary) {
    const rollup = shoot.totalPhotographerPay ?? shoot.photographerPay;
    if (rollup != null) {
      return toNum(rollup);
    }
  }

  return null;
}

/** Format a pay figure as USD currency (e.g. 125 → "$125.00"). */
export function formatPay(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
