import { useState, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootMediaHeader } from './ShootMediaHeader';

const props = (): ComponentProps<typeof ShootMediaHeader> => ({
  isClient: false, rawFiles: [], editedFiles: [], activeSubTab: 'uploaded', displayTab: 'uploaded', defaultTab: 'uploaded',
  setActiveSubTab: vi.fn(), setDisplayTab: vi.fn(), isPhotographer: false, isEditor: true,
  renderClientEditedCategoryTabs: () => null, renderEditedTab: () => null, renderRawUploadsTab: () => null,
  mediaViewMode: 'grid', toggleMediaViewMode: vi.fn(), sortMenuOpen: false, setSortMenuOpen: vi.fn(),
  sortOrder: 'manual', isDragMode: false, sortSaveStatus: 'idle', changeSortOrder: vi.fn(), toggleDragMode: vi.fn(),
  showUploadTab: false, selectedFiles: new Set(['photo-1']), setRequestManagerOpen: vi.fn(), downloading: false,
  handleDownload: vi.fn(), handleGenerateShareLink: vi.fn(), handleEditorDownloadRaw: vi.fn(),
  canMarkSelectedFiles: false, canDownload: true, isAdmin: false, handleReclassify: vi.fn(), markMenuOptions: [],
  canDelete: false, handleDeleteFiles: vi.fn(),
});

afterEach(cleanup);

function StatefulHeader(options: ComponentProps<typeof ShootMediaHeader>) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  return <ShootMediaHeader {...options} sortMenuOpen={sortMenuOpen} setSortMenuOpen={setSortMenuOpen} />;
}

describe('selected media download buttons', () => {
  it.each([true, false])('uses one download control and blocks duplicate downloads while busy (editor=%s)', (isEditor) => {
    const options = { ...props(), isEditor, displayTab: isEditor ? 'uploaded' as const : 'edited' as const };
    const { rerender } = render(<ShootMediaHeader {...options} />);
    const buttons = screen.getAllByRole('button', { name: 'Download selected files' });
    expect(buttons).toHaveLength(1);
    if (isEditor) {
      fireEvent.click(buttons[0]);
      expect(options.handleEditorDownloadRaw).toHaveBeenCalledWith(false);
    }
    rerender(<ShootMediaHeader {...options} downloading />);
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button.querySelector('svg.animate-spin')).not.toBeNull();
      expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
      fireEvent.click(button);
    });
    expect(options.handleEditorDownloadRaw).toHaveBeenCalledTimes(isEditor ? 1 : 0);
    expect(options.handleDownload).not.toHaveBeenCalled();
    rerender(<ShootMediaHeader {...options} downloading={false} />);
    buttons.forEach((button) => {
      expect(button).toBeEnabled();
      expect(button.querySelector('svg.animate-spin')).toBeNull();
      expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
    });
  });

  it.each([
    ['MLS Optimized', 'small'],
    ['Print Resolution', 'original'],
  ] as const)('downloads the selected files at %s resolution', async (label, size) => {
    const user = userEvent.setup();
    const options = { ...props(), isEditor: false, displayTab: 'edited' as const };
    render(<ShootMediaHeader {...options} />);
    await user.click(screen.getByRole('button', { name: 'Download selected files' }));
    await user.click(screen.getByRole('menuitem', { name: new RegExp(label) }));
    expect(options.handleDownload).toHaveBeenCalledExactlyOnceWith(size);
    expect(options.handleEditorDownloadRaw).not.toHaveBeenCalled();
  });
});

describe('media sort controls', () => {
  const sortProps = (): ComponentProps<typeof ShootMediaHeader> => ({
    ...props(), isEditor: false, selectedFiles: new Set(),
    rawFiles: [{ id: 'photo-1', filename: 'first.jpg' }], sortOrder: 'time',
  });

  it('keeps every ordering option available through one sort control', async () => {
    const user = userEvent.setup();
    const options = sortProps();
    render(<StatefulHeader {...options} />);
    expect(screen.getAllByRole('button', { name: 'Choose media sort order' })).toHaveLength(1);

    for (const [label, order] of [
      ['File Name', 'name'], ['Date Added', 'date'],
      ['Time Captured', 'time'], ['Manual (Drag & Drop)', 'manual'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: 'Choose media sort order' }));
      expect(screen.getByRole('menuitemradio', { name: 'Time Captured' })).toHaveAttribute('aria-checked', 'true');
      await user.click(screen.getByRole('menuitemradio', { name: label }));
      expect(options.changeSortOrder).toHaveBeenLastCalledWith(order);
    }
    expect(options.changeSortOrder).toHaveBeenCalledTimes(4);
  });

  it('stops and restarts dragging without switching away from manual order', async () => {
    const user = userEvent.setup();
    const options = { ...sortProps(), sortOrder: 'manual' as const, isDragMode: true };
    const { rerender } = render(<ShootMediaHeader {...options} />);
    await user.click(screen.getByRole('button', { name: 'Stop reordering media' }));
    rerender(<ShootMediaHeader {...options} isDragMode={false} />);
    await user.click(screen.getByRole('button', { name: 'Start reordering media' }));
    expect(options.toggleDragMode).toHaveBeenCalledTimes(2);
    expect(options.changeSortOrder).not.toHaveBeenCalled();
  });

  it('preserves the editor restriction on sorting', () => {
    render(<ShootMediaHeader {...sortProps()} isEditor sortOrder="manual" isDragMode />);
    expect(screen.queryByRole('button', { name: 'Choose media sort order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reordering media/ })).not.toBeInTheDocument();
  });
});

describe('expandable selection actions', () => {
  it('keeps reclassification and deletion reachable in the additional actions menu', async () => {
    const user = userEvent.setup();
    const options = {
      ...props(), isEditor: false, isAdmin: true, canMarkSelectedFiles: true, canDelete: true,
      markMenuOptions: [{ label: 'Main photos', value: 'photos' as const }],
    };
    render(<ShootMediaHeader {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    act(() => screen.getByRole('menuitem', { name: 'Mark as' }).focus());
    await user.keyboard('{ArrowRight}');
    await user.click(await screen.findByRole('menuitem', { name: 'Main photos' }));
    expect(options.handleReclassify).toHaveBeenCalledExactlyOnceWith('photos');

    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: /Delete 1 selected file/ }));
    expect(options.handleDeleteFiles).toHaveBeenCalledTimes(1);
  });

  it('allows an eligible client to open a request without offering staff actions', async () => {
    const user = userEvent.setup();
    const options = { ...props(), isClient: true, isEditor: false, canCreateRequest: true };
    render(<ShootMediaHeader {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Mark as' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /Create request/i }));
    expect(options.setRequestManagerOpen).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('does not show additional actions when the client cannot create a request', () => {
    const options = { ...props(), isClient: true, isEditor: false, canCreateRequest: false };
    const { rerender } = render(<ShootMediaHeader {...options} />);
    expect(screen.queryByRole('button', { name: 'More selected file actions' })).not.toBeInTheDocument();
    rerender(<ShootMediaHeader {...options} selectedFiles={new Set()} />);
    expect(screen.queryByRole('button', { name: 'Download selected files' })).not.toBeInTheDocument();
  });
});
