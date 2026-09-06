import { describe, expect, it } from 'vitest';
import type { V4Config, V4Media, V4Output } from '@/components/studio/v4/types';
import { containRect, currentPreparedFrame, latestOutputs, prepareMethod, regionFromPoints, selectedFrames } from './workspaceLogic';

describe('V4 workspace media and revision boundaries', () => {
  it('preserves selected order, excludes stale/video IDs, and leaves an empty selection empty', () => {
    const media = [{ id: 'a', kind: 'image' }, { id: 'b', kind: 'raw' }, { id: 'v', kind: 'video' }] as V4Media[];
    const config = { frames: ['b', 'a', 'b', 'missing', 'v'].map(mediaId => ({ mediaId, duration: 5, method: 'fit' })) } as V4Config;
    expect(selectedFrames(config, media).map(frame => frame.mediaId)).toEqual(['b', 'a']);
    expect(selectedFrames({ ...config, frames: [] }, media)).toEqual([]);
  });

  it('shows only completed versions and never promotes a pending/failed revision over a valid output', () => {
    const make = (id: string, mediaId: string, version: number, status = 'completed', url = 'https://media.test/output.jpg'): V4Output => ({ id, mediaId, version, status, url, kind: 'image' });
    const result = latestOutputs([make('a1', 'a', 1), make('a4', 'a', 4), make('a5', 'a', 5, 'failed'), make('a6', 'a', 6, 'pending'), make('b2', 'b', 2, 'ready'), make('b3', 'b', 3, 'completed', '')]);
    expect([...result.values()].map(output => output.id)).toEqual(['a4', 'b2']);
  });

  it('requires matching media, preparation method and a completed frame', () => {
    const frames = [
      { mediaId: 'a', method: 'crop' as const, version: 9, status: 'completed', url: '/crop.jpg' },
      { mediaId: 'a', method: 'extend' as const, version: 2, status: 'ready', url: '/extended.jpg' },
      { mediaId: 'a', method: 'extend' as const, version: 3, status: 'preparing', url: '/pending.jpg' },
    ];
    expect(currentPreparedFrame(frames, 'a', 'extend')?.url).toBe('/extended.jpg');
    expect(currentPreparedFrame(frames, 'b', 'extend')).toBeUndefined();
  });

  it('selects fit for matching formats and extension only for a portrait target', () => {
    expect(prepareMethod(900, 1600, '9:16')).toBe('fit');
    expect(prepareMethod(1600, 900, '9:16')).toBe('extend');
    expect(prepareMethod(1600, 900, '4:5')).toBe('extend');
    expect(prepareMethod(900, 1600, '16:9')).toBe('crop');
  });

  it('normalizes reverse/outside drags and aligns feedback to the actual contained image', () => {
    expect(regionFromPoints({ x: 1.2, y: .8 }, { x: -.1, y: .2 })).toEqual({ x: 0, y: .2, width: 1, height: .6000000000000001 });
    expect(containRect(800, 600, 1600, 900)).toEqual({ x: 0, y: 75, width: 800, height: 450 });
    expect(containRect(800, 600, 600, 1200)).toEqual({ x: 250, y: 0, width: 300, height: 600 });
  });
});
