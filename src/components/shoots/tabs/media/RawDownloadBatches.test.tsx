import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { downloadShootRawFiles } from '@/utils/shootMediaDownload';
import { RawDownloadBatches } from './RawDownloadBatches';
import { buildRawDownloadBatches, RAW_DOWNLOAD_BATCH_BYTES } from './rawDownloadBatchPlan';

vi.mock('@/utils/shootMediaDownload', () => ({ downloadShootRawFiles: vi.fn() }));
const file = (id: string, fileSize?: number, can_download = true): MediaFile => ({ id, filename: `${id}.RAF`, fileSize, can_download });
const files = [file('1', 300 * 1024 ** 2), file('2', 300 * 1024 ** 2), file('3', 20 * 1024 ** 2)];

describe('smaller original downloads', () => {
  beforeEach(() => vi.resetAllMocks());

  it('covers each permitted original once, preserves order and respects size and count bounds', () => {
    const input = [...files, file('3', 1), file('blocked', 1, false),
      { ...file('floorplan'), workflowStage: 'verified', filename: 'floorplan.pdf' },
      { ...file('pending-scan'), scan_status: 'quarantined' as const },
      file('large', 900 * 1024 ** 2),
      ...Array.from({ length: 45 }, (_, i) => file(`unknown-${i}`))];
    const batches = buildRawDownloadBatches(input);
    expect(batches.flatMap(batch => batch.fileIds)).toEqual(['1', '2', '3', 'large', ...Array.from({ length: 45 }, (_, i) => `unknown-${i}`)]);
    for (const batch of batches) {
      expect(batch.fileIds.length).toBeLessThanOrEqual(20);
      if (batch.bytes > RAW_DOWNLOAD_BATCH_BYTES) expect(batch.fileIds).toHaveLength(1);
    }
    expect(batches.at(-1)?.sizeKnown).toBe(false);
  });

  it('downloads only the chosen part, blocks duplicate preparation and retries just the failed part', async () => {
    let reject: (reason: Error) => void = () => {};
    vi.mocked(downloadShootRawFiles).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValue({ mode: 'redirect', url: 'https://reprodashboard.com/example.zip' });
    render(<RawDownloadBatches shootId={5853} files={files} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download in parts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download part 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download part 2' }));
    expect(downloadShootRawFiles).toHaveBeenCalledTimes(1);
    expect(downloadShootRawFiles).toHaveBeenCalledWith(expect.objectContaining({ shootId: 5853, fileIds: ['2', '3'] }));
    expect(screen.getByRole('button', { name: 'Download part 1' })).toBeDisabled();
    await act(async () => reject(new Error('Connection interrupted')));
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Download part 2' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to your browser'));
    expect(screen.queryByText(/Download complete/i)).not.toBeInTheDocument();
    expect(downloadShootRawFiles).toHaveBeenCalledTimes(2);
    expect(vi.mocked(downloadShootRawFiles).mock.calls.every(([args]) => args.fileIds?.join(',') === '2,3')).toBe(true);
  });

  it('cancels polling when closed and does not start another part automatically', async () => {
    vi.mocked(downloadShootRawFiles).mockImplementation(() => new Promise(() => {}));
    render(<RawDownloadBatches shootId={5886} files={files} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download in parts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download part 1' }));
    const signal = vi.mocked(downloadShootRawFiles).mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(signal?.aborted).toBe(true);
    expect(downloadShootRawFiles).toHaveBeenCalledTimes(1);
  });

  it('does not offer a parts dialog for one small ZIP', () => {
    render(<RawDownloadBatches shootId={5886} files={[file('1', 1000)]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
