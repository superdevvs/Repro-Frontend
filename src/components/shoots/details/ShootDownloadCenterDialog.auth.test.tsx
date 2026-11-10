import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth/AuthProvider';
import type { ShootData } from '@/types/shoots';
import { ShootDownloadCenterDialog } from './ShootDownloadCenterDialog';

vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryBlocker: vi.fn() }));

const office = { id: '1', name: 'Office', email: 'office@example.test', role: 'superadmin' };
const rep = { id: '7', name: 'Account rep', email: 'rep@example.test', role: 'salesRep' };
const shoot = {
  id: '42', services: [], files: [
    { id: 'old', filename: 'Hidden revision.mp4', workflow_stage: 'completed', is_hidden: true },
    { id: 'current', filename: 'Delivered video.mp4', workflow_stage: 'completed', is_hidden: false },
  ],
} as unknown as ShootData;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('authToken', 'test-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it.each([false, true])('uses the active rep session to hide revisions (impersonated: %s)', async (impersonated) => {
  localStorage.setItem('user', JSON.stringify(rep));
  if (impersonated) localStorage.setItem('originalUser', JSON.stringify(office));
  render(<AuthProvider><ShootDownloadCenterDialog shoot={shoot} open isDownloading={false}
    downloadStatusMessage="" onOpenChange={vi.fn()} onDownloadArchive={vi.fn()} onDownloadFile={vi.fn()} /></AuthProvider>);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Download Hidden revision.mp4' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Download Delivered video.mp4' })).toBeEnabled();
});

it('preserves the office session access to hidden revisions', async () => {
  localStorage.setItem('user', JSON.stringify(office));
  render(<AuthProvider><ShootDownloadCenterDialog shoot={shoot} open isDownloading={false}
    downloadStatusMessage="" onOpenChange={vi.fn()} onDownloadArchive={vi.fn()} onDownloadFile={vi.fn()} /></AuthProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download Hidden revision.mp4' })).toBeEnabled());
});
