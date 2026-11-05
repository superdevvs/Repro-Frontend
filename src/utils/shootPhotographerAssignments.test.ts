import { describe, expect, it } from 'vitest';
import { getShootPhotographerDisplayName } from './shootPhotographerAssignments';

describe('shoot preview photographers', () => {
  it('uses resolved service assignments and deduplicates the same photographer', () => {
    const darryl = { id: '1134', name: 'Darryl Felton' };
    expect(getShootPhotographerDisplayName({
      photographer: { id: '1123', name: 'Alex Frachetti' },
      serviceObjects: [
        { name: 'HDR', resolved_photographer_id: '1134', resolved_photographer: darryl },
        { name: 'Drone', photographer_id: '1134', photographer: darryl },
      ],
    })).toBe('Darryl Felton');
  });

  it('keeps the primary fallback for legacy records with no service assignment details', () => {
    expect(getShootPhotographerDisplayName({ services: ['HDR'], photographer: { name: 'Darryl Felton' } })).toBe('Darryl Felton');
    expect(getShootPhotographerDisplayName({ services: ['HDR'] })).toBe('Unassigned');
  });
  it('shows only outstanding artists on an Active card, including mixed stale delivery flags', () => {
    expect(getShootPhotographerDisplayName({ hasActiveWork: true, photographer: { id: '1', name: 'Harrison' }, serviceItems: [
      { name: 'Drone', workflow_status: 'delivered', delivery_status: 'delivered', photographer: { id: '1', name: 'Harrison' } },
      { name: 'HDR', workflow_status: 'pending', delivery_status: 'delivered', photographer: { id: '2', name: 'Lee' } },
      { name: 'Cancelled', workflow_status: 'cancelled', photographer: { id: '3', name: 'Other' } },
    ] })).toBe('Lee');
    expect(getShootPhotographerDisplayName({ hasActiveWork: true, photographer: { name: 'Harrison' }, serviceItems: [] })).toBe('Unassigned');
  });
});
