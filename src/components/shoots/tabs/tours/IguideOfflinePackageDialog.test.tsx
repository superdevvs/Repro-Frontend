import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIguideOfflinePackage } from '@/utils/shootTourData';

const resumableMocks = vi.hoisted(() => ({
  discard: vi.fn(),
  saved: false,
  upload: vi.fn(),
}));

vi.mock('./iguideResumableUpload', () => {
  class PausedError extends Error {
    constructor() {
      super('Upload paused.');
      this.name = 'IguideUploadPausedError';
    }
  }

  class ResumableError extends Error {
    readonly sessionId: string;

    constructor(message: string, options?: { session?: { id?: string } }) {
      super(message);
      this.name = 'IguideResumableUploadError';
      this.sessionId = options?.session?.id ?? '';
    }
  }

  return {
    discardIguideUploadSession: resumableMocks.discard,
    getPersistedIguideUpload: vi.fn(() => resumableMocks.saved ? {
      sessionId: 'saved-session',
      receivedBytes: 5,
      receivedChunkIndexes: [0],
    } : null),
    IguideResumableUploadError: ResumableError,
    IguideUploadPausedError: PausedError,
    uploadIguideOfflinePackageResumable: resumableMocks.upload,
  };
});

import { IguideOfflinePackageDialog } from './IguideOfflinePackageDialog';
import { IguideResumableUploadError, IguideUploadPausedError } from './iguideResumableUpload';

const queuedPackage = normalizeIguideOfflinePackage({
  id: 'package-uuid',
  status: 'queued',
  original_filename: 'offline.zip',
  size_bytes: 3,
});

const progress = (
  phase: 'preparing' | 'uploading' | 'finalizing',
  percent: number,
  chunkIndex: number | null = null,
) => ({
  bytesConfirmed: percent,
  bytesTransferred: percent,
  chunkIndex,
  percent,
  phase,
  totalBytes: 100,
  totalChunks: 2,
});

const selectFile = (container: HTMLElement, file = new File(['zip'], 'offline.zip', { type: 'application/zip' })) => {
  const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return file;
};

beforeEach(() => {
  resumableMocks.saved = false;
  resumableMocks.upload.mockReset();
  resumableMocks.discard.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('IguideOfflinePackageDialog', () => {
  it('warns admins that the public package must be MLS safe', () => {
    render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={9137}
      />,
    );

    expect(screen.getByText(/used on delivered branded and MLS tours/i)).toBeTruthy();
    expect(screen.getByText(/MLS-safe, unbranded export/i)).toBeTruthy();
  });

  it('shows resumable phases and returns the queued package after finalization', async () => {
    const onUploaded = vi.fn();
    const onOpenChange = vi.fn();
    resumableMocks.upload.mockImplementation(async ({ onProgress }) => {
      onProgress(progress('preparing', 0));
      onProgress(progress('uploading', 48, 0));
      onProgress(progress('finalizing', 100));
      return queuedPackage;
    });
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={onOpenChange}
        onUploaded={onUploaded}
        shootId={9137}
      />,
    );
    const file = selectFile(container);

    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(queuedPackage));
    expect(resumableMocks.upload).toHaveBeenCalledWith(expect.objectContaining({
      file,
      shootId: 9137,
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('pauses the active request, preserves it, and resumes the same file', async () => {
    resumableMocks.upload
      .mockImplementationOnce(({ onProgress, signal }) => new Promise((resolve, reject) => {
        onProgress(progress('uploading', 41, 0));
        signal.addEventListener('abort', () => {
          resumableMocks.saved = true;
          reject(new IguideUploadPausedError());
        }, { once: true });
      }))
      .mockResolvedValueOnce(queuedPackage);
    const onUploaded = vi.fn();
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={onUploaded}
        shootId={9}
      />,
    );
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));
    expect(await screen.findByText('Uploading chunk 1 of 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pause upload' }));

    const resume = await screen.findByRole('button', { name: 'Resume upload' });
    expect(screen.getByText('Upload paused — progress saved')).toBeTruthy();
    fireEvent.click(resume);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(queuedPackage));
    expect(resumableMocks.upload).toHaveBeenCalledTimes(2);
  });

  it('recognizes a saved session on file selection and explicitly discards it', async () => {
    resumableMocks.saved = true;
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={12}
      />,
    );
    const file = selectFile(container);
    expect(screen.getByRole('button', { name: 'Resume upload' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Discard upload' }));

    await waitFor(() => expect(resumableMocks.discard).toHaveBeenCalledWith({ file, shootId: 12 }));
    expect(screen.getByRole('button', { name: 'Upload package' })).toBeTruthy();
  });

  it('keeps Resume and Discard available when discarding the server session fails', async () => {
    resumableMocks.saved = true;
    resumableMocks.discard.mockRejectedValue(new Error('The connection was interrupted.'));
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={13}
      />,
    );
    selectFile(container);

    fireEvent.click(screen.getByRole('button', { name: 'Discard upload' }));

    expect((await screen.findByRole('alert')).textContent).toContain('connection was interrupted');
    expect(screen.getByRole('button', { name: 'Resume upload' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard upload' })).toBeTruthy();
  });

  it('offers explicit cleanup for an incompatible active server upload before retrying', async () => {
    const canonicalSession = '22222222-2222-4222-8222-222222222222';
    resumableMocks.upload.mockRejectedValueOnce(new IguideResumableUploadError(
      'The existing upload contains different file data. Discard it and start again.',
      { session: { id: canonicalSession } as never },
    ));
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={17}
      />,
    );
    const file = selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));

    expect((await screen.findByRole('alert')).textContent).toContain('different file data');
    expect(screen.getByText('Existing upload must be discarded')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Upload package' }) as HTMLButtonElement).disabled).toBe(true);
    expect((container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Discard existing upload' }));

    await waitFor(() => expect(resumableMocks.discard).toHaveBeenCalledWith({
      file,
      sessionId: canonicalSession,
      shootId: 17,
    }));
    expect((screen.getByRole('button', { name: 'Upload package' }) as HTMLButtonElement).disabled).toBe(false);
    expect((container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(false);
  });

  it('keeps conflicting server upload cleanup available when discard is interrupted', async () => {
    const canonicalSession = '22222222-2222-4222-8222-222222222223';
    resumableMocks.upload.mockRejectedValueOnce(new IguideResumableUploadError(
      'The existing upload belongs to a different file.',
      { session: { id: canonicalSession } as never },
    ));
    resumableMocks.discard.mockRejectedValueOnce(new Error('The cleanup connection was interrupted.'));
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={18}
      />,
    );
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard existing upload' }));

    expect((await screen.findByRole('alert')).textContent).toContain('cleanup connection was interrupted');
    expect(screen.getByRole('button', { name: 'Discard existing upload' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Upload package' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('retains the selected file and exposes Resume after a recoverable interruption', async () => {
    resumableMocks.upload.mockImplementation(async () => {
      resumableMocks.saved = true;
      throw new Error('The upload connection was interrupted.');
    });
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={14}
      />,
    );
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));

    expect((await screen.findByRole('alert')).textContent).toContain('connection was interrupted');
    expect(screen.getByText('offline.zip')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume upload' })).toBeTruthy();
  });

  it('pauses rather than discarding when the dialog unmounts', async () => {
    let capturedSignal: AbortSignal | null = null;
    resumableMocks.upload.mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => undefined);
    });
    const { container, unmount } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={15}
      />,
    );
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));
    await waitFor(() => expect(capturedSignal).not.toBeNull());

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    expect(resumableMocks.discard).not.toHaveBeenCalled();
  });

  it('keeps explicit Replace wording for an existing package', () => {
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage({
          id: 'old-package',
          status: 'ready',
          file_id: 72,
          original_filename: 'old.zip',
        })}
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
        shootId={16}
      />,
    );
    selectFile(container);

    expect(screen.getByRole('heading', { name: 'Replace iGUIDE ZIP' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replace package' })).toBeTruthy();
    expect(screen.getByText(/explicitly replaces the current package/i)).toBeTruthy();
  });
});
