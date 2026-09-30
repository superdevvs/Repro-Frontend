import { describe, expect, it } from 'vitest';
import {
  filterEditorActiveOperationalShoots,
  isEditorActiveOperationalShoot,
} from './shootHistoryUtils';

describe('editor active operational status filter', () => {
  it('keeps shoots that were just sent to editing (start_editing)', () => {
    expect(isEditorActiveOperationalShoot({ status: 'start_editing' })).toBe(true);
    expect(isEditorActiveOperationalShoot({ status: '', workflowStatus: 'start_editing' })).toBe(true);

    const filtered = filterEditorActiveOperationalShoots([
      { id: '377', status: 'start_editing' },
      { id: '145', status: '', workflowStatus: 'editing' },
      { id: '1', status: 'scheduled' },
    ]);

    expect(filtered.map((shoot) => shoot.id)).toEqual(['377', '145']);
  });
});
