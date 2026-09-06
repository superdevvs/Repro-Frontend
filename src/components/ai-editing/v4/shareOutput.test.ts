import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareOutputs } from './shareOutput';

afterEach(() => vi.unstubAllGlobals());
describe('generated output sharing', () => {
  it('shares the exact selected version through the native share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined), writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    expect(await shareOutputs('Georgetown V2', [{ name: 'Reel V2', url: 'https://media.test/reel-v2.mp4' }])).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Georgetown V2', url: 'https://media.test/reel-v2.mp4' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies named reviewed versions when native sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareOutputs('Reviewed photos', [{ name: 'Living room V4', url: 'https://media.test/living-v4.jpg' }, { name: 'Exterior V2', url: 'https://media.test/exterior-v2.jpg' }])).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Living room V4\nhttps://media.test/living-v4.jpg\n\nExterior V2\nhttps://media.test/exterior-v2.jpg');
  });

  it('does not copy or claim success when the user cancels the native sheet', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')), clipboard: { writeText } });
    expect(await shareOutputs('Reel', [{ name: 'Reel', url: 'https://media.test/reel.mp4' }])).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copy when the browser rejects native sharing and surfaces copy failure', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('Not supported')), clipboard: { writeText } });
    await expect(shareOutputs('Reel', [{ name: 'Reel', url: 'https://media.test/reel.mp4' }])).rejects.toThrow('Clipboard denied');
  });

  it('does not share an empty output list', async () => {
    const share = vi.fn(); vi.stubGlobal('navigator', { share });
    await expect(shareOutputs('Reel', [])).rejects.toThrow('no generated outputs');
    expect(share).not.toHaveBeenCalled();
  });
});
