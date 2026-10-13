import { describe, expect, it, vi } from 'vitest';
import { normalizeShootMediaFile } from '@/hooks/useShootFiles';
import { getMediaFullSizeImageUrl, getMediaImageUrlCandidates, getMediaSrcSet, getMediaVideoPreviewUrl, getMediaVideoUrl, getMediaVideoUrlCandidates, getMediaViewerImageCandidates } from './mediaPreviewUtils';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));

const preview = `https://reprodashboard.com/api/public/shoot-media/curation-preview/156/12/10?expires=1900000000&signature=${'a'.repeat(64)}`;
const original = 'https://reprodashboard.com/protected/original.jpg';
describe('hidden customer derived previews', () => {
  it('keeps the signed preview when every preview alias and the normalized url fallback are identical', () => {
    const file = normalizeShootMediaFile({ id: 12, shoot_id: 156, filename: 'hidden.jpg', media_type: 'edited', workflow_stage: 'verified', is_hidden: true,
      media_curation_scope: 'customer', can_download: false, url: preview, thumb_url: preview, grid_url: preview, web_url: preview, medium_url: preview, large_url: preview });
    expect(getMediaViewerImageCandidates(file)).toEqual([preview]);
    expect(getMediaImageUrlCandidates(file, 'grid')).toEqual([preview]);
    expect(getMediaSrcSet(file)).toBe(`${preview} 600w`);
    expect(getMediaFullSizeImageUrl(file)).toBe('');
  });
  it('never exposes a stale original on a hidden customer row and preserves contractor preview/original behavior', () => {
    const file = normalizeShootMediaFile({ id: 12, filename: 'hidden.jpg', is_hidden: true, media_curation_scope: 'customer', can_download: false,
      original_url: original, url: preview, thumb_url: preview, web_url: preview });
    expect(getMediaViewerImageCandidates(file)).toEqual([preview]);
    expect(getMediaFullSizeImageUrl(file)).toBe('');
    const contractor = { ...file, media_curation_scope: 'contractor' as const, can_download: true };
    expect(getMediaViewerImageCandidates(contractor)).toEqual([preview]);
    expect(getMediaFullSizeImageUrl(contractor)).toBe(original);
  });
  it('rejects an original reused as every preview alias during optimistic hide until signed metadata arrives', () => {
    const visible = normalizeShootMediaFile({ id: 12, shoot_id: 156, filename: 'legacy.jpg', media_curation_scope: 'customer',
      original_url: original, url: original, thumb_url: original, web_url: original, grid_url: original, medium_url: original, large_url: original });
    expect(getMediaImageUrlCandidates(visible, 'grid')).toContain(original);
    const optimisticHidden = { ...visible, is_hidden: true };
    expect(getMediaViewerImageCandidates(optimisticHidden)).toEqual([]);
    expect(getMediaImageUrlCandidates(optimisticHidden, 'grid')).toEqual([]);
    expect(getMediaImageUrlCandidates(optimisticHidden, 'original')).toEqual([]);
    expect(getMediaSrcSet(optimisticHidden)).toBe('');
    expect(getMediaFullSizeImageUrl(optimisticHidden)).toBe('');
    expect(getMediaViewerImageCandidates({ ...optimisticHidden, web_url: preview, thumb_url: preview, grid_url: preview })).toEqual([preview]);
  });
  it.each([
    preview.replace('/156/12/10', '/156/13/10'),
    preview.replace('/156/12/10', '/157/12/10'),
    preview.replace('/156/12/10', '/156/12/not-a-viewer'),
    preview.replace('signature=' + 'a'.repeat(64), 'signature=not-signed'),
    preview.replace('expires=1900000000&', ''),
    preview + '&path=original.jpg',
    original,
    'data:image/png;base64,secret',
  ])('rejects invalid restore candidate %s', candidate => {
    const file = normalizeShootMediaFile({ id: 12, shoot_id: 156, filename: 'hidden.jpg', is_hidden: true, media_curation_scope: 'customer',
      original_url: original, url: candidate, thumb_url: candidate, web_url: candidate, grid_url: candidate });
    expect(getMediaViewerImageCandidates(file)).toEqual([]);
    expect(getMediaImageUrlCandidates(file, 'grid')).toEqual([]);
    expect(getMediaFullSizeImageUrl(file)).toBe('');
  });
  it('blocks hidden customer original video and generic preview streams while preserving a signed poster', () => {
    const video = normalizeShootMediaFile({ id: 12, shoot_id: 156, filename: 'hidden.mp4', media_type: 'video', file_type: 'video/mp4',
      is_hidden: true, media_curation_scope: 'customer', original_url: original, url: original, thumb_url: preview });
    expect(getMediaVideoUrlCandidates(video)).toEqual([]);
    expect(getMediaVideoPreviewUrl(video)).toBe('');
    expect(getMediaVideoUrl(video)).toBe('');
    expect(getMediaImageUrlCandidates(video, 'thumb')).toEqual([preview]);
    expect(getMediaVideoUrlCandidates({ ...video, media_curation_scope: 'contractor' })).toContain(original);
  });
});
