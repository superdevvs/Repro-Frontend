export interface PaymentDetailMap {
  check_number?: string | number | null;
  notes?: string | null;
  payment_breakdown?: unknown;
  [key: string]: unknown;
}

export type PaymentDetails = PaymentDetailMap | null | undefined;

export interface PaymentBreakdownItem {
  method: string;
  amount: number;
  details?: PaymentDetailMap | null;
  paid_at?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  square: 'Card',
  stripe: 'Card',
  zelle: 'Zelle',
  cash: 'Cash',
  check: 'Cheque',
  cheque: 'Cheque',
  ach: 'ACH',
  other: 'Other',
  manual: 'Other',
  bank_transfer: 'ACH',
  mixed: 'Mixed',
};

export const normalizePaymentMethod = (method?: string | null): string | null => {
  if (!method) return null;
  const key = String(method).toLowerCase();
  if (['n/a', 'na', 'unknown', 'unavailable', 'none', 'null'].includes(key.trim())) {
    return null;
  }
  if (key === 'manual') return 'other';
  if (key === 'bank_transfer') return 'ach';
  if (key === 'cheque') return 'check';
  return key;
};

export const getPaymentMethodLabel = (method?: string | null): string => {
  if (!method) return 'N/A';
  const normalized = normalizePaymentMethod(method);
  if (!normalized) return 'N/A';
  return METHOD_LABELS[normalized] || method;
};

const CARD_METHODS = new Set(['square', 'stripe']);
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const getDetailValue = (details: PaymentDetailMap, keys: string[]): string | null => {
  for (const key of keys) {
    const value = details[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return null;
};

const formatCardBrand = (brand?: string | null): string | null => {
  if (!brand) return null;

  const normalized = brand.trim().toLowerCase();
  if (!normalized) return null;

  const labels: Record<string, string> = {
    amex: 'American Express',
    american_express: 'American Express',
    americanexpress: 'American Express',
    mastercard: 'Mastercard',
    master_card: 'Mastercard',
    visa: 'Visa',
    discover: 'Discover',
    diners: 'Diners Club',
    diners_club: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };

  return labels[normalized] || brand.trim();
};

const formatSinglePaymentMethod = (method?: string | null, details?: PaymentDetails): string => {
  if (!method) return 'N/A';
  const normalized = normalizePaymentMethod(method);
  const label = METHOD_LABELS[normalized || ''] || method;
  if (!details || typeof details !== 'object') {
    return label;
  }

  if (normalized && CARD_METHODS.has(normalized)) {
    const brand = formatCardBrand(getDetailValue(details, ['brand', 'card_brand', 'cardBrand']));
    const last4 = getDetailValue(details, ['last4', 'last_4', 'card_last4', 'cardLast4']);

    if (brand && last4) {
      return `${brand} - ${last4}`;
    }

    if (brand) {
      return brand;
    }

    if (last4) {
      return `${label} - ${last4}`;
    }
  }

  const suffixes: string[] = [];
  if (normalized === 'check' && details.check_number) {
    suffixes.push(`#${details.check_number}`);
  }
  if (details.notes) {
    suffixes.push(String(details.notes));
  }

  return suffixes.length ? `${label} (${suffixes.join(' - ')})` : label;
};

const toMoney = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const getPaymentBreakdown = (
  method?: string | null,
  details?: PaymentDetails,
  fallbackAmount?: number | null,
): PaymentBreakdownItem[] => {
  const detailMap = details && typeof details === 'object' ? details : null;
  const rawBreakdown = Array.isArray(detailMap?.payment_breakdown)
    ? detailMap.payment_breakdown
    : [];

  const parsedBreakdown = rawBreakdown
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const normalizedMethod = normalizePaymentMethod(
        typeof record.method === 'string' ? record.method : null,
      );
      const amount = toMoney(record.amount);
      if (!normalizedMethod || amount === null || amount <= 0) {
        return null;
      }

      return {
        method: normalizedMethod,
        amount,
        details:
          record.details && typeof record.details === 'object'
            ? (record.details as PaymentDetailMap)
            : null,
        paid_at: typeof record.paid_at === 'string' ? record.paid_at : null,
      } satisfies PaymentBreakdownItem;
    })
    .filter(Boolean) as PaymentBreakdownItem[];

  if (parsedBreakdown.length > 0) {
    return parsedBreakdown;
  }

  const normalizedMethod = normalizePaymentMethod(method);
  const amount = toMoney(fallbackAmount);

  if (!normalizedMethod || amount === null || amount <= 0) {
    return [];
  }

  return [
    {
      method: normalizedMethod,
      amount,
      details: detailMap,
      paid_at: null,
    },
  ];
};

export const getPaymentMethodSummary = (method?: string | null, details?: PaymentDetails): string => {
  const breakdown = getPaymentBreakdown(method, details);

  if (breakdown.length > 1) {
    return breakdown
      .map((entry) => getPaymentMethodLabel(entry.method))
      .filter((label, index, items) => label !== 'N/A' && items.indexOf(label) === index)
      .join(' + ');
  }

  if (breakdown.length === 1) {
    return formatSinglePaymentMethod(breakdown[0].method, breakdown[0].details ?? details);
  }

  return formatSinglePaymentMethod(method, details);
};

export const formatPaymentBreakdown = (
  method?: string | null,
  details?: PaymentDetails,
  fallbackAmount?: number | null,
): string | null => {
  const breakdown = getPaymentBreakdown(method, details, fallbackAmount);
  if (breakdown.length === 0) {
    return null;
  }

  return breakdown
    .map((entry) => `${getPaymentMethodLabel(entry.method)} ${currencyFormatter.format(entry.amount)}`)
    .join(' + ');
};

export const formatPaymentMethod = (method?: string | null, details?: PaymentDetails): string =>
  getPaymentMethodSummary(method, details);
