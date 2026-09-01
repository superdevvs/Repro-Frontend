import { apiClient } from '@/services/api';
import { fetchInvoices } from '@/services/invoiceService';
import type { InvoiceData } from '@/types/invoice';
import type { ShootHistoryRecord } from '@/types/shoots';

export type ReportTimeframe = 'monthly' | 'quarterly' | 'yearly';
export type ReportType = 'summary' | 'photographer' | 'service';

export interface ReportRange {
  start: string;
  end: string;
  label: string;
}

export interface ReportPeriodRow {
  period: string;
  revenue: number;
  shoots: number;
}

export interface ReportPhotographerRow {
  name: string;
  revenue: number;
  shoots: number;
}

export interface ReportServiceRow {
  name: string;
  revenue: number;
  shoots: number;
}

type ReportPerson = {
  id?: string | number | null;
  name?: string | null;
};

type ReportServiceItem = {
  name?: string | null;
  serviceName?: string | null;
  service_name?: string | null;
  paidAmount?: number | string | null;
  paid_amount?: number | string | null;
  resolvedPhotographer?: ReportPerson | null;
  resolved_photographer?: ReportPerson | null;
  photographer?: ReportPerson | null;
};

export type ReportShootRecord = ShootHistoryRecord & {
  serviceItems?: ReportServiceItem[];
  service_items?: ReportServiceItem[];
};

type ShootHistoryPage = {
  data?: ReportShootRecord[];
  meta?: {
    current_page?: number;
    per_page?: number;
    total?: number;
  };
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDateInput = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const toFiniteNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const parseReportDate = (value?: string | null): Date | null => {
  if (!value) return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('The report request was cancelled.', 'AbortError');
  }
};

const deduplicateById = <T extends { id: string | number }>(records: T[]): T[] =>
  Array.from(new Map(records.map((record) => [String(record.id), record])).values());

export const getReportRange = (
  timeframe: ReportTimeframe,
  now = new Date(),
): ReportRange => {
  const currentYear = now.getFullYear();
  const firstYear = timeframe === 'yearly' ? currentYear - 4 : currentYear;

  return {
    start: toDateInput(firstYear, 1, 1),
    end: toDateInput(currentYear, 12, 31),
    label: firstYear === currentYear ? String(currentYear) : `${firstYear}–${currentYear}`,
  };
};

export const fetchReportInvoices = async (
  range: ReportRange,
  signal?: AbortSignal,
): Promise<InvoiceData[]> => {
  const perPage = 100;
  throwIfAborted(signal);

  const firstPage = await fetchInvoices({
    page: 1,
    per_page: perPage,
    start: range.start,
    end: range.end,
  });
  const invoices = [...firstPage.data];

  for (let page = 2; page <= firstPage.last_page; page += 1) {
    throwIfAborted(signal);
    const response = await fetchInvoices({
      page,
      per_page: perPage,
      start: range.start,
      end: range.end,
    });
    invoices.push(...response.data);
  }

  return deduplicateById(invoices);
};

export const fetchReportShoots = async (
  range: ReportRange,
  signal?: AbortSignal,
): Promise<ReportShootRecord[]> => {
  const perPage = 200;
  const requestPage = async (page: number) => {
    const response = await apiClient.get<ShootHistoryPage>('/shoots/history', {
      params: {
        page,
        per_page: perPage,
        scheduled_start: range.start,
        scheduled_end: range.end,
      },
      signal,
    });
    return response.data;
  };

  const firstPage = await requestPage(1);
  const shoots = Array.isArray(firstPage.data) ? [...firstPage.data] : [];
  const total = toFiniteNumber(firstPage.meta?.total);
  const pageSize = toFiniteNumber(firstPage.meta?.per_page) || perPage;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  for (let page = 2; page <= pageCount; page += 1) {
    throwIfAborted(signal);
    const response = await requestPage(page);
    if (Array.isArray(response.data)) {
      shoots.push(...response.data);
    }
  }

  return deduplicateById(shoots);
};

const getInvoiceRevenue = (invoice: InvoiceData): number => {
  const normalizedRole = String(invoice.role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalizedRole && normalizedRole !== 'client') return 0;

  const amountPaid = toFiniteNumber(invoice.amountPaid);
  if (amountPaid > 0) return amountPaid;
  return invoice.status === 'paid' ? toFiniteNumber(invoice.amount) : 0;
};

const getPeriodKey = (date: Date, timeframe: ReportTimeframe): string => {
  const year = date.getFullYear();
  if (timeframe === 'monthly') return `${year}-${date.getMonth()}`;
  if (timeframe === 'quarterly') return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  return String(year);
};

const createPeriodRows = (
  timeframe: ReportTimeframe,
  now: Date,
): Array<ReportPeriodRow & { key: string }> => {
  const currentYear = now.getFullYear();

  if (timeframe === 'monthly') {
    return MONTH_LABELS.map((period, month) => ({
      key: `${currentYear}-${month}`,
      period,
      revenue: 0,
      shoots: 0,
    }));
  }

  if (timeframe === 'quarterly') {
    return Array.from({ length: 4 }, (_, index) => ({
      key: `${currentYear}-Q${index + 1}`,
      period: `Q${index + 1}`,
      revenue: 0,
      shoots: 0,
    }));
  }

  return Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - 4 + index;
    return {
      key: String(year),
      period: String(year),
      revenue: 0,
      shoots: 0,
    };
  });
};

export const buildPeriodRows = (
  invoices: InvoiceData[],
  shoots: ReportShootRecord[],
  timeframe: ReportTimeframe,
  now = new Date(),
): ReportPeriodRow[] => {
  const rows = createPeriodRows(timeframe, now);
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));

  invoices.forEach((invoice) => {
    const date = parseReportDate(invoice.issueDate || invoice.date || invoice.createdAt);
    if (!date) return;
    const row = rowsByKey.get(getPeriodKey(date, timeframe));
    if (row) row.revenue += getInvoiceRevenue(invoice);
  });

  shoots.forEach((shoot) => {
    const date = parseReportDate(shoot.scheduledDate);
    if (!date) return;
    const row = rowsByKey.get(getPeriodKey(date, timeframe));
    if (row) row.shoots += 1;
  });

  return rows.map(({ period, revenue, shoots: shootCount }) => ({
    period,
    revenue: Math.round(revenue * 100) / 100,
    shoots: shootCount,
  }));
};

const getServiceItems = (shoot: ReportShootRecord): ReportServiceItem[] => {
  if (Array.isArray(shoot.serviceItems) && shoot.serviceItems.length > 0) return shoot.serviceItems;
  return Array.isArray(shoot.service_items) ? shoot.service_items : [];
};

const getServiceName = (item: ReportServiceItem): string | null => {
  const name = item.name || item.serviceName || item.service_name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
};

const getItemRevenue = (item: ReportServiceItem): number =>
  toFiniteNumber(item.paidAmount ?? item.paid_amount);

const getItemPhotographer = (item: ReportServiceItem, shoot: ReportShootRecord): ReportPerson =>
  item.resolvedPhotographer
  || item.resolved_photographer
  || item.photographer
  || shoot.photographer
  || {};

const getPersonKey = (person: ReportPerson): string => {
  if (person.id !== null && person.id !== undefined && String(person.id).trim()) {
    return `id:${person.id}`;
  }
  return `name:${String(person.name || 'Unassigned').trim().toLowerCase()}`;
};

export const buildPhotographerRows = (shoots: ReportShootRecord[]): ReportPhotographerRow[] => {
  const totals = new Map<string, { name: string; revenue: number; shootIds: Set<number> }>();

  const add = (person: ReportPerson, shootId: number, revenue: number) => {
    const key = getPersonKey(person);
    const current = totals.get(key) ?? {
      name: String(person.name || 'Unassigned').trim() || 'Unassigned',
      revenue: 0,
      shootIds: new Set<number>(),
    };
    current.revenue += revenue;
    current.shootIds.add(shootId);
    totals.set(key, current);
  };

  shoots.forEach((shoot) => {
    const items = getServiceItems(shoot).filter((item) => getServiceName(item));
    if (items.length === 0) {
      add(shoot.photographer || {}, shoot.id, toFiniteNumber(shoot.financials?.totalPaid));
      return;
    }

    items.forEach((item) => {
      add(getItemPhotographer(item, shoot), shoot.id, getItemRevenue(item));
    });
  });

  return Array.from(totals.values())
    .map(({ name, revenue, shootIds }) => ({
      name,
      revenue: Math.round(revenue * 100) / 100,
      shoots: shootIds.size,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.shoots - left.shoots || left.name.localeCompare(right.name));
};

export const buildServiceRows = (shoots: ReportShootRecord[]): ReportServiceRow[] => {
  const totals = new Map<string, { name: string; revenue: number; shootIds: Set<number> }>();

  const add = (name: string, shootId: number, revenue: number) => {
    const key = name.toLowerCase();
    const current = totals.get(key) ?? { name, revenue: 0, shootIds: new Set<number>() };
    current.revenue += revenue;
    current.shootIds.add(shootId);
    totals.set(key, current);
  };

  shoots.forEach((shoot) => {
    const items = getServiceItems(shoot)
      .map((item) => ({ item, name: getServiceName(item) }))
      .filter((entry): entry is { item: ReportServiceItem; name: string } => Boolean(entry.name));

    if (items.length > 0) {
      items.forEach(({ item, name }) => add(name, shoot.id, getItemRevenue(item)));
      return;
    }

    const serviceNames = Array.from(new Set((shoot.services || []).map((name) => name.trim()).filter(Boolean)));
    const allocatedRevenue = serviceNames.length > 0
      ? toFiniteNumber(shoot.financials?.totalPaid) / serviceNames.length
      : 0;
    serviceNames.forEach((name) => add(name, shoot.id, allocatedRevenue));
  });

  return Array.from(totals.values())
    .map(({ name, revenue, shootIds }) => ({
      name,
      revenue: Math.round(revenue * 100) / 100,
      shoots: shootIds.size,
    }))
    .sort((left, right) => right.shoots - left.shoots || right.revenue - left.revenue || left.name.localeCompare(right.name));
};

const protectSpreadsheetCell = (value: string): string =>
  /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;

const escapeCsvCell = (value: string | number): string => {
  const normalized = protectSpreadsheetCell(String(value));
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const toCsv = (rows: Array<Array<string | number>>): string =>
  rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

export const buildReportCsv = (
  reportType: ReportType,
  periodRows: ReportPeriodRow[],
  photographerRows: ReportPhotographerRow[],
  serviceRows: ReportServiceRow[],
): string => {
  if (reportType === 'photographer') {
    return toCsv([
      ['Photographer', 'Shoots', 'Collected Revenue'],
      ...photographerRows.map((row) => [row.name, row.shoots, row.revenue.toFixed(2)]),
    ]);
  }

  if (reportType === 'service') {
    return toCsv([
      ['Service', 'Shoots', 'Collected Revenue'],
      ...serviceRows.map((row) => [row.name, row.shoots, row.revenue.toFixed(2)]),
    ]);
  }

  return toCsv([
    ['Period', 'Collected Revenue', 'Shoots'],
    ...periodRows.map((row) => [row.period, row.revenue.toFixed(2), row.shoots]),
  ]);
};
