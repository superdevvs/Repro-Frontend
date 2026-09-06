import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api';
import { downloadWorkspaceOutput } from './downloadOutput';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn().mockReturnValue('blob:authorized-output'); static revokeObjectURL = vi.fn(); });
});
afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('authorized workspace attachment downloads', () => {
  it('requests the exact output through apiClient, saves a versioned filename and releases the object URL', async () => {
    const blob = new Blob(['image bytes'], { type: 'image/png' });
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob });
    let clicked: { href: string; download: string } | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked = { href: this.href, download: this.download }; expect(document.body.contains(this)).toBe(true); });
    await downloadWorkspaceOutput('shoot/workspace', { id: 'image:older-v2', kind: 'image', version: 2 }, 'Margaret / Exterior.CR3');
    expect(apiClient.get).toHaveBeenCalledWith('/studio/workspaces/shoot%2Fworkspace/outputs/image%3Aolder-v2/download', { responseType: 'blob' });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(clicked?.href).toBe('blob:authorized-output');
    expect(clicked?.download).toBe('Margaret - Exterior-v2.png');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:authorized-output');
  });

  it('uses a sensible video filename and still cleans up if the browser cannot start the download', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob(['video bytes'], { type: 'application/octet-stream' }) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe('Georgetown Walkthrough-v3.mp4'); throw new Error('Browser blocked the download'); });
    await expect(downloadWorkspaceOutput('one', { id: 'reel-v3', kind: 'video', version: 3 }, 'Georgetown Walkthrough')).rejects.toThrow('Browser blocked');
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('surfaces an authorization failure and never creates a fake download', async () => {
    const error = new Error('You cannot access this output.');
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(downloadWorkspaceOutput('one', { id: 'v1', kind: 'image', version: 1 }, 'Exterior')).rejects.toBe(error);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects an empty attachment rather than reporting success', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob([]) });
    await expect(downloadWorkspaceOutput('one', { id: 'v1', kind: 'image', version: 1 }, 'Exterior')).rejects.toThrow('empty');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
