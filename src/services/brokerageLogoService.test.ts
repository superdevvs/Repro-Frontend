import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrokerageLogo, saveBrokerageLogo } from './brokerageLogoService';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: mocks }));
beforeEach(() => vi.clearAllMocks());

describe('brokerage logo API', () => {
  it('sends the actual file in multipart form data for the selected client', async () => {
    const expected = { logo: '/saved.png', can_manage: true };
    mocks.post.mockResolvedValue({ data: { data: expected } });
    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    expect(await saveBrokerageLogo('42', file)).toEqual(expected);
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toBe('/users/42/brokerage-logo');
    expect(body.get('logo')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('reads the persisted server state and removes through the same account endpoint', async () => {
    mocks.get.mockResolvedValue({ data: { data: { logo: '/saved.png', can_manage: false } } });
    mocks.delete.mockResolvedValue({ data: { data: { logo: null, can_manage: true } } });
    expect(await getBrokerageLogo(42)).toEqual({ logo: '/saved.png', can_manage: false });
    expect(await saveBrokerageLogo(42, null)).toEqual({ logo: null, can_manage: true });
    expect(mocks.delete).toHaveBeenCalledWith('/users/42/brokerage-logo');
  });
});
