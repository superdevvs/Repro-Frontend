import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecentSearches } from './useRecentSearches';

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.localStorage.clear(); });

describe('recent searches', () => {
  it('persists only submitted terms and scopes, deduplicates, and bounds the history', () => {
    const { result, unmount } = renderHook(() => useRecentSearches('account-a'));
    act(() => {
      for (let index = 0; index < 10; index++) result.current.remember(`query ${index}`, 'shoots', 'Shoots');
    });
    expect(result.current.entries).toHaveLength(8);
    act(() => result.current.remember('  QUERY 5  ', 'shoots', 'Shoots'));
    expect(result.current.entries).toHaveLength(8);
    expect(result.current.entries[0]).toMatchObject({ query: 'QUERY 5', scope: 'shoots' });
    act(() => result.current.remember('QUERY 5', 'everywhere', 'Everywhere'));
    expect(result.current.entries.filter(entry => entry.query === 'QUERY 5')).toHaveLength(2);
    const stored = [...result.current.entries];
    expect(Object.keys(stored[0]).sort()).toEqual(['id', 'label', 'query', 'scope', 'searchedAt']);
    unmount();
    const again = renderHook(() => useRecentSearches('account-a'));
    expect(again.result.current.entries).toEqual(stored);
  });

  it('isolates account and impersonation identities and supports removing or clearing terms', () => {
    const { result, rerender } = renderHook(({ identity }) => useRecentSearches(identity), { initialProps: { identity: 'admin:1' } });
    act(() => result.current.remember('Private address'));
    rerender({ identity: 'admin:1:impersonating:42' });
    expect(result.current.entries).toEqual([]);
    act(() => result.current.remember('Client address'));
    rerender({ identity: 'admin:1' });
    expect(result.current.entries.map(entry => entry.query)).toEqual(['Private address']);
    act(() => result.current.remove(result.current.entries[0].id));
    expect(result.current.entries).toEqual([]);
    act(() => { result.current.remember('One'); result.current.remember('Two'); });
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(window.localStorage.length).toBe(1); // Other identity's history remains intact.
  });

  it('keeps the palette and results page in sync', () => {
    const first = renderHook(() => useRecentSearches('same-account'));
    const second = renderHook(() => useRecentSearches('same-account'));
    act(() => first.result.current.remember('1447'));
    expect(second.result.current.entries.map(entry => entry.query)).toEqual(['1447']);
    act(() => second.result.current.clear());
    expect(first.result.current.entries).toEqual([]);
  });

  it('keeps search usable when storage is disabled and ignores blank searches', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const { result } = renderHook(() => useRecentSearches('account-a'));
    act(() => { result.current.remember('  '); result.current.remember('1447'); result.current.remember('Lane'); });
    expect(result.current.entries.map(entry => entry.query)).toEqual(['Lane', '1447']);
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
  });

  it('does not persist history without an authenticated identity or accept malformed storage', () => {
    window.localStorage.setItem('repro:recent-searches:v1:account-a', JSON.stringify([null, { query: 'Bad record' }, { query: 'Valid', scope: 'shoots', label: 'Shoots', searchedAt: 1 }]));
    const signedIn = renderHook(() => useRecentSearches('account-a'));
    expect(signedIn.result.current.entries.map(entry => entry.query)).toEqual(['Valid']);
    const signedOut = renderHook(() => useRecentSearches(undefined));
    act(() => signedOut.result.current.remember('Ignored'));
    expect(signedOut.result.current.entries).toEqual([]);
  });
});
