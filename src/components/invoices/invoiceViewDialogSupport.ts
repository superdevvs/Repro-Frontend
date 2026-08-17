import type { InvoiceShootRef, InvoiceViewDialogInvoice } from '@/types/invoice';

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
