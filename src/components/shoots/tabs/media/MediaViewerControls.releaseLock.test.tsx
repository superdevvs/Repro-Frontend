import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaViewerPreviewSizeControls, MediaViewerZoomControls } from './MediaViewerControls';
import { useMediaViewerController } from './useMediaViewerController';

vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));
afterEach(cleanup);

const file: MediaFile = {
  id: 'locked', filename: 'photo.jpg', uses_watermark: true,
  web_url: 'https://media.test/watermarked-web.jpg',
  original_url: 'https://media.test/original.jpg',
};
const base = {
  isOpen: true, files: [file], currentIndex: 0,
  onClose: vi.fn(), onIndexChange: vi.fn(), getImageUrl: () => '',
};

describe('release-locked lightbox', () => {
  it('hides both desktop and mobile size selectors while retaining zoom', () => {
    const { result } = renderHook(() => useMediaViewerController({ ...base, isClient: true }));
    render(<>
      <MediaViewerPreviewSizeControls model={result.current!} />
      <MediaViewerZoomControls model={result.current!} />
    </>);
    expect(screen.queryByRole('button', { name: /^(Full size|Full|Web size|Web)$/ })).toBeNull();
    expect(screen.getByTitle('Zoom in (+)')).toBeInTheDocument();
    expect(result.current!.imageUrl).toBe(file.web_url);
    expect(result.current!.fullSizeAvailable).toBe(false);
  });

  it('returns to the preview if access is revoked while full size is selected', () => {
    const { result, rerender } = renderHook(
      ({ canViewFullSize }) => useMediaViewerController({ ...base, canViewFullSize }),
      { initialProps: { canViewFullSize: true } },
    );
    act(() => result.current!.setPreviewMode('full'));
    expect(result.current!.previewMode).toBe('full');
    expect(result.current!.imageUrl).toBe(file.web_url);
    rerender({ canViewFullSize: false });
    expect(result.current!.imageUrl).toBe(file.web_url);
  });

  it('keeps size controls available for released media', () => {
    const { result } = renderHook(() => useMediaViewerController({ ...base, files: [{ ...file, uses_watermark: false }], canViewFullSize: true }));
    render(<MediaViewerPreviewSizeControls model={result.current!} />);
    expect(screen.getByRole('button', { name: 'Full size' })).toBeEnabled();
  });
});
