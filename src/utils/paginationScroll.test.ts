import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollPaginatedListToTop } from './paginationScroll';

function dimensions(node: HTMLElement, values: Record<string, number>) {
  Object.entries(values).forEach(([key, value]) => Object.defineProperty(node, key, { configurable: true, value }));
}
function visible(node: HTMLElement, top: number) {
  const rect = { top, left: 0, width: 500, height: 40 } as DOMRect;
  vi.spyOn(node, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect);
}
afterEach(() => { document.body.innerHTML = ''; document.documentElement.style.cssText = ''; vi.restoreAllMocks(); });

describe('scrolling paginated results', () => {
  it('aligns a page list inside main and respects the sticky tab inset', () => {
    const main = document.createElement('main'), list = document.createElement('div');
    document.body.append(main); main.append(list);
    main.style.overflowY = 'auto'; main.style.scrollPaddingTop = '56px'; list.style.scrollMarginTop = '8px';
    dimensions(main, { scrollTop: 1200, scrollLeft: 25, scrollHeight: 2400, clientHeight: 700, clientTop: 1 });
    visible(main, 80); visible(list, -950);
    main.scrollTo = vi.fn();
    scrollPaginatedListToTop(list);
    expect(main.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 105, left: 25, behavior: 'instant' });
  });

  it('resets a nested panel without moving the surrounding page or horizontal position', () => {
    const main = document.createElement('main'), panel = document.createElement('div');
    document.body.append(main); main.append(panel);
    main.style.overflowY = 'auto'; panel.style.overflowY = 'auto';
    visible(panel, 120);
    dimensions(panel, { scrollTop: 400, scrollLeft: 90, scrollHeight: 100, clientHeight: 300 });
    main.scrollTo = vi.fn(); panel.scrollTo = vi.fn();
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    scrollPaginatedListToTop(panel);
    expect(panel.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 90, behavior: 'instant' });
    expect(main.scrollTo).not.toHaveBeenCalled(); expect(windowScroll).not.toHaveBeenCalled();
  });

  it('skips horizontal table wrappers when finding the vertical scroll owner', () => {
    const main = document.createElement('main'), table = document.createElement('div'), list = document.createElement('div');
    document.body.append(main); main.append(table); table.append(list);
    main.style.overflowY = 'auto'; table.style.overflowY = 'auto';
    dimensions(main, { scrollTop: 600, scrollLeft: 0, scrollHeight: 1800, clientHeight: 600, clientTop: 0 });
    dimensions(table, { scrollTop: 0, scrollHeight: 800, clientHeight: 800 });
    visible(main, 0); visible(list, -400);
    main.scrollTo = vi.fn(); table.scrollTo = vi.fn();
    scrollPaginatedListToTop(list);
    expect(main.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 200, left: 0, behavior: 'instant' });
    expect(table.scrollTo).not.toHaveBeenCalled();
  });

  it('ignores an inactive responsive list', () => {
    const list = document.createElement('div');
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    scrollPaginatedListToTop(list);
    expect(windowScroll).not.toHaveBeenCalled();
  });
});
