type RawPaymentRecord = {
  id?: unknown;
  payment_id?: unknown;
  square_payment_id?: unknown;
  squarePaymentId?: unknown;
  stripe_payment_id?: unknown;
  stripePaymentId?: unknown;
  stripe_session_id?: unknown;
  stripeSessionId?: unknown;
  amount?: unknown;
  status?: unknown;
  refunded_at?: unknown;
  refundedAt?: unknown;
  refund_status?: unknown;
  refundStatus?: unknown;
};

type RawPaymentContainer = {
  payments?: unknown;
  base_quote?: unknown;
  tax_rate?: unknown;
  tax_percent?: unknown;
  taxPercent?: unknown;
  tax_amount?: unknown;
  total_quote?: unknown;
  total_paid?: unknown;
  payment?: {
    baseQuote?: unknown;
    base_quote?: unknown;
    taxRate?: unknown;
    tax_rate?: unknown;
    taxAmount?: unknown;
    tax_amount?: unknown;
    totalQuote?: unknown;
    total_quote?: unknown;
    totalPaid?: unknown;
    total_paid?: unknown;
    lastPaymentDate?: unknown;
    lastPaymentType?: unknown;
    paymentStatus?: unknown;
  } | null;
  last_payment_date?: unknown;
  last_payment_type?: unknown;
  payment_type?: unknown;
};

export type NormalizedShootPaymentSummary = {
  baseQuote: number;
  taxRate: number;
  taxAmount: number;
  totalQuote: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
  lastPaymentType?: string;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const pickFirstDefinedNumber = (...values: unknown[]): number => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    return toNumber(value);
  }

  return 0;
};

export const sumCompletedPayments = (payments: unknown): number => {
  if (!Array.isArray(payments)) {
    return 0;
  }

  const seenKeys = new Set<string>();

  return payments.reduce((sum, payment) => {
    const record = (payment ?? {}) as RawPaymentRecord;
    const status = String(record.status ?? '').trim().toLowerCase();
    if (status && status !== 'completed') {
      return sum;
    }

    const refundStatus = String(record.refund_status ?? record.refundStatus ?? '').trim().toLowerCase();
    if (record.refunded_at || record.refundedAt || refundStatus === 'refunded') {
      return sum;
    }

    const dedupeKey =
      toOptionalString(record.stripe_session_id) ||
      toOptionalString(record.stripeSessionId) ||
      toOptionalString(record.stripe_payment_id) ||
      toOptionalString(record.stripePaymentId) ||
      toOptionalString(record.square_payment_id) ||
      toOptionalString(record.squarePaymentId) ||
      toOptionalString(record.payment_id) ||
      toOptionalString(record.id);

    if (dedupeKey) {
      const normalizedKey = dedupeKey.toLowerCase();
      if (seenKeys.has(normalizedKey)) {
        return sum;
      }
      seenKeys.add(normalizedKey);
    }

    return sum + toNumber(record.amount);
  }, 0);
};

const hasCompletedPayment = (payments: unknown): boolean => {
  if (!Array.isArray(payments)) {
    return false;
  }

  return payments.some((payment) => {
    const record = (payment ?? {}) as RawPaymentRecord;
    const status = String(record.status ?? '').trim().toLowerCase();
    return !status || status === 'completed';
  });
};

export const normalizeShootPaymentSummary = (
  rawShoot: RawPaymentContainer | null | undefined,
): NormalizedShootPaymentSummary => {
  const payment = rawShoot?.payment ?? null;
  const completedPaymentsTotal = sumCompletedPayments(rawShoot?.payments);
  const hasCanonicalTotalPaid =
    rawShoot?.total_paid !== undefined ||
    payment?.totalPaid !== undefined ||
    payment?.total_paid !== undefined;

  const baseQuote = pickFirstDefinedNumber(
    rawShoot?.base_quote,
    payment?.baseQuote,
    payment?.base_quote,
  );
  const taxRate = pickFirstDefinedNumber(
    rawShoot?.tax_rate,
    payment?.taxRate,
    payment?.tax_rate,
    rawShoot?.tax_percent,
    rawShoot?.taxPercent,
  );
  const taxAmount = pickFirstDefinedNumber(
    rawShoot?.tax_amount,
    payment?.taxAmount,
    payment?.tax_amount,
  );
  const totalQuote = pickFirstDefinedNumber(
    rawShoot?.total_quote,
    payment?.totalQuote,
    payment?.total_quote,
  );
  const totalPaid = hasCanonicalTotalPaid
    ? pickFirstDefinedNumber(
        payment?.totalPaid,
        payment?.total_paid,
        rawShoot?.total_paid,
      )
    : (hasCompletedPayment(rawShoot?.payments) ? completedPaymentsTotal : 0);

  return {
    baseQuote,
    taxRate,
    taxAmount,
    totalQuote,
    totalPaid,
    balance: Math.max(totalQuote - totalPaid, 0),
    lastPaymentDate:
      toOptionalString(rawShoot?.last_payment_date) ||
      toOptionalString(payment?.lastPaymentDate),
    lastPaymentType:
      toOptionalString(rawShoot?.last_payment_type) ||
      toOptionalString(rawShoot?.payment_type) ||
      toOptionalString(payment?.lastPaymentType) ||
      toOptionalString(payment?.paymentStatus),
  };
};
