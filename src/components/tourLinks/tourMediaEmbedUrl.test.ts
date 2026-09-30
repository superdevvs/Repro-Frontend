import { describe, expect, it } from 'vitest';
import { getTourMediaEmbedUrl } from './tourMediaEmbedUrl';

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
