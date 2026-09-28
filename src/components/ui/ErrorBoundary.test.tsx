import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { UploadProvider, useUpload } from '@/context/UploadContext';
import { protectUploadFromNavigation, releaseUploadNavigationProtection } from '@/lib/uploadNavigationProtection';

const telemetry = vi.hoisted(() => vi.fn());
vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryError: telemetry }));
const suppressExpectedRenderError = (event: ErrorEvent) => {
  if (['private-filename-and-token-canary', 'Render failed', 'Importing a module script failed.'].some((message) => event.message.includes(message))) event.preventDefault();
};
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); telemetry.mockReset(); window.addEventListener('error', suppressExpectedRenderError); });
afterEach(() => { cleanup(); releaseUploadNavigationProtection('fallback-test'); window.removeEventListener('error', suppressExpectedRenderError); vi.restoreAllMocks(); });

describe('contained render recovery', () => {
  it('keeps neighboring UI visible, reports only a reviewed code, and retries without navigation', () => {
    let broken = true;
    function View() {
      if (broken) throw new Error('private-filename-and-token-canary');
      return <p>Media is available</p>;
    }
    render(<><nav>Dashboard navigation</nav><ErrorBoundary scope="shoot_media"><View /></ErrorBoundary></>);
    expect(screen.getByRole('alert')).toHaveTextContent('This view could not load');
    expect(screen.getByText('Dashboard navigation')).toBeVisible();
    expect(telemetry).toHaveBeenCalledWith('A view could not render.', 'ReactRenderError', { code: 'shoot_media_render_error' });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain('canary');
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Media is available')).toBeVisible();
  });

  it('protects an active upload through a failed view and local retry', async () => {
    let broken = false;
    let finishUpload!: () => void;
    let uploadSignal!: AbortSignal;
    function View() {
      if (broken) throw new Error('Render failed');
      return <p>Upload view</p>;
    }
    function Controls() {
      const { trackUpload, uploads } = useUpload();
      return <><button onClick={() => trackUpload({
        shootId: '98', shootAddress: 'Test shoot', fileCount: 190,
        fileNames: ['one.cr3'], uploadType: 'raw',
        uploadFn: (_progress, signal) => {
          uploadSignal = signal;
          return new Promise<void>((resolve) => { finishUpload = resolve; });
        },
      })}>Start upload</button><p data-testid="upload-status">{uploads[0]?.status}</p></>;
    }
    const app = () => <UploadProvider><Controls /><ErrorBoundary><View /></ErrorBoundary></UploadProvider>;
    const rendered = render(app());
    fireEvent.click(screen.getByRole('button', { name: 'Start upload' }));
    await waitFor(() => expect(screen.getByTestId('upload-status')).toHaveTextContent('uploading'));
    broken = true;
    rendered.rerender(app());
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Uploads are still running');
    expect(uploadSignal.aborted).toBe(false);
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Upload view')).toBeVisible();
    expect(uploadSignal.aborted).toBe(false);
    await act(async () => { finishUpload(); });
    await waitFor(() => expect(screen.getByTestId('upload-status')).toHaveTextContent('succeeded'));
  });

  it('does not promise an automatic refresh and enables reload only after uploads finish', () => {
    protectUploadFromNavigation('fallback-test');
    function MissingModule(): never { throw new TypeError('Importing a module script failed.'); }
    render(<ErrorBoundary><MissingModule /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Part of the app could not be downloaded');
    expect(screen.getByRole('alert')).not.toHaveTextContent('new version');
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeDisabled();
    act(() => releaseUploadNavigationProtection('fallback-test'));
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(telemetry).toHaveBeenCalledWith('A view could not render.', 'ReactRenderError', { code: 'react_chunk_load_error' });
  });

  it('keeps the fallback usable if telemetry or a diagnostic callback throws', () => {
    telemetry.mockImplementation(() => { throw new Error('Telemetry offline'); });
    function BrokenView(): never { throw new Error('Render failed'); }
    render(<ErrorBoundary onError={() => { throw new Error('Callback failed'); }}><BrokenView /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled();
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
