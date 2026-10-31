import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { MediaSortControl } from './MediaSortControl';
afterEach(cleanup);
it('offers an explicit save action and keeps failed saves visible', () => {
  const save = vi.fn();
  const props = { open: false, onOpenChange: vi.fn(), sortOrder: 'manual' as const, isDragMode: true,
    sortSaveStatus: 'error' as const, changeSortOrder: vi.fn(), toggleDragMode: save };
  const { rerender } = render(<MediaSortControl {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save media order' }));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Not saved');
  rerender(<MediaSortControl {...props} sortSaveStatus="saving" />);
  expect(screen.getByRole('button', { name: 'Save media order' })).toBeDisabled();
  rerender(<MediaSortControl {...props} sortSaveStatus="saved" />);
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
});
