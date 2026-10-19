import { describe, expect, it } from 'vitest';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { transformShootFromApi } from './shootNormalization';

describe('shoot detail progress normalization', () => {
  it.each(['progress_status', 'progressStatus'])('preserves %s for the actual detail view', field => {
    const shoot = transformShootFromApi({ id: 42, serviceItems: [{
      id: 11, service_id: 1, name: 'Zillow Showcase', price: 100, quantity: 1,
      workflow_status: 'delivered', [field]: 'awaiting_assets',
    }] });
    expect(getShootServiceItems(shoot)[0].source.progress_status).toBe('awaiting_assets');
  });
  it('preserves progress in a service-only cached summary', () => {
    const shoot = transformShootFromApi({ id: 42, services: [{
      id: 1, shoot_service_id: 11, name: 'Photos', price: 100, quantity: 1, progress_status: 'in_editing',
    }] });
    expect(getShootServiceItems(shoot)[0].source.progress_status).toBe('in_editing');
  });
});
