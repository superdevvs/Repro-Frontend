import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';

export type ServiceProgressCode =
  | 'pending' | 'received' | 'in_editing' | 'drafting' | 'processing'
  | 'awaiting_assets' | 'ready' | 'delivered' | 'cancelled' | 'on_hold' | 'needs_attention';

type ProgressTone = 'neutral' | 'active' | 'waiting' | 'delivered';
export type ServiceProgress = { code: ServiceProgressCode; label: string; tone: ProgressTone };

const states: Record<ServiceProgressCode, Omit<ServiceProgress, 'code'>> = {
  pending: { label: 'Pending', tone: 'neutral' },
  received: { label: 'Received', tone: 'neutral' },
  in_editing: { label: 'In editing', tone: 'active' },
  drafting: { label: 'Drafting', tone: 'active' },
  processing: { label: 'Processing', tone: 'active' },
  awaiting_assets: { label: 'Awaiting links & floor plans', tone: 'waiting' },
  ready: { label: 'Ready', tone: 'active' },
  delivered: { label: 'Delivered', tone: 'delivered' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  on_hold: { label: 'On hold', tone: 'waiting' },
  needs_attention: { label: 'Needs attention', tone: 'waiting' },
};

export function getServiceProgress(item: NormalizedShootServiceItem): ServiceProgress | null {
  if (item.isInvoiceAdjustment) return null;
  const supplied = item.source.progress_status ?? item.source.progressStatus;
  let code: ServiceProgressCode;
  if (typeof supplied === 'string' && Object.prototype.hasOwnProperty.call(states, supplied)) {
    code = supplied as ServiceProgressCode;
  } else {
    // Older cached payloads retain conservative row-level semantics until the
    // refreshed API response supplies provider-aware progress. Never inherit a
    // whole-shoot Delivered flag for unfinished services on a partial order.
    const workflow = item.workflowStatus?.toLowerCase();
    const delivery = item.deliveryStatus?.toLowerCase();
    if (workflow === 'cancelled' || delivery === 'cancelled') code = 'cancelled';
    else if (workflow === 'delivered' || delivery === 'delivered' || item.source.delivered_at || item.source.deliveredAt) code = 'delivered';
    else if (workflow === 'ready' || delivery === 'ready') code = 'ready';
    else if (workflow === 'in_progress') code = 'in_editing';
    else code = 'pending';
  }
  return { code, ...states[code] };
}
