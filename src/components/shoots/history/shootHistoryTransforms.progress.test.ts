import { describe, expect, it } from 'vitest';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { mapShootApiToShootData } from './shootHistoryTransforms';

describe('service progress API normalization', () => {
  it.each(['progress_status', 'progressStatus'])('retains %s in the detailed operational payload', key => {
    const shoot = mapShootApiToShootData({ id: 42, address: 'Status test',
      serviceItems: [{ id: 11, shoot_service_id: 11, service_id: 1, name: 'Zillow Showcase', price: 100, quantity: 1, [key]: 'awaiting_assets' }],
    });
    expect(getShootServiceItems(shoot)[0].source.progress_status).toBe('awaiting_assets');
  });
  it('retains progress in a services-only cached payload', () => {
    const shoot = mapShootApiToShootData({ id: 42, address: 'Status test',
      services: [{ id: 1, shoot_service_id: 11, name: 'Photos', price: 100, quantity: 1, progress_status: 'in_editing' }],
    });
    expect(getShootServiceItems(shoot)[0].source.progress_status).toBe('in_editing');
  });
});
