import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMediaUploadRetrySelection } from './useMediaUploadRetrySelection';

describe('retained media upload selections', () => {
  it('skips acknowledged files and recovers original File objects when a selection is repeated', () => {
    const { result } = renderHook(() => useMediaUploadRetrySelection('shoot-42:actor-1'));
    const original = [1, 2].map((id) => new File(['raw'], `${id}.cr3`, { lastModified: 1 }));
    const prepared = result.current.prepare('raw', original);
    act(() => result.current.record('raw', prepared, [0]));
    const repeated = original.map((file) => new File(['raw'], file.name, { lastModified: 1 }));
    expect(result.current.prepare('raw', repeated)).toEqual([original[1]]);
    expect(result.current.pending('raw')).toEqual([original[1]]);
    act(() => result.current.record('raw', [original[1]], [0]));
    expect(result.current.pending('raw')).toEqual([]);
  });
  it('drops retained identities when the shoot or authentication scope changes', () => {
    const { result, rerender } = renderHook(({ scope }) => useMediaUploadRetrySelection(scope), { initialProps: { scope: 'first' } });
    result.current.prepare('edited', [new File(['photo'], 'image.jpg')]);
    rerender({ scope: 'second' });
    expect(result.current.pending('edited')).toEqual([]);
  });
});
