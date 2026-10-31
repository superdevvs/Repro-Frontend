import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { claimListingStudioTrials, downloadListingStudioTrial, getListingStudioTrials } from './listingStudioTrials';

const adapter = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('authToken', 'private-dashboard-session');
  apiClient.defaults.adapter = adapter;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:private-photo'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('Listing Studio authenticated API', () => {
  it('sends the one-time claim in the request body and loads only the authenticated owner list', async () => {
    adapter.mockImplementation(async config => ({ data: { success: true, data: { trials: [] } }, status: 200, statusText: 'OK', headers: {}, config }));
    await claimListingStudioTrials('c'.repeat(64));
    await getListingStudioTrials();
    const claim = adapter.mock.calls[0][0];
    expect(claim.url).toBe('/listing-studio/trials/claim');
    expect(claim.headers.get('Authorization')).toBe('Bearer private-dashboard-session');
    expect(JSON.parse(claim.data)).toEqual({ token: 'c'.repeat(64) });
    expect(claim.params).toBeUndefined();
    expect(adapter.mock.calls[1][0].url).toBe('/listing-studio/trials');
  });
  it('fetches the private photo with authorization and downloads only a local blob URL', async () => {
    const photo = new Blob(['edited photo'], { type: 'image/png' });
    adapter.mockImplementation(async config => ({ data: photo, status: 200, statusText: 'OK', headers: {}, config }));
    let downloadHref = '';
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloadHref = this.href;
      downloadName = this.download;
    });
    await downloadListingStudioTrial({ id: 'trial-123', service: 'staging' });
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe('/listing-studio/trials/trial-123/download');
    expect(config.headers.get('Authorization')).toBe('Bearer private-dashboard-session');
    expect(config.responseType).toBe('blob');
    expect(config.params).toBeUndefined();
    expect(downloadHref).toBe('blob:private-photo');
    expect(downloadName).toBe('listing-studio-staging.png');
    expect(document.querySelector('a[download]')).toBeNull();
  });
  it('does not turn an empty or unexpected response into a downloadable photo', async () => {
    adapter.mockImplementation(async config => ({ data: new Blob(['unexpected html'], { type: 'text/html' }), status: 200, statusText: 'OK', headers: {}, config }));
    await expect(downloadListingStudioTrial({ id: 'trial-123', service: 'twilight' })).rejects.toThrow('not available');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
