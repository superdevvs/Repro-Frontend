import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootUploadSummaries } from './ShootUploadSummaries';

const mocks = vi.hoisted(() => ({ role: 'admin', uploads: [], instantMotion: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '5', role: mocks.role } }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ uploads: mocks.uploads }) }));
vi.mock('framer-motion', async importOriginal => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: (props: ComponentProps<typeof actual.AnimatePresence>) => mocks.instantMotion ? props.children : <actual.AnimatePresence {...props} /> };
});
const requirements = { expected: 125, exact: true, saved: 8, missing: 117, finalCount: 25, finalExact: true, breakdown: 'HDR Photos: 125 (25 × 5)', services: [], videoServices: [], unassigned: 0 };
const summary = (id: string) => ({ id, uploadType: 'raw', fileCount: 8, totalBytes: 10000, completedAt: new Date(Date.now() - 1000).toISOString() });
beforeEach(() => { localStorage.clear(); mocks.role = 'admin'; mocks.instantMotion = false; const first = summary('first'); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [first] }) }))); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
      { ...summary('older'), fileCount: 3, completedAt: new Date(Date.now() - 3000).toISOString() },
      { ...summary('newest'), fileCount: 5, completedAt: new Date(Date.now() - 2000).toISOString() },
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
  it('does not show expired summaries again when loading or refetching', async () => {
    const expired = { ...summary('expired'), completedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [expired] }) } as Response);
    const { client } = mount();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await client.invalidateQueries({ queryKey: ['shootUploadSummaries'] });
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();
    expect(screen.getByText('Saved photo stays visible')).toBeVisible();
  });
  it('expires each upload five minutes after completion and gives later uploads their full lifetime', async () => {
    // Clock tests assert retention deadlines without Framer's separate frame clock.
    mocks.instantMotion = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    const first = { ...summary('first'), completedAt: new Date().toISOString() };
    const batches = [first];
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [...batches] }) } as Response);
    const { client } = mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText('8 / 8 saved')).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
    batches.push({ ...summary('second'), fileCount: 9, completedAt: new Date().toISOString() });
    await act(async () => { await client.invalidateQueries({ queryKey: ['shootUploadSummaries'] }); await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText('9 / 9 saved')).toBeVisible();
    expect(screen.getByText('1 / 2')).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(3 * 60 * 1000); });
    expect(screen.getByText('9 / 9 saved')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Next upload summary' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000 - 11); });
    expect(screen.getByText('9 / 9 saved')).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();
    expect(screen.getByText('Saved photo stays visible')).toBeVisible();
  });
  it('catches up after a suspended tab without extending the completion deadline', async () => {
    mocks.instantMotion = true;
    vi.useFakeTimers();
    const batch = { ...summary('first'), completedAt: new Date(Date.now() - 1000).toISOString() };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [batch] }) } as Response);
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText('Upload complete')).toBeVisible();
    vi.setSystemTime(Date.parse(batch.completedAt) + 5 * 60 * 1000 + 1);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();
    expect(screen.getByText('Saved photo stays visible')).toBeVisible();
  });
});
