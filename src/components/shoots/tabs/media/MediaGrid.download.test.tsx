import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaGrid } from './MediaGrid';

const files = [
  { id: 'a', filename: 'first.jpg', isExtra: false },
  { id: 'b', filename: 'extra.jpg', isExtra: true },
] as MediaFile[];
const props = {
  files, selectedFiles: new Set<string>(), canSelect: false,
  onSelectionChange: vi.fn(), onFileClick: vi.fn(),
  getImageUrl: () => '/photo.jpg', getSrcSet: () => '', isImage: () => true,
  canDownloadSingleMedia: true, canInteractSingleMedia: true,
};
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function finishDrawerClose(drawer: HTMLElement) {
  expect(drawer.getAttribute('data-state')).toBe('closed');
  // jsdom does not emit the browser's CSS animation completion events.
  for (const [element, animationName] of [[document.querySelector('[data-vaul-overlay]'), 'fadeOut'], [drawer, 'slideToBottom']] as const) {
    if (!element) continue;
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    fireEvent(element, event);
  }
}

describe('media grid file download buttons', () => {
  it('keeps only the active grid file disabled with a compact spinner inside its button', () => {
    const viewMode = 'grid';
    const onDownloadSingle = vi.fn();
    const { rerender } = render(<MediaGrid {...props} viewMode={viewMode} onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set(['a'])} />);
    const buttons = screen.getAllByRole('button', { name: 'Download image' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-busy')).toBe('true');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect(buttons[0].querySelector('svg.animate-spin')).not.toBeNull();
    expect(buttons[0].querySelector('image[href^="/brand/re/"]')).toBeNull();
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    expect(buttons[1].querySelector('svg.animate-spin')).toBeNull();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onDownloadSingle).toHaveBeenCalledTimes(1);
    expect(onDownloadSingle).toHaveBeenCalledWith('b');
    rerender(<MediaGrid {...props} viewMode={viewMode} onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set()} />);
    const readyButton = screen.getAllByRole('button', { name: 'Download image' })[0];
    expect(readyButton.getAttribute('aria-busy')).toBe('false');
    expect((readyButton as HTMLButtonElement).disabled).toBe(false);
    expect(readyButton.querySelector('svg.animate-spin')).toBeNull();
    expect(readyButton.querySelector('image[href^="/brand/re/"]')).toBeNull();
  });

  it('keeps file downloads in the list drawer and updates busy state for the correct file', async () => {
    const onDownloadSingle = vi.fn();
    const { rerender } = render(<MediaGrid {...props} viewMode="list" onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set(['a'])} />);
    expect(screen.queryByRole('button', { name: 'Download image' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Media actions for first.jpg' }));
    const busy = await screen.findByRole('button', { name: 'Download image' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.querySelector('svg.animate-spin')).not.toBeNull();
    fireEvent.click(busy);
    expect(onDownloadSingle).not.toHaveBeenCalled();
    rerender(<MediaGrid {...props} viewMode="list" onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set()} />);
    const ready = screen.getByRole('button', { name: 'Download image' });
    expect((ready as HTMLButtonElement).disabled).toBe(false);
    expect(ready.getAttribute('aria-busy')).toBe('false');
    expect(ready.querySelector('svg.animate-spin')).toBeNull();
    const drawer = screen.getByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    finishDrawerClose(drawer);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Media actions for extra.jpg' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download image' }));
    expect(onDownloadSingle).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('shows a permitted grid download without granting comment or favorite controls', () => {
    render(<MediaGrid {...props} files={[files[0]]} viewMode="grid" canInteractSingleMedia={false} onDownloadSingle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    expect(screen.queryByTitle('Add comment')).toBeNull();
    expect(screen.queryByTitle('Like image')).toBeNull();
  });
});


it.each([['grid', false], ['list', false], ['grid', true]] as const)('marks requested media in orange in %s view (manual %s)', (viewMode, manualSortActive) => {
  render(<MediaGrid {...props} files={[{ ...files[0], has_open_request: true }, files[1]]}
    viewMode={viewMode} sortOrder={manualSortActive ? 'manual' : 'time'} manualSortActive={manualSortActive} />);
  expect(screen.getByText('first.jpg').closest('.border')?.className).toContain('border-orange-500');
  expect(screen.getByText('extra.jpg').closest('.border')?.className).not.toContain('border-orange-500');
});
