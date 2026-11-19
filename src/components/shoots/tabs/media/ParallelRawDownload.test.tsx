import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ParallelRawDownload } from './ParallelRawDownload';
import { downloadShootRawFiles, startSameWindowDownload } from '@/utils/shootMediaDownload';
import { chooseDownloadFile, ParallelDownload } from '@/utils/parallelDownload';

vi.mock('@/utils/shootMediaDownload', () => ({ downloadShootRawFiles: vi.fn(), startSameWindowDownload: vi.fn() }));
vi.mock('@/utils/parallelDownload', () => ({ supportsParallelDownload: () => true, chooseDownloadFile: vi.fn(), ParallelDownload: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('prepares only the visible authorized files without automatically starting another download', async () => {
  vi.mocked(downloadShootRawFiles).mockResolvedValue({ mode: 'redirect', url: 'https://downloads.reprodashboard.com/a.zip' });
  render(<ParallelRawDownload shootId={5999} files={[{ id: '11', filename: 'a.raf' }, { id: '12', filename: 'b.raf' }]} disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parallel download' }));
  await screen.findByRole('button', { name: 'Save and download' });
  expect(downloadShootRawFiles).toHaveBeenCalledWith(expect.objectContaining({ shootId: 5999, fileIds: ['11', '12'], startDownload: false }));
  expect(chooseDownloadFile).not.toHaveBeenCalled();
  expect(startSameWindowDownload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use browser download' }));
  expect(startSameWindowDownload).toHaveBeenCalledWith('https://downloads.reprodashboard.com/a.zip');
});

it('refreshes authorization before starting and reports completion only after saving', async () => {
  vi.mocked(downloadShootRawFiles).mockResolvedValue({ mode: 'redirect', url: 'https://downloads.reprodashboard.com/a.zip' });
  vi.mocked(chooseDownloadFile).mockResolvedValue({ createWritable: vi.fn() });
  const start = vi.fn().mockResolvedValue(true);
  vi.mocked(ParallelDownload).mockImplementation(function () { return { start, pause: vi.fn() } as unknown as ParallelDownload; });
  render(<ParallelRawDownload shootId={5999} files={[{ id: '11', filename: 'a.raf' }]} disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parallel download' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save and download' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download complete'));
  expect(downloadShootRawFiles).toHaveBeenCalledTimes(2);
  expect(start).toHaveBeenCalledOnce();
});

it('suggests the signed attachment name instead of the archive cache key', async () => {
  vi.mocked(downloadShootRawFiles).mockResolvedValue({ mode: 'redirect', url: 'https://downloads.reprodashboard.com/api/public/shoot-media/file/editor-downloads/5999/9b9f2f6b20ff.zip?download=12-main-st-raw-files.zip&expires=1&signature=abc' });
  vi.mocked(chooseDownloadFile).mockResolvedValue({ createWritable: vi.fn() });
  vi.mocked(ParallelDownload).mockImplementation(function () { return { start: vi.fn().mockResolvedValue(true), pause: vi.fn() } as unknown as ParallelDownload; });
  render(<ParallelRawDownload shootId={5999} files={[{ id: '11', filename: 'a.raf' }]} disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parallel download' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save and download' }));
  await waitFor(() => expect(chooseDownloadFile).toHaveBeenCalledWith('12-main-st-raw-files.zip'));
});
