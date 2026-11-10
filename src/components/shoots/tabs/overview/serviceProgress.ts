import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';

export type ServiceProgressCode =
  | 'applied' | 'pending' | 'received' | 'in_editing' | 'drafting' | 'processing'
  | 'awaiting_assets' | 'ready' | 'delivering' | 'delivered' | 'cancelled' | 'on_hold' | 'needs_attention';

type ProgressTone = 'neutral' | 'active' | 'waiting' | 'delivered';
export type ServiceProgress = { code: ServiceProgressCode; label: string; tone: ProgressTone };

const states: Record<ServiceProgressCode, Omit<ServiceProgress, 'code'>> = {
  applied: { label: 'Applied', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'neutral' },
  received: { label: 'Received', tone: 'neutral' },
  in_editing: { label: 'In editing', tone: 'active' },
  drafting: { label: 'Drafting', tone: 'active' },
  processing: { label: 'Processing', tone: 'active' },
  awaiting_assets: { label: 'Awaiting links & floor plans', tone: 'waiting' },
  ready: { label: 'Ready', tone: 'active' },
  delivering: { label: 'Delivering', tone: 'active' },
  delivered: { label: 'Delivered', tone: 'delivered' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  on_hold: { label: 'On hold', tone: 'waiting' },
  needs_attention: { label: 'Needs attention', tone: 'waiting' },
};

export function getServiceProgress(item: NormalizedShootServiceItem): ServiceProgress | null {
  if (item.isInvoiceAdjustment) return null;
  const supplied = item.source.progress_status ?? item.source.progressStatus;
  const workflow = item.workflowStatus?.toLowerCase();
  const delivery = item.deliveryStatus?.toLowerCase();
  let code: ServiceProgressCode;
  if (supplied === 'cancelled' || workflow === 'cancelled' || delivery === 'cancelled') {
    code = 'cancelled';
  } else if (supplied === 'not_applicable' || !item.isDeliverable) {
    code = 'applied';
  } else if (item.source.delivery_components?.some(component => component.status === 'delivered' && !component.without_content)
    && item.source.delivery_components.some(component => !['delivered', 'cancelled'].includes(component.status))) {
    code = 'delivering';
  } else if (typeof supplied === 'string' && Object.prototype.hasOwnProperty.call(states, supplied)) {
    code = supplied as ServiceProgressCode;
  } else {
    // Older cached payloads retain conservative row-level semantics until the
    // refreshed API response supplies provider-aware progress. Never inherit a
    // whole-shoot Delivered flag for unfinished services on a partial order.
    if (workflow === 'delivered' && delivery === 'delivered') code = 'delivered';
    else if (workflow === 'ready' || delivery === 'ready') code = 'ready';
    else if (workflow === 'in_progress') code = 'in_editing';
    else code = 'pending';
  }
  return { code, ...states[code] };
}
