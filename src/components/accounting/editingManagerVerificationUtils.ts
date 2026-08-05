import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';

import type { ShootData, ShootServiceObject } from '@/types/shoots';
import type { InvoiceData } from '@/utils/invoiceUtils';
import {
  DELIVERED_STATUS_KEYWORDS,
  UPLOADED_STATUS_KEYWORDS,
} from '@/utils/dashboardDerivedUtils';
type DatePreset = 'all_time' | 'this_month' | 'last_month' | 'custom';
type VerificationStatusFilter = 'all' | 'uploaded' | 'delivered' | 'paid' | 'unpaid';

type VerificationServiceBreakdown = {
  id: string;
  name: string;
  imageCount: number | null;
  rate: number | null;
  subtotal: number;
};

type VerificationInvoiceReference = {
  id: string;
  number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  allocatedSubtotal: number;
  allocatedTax: number;
  allocatedAmount: number;
  shootCount: number;
  services: string[];
  source: InvoiceData;
};

export type EditingAccountingVerificationRow = {
  shootId: string;
  editorId: string | null;
  editorName: string;
  address: string;
  verificationDate: Date | null;
  uploadedCount: number | null;
  editedCount: number | null;
  expectedCount: number | null;
  services: VerificationServiceBreakdown[];
  calculatedEditorPay: number;
  invoiceSubtotal: number;
  invoiceTax: number;
  invoiceAmount: number;
  invoiceDisplayNumber: string;
  invoiceId: string | null;
  invoiceStatus: string;
  differenceAmount: number;
  discrepancyFlags: string[];
  status: string;
  invoices: VerificationInvoiceReference[];
};

interface EditingManagerVerificationViewProps {
  shoots: ShootData[];
  invoices: InvoiceData[];
  loading?: boolean;
  onViewInvoice: (invoice: InvoiceData) => void;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const statusLabelMap: Record<VerificationStatusFilter, string> = {
  all: 'All',
  uploaded: 'Uploaded',
  delivered: 'Delivered',
  paid: 'Paid',
  unpaid: 'Unpaid',
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveCount = (value: unknown): number | null => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return parsed >= 0 ? parsed : null;
};

const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Fall through to Date parser for legacy values.
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatInputDate = (value: Date) => format(value, 'yyyy-MM-dd');

const getPresetDateRange = (preset: DatePreset) => {
  if (preset === 'all_time') {
    return null;
  }

  const now = new Date();
  if (preset === 'last_month') {
    const previousMonth = subMonths(now, 1);
    return {
      from: startOfMonth(previousMonth),
      to: endOfMonth(previousMonth),
    };
  }

  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
};

const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getStatusKey = (shoot: ShootData) => normalizeText(shoot.workflowStatus || shoot.status);

const hasKeyword = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(normalizeText(keyword)));

const isDeliveredShoot = (shoot: ShootData) => {
  const statusKey = getStatusKey(shoot);
  return Boolean(shoot.completedDate) || hasKeyword(statusKey, DELIVERED_STATUS_KEYWORDS);
};

const isUploadedShoot = (shoot: ShootData) => {
  if (isDeliveredShoot(shoot)) return false;
  const statusKey = getStatusKey(shoot);
  return hasKeyword(statusKey, UPLOADED_STATUS_KEYWORDS);
};

const getVerificationDate = (shoot: ShootData) =>
  parseDateValue(shoot.completedDate) || parseDateValue(shoot.scheduledDate);

const getAddress = (shoot: ShootData) =>
  shoot.location?.fullAddress ||
  [shoot.location?.address, shoot.location?.city, shoot.location?.state, shoot.location?.zip]
    .filter(Boolean)
    .join(', ') ||
  'Unknown property';

const extractPhotoCountFromLabel = (label?: string | null): number | null => {
  if (!label) return null;
  const match = label.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : null;
};

const getUploadedCount = (shoot: ShootData): number | null => {
  const candidates = [
    shoot.media?.images?.length,
    shoot.rawPhotoCount,
    shoot.mediaSummary?.rawUploaded,
    shoot.editedPhotoCount,
    shoot.mediaSummary?.editedUploaded,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const getEditedCount = (shoot: ShootData): number | null => {
  const candidates = [
    shoot.editedPhotoCount,
    shoot.mediaSummary?.editedUploaded,
    shoot.media?.images?.length,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const getExpectedCount = (shoot: ShootData): number | null => {
  const directCandidates = [shoot.expectedFinalCount, shoot.package?.expectedDeliveredCount];
  for (const candidate of directCandidates) {
    const parsed = toPositiveCount(candidate);
    if (parsed !== null) return parsed;
  }

  const serviceObjects = Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : [];
  const serviceObjectCount = serviceObjects.reduce((sum, service) => {
    const count = toPositiveCount(service.photo_count);
    return sum + (count ?? 0);
  }, 0);
  if (serviceObjectCount > 0) return serviceObjectCount;

  const services = Array.isArray(shoot.services) ? shoot.services : [];
  const serviceCount = services.reduce((sum, service) => sum + (extractPhotoCountFromLabel(service) ?? 0), 0);
  return serviceCount > 0 ? serviceCount : null;
};

const getInvoiceShootCount = (invoice: InvoiceData): number => {
  const shootsCount = toPositiveCount(invoice.shootsCount);
  if (shootsCount && shootsCount > 0) return shootsCount;
  if (Array.isArray(invoice.shoots) && invoice.shoots.length > 0) return invoice.shoots.length;
  if (invoice.shoot || invoice.shoot_id) return 1;
  return 1;
};

const getInvoiceLinkedShootIds = (invoice: InvoiceData): string[] => {
  const ids = new Set<string>();
  if (invoice.shoot_id !== undefined && invoice.shoot_id !== null) {
    ids.add(String(invoice.shoot_id));
  }
  if (invoice.shoot && typeof invoice.shoot === 'object' && 'id' in invoice.shoot && invoice.shoot.id != null) {
    ids.add(String(invoice.shoot.id));
  }
  if (Array.isArray(invoice.shoots)) {
    invoice.shoots.forEach((shoot) => {
      if (shoot && typeof shoot === 'object' && 'id' in shoot && shoot.id != null) {
        ids.add(String(shoot.id));
      }
    });
  }
  return Array.from(ids);
};

const getInvoiceServiceLabels = (invoice: InvoiceData): string[] => {
  const fromItems = Array.isArray(invoice.items)
    ? invoice.items
        .map((item) => item?.description)
        .filter((value): value is string => Boolean(value))
    : [];

  if (fromItems.length > 0) {
    return fromItems;
  }

  return Array.isArray(invoice.services) ? invoice.services.filter(Boolean) : [];
};

const getInvoiceTotals = (invoice: InvoiceData) => {
  const total = Number(
    (toNumber(invoice.total ?? invoice.amount) ?? 0).toFixed(2),
  );
  const tax = Number((toNumber(invoice.tax) ?? 0).toFixed(2));
  const subtotal = Number(
    (
      toNumber(invoice.subtotal) ??
      Math.max(total - tax, 0)
    ).toFixed(2),
  );

  return {
    subtotal,
    tax,
    total: total || Number((subtotal + tax).toFixed(2)),
  };
};

const buildServiceBreakdown = (shoot: ShootData): VerificationServiceBreakdown[] => {
  const serviceObjects = Array.isArray(shoot.serviceObjects) ? shoot.serviceObjects : [];
  if (serviceObjects.length > 0) {
    return serviceObjects.map((service: ShootServiceObject, index) => {
      const quantity = toPositiveCount(service.quantity) ?? 1;
      const subtotal = Number(((toNumber(service.price) ?? 0) * quantity).toFixed(2));
      const imageCount = toPositiveCount(service.photo_count);
      const rate = imageCount && imageCount > 0 ? Number((subtotal / imageCount).toFixed(2)) : null;
      return {
        id: String(service.id || `${shoot.id}-service-${index}`),
        name: service.name || `Service ${index + 1}`,
        imageCount,
        rate,
        subtotal,
      };
    });
  }

  return (Array.isArray(shoot.services) ? shoot.services : []).map((service, index) => ({
    id: `${shoot.id}-legacy-service-${index}`,
    name: service,
    imageCount: extractPhotoCountFromLabel(service),
    rate: null,
    subtotal: 0,
  }));
};

const getCalculatedTotal = (shoot: ShootData, services: VerificationServiceBreakdown[]) => {
  const serviceTotal = Number(
    services.reduce((sum, service) => sum + (service.subtotal || 0), 0).toFixed(2),
  );
  if (serviceTotal > 0) return serviceTotal;
  return Number((toNumber(shoot.payment?.totalQuote) ?? 0).toFixed(2));
};

const getEditorId = (shoot: ShootData): string | null => {
  const candidate =
    shoot.editor?.id ??
    (shoot as ShootData & { editor_id?: string | number }).editor_id ??
    (shoot as ShootData & { editorId?: string | number }).editorId;

  return candidate != null ? String(candidate) : null;
};

const getEditorName = (shoot: ShootData) => shoot.editor?.name || 'Unassigned';

const getDisplayStatus = (shoot: ShootData, invoices: VerificationInvoiceReference[]) => {
  if (invoices.length > 0 && invoices.every((invoice) => invoice.status === 'paid')) {
    return 'Paid';
  }
  if (isDeliveredShoot(shoot)) {
    return 'Delivered';
  }
  if (isUploadedShoot(shoot)) {
    return 'Uploaded';
  }
  if (invoices.length > 0) {
    return 'Unpaid';
  }
  return shoot.workflowStatus || shoot.status || 'Unknown';
};

const hasServiceMismatch = (shootServices: VerificationServiceBreakdown[], invoiceServices: string[]) => {
  if (shootServices.length === 0 || invoiceServices.length === 0) return false;

  const shootLabels = shootServices.map((service) => normalizeText(service.name));
  const invoiceLabels = invoiceServices.map((service) => normalizeText(service));

  return shootLabels.some(
    (service) =>
      service &&
      !invoiceLabels.some(
        (invoiceService) => invoiceService.includes(service) || service.includes(invoiceService),
      ),
  );
};

const buildVerificationRow = (
  shoot: ShootData,
  linkedInvoices: InvoiceData[],
): EditingAccountingVerificationRow => {
  const services = buildServiceBreakdown(shoot);
  const calculatedEditorPay = getCalculatedTotal(shoot, services);
  const verificationInvoices = linkedInvoices.map((invoice) => {
    const shootCount = getInvoiceShootCount(invoice);
    const totals = getInvoiceTotals(invoice);
    return {
      id: String(invoice.id),
      number: invoice.number || invoice.invoiceNumber || String(invoice.id),
      status: (invoice.status || 'pending').toLowerCase(),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      allocatedSubtotal: Number((totals.subtotal / Math.max(shootCount, 1)).toFixed(2)),
      allocatedTax: Number((totals.tax / Math.max(shootCount, 1)).toFixed(2)),
      allocatedAmount: Number((totals.total / Math.max(shootCount, 1)).toFixed(2)),
      shootCount,
      services: getInvoiceServiceLabels(invoice),
      source: invoice,
    };
  });

  const invoiceSubtotal = Number(
    verificationInvoices.reduce((sum, invoice) => sum + invoice.allocatedSubtotal, 0).toFixed(2),
  );
  const invoiceTax = Number(
    verificationInvoices.reduce((sum, invoice) => sum + invoice.allocatedTax, 0).toFixed(2),
  );
  const invoiceAmount = Number(
    verificationInvoices.reduce((sum, invoice) => sum + invoice.allocatedAmount, 0).toFixed(2),
  );
  const differenceAmount = Number((invoiceSubtotal - calculatedEditorPay).toFixed(2));

  const discrepancyFlags: string[] = [];
  const uploadedCount = getUploadedCount(shoot);
  const editedCount = getEditedCount(shoot);
  const expectedCount = getExpectedCount(shoot);

  if (verificationInvoices.length === 0) {
    discrepancyFlags.push('Missing invoice');
    discrepancyFlags.push('Missing shoot in invoice coverage');
  }

  if (uploadedCount === null || editedCount === null || expectedCount === null) {
    discrepancyFlags.push('Missing counts');
  }

  if (verificationInvoices.length > 0 && Math.abs(differenceAmount) > 0.01) {
    discrepancyFlags.push('Invoice amount mismatch');
  }

  if (verificationInvoices.some((invoice) => hasServiceMismatch(services, invoice.services))) {
    discrepancyFlags.push('Service mismatch');
  }

  const invoiceDisplayNumber =
    verificationInvoices.length === 0
      ? 'No linked invoice'
      : verificationInvoices.length === 1
        ? verificationInvoices[0].number
        : `${verificationInvoices[0].number} +${verificationInvoices.length - 1} more`;

  const invoiceStatus =
    verificationInvoices.length === 0
      ? 'Missing'
      : verificationInvoices.every((invoice) => invoice.status === 'paid')
        ? 'Paid'
        : verificationInvoices.some((invoice) => invoice.status === 'paid')
          ? 'Partially paid'
          : 'Unpaid';

  return {
    shootId: String(shoot.id),
    editorId: getEditorId(shoot),
    editorName: getEditorName(shoot),
    address: getAddress(shoot),
    verificationDate: getVerificationDate(shoot),
    uploadedCount,
    editedCount,
    expectedCount,
    services,
    calculatedEditorPay,
    invoiceSubtotal,
    invoiceTax,
    invoiceAmount,
    invoiceDisplayNumber,
    invoiceId: verificationInvoices[0]?.id ?? null,
    invoiceStatus,
    differenceAmount,
    discrepancyFlags: Array.from(new Set(discrepancyFlags)),
    status: getDisplayStatus(shoot, verificationInvoices),
    invoices: verificationInvoices,
  };
};

const summaryCardTone = (value: number) =>
  Math.abs(value) > 0.01 ? 'text-amber-600' : 'text-emerald-600';

const rowsPerPageOptions = [10, 20, 50, 100] as const;

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages] as const;
};


export type { DatePreset, EditingManagerVerificationViewProps, VerificationStatusFilter };
export {
  buildPaginationItems,
  buildVerificationRow,
  currencyFormatter,
  formatInputDate,
  getInvoiceLinkedShootIds,
  getPresetDateRange,
  normalizeText,
  parseDateValue,
  rowsPerPageOptions,
  statusLabelMap,
  summaryCardTone,
};

