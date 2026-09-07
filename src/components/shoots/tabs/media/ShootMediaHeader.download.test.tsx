import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('selected media download buttons', () => {
  it.each([true, false])('keeps desktop and mobile icons spinning while busy (editor=%s)', (isEditor) => {
    const options = { ...props(), isEditor, displayTab: isEditor ? 'uploaded' as const : 'edited' as const };
    const { rerender } = render(<ShootMediaHeader {...options} />);
    const buttons = screen.getAllByRole('button', { name: 'Download selected files' });
    expect(buttons).toHaveLength(2);
    if (isEditor) {
      fireEvent.click(buttons[0]);
      expect(options.handleEditorDownloadRaw).toHaveBeenCalledWith(false);
    }
    rerender(<ShootMediaHeader {...options} downloading />);
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button.querySelector('.animate-spin')).not.toBeNull();
      fireEvent.click(button);
    });
    expect(options.handleEditorDownloadRaw).toHaveBeenCalledTimes(isEditor ? 1 : 0);
    expect(options.handleDownload).not.toHaveBeenCalled();
    rerender(<ShootMediaHeader {...options} downloading={false} />);
    buttons.forEach((button) => {
      expect(button).toBeEnabled();
      expect(button.querySelector('.animate-spin')).toBeNull();
    });
  });
});
