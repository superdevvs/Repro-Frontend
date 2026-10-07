import type { WeeklyInvoice, WeeklyInvoiceItem } from '@/services/invoiceService';
import { parseInvoiceDateInput } from '@/utils/invoiceDateFilters';

// These are business calendar dates, not instants in the viewer's timezone.
const calendarDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = /^\d{4}-\d{2}-\d{2}(?=$|[T\s])/.exec(value);
  return match && parseInvoiceDateInput(match[0]) ? match[0] : null;
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
      date,
      dateLabel: parsed ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable',
      showShootNumber: Boolean(item.shoot_id && !new RegExp(`\\bShoot\\s*#\\s*${item.shoot_id}\\b`, 'i').test(item.description)),
    };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};
