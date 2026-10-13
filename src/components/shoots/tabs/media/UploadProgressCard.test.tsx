import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadProgressCard } from './MediaUploadPanels';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('UploadProgressCard per-file row details', () => {
  it('shows size, percent, and check on the right of each file row', () => {
    render(
      <UploadProgressCard
        fileCount={2}
        fileNames={['312 Obrecht Rd-62042_0216.jpg', 'done.jpg']}
        progress={58.7}
        note="Keep this tab open"
        transferDetail={{
          fileName: '312 Obrecht Rd-62042_0216.jpg',
          fileNumber: 1,
          fileProgress: 40,
          phase: 'transferring',
          completedFileIndexes: [1],
          fileSizes: [2_400_000, 1_024_000],
          fileProgresses: [40, 100],
        }}
      />,
    );

    expect(screen.getByText(/Uploading 2 files\.\.\. 58\.7%/)).toBeInTheDocument();
    expect(screen.getByTestId('upload-progress-file-size-0')).toHaveTextContent('2.3 MB');
    expect(screen.getByTestId('upload-progress-file-pct-0')).toHaveTextContent('40%');
    expect(screen.getByTestId('upload-progress-file-size-1')).toHaveTextContent('1000.0 KB');
    expect(screen.getByTestId('upload-progress-file-check-1')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-progress-file-pct-1')).not.toBeInTheDocument();
  });

  it('shows real speed, drops a stalled rate to zero, and replaces it while saving', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T06:00:00Z'));
    const detail = { fileName: 'a.jpg', fileNumber: 1, fileProgress: 50, phase: 'transferring' as const,
      completedFileIndexes: [], bytesPerSecond: 2 * 1024 * 1024, lastTransferAt: Date.now() };
    const props = { fileCount: 1, fileNames: ['a.jpg'], progress: 50, note: 'Uploading in background' };
    const { rerender } = render(<UploadProgressCard {...props} transferDetail={detail} />);
    expect(screen.getByTestId('upload-transfer-speed')).toHaveTextContent('2.0 MB/s');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByTestId('upload-transfer-speed')).toHaveTextContent('0.0 KB/s');
    rerender(<UploadProgressCard {...props} transferDetail={{ ...detail, phase: 'processing' }} />);
    expect(screen.getByTestId('upload-transfer-speed')).toHaveTextContent('Saving…');
    expect(screen.getByTestId('upload-transfer-speed')).not.toHaveTextContent('/s');
  });
});
