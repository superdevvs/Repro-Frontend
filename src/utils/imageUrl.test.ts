import { describe, expect, it, vi } from 'vitest';
import { normalizeImageUrl } from './imageUrl';

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }));

describe('normalizeImageUrl private shoot media', () => {
  it('does not map shoot object keys onto the public /storage alias', () => {
    expect(normalizeImageUrl('shoots/42/thumbs/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/thumbs/front.jpg',
    );
    expect(normalizeImageUrl('/storage/shoots/42/thumbs/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/thumbs/front.jpg',
    );
    expect(normalizeImageUrl('https://reprodashboard.com/storage/shoots/42/web/front.jpg')).toBe(
      'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/web/front.jpg',
    );
  });

  it('keeps avatars on the public storage prefix', () => {
    expect(normalizeImageUrl('avatars/user.png')).toBe('https://reprodashboard.com/storage/avatars/user.png');
  });

  it('does not send share-link zips through /storage/share-links', () => {
    expect(normalizeImageUrl('share-links/9/pack.zip')).toBe('https://reprodashboard.com/share-links/9/pack.zip');
    expect(normalizeImageUrl('/storage/share-links/9/pack.zip')).toBe(
      'https://reprodashboard.com/share-links/9/pack.zip',
    );
  });
});
