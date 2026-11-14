import type { DeliveryComponent, DeliveryPlan } from '@/services/mediaMarkService';

export function automaticDeliveryMethod(component: DeliveryComponent, withoutContent = false) {
  if (component.resolved || ['delivered', 'cancelled'].includes(component.status)) return null;
  if (component.status === 'ready') {
    if (component.methods.includes('media')) return 'media';
    if (component.methods.includes('external')) return 'external';
  }
  if (!withoutContent && component.methods.includes('external') && component.reason_codes.includes('external_review_required')) return 'external';
  return withoutContent && !component.deferred && component.methods.includes('defer') ? 'defer' : null;
}

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
