import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { getVisibleClientContact } from './clientContactVisibility';
import { canViewVideoEditorClientContext } from './videoEditorClientContext';

describe('video editor client context across shoot loading paths', () => {
  it.each([true, false, undefined])('preserves server authorization through detail and list normalization (%s)', permission => {
    const raw = { id: 42, can_view_video_editor_context: permission, client: { id: 12, name: 'Jordan Client' },
      company_notes: 'Brand the end card.', services: [], scheduled_date: '2026-10-01', time: '10:00' };
    const detail = transformShootFromApi(raw);
    const list = mapShootApiToShootData(raw);
    for (const shoot of [detail, list]) {
      expect(canViewVideoEditorClientContext(shoot)).toBe(permission === true);
      expect(getVisibleClientContact({ client: shoot.client, role: 'editor', shoot }).name).toBe(permission ? 'Jordan Client' : null);
      const card = shootDataToSummary(shoot);
      expect(canViewVideoEditorClientContext(card)).toBe(permission === true);
      expect(card.companyNotes).toBe('Brand the end card.');
    }
  });

  it('treats explicit denial as authoritative when aliases conflict', () => {
    expect(canViewVideoEditorClientContext({ canViewVideoEditorContext: false, can_view_video_editor_context: true })).toBe(false);
  });
});
