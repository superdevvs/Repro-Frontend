import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShootEditorViewport } from './useShootEditorViewport';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shoot editor visible viewport', () => {
  it('refreshes the layout before opening after a rotation while the editor was closed', () => {
    const visible = Object.assign(new EventTarget(), { width: 1366, height: 900, offsetLeft: 0, offsetTop: 0 });
    vi.stubGlobal('visualViewport', visible);
    const { result, rerender } = renderHook(({ open }) => useShootEditorViewport(open), { initialProps: { open: false } });
    visible.width = 768; visible.height = 1024;
    rerender({ open: true });
    expect(result.current.layout).toBe('tablet');
    expect(result.current.style).toMatchObject({ '--shoot-vw': '768px', '--shoot-vh': '1024px' });
  });
  it('uses the visible tablet area when zoom and a keyboard reduce the layout viewport', async () => {
    const visible = Object.assign(new EventTarget(), { width: 820, height: 1000, offsetLeft: 0, offsetTop: 0 });
    vi.stubGlobal('visualViewport', visible);
    const { result } = renderHook(() => useShootEditorViewport(true));
    expect(result.current.layout).toBe('tablet');
    act(() => { visible.height = 400; visible.width = 600; visible.offsetLeft = 30; visible.offsetTop = 60; visible.dispatchEvent(new Event('resize')); });
    await waitFor(() => expect(result.current.layout).toBe('phone'));
    expect(result.current.short).toBe(true);
    expect(result.current.style).toMatchObject({ '--shoot-vw': '600px', '--shoot-vh': '400px', '--shoot-vleft': '30px', '--shoot-vtop': '60px' });
    act(() => { visible.width = 1366; visible.height = 900; visible.offsetLeft = 0; visible.offsetTop = 0; visible.dispatchEvent(new Event('resize')); });
    await waitFor(() => expect(result.current.layout).toBe('wide'));
    expect(result.current.short).toBe(false);
  });
});
