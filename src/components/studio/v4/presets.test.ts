import { describe, expect, it } from 'vitest';
import { findPreset, initialConfig } from './presets';
import type { V4Media } from './types';

const media: V4Media[] = Array.from({ length: 52 }, (_, i) => ({ id: `file:${i + 1}`, fileId: i + 1, shootId: 1, name: `${i + 1}.jpg`, kind: 'image', url: '/photo.jpg', thumbnailUrl: '/photo.jpg' }));
describe('V4 initial edit scope', () => {
  it('keeps every selected photo for a whole-shoot recipe', () => {
    for (const id of ['full-shoot', 'listing-ready', 'color-correction']) {
      const config = initialConfig(findPreset(id), media);
      expect(config.frames.map(f => f.mediaId)).toEqual(media.map(m => m.id));
      // Photo scope must not turn the unused video duration into an invalid API payload.
      expect(config.duration).toBe(30);
    }
  });
  it('starts a walkthrough with six five-second scenes and optional effects off', () => {
    const config = initialConfig(findPreset('walkthrough'), media);
    expect(config.frames).toHaveLength(6);
    expect(config.duration).toBe(30);
    expect(config.transition).toBe('none');
    expect(config.text.style).toBe('none');
    expect(config.frames.every(f => f.method === 'extend' && f.duration === 5)).toBe(true);
  });
  it('does not invent missing scenes for a short shoot', () => {
    const config = initialConfig(findPreset('walkthrough'), media.slice(0, 2));
    expect(config.duration).toBe(10);
    expect(config.frames).toHaveLength(2);
  });
  it('keeps a teaser to three scenes and excludes uploaded video from image generation', () => {
    const source: V4Media[] = [{ ...media[0], kind: 'video' }, ...media.slice(1)];
    const config = initialConfig(findPreset('social-teaser'), source);
    expect(config.duration).toBe(15);
    expect(config.frames[0].mediaId).toBe('file:2');
  });
});
