import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { V4Workspace } from '@/components/studio/v4/types';
import { useWorkspaceDraft } from './useWorkspaceDraft';

const workspace = (): V4Workspace => ({
  id: 'one', name: 'Georgetown', presetId: 'listing-ready', media: [{ id: 'a', kind: 'image', name: 'Exterior', url: '/a.jpg', thumbnailUrl: '/a.jpg' }],
  config: { prompt: '', ratio: '9:16', duration: 30, transition: 'none', transitionDuration: 0, text: { title: '', subtitle: '', style: 'none', position: 'bottom' }, adjustments: {}, frames: [{ mediaId: 'a', method: 'fit', duration: 5 }] },
  status: 'draft', progress: null, error: null, outputs: [], preparedFrames: [], createdAt: '', updatedAt: '',
});
afterEach(cleanup);
describe('workspace draft and polling', () => {
  it('keeps unsaved changes during polling and becomes clean after the matching save', () => {
    const initial = workspace();
    const { result, rerender } = renderHook(({ server }) => useWorkspaceDraft(server), { initialProps: { server: initial } });
    act(() => result.current.setConfig(current => ({ ...current, prompt: 'Keep window shapes' })));
    rerender({ server: { ...initial, progress: 40, updatedAt: 'later' } });
    expect(result.current.config.prompt).toBe('Keep window shapes');
    expect(result.current.dirty).toBe(true);
    rerender({ server: { ...initial, config: result.current.config } });
    expect(result.current.dirty).toBe(false);
  });

  it('replaces stale selections after the user changes source media', () => {
    const initial = workspace();
    const { result, rerender } = renderHook(({ server }) => useWorkspaceDraft(server), { initialProps: { server: initial } });
    act(() => result.current.setConfig(current => ({ ...current, prompt: 'Unsaved old source' })));
    const next = { ...initial, media: [{ ...initial.media[0], id: 'b' }], config: { ...initial.config, frames: [{ mediaId: 'b', method: 'crop' as const, duration: 5 }] } };
    rerender({ server: next });
    expect(result.current.config).toEqual(next.config);
    expect(result.current.dirty).toBe(false);
  });
});
