export type PaymentDetails = Record<string, any> | null | undefined;

const METHOD_LABELS: Record<string, string> = {
  square: 'Card (Square)',
  zelle: 'Zelle',
  cash: 'Cash',
  check: 'Check',
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
  return key;
};

export const getPaymentMethodLabel = (method?: string | null): string => {
  if (!method) return 'N/A';
  const normalized = normalizePaymentMethod(method);
  if (!normalized) return 'N/A';
  return METHOD_LABELS[normalized] || method;
};

export const formatPaymentMethod = (method?: string | null, details?: PaymentDetails): string => {
  if (!method) return 'N/A';
  const normalized = normalizePaymentMethod(method);
  const label = METHOD_LABELS[normalized || ''] || method;
  if (!details || typeof details !== 'object') {
    return label;
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
