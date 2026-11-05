import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { normalizeShootAutoDelivery } from '@/utils/shootAutoDelivery';
import { transformDashboardOverview } from '@/utils/dashboardTransformers';

describe('server Auto delivery capability projections', () => {
  it.each([true, false])('retains explicit enabled=%s through detail, history and dashboard summaries', enabled => {
    const auto_delivery = { enabled, available: true, can_manage: false, reason: 'Management access required.' };
    const wire = { id: 5930, status: 'active', auto_delivery };
    for (const data of [transformShootFromApi(wire), mapShootApiToShootData(wire)]) {
      expect(data.autoDelivery).toEqual(auto_delivery);
      expect(data.auto_delivery).toEqual(auto_delivery);
      expect(shootDataToSummary(data).autoDelivery).toEqual(auto_delivery);
    }
    const overview = transformDashboardOverview({
      stats: { total_shoots: 1, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
      upcoming_shoots: [], photographers: [], pending_reviews: [], activity_log: [], issues: [],
      workflow: { columns: [{ key: 'uploaded', label: 'In Progress', accent: '#000000', count: 1,
        shoots: [{ ...wire, services: [], is_flagged: false }] }] },
    });
    expect(overview.workflow.columns[0].shoots[0].autoDelivery).toEqual(auto_delivery);
  });

  it.each([undefined, null, {}, { enabled: true }, { enabled: true, available: 'true', can_manage: true }])('does not invent eligibility from an incomplete capability: %j', capability => {
    expect(normalizeShootAutoDelivery(capability)).toBeUndefined();
  });
});
