export type CouponType = 'percentage' | 'fixed';

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  amount: number | string;
  max_uses?: number | null;
  current_uses?: number | null;
  is_active?: boolean | null;
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CouponUpdatePayload {
  code: string;
  type: CouponType;
  amount: number;
  max_uses: number | null;
  valid_until: string | null;
}
