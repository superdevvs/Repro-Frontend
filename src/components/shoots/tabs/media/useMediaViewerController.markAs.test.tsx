import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaViewerController } from './useMediaViewerController';
import type { MediaFile } from '@/hooks/useShootFiles';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: 'editing_manager' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const editedPhoto = {
  id: '1081',
  filename: 'living.jpg',
  media_type: 'extra',
  mime_type: 'image/jpeg',
  workflowStage: 'completed',
} as MediaFile;

const base = {
  isOpen: true,
  onClose: vi.fn(),
  files: [editedPhoto],
  currentIndex: 0,
  onIndexChange: vi.fn(),
  getImageUrl: () => 'https://example.test/img.jpg',
  shoot: { id: '108' } as Parameters<typeof useMediaViewerController>[0]['shoot'],
  isAdmin: true,
  isClient: false,
};

describe('useMediaViewerController mark as', () => {
  it('exposes Mark as Main photos for EM when canReclassify is set', async () => {
    const onReclassify = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMediaViewerController({
        ...base,
        canReclassify: true,
        onReclassify,
      }),
    );

    expect(result.current).not.toBeNull();
    expect(result.current!.canMarkAs).toBe(true);
    expect(result.current!.viewerMarkMenuOptions.some((o) => o.value === 'photos' && o.label === 'Main photos')).toBe(true);
    expect(result.current!.canSetHero).toBe(true);

    await act(async () => {
      await result.current!.handleMarkAs('photos');
    });
    expect(onReclassify).toHaveBeenCalledWith('1081', 'photos');
  });

  it('hides Mark as when canReclassify is false', () => {
    const { result } = renderHook(() =>
      useMediaViewerController({
        ...base,
        canReclassify: false,
        onReclassify: vi.fn(),
      }),
    );
    expect(result.current!.canMarkAs).toBe(false);
  });
});
