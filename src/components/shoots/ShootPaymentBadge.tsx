import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';

/**
 * One payment indicator for every shoot surface.
 *
 * Four separate implementations of this badge existed (scheduled row, completed
 * row, album card, details header) and they disagreed — `partial` rendered as
 * `outline` in one place and `secondary` in another, and none showed an amount.
 * Colour carries the meaning here: green paid, orange partially paid, red
 * unpaid, with the amount alongside so a client can see what is outstanding
 * without opening the shoot.
 *
 * Yellow is deliberately not used.
 */

export type ShootPaymentBadgeSize = 'sm' | 'md';

const STATUS_STYLES = {
  paid: 'bg-emerald-600 text-white hover:bg-emerald-600 border-transparent',
  partial: 'bg-orange-500 text-white hover:bg-orange-500 border-transparent',
  unpaid: 'bg-red-600 text-white hover:bg-red-600 border-transparent',
} as const;

const STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
} as const;

const formatAmount = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ShootPaymentBadgeProps {
  shoot: ShootData | null | undefined;
  /** Hide the amount when the surface is too tight for it. */
  showAmount?: boolean;
  size?: ShootPaymentBadgeSize;
  className?: string;
}

export function ShootPaymentBadge({
  shoot,
  showAmount = true,
  size = 'md',
  className,
}: ShootPaymentBadgeProps) {
  if (!shoot) return null;

  const summary = normalizeShootPaymentSummary(shoot);
  const status = summary.paymentStatus ?? 'unpaid';

  // Paid shows what was collected; anything else shows what is still owed, since
  // the outstanding figure is the number that prompts action.
  const amount = status === 'paid' ? summary.totalPaid : summary.balance;
  const shouldShowAmount = showAmount && Number.isFinite(amount) && amount > 0;

  return (
    <Badge
      className={cn(
        STATUS_STYLES[status],
        size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        'font-medium tabular-nums',
        className,
      )}
    >
      {STATUS_LABELS[status]}
      {shouldShowAmount ? ` · ${formatAmount(amount)}` : ''}
    </Badge>
  );
}

export default ShootPaymentBadge;
