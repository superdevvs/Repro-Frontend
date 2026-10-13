import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootUploadSummaries } from './ShootUploadSummaries';

const mocks = vi.hoisted(() => ({ role: 'admin', uploads: [] }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '5', role: mocks.role } }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ uploads: mocks.uploads }) }));
const requirements = { expected: 125, exact: true, saved: 8, missing: 117, finalCount: 25, finalExact: true, breakdown: 'HDR Photos: 125 (25 × 5)', services: [], videoServices: [], unassigned: 0 };
const summary = (id: string) => ({ id, uploadType: 'raw', fileCount: 8, totalBytes: 10000, completedAt: new Date(Date.now() - 1000).toISOString() });
beforeEach(() => { localStorage.clear(); mocks.role = 'admin'; vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [summary('first')] }) }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount(isClient = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><ShootUploadSummaries shootId="1" unitId="7" uploadType="raw" role={mocks.role} isClient={isClient} requirements={requirements} onUploadMore={vi.fn()} /><p>Saved photo stays visible</p></QueryClientProvider>);
  return { ...view, client };
}

describe('staff-only completion summaries', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'photographer', 'salesRep'])('shows confirmed summaries for %s', async role => {
    mocks.role = role; mount();
    expect(await screen.findByText('Upload complete')).toBeVisible();
    expect(screen.getByText(/Uploaded .* ago/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'View files' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('unit_id=7');
  });
  it('never fetches or renders summaries for clients, including conflicting staff flags', () => {
    mount(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();
  });
  it.each(['client', 'editor'])('does not request internal summaries for the %s role', role => {
    mocks.role = role; mount();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows one batch at a time, pages history, and brings a new completed batch to the front', async () => {
    const batches = [
      { ...summary('older'), fileCount: 3, completedAt: '2026-10-01T10:00:00Z' },
      { ...summary('newest'), fileCount: 5, completedAt: '2026-10-02T10:00:00Z' },
      { ...summary('edited'), uploadType: 'edited', fileCount: 9 },
    ];
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [...batches] }) } as Response);
    const { client } = mount();
    expect(await screen.findByText('5 / 5 saved')).toBeVisible();
    expect(screen.getAllByTestId('upload-completion-summary')).toHaveLength(1);
    expect(screen.getByText('1 / 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next upload summary' }));
    expect(await screen.findByText('3 / 3 saved')).toBeVisible();
    await client.invalidateQueries({ queryKey: ['shootUploadSummaries'] });
    expect(screen.getByText('3 / 3 saved')).toBeVisible();
    batches.push({ ...summary('latest'), fileCount: 7 });
    await client.invalidateQueries({ queryKey: ['shootUploadSummaries'] });
    expect(await screen.findByText('7 / 7 saved')).toBeVisible();
    expect(screen.getByText('1 / 3')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss upload summary' }));
    expect(await screen.findByText('5 / 5 saved')).toBeVisible();
    expect(screen.getAllByTestId('upload-completion-summary')).toHaveLength(1);
    expect(screen.getByText('1 / 2')).toBeVisible();
    expect(localStorage.getItem('shoot-upload-dismissed:5:1:7')).toContain('latest');
  });
  it('persists dismissal, preserves photos, and gives a new upload its own summary', async () => {
    const { client } = mount();
    await screen.findByText('Upload complete');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss upload summary' }));
    await waitFor(() => expect(screen.queryByText('Upload complete')).not.toBeInTheDocument());
    expect(screen.getByText('Saved photo stays visible')).toBeVisible();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [summary('first'), summary('second')] }) } as Response);
    await client.invalidateQueries({ queryKey: ['shootUploadSummaries'] });
    expect(await screen.findByText('Upload complete')).toBeVisible();
    expect(screen.getAllByTestId('upload-completion-summary')).toHaveLength(1);
    expect(localStorage.getItem('shoot-upload-dismissed:5:1:7')).toBe('["first"]');
  });
});
