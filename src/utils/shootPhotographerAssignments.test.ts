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
});
