import type { ShootData } from '@/types/shoots';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';

type QuoteServiceEntry = {
  price?: unknown;
  quantity?: unknown;
};

export const getCatalogServiceEntries = (
  shoot: Pick<ShootData, 'serviceItems' | 'service_items' | 'serviceObjects' | 'services'>,
): unknown[] => {
  const entries = Array.isArray(shoot.serviceItems) && shoot.serviceItems.length > 0
    ? shoot.serviceItems
    : Array.isArray(shoot.service_items) && shoot.service_items.length > 0
      ? shoot.service_items
      : Array.isArray(shoot.serviceObjects) && shoot.serviceObjects.length > 0
        ? shoot.serviceObjects
        : Array.isArray(shoot.services) ? shoot.services : [];

  return entries.filter((entry) => !isInvoiceAdjustmentServiceItem(entry));
};

export const calculateAddServiceQuote = (
  services: QuoteServiceEntry[],
  taxRate: number,
  invoiceAdjustmentTotal: number,
) => {
  const baseQuote = services.reduce((sum, service) => {
    const price = Number(service.price);
    const quantity = Number(service.quantity ?? 1);

    return sum
      + (Number.isFinite(price) ? price : 0)
      * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }, 0);
  const numericTaxRate = Number(taxRate);
  const normalizedTaxRate = Number.isFinite(numericTaxRate)
    ? (numericTaxRate > 1 ? numericTaxRate / 100 : numericTaxRate)
    : 0;
  const taxAmount = baseQuote * normalizedTaxRate;

  return {
    baseQuote,
    taxAmount,
    totalQuote: baseQuote + taxAmount + invoiceAdjustmentTotal,
  };
};
