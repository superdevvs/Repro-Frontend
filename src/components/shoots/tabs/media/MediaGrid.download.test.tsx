import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
afterEach(cleanup);

describe('media grid file download buttons', () => {
  it.each(['grid', 'list'] as const)('keeps only the active %s file disabled with an inside-button spinner', (viewMode) => {
    const onDownloadSingle = vi.fn();
    const { rerender } = render(<MediaGrid {...props} viewMode={viewMode} onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set(['a'])} />);
    const buttons = screen.getAllByRole('button', { name: 'Download image' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-busy')).toBe('true');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect(buttons[0].querySelector('.animate-spin')).not.toBeNull();
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onDownloadSingle).toHaveBeenCalledTimes(1);
    expect(onDownloadSingle).toHaveBeenCalledWith('b');
    rerender(<MediaGrid {...props} viewMode={viewMode} onDownloadSingle={onDownloadSingle} downloadingFileIds={new Set()} />);
    const readyButton = screen.getAllByRole('button', { name: 'Download image' })[0];
    expect(readyButton.getAttribute('aria-busy')).toBe('false');
    expect((readyButton as HTMLButtonElement).disabled).toBe(false);
    expect(readyButton.querySelector('.animate-spin')).toBeNull();
  });

  it('shows a permitted grid download without granting comment or favorite controls', () => {
    render(<MediaGrid {...props} files={[files[0]]} viewMode="grid" canInteractSingleMedia={false} onDownloadSingle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    expect(screen.queryByTitle('Add comment')).toBeNull();
    expect(screen.queryByTitle('Like image')).toBeNull();
  });
});
