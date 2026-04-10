import React, { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileText } from 'lucide-react';

import { ShootDetailsModalWrapper } from '@/components/dashboard/v2/ShootDetailsModalWrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { DashboardShootSummary } from '@/types/dashboard';
import type { ShootData, ShootServiceObject } from '@/types/shoots';
import type { InvoiceData } from '@/utils/invoiceUtils';
import {
  DELIVERED_STATUS_KEYWORDS,
  UPLOADED_STATUS_KEYWORDS,
  shootDataToSummary,
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

export function EditingManagerVerificationView({
  shoots,
  invoices,
  loading = false,
  onViewInvoice,
}: EditingManagerVerificationViewProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editorFilter, setEditorFilter] = useState('all_editors');
  const [statusFilter, setStatusFilter] = useState<VerificationStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShoot, setSelectedShoot] = useState<DashboardShootSummary | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const shootLookup = useMemo(() => {
    const map = new Map<string, ShootData>();
    shoots.forEach((shoot) => {
      map.set(String(shoot.id), shoot);
    });
    return map;
  }, [shoots]);

  const invoiceLookup = useMemo(() => {
    const map = new Map<string, InvoiceData[]>();
    invoices.forEach((invoice) => {
      getInvoiceLinkedShootIds(invoice).forEach((shootId) => {
        const existing = map.get(shootId) ?? [];
        existing.push(invoice);
        map.set(shootId, existing);
      });
    });
    return map;
  }, [invoices]);

  const allRows = useMemo(
    () =>
      shoots
        .map((shoot) => buildVerificationRow(shoot, invoiceLookup.get(String(shoot.id)) ?? []))
        .sort((left, right) => {
          const leftTime = left.verificationDate?.getTime() ?? 0;
          const rightTime = right.verificationDate?.getTime() ?? 0;
          return rightTime - leftTime;
        }),
    [shoots, invoiceLookup],
  );

  const editors = useMemo(() => {
    const uniqueEditors = new Map<string, string>();
    allRows.forEach((row) => {
      if (row.editorId && row.editorName) {
        uniqueEditors.set(row.editorId, row.editorName);
      }
    });
    return Array.from(uniqueEditors.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const from = parseDateValue(fromDate);
    const to = parseDateValue(toDate);
    const search = normalizeText(searchQuery);

    return allRows.filter((row) => {
      if (from && row.verificationDate && row.verificationDate < from) {
        return false;
      }

      if (to && row.verificationDate) {
        const inclusiveTo = new Date(to);
        inclusiveTo.setHours(23, 59, 59, 999);
        if (row.verificationDate > inclusiveTo) {
          return false;
        }
      }

      if (from && !row.verificationDate) {
        return false;
      }

      if (editorFilter !== 'all_editors' && row.editorId !== editorFilter) {
        return false;
      }

      if (statusFilter === 'uploaded' && row.status !== 'Uploaded') {
        return false;
      }

      if (statusFilter === 'delivered' && row.status !== 'Delivered') {
        return false;
      }

      if (statusFilter === 'paid' && row.status !== 'Paid') {
        return false;
      }

      if (statusFilter === 'unpaid' && row.status === 'Paid') {
        return false;
      }

      if (search) {
        const haystack = [
          row.shootId,
          row.address,
          row.editorName,
          row.invoiceDisplayNumber,
          row.services.map((service) => service.name).join(' '),
        ]
          .map((value) => normalizeText(value))
          .join(' ');

        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [allRows, editorFilter, fromDate, searchQuery, statusFilter, toDate]);

  const summary = useMemo(() => {
    const totalShoots = filteredRows.length;
    const calculatedTotal = Number(
      filteredRows.reduce((sum, row) => sum + row.calculatedEditorPay, 0).toFixed(2),
    );
    const invoiceTax = Number(
      filteredRows.reduce((sum, row) => sum + row.invoiceTax, 0).toFixed(2),
    );
    const linkedInvoiceTotal = Number(
      filteredRows.reduce((sum, row) => sum + row.invoiceAmount, 0).toFixed(2),
    );
    const mismatches = filteredRows.filter((row) => row.discrepancyFlags.length > 0).length;

    return {
      totalShoots,
      calculatedTotal,
      invoiceTax,
      linkedInvoiceTotal,
      mismatches,
      matched: Math.max(totalShoots - mismatches, 0),
    };
  }, [filteredRows]);

  const hasActiveFilters = useMemo(
    () =>
      datePreset !== 'all_time' ||
      Boolean(fromDate) ||
      Boolean(toDate) ||
      editorFilter !== 'all_editors' ||
      statusFilter !== 'all' ||
      Boolean(searchQuery.trim()),
    [datePreset, editorFilter, fromDate, searchQuery, statusFilter, toDate],
  );

  const totalPages = Math.max(Math.ceil(filteredRows.length / rowsPerPage), 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [editorFilter, fromDate, rowsPerPage, searchQuery, statusFilter, toDate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredRows, rowsPerPage]);

  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEnd = filteredRows.length === 0 ? 0 : Math.min(currentPage * rowsPerPage, filteredRows.length);

  const toggleRow = (shootId: string) => {
    setExpandedRows((current) => ({
      ...current,
      [shootId]: !current[shootId],
    }));
  };

  const handlePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value === 'custom') {
      return;
    }

    const range = getPresetDateRange(value);
    setFromDate(range ? formatInputDate(range.from) : '');
    setToDate(range ? formatInputDate(range.to) : '');
  };

  const resetFilters = () => {
    setDatePreset('all_time');
    setFromDate('');
    setToDate('');
    setEditorFilter('all_editors');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleOpenShootOverview = (shootId: string) => {
    const shoot = shootLookup.get(shootId);
    if (!shoot) return;
    setSelectedShoot(shootDataToSummary(shoot));
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Verification workspace</CardTitle>
          <CardDescription>
            Filter the review queue and open receipts with full subtotal, tax, and total details.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="space-y-2 xl:col-span-3">
            <p className="text-sm font-medium">Search</p>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by shoot, address, editor, invoice, or service"
              aria-label="Search verification rows"
            />
          </div>

          <div className="space-y-2 xl:col-span-2">
            <p className="text-sm font-medium">Date range</p>
            <Select value={datePreset} onValueChange={(value) => handlePresetChange(value as DatePreset)}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All time</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 xl:col-span-4">
            <p className="text-sm font-medium">Custom range</p>
            <DateRangePicker
              value={{ startDate: fromDate, endDate: toDate }}
              onChange={({ startDate: nextFromDate, endDate: nextToDate }) => {
                setDatePreset('custom');
                setFromDate(nextFromDate);
                setToDate(nextToDate);
              }}
              placeholder="Choose verification range"
            />
          </div>

          <div className="space-y-2 xl:col-span-2">
            <p className="text-sm font-medium">Editor</p>
            <Select value={editorFilter} onValueChange={setEditorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All editors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_editors">All editors</SelectItem>
                {editors.map((editor) => (
                  <SelectItem key={editor.id} value={editor.id}>
                    {editor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 xl:col-span-1">
            <p className="text-sm font-medium">Status</p>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as VerificationStatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabelMap).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Shoots</CardDescription>
            <CardTitle>{summary.totalShoots}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Needs Review</CardDescription>
            <CardTitle className={summary.mismatches > 0 ? 'text-amber-600' : 'text-emerald-600'}>
              {summary.mismatches}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {summary.matched} row{summary.matched === 1 ? '' : 's'} already aligned
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Service Subtotal</CardDescription>
            <CardTitle>{currencyFormatter.format(summary.calculatedTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoice Tax</CardDescription>
            <CardTitle>{currencyFormatter.format(summary.invoiceTax)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Linked Invoice Total</CardDescription>
            <CardTitle>{currencyFormatter.format(summary.linkedInvoiceTotal)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Shoot verification</CardTitle>
          <CardDescription>
            Compare editor service subtotal against linked invoice subtotal, with tax shown separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Loading accounting verification data...
            </div>
          ) : allRows.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              No shoots are available for verification yet.
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              <p>No shoots match the current verification filters.</p>
              {hasActiveFilters && (
                <div className="mt-4">
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {filteredRows.length} verification row{filteredRows.length === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
                    <SelectTrigger className="w-[90px]">
                      <SelectValue placeholder="20" />
                    </SelectTrigger>
                    <SelectContent>
                      {rowsPerPageOptions.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Table>
              <caption className="sr-only">
                Shoot verification rows with invoice subtotal, tax, total, and review status.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Shoot</TableHead>
                  <TableHead>Editor</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Edited</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Service subtotal</TableHead>
                  <TableHead>Linked invoice</TableHead>
                  <TableHead>Invoice total</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => {
                  const isExpanded = Boolean(expandedRows[row.shootId]);
                  const hasIssues = row.discrepancyFlags.length > 0;
                  return (
                    <React.Fragment key={row.shootId}>
                      <TableRow>
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleRow(row.shootId)}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} verification details for shoot #${row.shootId}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-left font-semibold"
                              onClick={() => handleOpenShootOverview(row.shootId)}
                              aria-label={`Open shoot #${row.shootId} overview`}
                            >
                              #{row.shootId}
                            </Button>
                            <p className="max-w-[240px] text-sm text-muted-foreground">{row.address}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.verificationDate ? format(row.verificationDate, 'MMM d, yyyy') : 'No date'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="font-medium">{row.editorName}</p>
                        </TableCell>
                        <TableCell className="align-top">{row.uploadedCount ?? '—'}</TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p>{row.editedCount ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              Expected {row.expectedCount ?? '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="max-w-[220px] text-sm text-muted-foreground">
                            {row.services.length > 0
                              ? row.services.map((service) => service.name).join(', ')
                              : 'No services mapped'}
                          </p>
                        </TableCell>
                        <TableCell className="align-top font-medium">
                          {currencyFormatter.format(row.calculatedEditorPay)}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.invoices.length > 0 ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-left"
                              onClick={() => onViewInvoice(row.invoices[0].source)}
                              aria-label={`Open receipt ${row.invoiceDisplayNumber}`}
                            >
                              <span>{row.invoiceDisplayNumber}</span>
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">No linked invoice</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="font-medium">{currencyFormatter.format(row.invoiceAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              Tax {currencyFormatter.format(row.invoiceTax)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className={cn('align-top font-medium', summaryCardTone(row.differenceAmount))}>
                          {currencyFormatter.format(row.differenceAmount)}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-2">
                            <Badge variant="outline" className="w-fit">
                              {row.status}
                            </Badge>
                            {hasIssues ? (
                              <Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Review
                              </Badge>
                            ) : (
                              <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Matched
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-muted/20">
                            <div className="grid gap-4 py-2 lg:grid-cols-2">
                              <div className="space-y-3 rounded-lg border bg-background p-4">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <p className="font-medium">Service breakdown</p>
                                </div>
                                {row.services.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No service breakdown available.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {row.services.map((service) => (
                                      <div
                                        key={service.id}
                                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                                      >
                                        <div>
                                          <p className="font-medium">{service.name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Images: {service.imageCount ?? '—'}
                                            {' • '}
                                            Rate: {service.rate !== null ? currencyFormatter.format(service.rate) : '—'}
                                          </p>
                                        </div>
                                        <p className="font-semibold">{currencyFormatter.format(service.subtotal)}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3 rounded-lg border bg-background p-4">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                  <p className="font-medium">Verification details</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {row.discrepancyFlags.length > 0 ? (
                                    row.discrepancyFlags.map((flag) => (
                                      <Badge
                                        key={flag}
                                        variant="outline"
                                        className="border-amber-200 bg-amber-50 text-amber-800"
                                      >
                                        {flag}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                      Counts and invoice totals are aligned
                                    </Badge>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  {row.invoices.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No invoice linked to this shoot yet.</p>
                                  ) : (
                                    row.invoices.map((invoice) => (
                                      <div
                                        key={invoice.id}
                                        className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                                      >
                                        <div className="space-y-1">
                                          <Button
                                            type="button"
                                            variant="link"
                                            className="h-auto p-0 font-medium"
                                            onClick={() => onViewInvoice(invoice.source)}
                                            aria-label={`Open receipt ${invoice.number}`}
                                          >
                                            {invoice.number}
                                          </Button>
                                          <p className="text-xs text-muted-foreground">
                                            {invoice.status} • {invoice.shootCount > 1 ? `Shared across ${invoice.shootCount} shoots` : 'Single shoot invoice'}
                                          </p>
                                          {invoice.services.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              {invoice.services.join(', ')}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold">{currencyFormatter.format(invoice.allocatedAmount)}</p>
                                          <div className="space-y-0.5 text-xs text-muted-foreground">
                                            <p>Subtotal {currencyFormatter.format(invoice.allocatedSubtotal)}</p>
                                            <p>Tax {currencyFormatter.format(invoice.allocatedTax)}</p>
                                            <p>Total {currencyFormatter.format(invoice.total)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination className="justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (currentPage > 1) {
                              setCurrentPage(currentPage - 1);
                            }
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {paginationItems.map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {item === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={item === currentPage}
                              onClick={(event) => {
                                event.preventDefault();
                                setCurrentPage(item);
                              }}
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (currentPage < totalPages) {
                              setCurrentPage(currentPage + 1);
                            }
                          }}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <ShootDetailsModalWrapper
        shoot={selectedShoot}
        onClose={() => setSelectedShoot(null)}
      />
    </>
  );
}
