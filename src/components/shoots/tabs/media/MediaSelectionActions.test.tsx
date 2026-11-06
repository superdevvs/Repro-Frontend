import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MediaSelectionActions, type MediaSelectionActionsProps } from './MediaSelectionActions';

afterEach(cleanup);

const props = (): MediaSelectionActionsProps => ({
  selectedFiles: new Set(['1']), isClient: false, isEditor: false, isAdmin: false, displayTab: 'edited',
  rawFiles: [], editedFiles: [{ id: '1', filename: 'one.jpg' }],
  sortMenuOpen: false, setSortMenuOpen: vi.fn(), sortOrder: 'time', isDragMode: false,
  sortSaveStatus: 'idle', changeSortOrder: vi.fn(), toggleDragMode: vi.fn(),
  canMarkSelectedFiles: true, onOpenMark: vi.fn(), canDelete: true, handleDeleteFiles: vi.fn(),
  canDownload: true, downloading: false, handleDownload: vi.fn(), handleEditorDownloadRaw: vi.fn(),
  setRequestManagerOpen: vi.fn(), desktop: true,
});

describe('desktop media selection actions', () => {
  it('keeps Sort, Mark, and Delete primary and puts downloads and presentation items in one More menu', async () => {
    const user = userEvent.setup();
    const options = props();
    const hide = vi.fn();
    render(<MediaSelectionActions {...options} presentationActions={<button>Inline mobile tools</button>}
      presentationMenuActions={<DropdownMenuItem onSelect={hide}>Hide selected</DropdownMenuItem>} hasPresentationMenuActions />);
    expect(screen.getByRole('button', { name: 'Choose media sort order' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected files' }));
    expect(options.onOpenMark).toHaveBeenCalledOnce();
    expect(options.handleDeleteFiles).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Download selected files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inline mobile tools' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    expect(screen.getByRole('menuitem', { name: /MLS Optimized/ })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /Print Resolution/ })).toBeVisible();
    const item = screen.getByRole('menuitem', { name: 'Hide selected' });
    expect(within(item).queryByRole('button')).not.toBeInTheDocument();
    await user.click(item);
    expect(hide).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each([['MLS Optimized', 'small'], ['Print Resolution', 'original']] as const)('runs the existing %s download from More', async (label, size) => {
    const user = userEvent.setup();
    const options = props();
    render(<MediaSelectionActions {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: new RegExp(label) }));
    expect(options.handleDownload).toHaveBeenCalledExactlyOnceWith(size);
    expect(options.handleEditorDownloadRaw).not.toHaveBeenCalled();
  });

  it('keeps editor RAW downloads scoped and prevents duplicate downloads while busy', async () => {
    const user = userEvent.setup();
    const options = { ...props(), isEditor: true, displayTab: 'uploaded' as const };
    const view = render(<MediaSelectionActions {...options} />);
    expect(screen.queryByRole('button', { name: 'Choose media sort order' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download selected RAW files' }));
    expect(options.handleEditorDownloadRaw).toHaveBeenCalledExactlyOnceWith(false);
    view.rerender(<MediaSelectionActions {...options} downloading />);
    expect(screen.getByRole('button', { name: 'More selected file actions' })).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    const download = screen.getByRole('menuitem', { name: 'Download selected RAW files' });
    expect(download).toHaveAttribute('data-disabled');
    fireEvent.click(download);
    expect(options.handleEditorDownloadRaw).toHaveBeenCalledOnce();
    expect(options.handleDownload).not.toHaveBeenCalled();
  });

  it('keeps desktop sorting available and disables selection actions until files are selected', async () => {
    const user = userEvent.setup();
    const options = props();
    const view = render(<MediaSelectionActions {...options} selectedFiles={new Set()} canDelete={false} hasDeletableFiles />);
    expect(screen.getByRole('group', { name: 'Media actions' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose media sort order' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mark' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete selected files' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More selected file actions' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mark' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected files' }));
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    expect(options.onOpenMark).not.toHaveBeenCalled();
    expect(options.handleDeleteFiles).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    view.rerender(<MediaSelectionActions {...options} />);
    expect(screen.getByRole('button', { name: 'Mark' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete selected files' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'More selected file actions' })).toBeEnabled();
  });

  it('keeps the mobile group hidden without a selection and respects denied capabilities', () => {
    const options = props();
    const view = render(<MediaSelectionActions {...options} selectedFiles={new Set()} desktop={false} isDragMode />);
    expect(screen.queryByRole('group', { name: 'Media actions' })).not.toBeInTheDocument();
    view.rerender(<MediaSelectionActions {...options} canMarkSelectedFiles={false} canDelete={false} canDownload={false}
      hasPresentationMenuActions={false} presentationMenuActions={<DropdownMenuItem>Unavailable</DropdownMenuItem>} />);
    expect(screen.queryByRole('button', { name: 'Mark' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete selected files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More selected file actions' })).not.toBeInTheDocument();
  });

  it('closes an open More menu when the selection clears', async () => {
    const user = userEvent.setup();
    const options = props();
    const view = render(<MediaSelectionActions {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    expect(screen.getByRole('menuitem', { name: /MLS Optimized/ })).toBeVisible();
    view.rerender(<MediaSelectionActions {...options} selectedFiles={new Set()} canDelete={false} hasDeletableFiles />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More selected file actions' })).toBeDisabled();
    expect(options.handleDownload).not.toHaveBeenCalled();
  });

  it('keeps Save available during manual sorting and sends eligible clients through the existing request action', async () => {
    const user = userEvent.setup();
    const options = { ...props(), isClient: true, canMarkSelectedFiles: false, canDelete: false, canDownload: false,
      isDragMode: true, sortOrder: 'manual' as const };
    const view = render(<MediaSelectionActions {...options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save media order' }));
    expect(options.toggleDragMode).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'More selected file actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create request' }));
    expect(options.setRequestManagerOpen).toHaveBeenCalledExactlyOnceWith(true);
    view.rerender(<MediaSelectionActions {...options} canCreateRequest={false} />);
    expect(screen.queryByRole('button', { name: 'More selected file actions' })).not.toBeInTheDocument();
  });
});
