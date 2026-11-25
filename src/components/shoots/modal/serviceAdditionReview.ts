import type { ShootData } from '@/types/shoots';
import { getShootUnits } from '@/features/shoot-units/shootUnitData';
import { canChooseServiceChangeIntent, type ServiceChangeIntent } from '@/utils/activeShootWork';
import { getBookedServiceQuantities, normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { getShootServiceItems, isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';

type Addition = { id: string; name: string; quantity: number };
export type ReviewedAddition = Addition & { status?: 'missing' | 'saved' | 'different'; savedQuantity?: number };
export type ServiceAdditionDraft = { additions: Addition[]; additionsOnly: boolean; intent: ServiceChangeIntent };

function bookedIds(shoot: ShootData) {
  const ids = new Set<string>();
  for (const item of getShootServiceItems(shoot)) if (item.serviceId) ids.add(item.serviceId);
  for (const item of [...(shoot.serviceObjects ?? []), ...(shoot.servicePresentation ?? [])]) {
    if (isInvoiceAdjustmentServiceItem(item)) continue;
    const id = item.service_id ?? ('id' in item ? item.id : undefined);
    if (id != null) ids.add(String(id));
  }
  return ids;
}

/** Compare against the booking that opened the editor, even after a realtime refresh. */
export function captureServiceAdditions(
  original: ShootData, selected: string[], quantities: Record<string, number>,
  catalog: { id: string; name: string }[], intent: ServiceChangeIntent, hasOtherEdits: boolean,
): ServiceAdditionDraft | undefined {
  if (!canChooseServiceChangeIntent(original) || getShootUnits(original).length) return;
  const booked = bookedIds(original);
  const additions = selected.filter(id => !booked.has(id)).map(id => ({
    id, name: catalog.find(option => option.id === id)?.name ?? `Service #${id}`,
    quantity: normalizeBookingQuantity(quantities[id]),
  }));
  if (!additions.length) return;
  const originalQuantities = getBookedServiceQuantities(original);
  const changedExisting = [...booked].some(id => !selected.includes(id)
    || (quantities[id] !== undefined && quantities[id] !== (originalQuantities[id] ?? 1)));
  return { additions, intent, additionsOnly: !hasOtherEdits && !changedExisting };
}

export function reviewServiceAdditions(draft: ServiceAdditionDraft | undefined, latest: ShootData) {
  const booked = bookedIds(latest);
  const quantities = getBookedServiceQuantities(latest);
  const hasServiceDetail = Array.isArray(latest.serviceItems) || Array.isArray(latest.service_items) || Array.isArray(latest.serviceObjects);
  const rows: ReviewedAddition[] = (draft?.additions ?? []).map(addition => {
    const present = booked.has(addition.id);
    const savedQuantity = quantities[addition.id];
    const status = !present && hasServiceDetail ? 'missing' : savedQuantity === addition.quantity ? 'saved' : 'different';
    return { ...addition, status, savedQuantity };
  });
  const canApply = Boolean(hasServiceDetail && draft?.additionsOnly && latest.editVersion && latest.canManageBooking
    && canChooseServiceChangeIntent(latest) && !getShootUnits(latest).length
    && !rows.some(row => row.status === 'different'));
  return { rows, canApply, missing: rows.filter(row => row.status === 'missing') };
}
