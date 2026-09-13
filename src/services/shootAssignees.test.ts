import { afterEach, describe, expect, it, vi } from 'vitest';
import { assigneesForRole, loadShootAssignees } from './shootAssignees';

vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test', 'X-Impersonate-User-Id': '7' }) }));
afterEach(() => vi.unstubAllGlobals());

describe('shoot assignment lookup', () => {
  it('uses the supported light account endpoint and handles primary and secondary roles', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [
      { id: 7, name: 'Test photographer', role: 'photographer' },
      { id: 8, name: 'Dual role', role: 'admin', secondary_roles: ['editor'] },
      { id: 9, name: 'Client', role: 'client' },
    ] }) });
    vi.stubGlobal('fetch', fetcher);
    const users = await loadShootAssignees();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/admin/users?light=1'), expect.objectContaining({ headers: expect.objectContaining({ 'X-Impersonate-User-Id': '7' }) }));
    expect(assigneesForRole(users, 'photographer').map(u => u.id)).toEqual(['7']);
    expect(assigneesForRole(users, 'editor').map(u => u.id)).toEqual(['8']);
  });
  it('reports endpoint errors instead of treating them as an empty account list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(loadShootAssignees()).rejects.toThrow('Unable to load assignment options');
  });
});
