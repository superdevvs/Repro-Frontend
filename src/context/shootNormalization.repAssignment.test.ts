import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('explicit shoot sales rep assignment', () => {
  it('retains shoot assignment separately from the client account representative', () => {
    const shoot = transformShootFromApi({
      id: 89, rep_id: 10, rep: { id: 10, name: 'Shoot rep' },
      client: { id: 3, rep: { id: 9, name: 'Account rep' } },
    });
    expect(shoot.assignedRepId).toBe('10');
    expect(shoot.rep?.id).toBe('9');
  });

  it('does not grant a shoot assignment from an account rep when rep_id is null', () => {
    const shoot = transformShootFromApi({
      id: 89, rep_id: null, client: { id: 3, rep: { id: 9, name: 'Account rep' } },
    });
    expect(shoot.assignedRepId).toBeNull();
    expect(shoot.rep?.id).toBe('9');
  });

  it('supports the resource shape containing only the explicit top-level rep', () => {
    expect(transformShootFromApi({ id: 89, rep: { id: 10, name: 'Shoot rep' } }).assignedRepId).toBe('10');
  });

  it('preserves an explicit unassigned normalized value even when a display rep exists', () => {
    expect(transformShootFromApi({ id: 89, assignedRepId: null, rep: { id: 9, name: 'Account rep' } }).assignedRepId).toBeNull();
  });
});
