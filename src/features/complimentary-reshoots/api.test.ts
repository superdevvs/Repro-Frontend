import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patchRequest } = vi.hoisted(() => ({ patchRequest: vi.fn() }));

vi.mock('@/services/api', () => ({
  apiClient: {
    patch: patchRequest,
  },
}));

import { updateShootCompensations } from './api';

describe('complimentary reshoot compensation API', () => {
  beforeEach(() => {
    patchRequest.mockReset();
    patchRequest.mockResolvedValue({ data: { data: { id: 91 } } });
  });

  it('sends the backend bulk compensation contract unchanged', async () => {
    const payload = {
      compensations: [
        { id: 12, mode: 'none' as const, expected_updated_at: '2026-09-01T10:00:00Z' },
        { id: 13, mode: 'custom' as const, amount: 95, expected_updated_at: '2026-09-01T10:01:00Z' },
      ],
    };

    await updateShootCompensations(91, payload);

    expect(patchRequest).toHaveBeenCalledWith('/admin/shoots/91/compensations', payload);
  });
});
