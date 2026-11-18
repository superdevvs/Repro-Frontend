import type { DeliveryComponent, DeliveryPlan } from '@/services/mediaMarkService';

/** How missing work is handled: wait for it, deliver it later (defer), or complete it without content. */
export type MissingWork = 'none' | 'later' | 'complete';

export function automaticDeliveryMethod(component: DeliveryComponent, missing: MissingWork | boolean = 'none') {
  const mode: MissingWork = missing === true ? 'later' : missing === false ? 'none' : missing;
  if (component.resolved || ['delivered', 'cancelled'].includes(component.status)) return null;
  if (component.status === 'ready') {
    if (component.methods.includes('media')) return 'media';
    if (component.methods.includes('external')) return 'external';
  }
  if (mode === 'complete') return component.methods.includes('manual_no_content') ? 'manual_no_content' : null;
  if (mode !== 'later' && component.methods.includes('external') && component.reason_codes.includes('external_review_required')) return 'external';
  return mode === 'later' && !component.deferred && component.methods.includes('defer') ? 'defer' : null;
}

/** Work the actor may close without content, including work deferred earlier. */
export const canCompleteWithoutContent = (plan: DeliveryPlan) => plan.capabilities.can_manual_no_content
  && plan.components.some(component => !component.resolved && component.status !== 'ready' && component.methods.includes('manual_no_content'));

export function readyDeliverySelection(plan: DeliveryPlan, fileIds: number[] = []) {
  return plan.components.filter(component => component.status === 'ready' && automaticDeliveryMethod(component)
    && (!fileIds.length || component.file_ids.some(id => fileIds.includes(id)))).map(component => component.id);
}

export function deliveryServiceGroups(plan: DeliveryPlan) {
  const groups = new Map<number, { id: number; name: string; unitId: number | null; components: DeliveryComponent[] }>();
  for (const component of plan.components) {
    const group = groups.get(component.shoot_service_id) ?? {
      id: component.shoot_service_id, name: component.service_name || `Service #${component.shoot_service_id}`,
      unitId: component.unit_id, components: [],
    };
    group.components.push(component);
    groups.set(group.id, group);
  }
  return [...groups.values()];
}
