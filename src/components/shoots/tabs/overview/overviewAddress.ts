import type { ShootData } from '@/types/shoots';
import { getShootPropertyDetails } from '@/utils/shootAddressDisplay';

const unitAtEnd = (address: string): string | null =>
  address.trim().match(/(?:^|[\s,])((?:apartment|apt\.?|unit|suite|ste\.?)\s*#?\s*[a-z0-9][a-z0-9/-]*|#\s*[a-z0-9][a-z0-9/-]*)$/i)?.[1] ?? null;

/** The display line may append an outdated unit; start from the saved street. */
export function getOverviewEditableAddress(shoot: ShootData): string {
  const raw = (shoot as ShootData & { address?: string | null }).address;
  return raw ?? shoot.location?.address ?? '';
}

/** Keep the separate unit metadata in step with an explicitly edited address. */
export function syncOverviewAddressDetails(
  shoot: ShootData,
  address: string | undefined,
  details: Record<string, unknown>,
): Record<string, unknown> {
  if (address === undefined || address.trim() === getOverviewEditableAddress(shoot).trim()) return details;
  const unit = unitAtEnd(address);
  const original = getShootPropertyDetails(shoot) ?? {};
  const next: Record<string, unknown> = { ...details, aptSuite: unit };
  // The API merges property_details. Clear/update aliases too so a removed unit
  // cannot reappear through the display helper's legacy fallback.
  for (const key of ['apt_suite', 'suite', 'unit']) {
    if (key in original || key in details) next[key] = unit;
  }
  return next;
}
