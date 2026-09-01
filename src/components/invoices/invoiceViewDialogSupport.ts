import type { InvoiceParty, InvoiceShootRef, InvoiceViewDialogInvoice } from '@/types/invoice';

export const isInvoiceParty = (value: unknown): value is InvoiceParty => (
  Boolean(value) && typeof value === 'object'
);

export const firstInvoicePartyText = (
  source: InvoiceParty | null | undefined,
  keys: string[],
): string => {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return '';
};

/**
 * Resolve every shoot association supported by the backend. Older aggregate
 * invoices may be linked only through invoice_items.shoot_id, so relying on
 * invoice.shoot / invoice.shoots makes their adjustment target impossible to
 * choose after a reload.
 */
export const collectLinkedInvoiceShoots = (
  invoice: InvoiceViewDialogInvoice,
): InvoiceShootRef[] => {
  const unique = new Map<string, InvoiceShootRef>();
  const add = (shoot?: InvoiceShootRef | null) => {
    if (shoot?.id == null) return;
    unique.set(String(shoot.id), { ...unique.get(String(shoot.id)), ...shoot });
  };

  add(invoice.shoot);
  (invoice.shoots || []).forEach(add);
  (invoice.items || []).forEach((item) => {
    if (item.shoot_id != null) add({ id: item.shoot_id });
  });

  return Array.from(unique.values());
};
