import { describe, expect, it, vi } from 'vitest';
import { readShootListPages } from './readShootListPages';

describe('operational shoot page hydration', () => {
  it('rejects malformed pagination instead of silently omitting work', async () => {
    const readPage = vi.fn();
    await expect(readShootListPages({ data: [1], meta: { last_page: NaN } }, readPage)).rejects.toThrow('Invalid shoot pagination');
    expect(readPage).not.toHaveBeenCalled();
  });

  it('keeps an explicit later-page caller scoped to that page', async () => {
    const first = { data: [2], meta: { last_page: 5 } };
    const readPage = vi.fn();
    expect(await readShootListPages(first, readPage, { page: 2 })).toBe(first);
    expect(readPage).not.toHaveBeenCalled();
  });

  it('stops when the role scope aborts during a page request', async () => {
    const controller = new AbortController();
    const readPage = vi.fn(async () => {
      controller.abort();
      return { data: [2], meta: { last_page: 3 } };
    });
    await expect(readShootListPages({ data: [1], meta: { last_page: 3 } }, readPage, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(readPage).toHaveBeenCalledTimes(1);
  });
});
