import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaGrid } from './MediaGrid';

const files: MediaFile[] = [
  { id: 'own', filename: 'own.mp4', can_delete: true },
  { id: 'other', filename: 'other.mp4', can_delete: false },
];
afterEach(cleanup);

describe('file-scoped selection for video editors', () => {
  it.each(['grid', 'list'] as const)('only offers the authorized file in %s view', (viewMode) => {
    const onSelectionChange = vi.fn();
    const props = {
      files, selectedFiles: new Set<string>(), canSelect: true, viewMode,
      onSelectionChange, onFileClick: vi.fn(), getImageUrl: () => '',
      getSrcSet: () => '', isImage: () => false, canSelectFile: (file: MediaFile) => file.can_delete === true,
    };
    const { rerender } = render(<MediaGrid {...props} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onSelectionChange).toHaveBeenCalledWith('own');
    if (viewMode === 'list') {
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
    }
    rerender(<MediaGrid {...props} selectedFiles={new Set(['own'])} />);
    expect(screen.getByTitle('Deselect All')).toBeTruthy();
    expect(screen.queryByTitle('Select All')).toBeNull();
  });

  it.each(['grid', 'list'] as const)('shows no selection control when every file is protected in %s view', (viewMode) => {
    render(<MediaGrid files={files} selectedFiles={new Set()} canSelect canSelectFile={() => false}
      onSelectionChange={vi.fn()} onFileClick={vi.fn()} getImageUrl={() => ''}
      getSrcSet={() => ''} isImage={() => false} viewMode={viewMode} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByTitle('Select All')).toBeNull();
  });
});
