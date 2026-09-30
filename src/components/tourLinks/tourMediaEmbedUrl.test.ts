import { describe, expect, it } from 'vitest';
import {
  filterVirtualTourEmbeds,
  findDuplicateAmongTourMediaUrls,
  findTourMediaDuplicateConflict,
  getTourMediaEmbedUrl,
  normalizeTourMediaCompareKey,
} from './tourMediaEmbedUrl';

describe('getTourMediaEmbedUrl', () => {
  it('converts a Vimeo share URL into the player embed URL for iframe src', () => {
    expect(
      getTourMediaEmbedUrl('https://vimeo.com/1231608063?share=copy&fl=sv&fe=ci'),
    ).toBe('https://player.vimeo.com/video/1231608063');
  });

  it('converts bare vimeo.com/ID URLs', () => {
    expect(getTourMediaEmbedUrl('https://vimeo.com/1231608063')).toBe(
      'https://player.vimeo.com/video/1231608063',
    );
  });

  it('leaves player.vimeo.com embed URLs as player URLs', () => {
    expect(getTourMediaEmbedUrl('https://player.vimeo.com/video/1231608063')).toBe(
      'https://player.vimeo.com/video/1231608063',
    );
  });

  it('converts YouTube watch URLs to embed URLs', () => {
    expect(getTourMediaEmbedUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(
      'https://www.youtube.com/embed/abcdefghijk',
    );
  });

  it('passes through non-YouTube/Vimeo URLs unchanged', () => {
    expect(getTourMediaEmbedUrl('https://my.matterport.com/show/?m=abc')).toBe(
      'https://my.matterport.com/show/?m=abc',
    );
  });

  it('returns null for empty input', () => {
    expect(getTourMediaEmbedUrl('')).toBeNull();
  });
});

describe('filterVirtualTourEmbeds', () => {
  const vimeoShare = 'https://vimeo.com/1231608063?share=copy&fl=sv&fe=ci';
  const matterport = 'https://my.matterport.com/show/?m=abc123';

  it('filters embeds that normalize to the same player URL as video_link', () => {
    const result = filterVirtualTourEmbeds(
      [
        { id: 'e1', title: 'Video 1', branded: vimeoShare, mls: vimeoShare },
        { id: 'e2', title: 'Video', branded: vimeoShare, mls: vimeoShare },
      ],
      {
        videoUrls: [vimeoShare],
        featuredId: 'e1',
        getValue: (e) => e.branded || e.mls || '',
      },
    );
    expect(result).toEqual([]);
  });

  it('collapses two identical embeds to one when video_link is absent', () => {
    const result = filterVirtualTourEmbeds(
      [
        { id: 'e1', title: 'Video 1', branded: vimeoShare, mls: vimeoShare },
        { id: 'e2', title: 'Video', branded: vimeoShare, mls: vimeoShare },
      ],
      { getValue: (e) => e.branded || e.mls || '' },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('e1');
  });

  it('keeps a distinct Matterport embed alongside listing video', () => {
    const result = filterVirtualTourEmbeds(
      [
        { id: 'vid', title: 'Video', branded: vimeoShare, mls: vimeoShare },
        { id: 'mp', title: '3D Tour', branded: matterport, mls: matterport },
      ],
      {
        videoUrls: [vimeoShare, 'https://player.vimeo.com/video/1231608063'],
        getValue: (e) => e.branded || e.mls || '',
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mp');
    expect(normalizeTourMediaCompareKey(result[0]!.branded!)).toBe(
      normalizeTourMediaCompareKey(matterport),
    );
  });

  it('filters HTML paste embeds whose iframe src matches video_link', () => {
    const html = `<iframe src="${vimeoShare}" width="640" height="360"></iframe>`;
    const result = filterVirtualTourEmbeds(
      [{ id: 'html', title: 'Paste', branded: html, mls: html }],
      {
        videoUrls: ['https://player.vimeo.com/video/1231608063'],
        getValue: (e) => e.branded || '',
      },
    );
    expect(result).toEqual([]);
  });
});

describe('findTourMediaDuplicateConflict', () => {
  const vimeoShare = 'https://vimeo.com/1231608063?share=copy&fl=sv&fe=ci';
  const vimeoPlayer = 'https://player.vimeo.com/video/1231608063';

  it('flags a share URL that matches listing video_link', () => {
    const conflict = findTourMediaDuplicateConflict(
      { url: vimeoShare, label: 'Video 2', kind: 'embed' },
      [{ url: vimeoPlayer, label: 'the listing Video Link', kind: 'video_link' }],
    );
    expect(conflict).not.toBeNull();
    expect(conflict?.existing.kind).toBe('video_link');
    expect(conflict?.message).toMatch(/listing Video Link/i);
  });

  it('flags duplicate embeds in a list', () => {
    const conflict = findDuplicateAmongTourMediaUrls([
      { id: 'a', url: vimeoShare, label: 'Video 1', kind: 'embed' },
      { id: 'b', url: vimeoPlayer, label: 'Video 2', kind: 'embed' },
    ]);
    expect(conflict).not.toBeNull();
    expect(conflict?.candidate.id).toBe('b');
    expect(conflict?.existing.id).toBe('a');
  });

  it('allows distinct Matterport alongside video_link', () => {
    const conflict = findTourMediaDuplicateConflict(
      { url: 'https://my.matterport.com/show/?m=abc', label: '3D', kind: 'embed' },
      [{ url: vimeoShare, label: 'the listing Video Link', kind: 'video_link' }],
    );
    expect(conflict).toBeNull();
  });
});

