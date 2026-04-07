export interface PaymentDetailMap {
  check_number?: string | number | null;
  notes?: string | null;
  [key: string]: unknown;
}

export type PaymentDetails = PaymentDetailMap | null | undefined;

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
};

export const normalizePaymentMethod = (method?: string | null): string | null => {
  if (!method) return null;
  const key = String(method).toLowerCase();
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

export const formatPaymentMethod = (method?: string | null, details?: PaymentDetails): string => {
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
