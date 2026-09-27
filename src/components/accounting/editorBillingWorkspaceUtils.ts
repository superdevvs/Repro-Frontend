import type { EditorEarningsDetail, EditorEarningsLineItem } from '@/services/invoiceService';

export type EditorRate = EditorEarningsDetail['current_rates']['service_rates'][number];
export type EditorPayoutGroup = { id: string; paidAt: string | null; amount: number; items: EditorEarningsLineItem[] };

export function resolveEditorEarning(item: EditorEarningsLineItem, rates: EditorRate[]) {
  const rate = Number(item.rate_snapshot || 0), payout = Number(item.payout_amount || 0);
  // A saved zero payout with a recorded rate is still an immutable snapshot.
  if (item.is_paid || rate > 0 || payout > 0) return { rate, payout, isFallback: false };
  const match = rates.find((candidate) => item.service_id != null && String(candidate.service_id) === String(item.service_id))
    || rates.find((candidate) => candidate.service_name.trim().toLowerCase() === item.service_name.trim().toLowerCase());
  const currentRate = Number(match?.rate || 0);
  return { rate: currentRate, payout: currentRate * Number(item.quantity_snapshot || 0), isFallback: currentRate > 0 };
}

export function isEditorDateInRange(value: string | null | undefined, start = '', end = '') {
  if (!start && !end) return true;
  if (!value || (start && end && start > end)) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const from = start ? new Date(`${start}T00:00:00`) : null;
  const until = end ? new Date(`${end}T23:59:59.999`) : null;
  return (!from || date >= from) && (!until || date <= until);
}

export function summarizeEditorRecordedEarnings(items: EditorEarningsLineItem[]) {
  const recorded = items.reduce((sum, item) => sum + Number(item.payout_amount || 0), 0);
  const unpaid = items.filter((item) => !item.is_paid).reduce((sum, item) => sum + Number(item.payout_amount || 0), 0);
  const shoots = new Set(items.map((item) => item.shoot_id)).size;
  return { recorded, unpaid, shoots, average: shoots ? recorded / shoots : 0 };
}

export function groupEditorPayouts(items: EditorEarningsLineItem[], start = '', end = ''): EditorPayoutGroup[] {
  const groups = new Map<string, EditorPayoutGroup>();
  items.filter((item) => item.is_paid && isEditorDateInRange(item.paid_at, start, end)).forEach((item) => {
    const id = item.payout_batch_id || `payment-${item.id}`;
    const group = groups.get(id) || { id, paidAt: item.paid_at || null, amount: 0, items: [] };
    group.amount += Number(item.payout_amount || 0);
    group.items.push(item);
    if (item.paid_at && (!group.paidAt || item.paid_at > group.paidAt)) group.paidAt = item.paid_at;
    groups.set(id, group);
  });
  return [...groups.values()].sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

export function filterEditorLedger(items: EditorEarningsLineItem[], filters: { start?: string; end?: string; status?: string; service?: string; search?: string }) {
  const query = (filters.search || '').trim().toLowerCase();
  return items.filter((item) => isEditorDateInRange(item.completed_at, filters.start, filters.end))
    .filter((item) => !filters.status || (filters.status === 'paid' ? item.is_paid : !item.is_paid))
    .filter((item) => !filters.service || item.service_name === filters.service)
    .filter((item) => `${item.shoot_id} ${item.service_name} ${item.client?.name || ''} ${item.shoot?.address || ''}`.toLowerCase().includes(query))
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
}
