import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewerImageBuffer, type ImageRequest } from './viewerImageBuffer';

class FakeImage {
  static images: FakeImage[] = [];
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1500;
  naturalHeight = 1000;
  decode = vi.fn(() => Promise.resolve());
  removeAttribute = vi.fn();
  constructor() { FakeImage.images.push(this); }
}
const request = (id: number, original = false, bytes = 6_000_000): ImageRequest => ({ key: `${id}`, url: `/photo-${id}.jpg`, original, bytes, current: id === 0 });
afterEach(() => { vi.unstubAllGlobals(); FakeImage.images = []; });
describe('bounded decoded viewer buffer', () => {
  it('limits transfers to two and waits for decoding before displaying a ready frame', async () => {
    vi.stubGlobal('Image', FakeImage);
    const cache = new ViewerImageBuffer(vi.fn(), 192 * 1024 * 1024);
    cache.configure(Array.from({ length: 6 }, (_, i) => request(i)));
    expect(FakeImage.images).toHaveLength(2);
    let decoded!: () => void;
    FakeImage.images[0].decode.mockReturnValue(new Promise<void>((resolve) => { decoded = resolve; }));
    FakeImage.images[0].onload?.();
    expect(cache.entries.get('0')?.state).toBe('loading');
    decoded(); await Promise.resolve();
    expect(cache.entries.get('0')?.state).toBe('ready');
    expect(FakeImage.images).toHaveLength(3);
    cache.dispose();
  });
  it('does not count errors as ready or retry failed URLs on every render', () => {
    vi.stubGlobal('Image', FakeImage);
    const cache = new ViewerImageBuffer(vi.fn(), 100);
    cache.configure([request(0)]);
    FakeImage.images[0].onerror?.();
    cache.configure([request(0)]);
    expect(cache.entries.get('0')?.state).toBe('error');
    expect(FakeImage.images).toHaveLength(1);
  });
  it('retains the current original but rejects speculative originals beyond the memory budget', () => {
    vi.stubGlobal('Image', FakeImage);
    const cache = new ViewerImageBuffer(vi.fn(), 96_000_000);
    cache.configure([request(0, true, 80_000_000), request(1, true, 80_000_000)]);
    expect([...cache.entries.keys()]).toEqual(['0']);
  });
  it('ignores late decoding after navigation/disposal and cancels obsolete transfers', async () => {
    vi.stubGlobal('Image', FakeImage);
    const changed = vi.fn();
    const cache = new ViewerImageBuffer(changed, 100);
    cache.configure([request(0)]);
    const image = FakeImage.images[0];
    image.onload?.();
    cache.dispose();
    await Promise.resolve();
    expect(cache.entries.size).toBe(0);
    expect(changed).not.toHaveBeenCalled();
    expect(image.removeAttribute).toHaveBeenCalledWith('src');
  });
});
