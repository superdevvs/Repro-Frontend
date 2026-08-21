export type PaymentRecord = {
  status?: string;
  amount?: number | string;
};

export type ShootPaymentStatusResponse = {
  total_quote?: number | string;
  payments?: PaymentRecord[];
};

export type PaymentSessionConfirmationResponse = {
  last_payment_amount?: number | string | null;
  return_to?: string | null;
};

export type CouponValidationResponse = {
  valid?: boolean;
  discount?: number;
  discount_amount?: number;
  discount_type?: 'percentage' | 'fixed';
  message?: string;
};

export const getCompletedPaymentTotal = (payments?: PaymentRecord[]): number =>
  payments
    ?.filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
