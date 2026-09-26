export interface LogDeliveryState {
  total: number;
  lastLossAt: number | null;
  recentLosses: number;
}
export function logDelivery(previous: LogDeliveryState | null, total: number, now = Date.now()): LogDeliveryState {
  if (!Number.isFinite(total) || total < 0) throw new Error("Invalid Alloy loss counter");
  // A first reading establishes a baseline; a reset starts a new Alloy counter.
  const added = previous ? (total >= previous.total ? total - previous.total : total) : 0;
  const recent = previous?.lastLossAt !== null && previous?.lastLossAt !== undefined &&
    now >= previous.lastLossAt && now - previous.lastLossAt < 300000;
  return {
    total,
    lastLossAt: added > 0 ? now : (recent ? previous!.lastLossAt : null),
    recentLosses: (recent ? previous!.recentLosses : 0) + added,
  };
}
