import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { presetAvailability, studioProviderService, type StudioCapabilities } from './studioProviderService';
import { studioWorkspaceService } from './studioWorkspaceService';

vi.mock('./api', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('./studioService', () => ({ studioService: {} }));
describe('Studio provider contracts', () => {
  it('keeps new presets unavailable until the server confirms readiness', () => {
    expect(presetAvailability('sky-replacement').ready).toBe(false);
    expect(presetAvailability('perspective-correction').ready).toBe(false);
    const capabilities = { presets: { 'listing-ready': { ready: false, reason: 'Not configured.' } } } as unknown as StudioCapabilities;
    expect(presetAvailability('listing-ready', capabilities)).toEqual({ ready: false, reason: 'Not configured.' });
  });
  it('uses the sanitized settings contract without substituting or echoing credential values', async () => {
    const settings = { services: [], credentials: { fotello: { keyConfigured: true, teamIdConfigured: false } } };
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: settings } });
    expect(await studioProviderService.save({ credentials: { fotello: { apiKey: 'test-only' } } })).toEqual(settings);
    expect(apiClient.put).toHaveBeenCalledWith('/studio/provider-settings', { credentials: { fotello: { apiKey: 'test-only' } } });
  });
  it('upscales the chosen output version instead of implicitly choosing the latest output', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'w1', status: 'generating' } } });
    await studioWorkspaceService.upscale('w1', 'file:1', 'output-v1');
    expect(apiClient.post).toHaveBeenCalledWith('/studio/workspaces/w1/upscale', { mediaId: 'file:1', outputId: 'output-v1' });
  });
});
