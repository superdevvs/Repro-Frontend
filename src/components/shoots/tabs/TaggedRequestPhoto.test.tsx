import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TaggedRequestPhoto } from './TaggedRequestPhoto';
import { downloadShootMediaFile } from '@/utils/shootMediaDownload';

vi.mock('@/utils/shootMediaDownload', () => ({ downloadShootMediaFile: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('downloads the authorized original beside the thumbnail without opening the preview', async () => {
  const preview = vi.fn();
  render(<TaggedRequestPhoto shootId={42} file={{ id: '7', filename: 'Requested.jpg', thumbnail: '/thumb.jpg', canDownload: true }} onPreview={preview} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download Requested.jpg' }));
  await waitFor(() => expect(downloadShootMediaFile).toHaveBeenCalledWith({ shootId: 42, fileId: '7' }));
  expect(preview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Requested.jpg' }));
  expect(preview).toHaveBeenCalledOnce();
});

it('does not offer a download for an unauthorized tagged image', () => {
  render(<TaggedRequestPhoto shootId={42} file={{ id: '7', filename: 'Requested.jpg', canDownload: false }} onPreview={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
});
