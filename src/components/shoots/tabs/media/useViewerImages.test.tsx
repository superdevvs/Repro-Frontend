import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useViewerImages } from './useViewerImages';
import type { MediaFile } from '@/hooks/useShootFiles';

class ImageStub {
  static images: ImageStub[] = [];
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1500;
  naturalHeight = 1000;
  decode = vi.fn(() => Promise.resolve());
  removeAttribute = vi.fn();
  constructor() { ImageStub.images.push(this); }
}
const photo: MediaFile = { id: '1', filename: '1.jpg', web_url: '/web.jpg', original_url: '/original.jpg', width: 4000, height: 3000 };
beforeEach(() => vi.stubGlobal('Image', ImageStub));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); ImageStub.images = []; });

it('refreshes failed authorized metadata once, then loads a renewed URL', async () => {
  const refresh = vi.fn();
  const { result, rerender } = renderHook(({ file }) => useViewerImages([file], 0, 'web', true, true, 'user1', refresh), { initialProps: { file: photo } });
  act(() => ImageStub.images[0].onerror?.());
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  rerender({ file: { ...photo, web_url: '/web.jpg?renewed=1' } });
  expect(ImageStub.images.at(-1)?.src).toBe('/web.jpg?renewed=1');
  await act(async () => ImageStub.images.at(-1)?.onload?.());
  expect(result.current.ready).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('does not use originals for missing Web derivatives or unsupported originals', async () => {
  const { result, rerender } = renderHook(({ file }) => useViewerImages([file], 0, 'web', true, true, 'user1'), { initialProps: { file: { ...photo, web_url: undefined, thumbnail_url: '/thumb.jpg' } } });
  expect(ImageStub.images.every(i => !i.src.includes('original'))).toBe(true);
  expect(result.current.url).toBe('/thumb.jpg');
  rerender({ file: { ...photo, filename: '1.heic', web_url: undefined, thumbnail_url: '/thumb.jpg' } });
  await act(async () => ImageStub.images[0].onload?.());
  expect(result.current.ready).toBe(true);
});

it('drops original transfers on access revocation and prevents late callbacks restoring them', async () => {
  const { result, rerender } = renderHook(({ allowed }) => useViewerImages([photo], 0, 'full', true, allowed, 'user1'), { initialProps: { allowed: true } });
  const original = ImageStub.images.find(i => i.src === '/original.jpg')!;
  const late = original.onload;
  const count = ImageStub.images.length;
  rerender({ allowed: false });
  await act(async () => late?.());
  expect(original.removeAttribute).toHaveBeenCalledWith('src');
  expect(ImageStub.images.slice(count).every(i => !i.src.includes('original'))).toBe(true);
  expect(result.current.url).toBe('/web.jpg');
});

it('does not reuse decoded entries across a media revision', async () => {
  const { result, rerender } = renderHook(({ revision }) => useViewerImages([{ ...photo, content_version: revision }], 0, 'web', true, true, 'user1'), { initialProps: { revision: 1 } });
  await act(async () => ImageStub.images[0].onload?.());
  expect(result.current.ready).toBe(true);
  rerender({ revision: 2 });
  expect(result.current.ready).toBe(false);
  expect(ImageStub.images).toHaveLength(2);
});

it('treats failed decoding as an error, not a ready slideshow frame', async () => {
  const { result } = renderHook(() => useViewerImages([photo], 0, 'full', true, true, 'user1'));
  const original = ImageStub.images.find(i => i.src === '/original.jpg')!;
  original.decode.mockRejectedValue(new Error('corrupt image'));
  await act(async () => original.onload?.());
  expect(result.current.displayed).toBe('web');
  expect(result.current.message).toBe('Full-size preview unavailable');
});
