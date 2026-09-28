import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootDetailsMediaTab } from './ShootDetailsMediaTab';
import { UploadProvider, useUpload } from '@/context/UploadContext';

const mocks = vi.hoisted(() => ({ broken: true, telemetry: vi.fn() }));
vi.mock('./media/useShootDetailsMediaTab', () => ({ useShootDetailsMediaTab: () => {
  if (mocks.broken) throw new Error('Synthetic media render failure');
  return <p>Media controls</p>;
} }));
vi.mock('@/features/shoot-units/useShootUnitScope', () => ({ useShootUnitScope: () => ({ activeUnitId: null }) }));
vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryError: mocks.telemetry }));
const suppressExpectedRenderError = (event: ErrorEvent) => { if (event.message.includes('Synthetic media render failure')) event.preventDefault(); };
beforeEach(() => { mocks.broken = true; mocks.telemetry.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}); window.addEventListener('error', suppressExpectedRenderError); });
afterEach(() => { cleanup(); window.removeEventListener('error', suppressExpectedRenderError); vi.restoreAllMocks(); });

describe('media subtree containment', () => {
  it('contains the real media entrypoint inside the surrounding shoot and dashboard controls', () => {
    const props = { shoot: { id: '98' } as ShootData, isAdmin: false, isPhotographer: true, isEditor: false, isClient: false, role: 'photographer', onShootUpdate: vi.fn() };
    render(<><nav>Dashboard navigation</nav><button>Close shoot</button><ShootDetailsMediaTab {...props} /></>);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByText('Dashboard navigation')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close shoot' })).toBeEnabled();
    expect(mocks.telemetry).toHaveBeenCalledWith('A view could not render.', 'ReactRenderError', { code: 'shoot_media_render_error' });
    mocks.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Media controls')).toBeVisible();
  });

  it('keeps the upload provider and sibling dashboard alive when media throws mid-transfer', async () => {
    let complete!: () => void;
    let signal!: AbortSignal;
    function DashboardControls() {
      const { trackUpload, uploads } = useUpload();
      return <nav><button onClick={() => trackUpload({
        shootId: '98', shootAddress: 'Test shoot', fileCount: 190,
        fileNames: ['one.cr3'], uploadType: 'raw',
        uploadFn: (_progress, uploadSignal) => {
          signal = uploadSignal;
          return new Promise<void>((resolve) => { complete = resolve; });
        },
      })}>Start upload</button><output>{uploads[0]?.status}</output><button>Close shoot</button></nav>;
    }
    const props = { shoot: { id: '98' } as ShootData, isAdmin: false, isPhotographer: true, isEditor: false, isClient: false, role: 'photographer', onShootUpdate: vi.fn() };
    const app = () => <UploadProvider><DashboardControls /><ShootDetailsMediaTab {...props} /></UploadProvider>;
    mocks.broken = false;
    const rendered = render(app());
    fireEvent.click(screen.getByRole('button', { name: 'Start upload' }));
    await waitFor(() => expect(screen.getByText('uploading')).toBeVisible());
    mocks.broken = true;
    rendered.rerender(app());
    expect(screen.getByRole('button', { name: 'Close shoot' })).toBeEnabled();
    expect(screen.getByText('uploading')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeDisabled();
    expect(signal.aborted).toBe(false);
    await act(async () => { complete(); });
    await waitFor(() => expect(screen.getByText('succeeded')).toBeVisible());
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeEnabled();
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
