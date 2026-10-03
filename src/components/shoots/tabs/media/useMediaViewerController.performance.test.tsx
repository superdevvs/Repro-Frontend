import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaViewerController } from './useMediaViewerController';
import type { MediaFile } from '@/hooks/useShootFiles';

vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'admin' }, role: 'admin' }) }));
class FakeImage {
  static urls: string[] = [];
  static originals: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1500;
  naturalHeight = 1000;
  decode = () => Promise.resolve();
  removeAttribute() { this.onload = null; }
  url = "";
  set src(url: string) {
    this.url = url;
    FakeImage.urls.push(url);
    if (url.includes('original')) FakeImage.originals.push(this);
    else queueMicrotask(() => this.onload?.());
  }
}
const files: MediaFile[] = Array.from({ length: 24 }, (_, i) => ({ id: `${i}`, filename: `${i}.jpg`, web_url: `https://media.test/web-${i}.jpg`, original_url: `https://media.test/original-${i}.jpg`, width: 4000, height: 3000 }));
const base = { isOpen: true, files, slideshowFiles: files, onClose: vi.fn(), onIndexChange: vi.fn(), getImageUrl: () => '', canViewFullSize: true, canStartSlideshow: true };
beforeEach(() => { vi.stubGlobal('Image', FakeImage); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); FakeImage.urls = []; FakeImage.originals = []; });
describe('lightbox rendition navigation', () => {
  it('keeps Full Size over twenty changes and displays the same-photo preview until the original decodes', async () => {
    const { result, rerender } = renderHook(({ index }) => useMediaViewerController({ ...base, currentIndex: index }), { initialProps: { index: 0 } });
    act(() => result.current!.setPreviewMode('full'));
    for (let index = 0; index < 20; index++) {
      rerender({ index });
      expect(result.current!.previewMode).toBe('full');
      expect(result.current!.imageUrl).toBe(files[index].web_url);
      expect(result.current!.imageStatus).toBe('Loading full size…');
      await waitFor(() => expect(FakeImage.originals.some(image => image.url === files[index].original_url && image.onload)).toBe(true));
      await act(async () => { FakeImage.originals.filter(image => image.url === files[index].original_url).forEach((image) => image.onload?.()); });
      await waitFor(() => expect(result.current!.imageUrl).toBe(files[index].original_url));
    }
  });
  it('uses the selected rendition in slideshow and retains it on exit', async () => {
    const { result } = renderHook(() => useMediaViewerController({ ...base, currentIndex: 0 }));
    act(() => result.current!.setPreviewMode('full'));
    act(() => result.current!.handleEnterSlideshow());
    expect(result.current!.previewMode).toBe('full');
    await waitFor(() => expect(FakeImage.originals.some(image => image.url === files[0].original_url && image.onload)).toBe(true));
    await act(async () => { FakeImage.originals.forEach((image) => image.onload?.()); });
    await waitFor(() => expect(result.current!.slideshowCurrentImageUrl).toBe(files[0].original_url));
    act(() => result.current!.exitSlideshow());
    expect(result.current!.previewMode).toBe('full');
  });
  it('makes no original requests in Web mode or for locked media', async () => {
    const { result, rerender } = renderHook(({ allowed }) => useMediaViewerController({ ...base, currentIndex: 0, canViewFullSize: allowed }), { initialProps: { allowed: false } });
    act(() => result.current!.setPreviewMode('full'));
    await act(async () => { await Promise.resolve(); });
    expect(FakeImage.urls.some((url) => url.includes('original'))).toBe(false);
    rerender({ allowed: true });
    await act(async () => { await Promise.resolve(); });
    expect(result.current!.previewMode).toBe('web');
    expect(FakeImage.urls.some((url) => url.includes('original'))).toBe(false);
  });
});
