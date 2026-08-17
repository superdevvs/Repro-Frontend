import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import type {
  SelectedServiceSource,
  ShootDetails,
} from './shootEditModalTypes';

type ServiceSourceRecord = Record<string, unknown>;

export const getShootEditCatalogServiceId = (entry: unknown): string | undefined => {
  if (!entry || typeof entry !== 'object' || isInvoiceAdjustmentServiceItem(entry)) {
    return undefined;
  }

  const record = entry as ServiceSourceRecord;
  const value = record.service_id ?? record.serviceId ?? record.id;
  if (value === null || value === undefined) return undefined;

  const normalized = String(value).trim();
  return normalized || undefined;
};

const normalizeCatalogEntry = (entry: unknown): SelectedServiceSource | null => {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object' || isInvoiceAdjustmentServiceItem(entry)) return null;

  const record = entry as ServiceSourceRecord;
  const id = getShootEditCatalogServiceId(record);
  const name = typeof record.name === 'string' ? record.name : undefined;
  const label = typeof record.label === 'string' ? record.label : undefined;

  if (!id && !name && !label) return null;
  return {
    id,
    service_id: id,
    name,
    label,
  };
};

const normalizeSource = (source: unknown): SelectedServiceSource[] => (
  Array.isArray(source)
    ? source.map(normalizeCatalogEntry).filter((entry): entry is SelectedServiceSource => entry !== null)
    : []
);

export const getShootEditCatalogServiceEntries = (
  shoot: Pick<ShootDetails, 'serviceItems' | 'service_items' | 'serviceObjects' | 'services'>,
): SelectedServiceSource[] => {
  const structuredEntries = normalizeSource(
    Array.isArray(shoot.serviceItems) && shoot.serviceItems.length > 0
      ? shoot.serviceItems
      : shoot.service_items,
  );
  if (structuredEntries.length > 0) return structuredEntries;

  const serviceObjectEntries = normalizeSource(shoot.serviceObjects);
  if (serviceObjectEntries.length > 0) return serviceObjectEntries;

  return normalizeSource(shoot.services);
};

export const addInvoiceAdjustmentToCatalogTotal = (
  catalogTotal: number,
  invoiceAdjustmentTotal: number,
): number => catalogTotal + invoiceAdjustmentTotal;
