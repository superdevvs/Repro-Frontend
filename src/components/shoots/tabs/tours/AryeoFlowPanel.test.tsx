import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AryeoFlowPanel } from './AryeoFlowPanel';

function fixture() {
  return {
    configured: true,
    connections: [{ id: 1, name: 'Mac mini', online: true, last_seen_at: new Date().toISOString(), processing_enabled: true, executor_ready: true, shoot_enabled: true }],
    orders: [{ id: 3, connection_id: 1, request_id: 'order-42', listing_id: 'listing-42', discovery: { address: '9407 Reservoir Rd', requester_email: 'test@example.test', required: { photos: 1, floorplans: 0, videos: 0, tours: 0 } }, inventory: null, inventory_checked_at: null, readiness: { eligible: true, blockers: [], available: { photos: 1, floorplans: 0, videos: 0, tours: 0 }, media_version: 'v1', assets: [{ id: 1, filename: 'photo.jpg', type: 'photos' }] }, jobs: [] }],
    unmatched: [],
  };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Aryeo Flow panel', () => {
  it('shows unknown inventory and never starts a delivery when opened', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => fixture() });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={4} unitId={7} />);
    await screen.findByText('Order order-42');
    expect(screen.getByText('Showcase request received')).toBeVisible();
    expect(screen.getAllByText('Unknown')).toHaveLength(8);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('/shoots/4/aryeo?unit_id=7');
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });
  it('queues the exact matched order only when clicked', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => fixture() });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={4} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Process & deliver' }));
    await waitFor(() => expect(fetch.mock.calls.some(c => c[0].endsWith('/shoots/4/aryeo/requests/3/process') && c[1].method === 'POST')).toBe(true));
  });
  it('shows an unspecified requested quantity without inventing a count or waiting for Summary', async () => {
    const original = fixture();
    const data = { ...original, orders: [{ ...original.orders[0],
      discovery: { ...original.orders[0].discovery, required: { photos: null, floorplans: 0, videos: 0, tours: 0 } },
      readiness: { ...original.orders[0].readiness, dashboard: { paid: true, delivered: true, summary_required: false } },
    }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText('Dashboard: Paid · Delivered · Summary email not required')).toBeVisible();
    expect(screen.getByRole('cell', { name: /^Requested$/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeEnabled();
  });
  it('blocks processing while the worker is offline or in automatic mode', async () => {
    const data = fixture(); data.connections[0].online = false; data.connections[0].executor_ready = false;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByRole('button', { name: 'Process & deliver' })).toBeDisabled();
  });
  it('retains a labelled last verified inventory instead of presenting stale counts as current', async () => {
    const original = fixture();
    const data = { ...original, orders: [{ ...original.orders[0],
      inventory: { complete: true, assets: [{ id: 'photo-1', type: 'photos', delivered: false }] },
      inventory_checked_at: new Date(Date.now() - 600000).toISOString(),
    }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText(/Showing last verified counts; refresh required before delivery/)).toBeVisible();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
  it('keeps delivered state separate from unfinished filing', async () => {
    const data = { ...fixture(), orders: [{ ...fixture().orders[0], jobs: [{ id: 'job-1', status: 'followup_pending', media_version: 'v1', error: 'Archive unavailable', steps: { delivery: 'success', filing: 'failed' }, receipt: { verified_at: new Date().toISOString() } }] }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText('Delivered · follow-up pending')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resume unfinished steps' })).toBeEnabled();
  });
});
