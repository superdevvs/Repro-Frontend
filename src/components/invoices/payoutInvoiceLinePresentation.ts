import type { WeeklyInvoice, WeeklyInvoiceItem } from '@/services/invoiceService';
import { parseInvoiceDateInput } from '@/utils/invoiceDateFilters';

// These are business calendar dates, not instants in the viewer's timezone.
const calendarDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = /^\d{4}-\d{2}-\d{2}(?=$|[T\s])/.exec(value);
  return match && parseInvoiceDateInput(match[0]) ? match[0] : null;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The client of a payout line's shoot: API value, stored meta, then the linked shoot's client. */
export const payoutLineClientName = (
  item: Pick<WeeklyInvoiceItem, 'client_name' | 'meta'>,
  shoot?: { client?: { name?: string | null } | null } | null,
): string | null => text(item.client_name) || text(item.meta?.client_name) || text(shoot?.client?.name) || null;

/** "1234 Main St … · Client: Jane Smith" for single-line surfaces such as PDFs. */
export const withPayoutClientName = (description: string, clientName: string | null | undefined) => {
  const name = text(clientName);
  if (!name || description.toLowerCase().includes(`client: ${name.toLowerCase()}`)) return description;
  return `${description} · Client: ${name}`;
};

export const payoutInvoiceLines = (invoice: WeeklyInvoice) => {
  const shoots = new Map((invoice.shoots || []).map(shoot => [String(shoot.id), shoot]));
  return (invoice.items || []).map((item: WeeklyInvoiceItem) => {
    const shoot = item.shoot_id ? shoots.get(String(item.shoot_id)) : undefined;
    const date = calendarDate(item.meta?.work_date)
      || calendarDate(shoot?.scheduled_date)
      || calendarDate(item.meta?.scheduled_date)
      // A known shoot with no date must not silently use its completion date.
      || (!shoot && item.meta?.source !== 'linked_work' ? calendarDate(item.recorded_at) : null);
    const parsed = date ? parseInvoiceDateInput(date) : null;
    return {
      item,
      clientName: payoutLineClientName(item, shoot),
      date,
      dateLabel: parsed ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable',
      showShootNumber: Boolean(item.shoot_id && !new RegExp(`\\bShoot\\s*#\\s*${item.shoot_id}\\b`, 'i').test(item.description)),
    };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};
