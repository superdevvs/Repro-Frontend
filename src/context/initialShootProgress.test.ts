import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { createInitialShootProgress } from './initialShootProgress';

describe('initial shoot page publication', () => {
  it('retains edits and deletions made while later pages are in flight', () => {
    let current: ShootData[] = [];
    const progress = createInitialShootProgress(() => true, () => current, next => { current = next; });
    progress.onPage('scheduled', [{ id: 1, status: 'scheduled' }, { id: 2, status: 'scheduled' }], 1);
    current = current.filter(shoot => shoot.id !== '2').map(shoot => ({ ...shoot, workflowStatus: 'ready' }));
    progress.onPage('completed', [{ id: 3, status: 'editing' }], 1);
    progress.onPage('scheduled', [{ id: 2, status: 'scheduled' }, { id: 4, status: 'scheduled' }], 2);
    expect(current.map(shoot => shoot.id)).toEqual(['1', '4', '3']);
    expect(current[0].workflowStatus).toBe('ready');
    expect(progress.deletedIds.has('2')).toBe(true);
  });

  it('orders sections consistently and refuses obsolete account responses', () => {
    let enabled = true;
    let current: ShootData[] = [];
    const progress = createInitialShootProgress(() => enabled, () => current, next => { current = next; });
    progress.onPage('delivered', [{ id: 3, status: 'delivered' }], 1);
    progress.onPage('scheduled', [{ id: 1, status: 'scheduled' }], 1);
    expect(current.map(shoot => shoot.id)).toEqual(['1', '3']);
    enabled = false;
    current = [];
    progress.onPage('completed', [{ id: 2, status: 'editing' }], 1);
    expect(current).toEqual([]);
  });
});
