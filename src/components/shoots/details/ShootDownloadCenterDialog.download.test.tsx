import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ archive: vi.fn(), raw: vi.fn(), file: vi.fn(), toast: vi.fn() }));
vi.mock('@/utils/shootMediaDownload', () => ({
  downloadShootMediaArchive: mocks.archive, downloadShootRawFiles: mocks.raw, downloadShootMediaFile: mocks.file,
  getShootMediaDownloadSizeLabel: (size: string) => size,
}));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}) }));
vi.mock('@/services/mmmService', () => ({ mmmService: {} }));

import { ShootDownloadCenterDialog } from './ShootDownloadCenterDialog';
import { useShootDetailsModalActions } from '../modal/useShootDetailsModalActions';

const shoot = {
  id: '101', location: { address: '12 Oak Street', city: 'Austin', state: 'TX', zip: '78701', fullAddress: '12 Oak Street, Austin, TX 78701' },
  services: [], files: [{ id: 'photo-1', filename: 'front.jpg', media_type: 'edited' }, { id: 'pdf-1', filename: 'floorplan.pdf' }],
} as ShootData;

function DownloadCenter() {
  const actions = useShootDetailsModalActions({ shoot, isPhotographer: false, refreshShoot: async () => shoot, toast: mocks.toast });
  return <ShootDownloadCenterDialog shoot={shoot} open isDownloading={actions.isDownloading}
    downloadStatusMessage={actions.downloadStatusMessage} onOpenChange={vi.fn()}
    onDownloadArchive={actions.handleDownloadMedia} onDownloadFile={actions.handleDownloadFile} />;
}

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Download Center loading buttons', () => {
  it('serializes raw and archive clicks before React renders the busy state', async () => {
    let finish!: () => void;
    mocks.raw.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ mode: 'blob' }); }));
    const { result } = renderHook(() => useShootDetailsModalActions({ shoot, isPhotographer: false, refreshShoot: async () => shoot, toast: mocks.toast }));
    let first!: Promise<void>;
    act(() => {
      first = result.current.handleEditorDownloadRaw();
      void result.current.handleEditorDownloadRaw();
      void result.current.handleDownloadMedia('original');
    });
    expect(mocks.raw).toHaveBeenCalledTimes(1);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.raw).toHaveBeenCalledWith({ shootId: '101', fileIds: [], address: '12 Oak Street, Austin, TX, 78701' });
    expect(result.current.isDownloading).toBe(true);
    await act(async () => { finish(); await first; });
    expect(result.current.isDownloading).toBe(false);
  });

  it('retains choices and spins only the selected archive button, then enables retry after failure', async () => {
    let rejectArchive!: (reason: Error) => void;
    mocks.archive.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectArchive = reject; }));
    render(<DownloadCenter />);
    const print = screen.getByRole('button', { name: /Print Resolution/ });
    const mls = screen.getByRole('button', { name: /MLS Optimized/ });
    fireEvent.click(print);
    fireEvent.click(print);
    expect(mocks.archive).toHaveBeenCalledTimes(1);
    expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ address: '12 Oak Street, Austin, TX, 78701', size: 'original' }));
    expect(print).toBeInTheDocument();
    expect(print).toHaveAttribute('aria-busy', 'true');
    expect(print.querySelector('.animate-spin')).not.toBeNull();
    expect(mls).toBeDisabled();
    expect(mls.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your full-size files');
    act(() => { mocks.archive.mock.calls[0][0].onDownloading(); });
    expect(screen.getByRole('status')).toHaveTextContent('Downloading your files...');
    await act(async () => { rejectArchive(new Error('Please retry.')); });
    await waitFor(() => expect(print).toBeEnabled());
    expect(print.querySelector('.animate-spin')).toBeNull();
    mocks.archive.mockResolvedValueOnce({ mode: 'blob', waited: false });
    fireEvent.click(mls);
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mls).toBeEnabled());
  });

  it('keeps a file button spinning until the file download promise finishes', async () => {
    let finish!: () => void;
    mocks.file.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<DownloadCenter />);
    const button = screen.getByRole('button', { name: 'Download floorplan.pdf' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    await act(async () => { finish(); });
    await waitFor(() => expect(button).toBeEnabled());
    expect(mocks.file).toHaveBeenCalledWith({ shootId: '101', fileId: 'pdf-1' });
  });
});
