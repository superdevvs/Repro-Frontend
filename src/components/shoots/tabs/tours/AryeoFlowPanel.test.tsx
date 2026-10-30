import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function supervisedFixture() {
  const original = fixture();
  return { ...original, orders: [{ ...original.orders[0], request_id: null,
    discovery: { ...original.orders[0].discovery, source_kind: 'supervised_existing_listing' },
    inventory: { complete: true, assets: [{ id: 'remote-photo-1', type: 'photos', delivered: true, dashboard_asset_id: 1 }],
      manual_delivery_receipt: { mode: 'supervised', operation_id: 'operator-run-1', listing_id: 'listing-42',
        media_version: 'v1', asset_ids: [1], tour_ids: [] as string[], verified_at: new Date().toISOString() } },
    inventory_checked_at: new Date().toISOString(),
  }] };
}

function providerFixture() {
  const original = fixture();
  return { ...original, orders: [{ ...original.orders[0], inventory: { provider_status: {
    origin: 'aryeo_provider', request_id: 'order-42', requester_email: 'test@example.test', listing_id: 'listing-42',
    checked_at: new Date().toISOString(), delivery_status: 'delivered',
    counts: { photos: 40, floorplans: 5, videos: 0, tours: 1 }, delivered_counts: null,
  } } }] };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Aryeo Flow panel', () => {
  it('offers explicit client connection and shoot enablement without queueing delivery', async () => {
    const original = fixture();
    const data = { ...original,
      connections: [{ ...original.connections[0], discovery_only: true, shoot_enabled: false }],
      orders: [{ ...original.orders[0], delivery_setup: { can_enable: true, client_name: 'David Wagner', client_access_required: true } }],
    };
    let enabled = false;
    const fetch = vi.fn().mockImplementation(async (_url, options) => {
      if (options.method === 'POST') enabled = true;
      return { ok: true, json: async () => enabled
        ? { ...data, connections: [{ ...data.connections[0], shoot_enabled: true, discovery_only: false }] }
        : data };
    });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={4} unitId={7} />);
    const connect = await screen.findByRole('button', { name: 'Connect client & enable delivery' });
    expect(screen.getByText('Delivery setup required')).toBeVisible();
    expect(screen.getByText(/Connect David Wagner to Aryeo to access their released media/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeDisabled();
    expect(fetch.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
    fireEvent.click(connect);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeEnabled());
    const mutation = fetch.mock.calls.find(call => call[1].method === 'POST');
    expect(mutation?.[0]).toContain('/shoots/4/aryeo/requests/3/enable-delivery');
    expect(JSON.parse(mutation?.[1].body)).toEqual({ confirm_access: true, unit_id: 7 });
    expect(fetch.mock.calls.some(call => call[0].endsWith('/process'))).toBe(false);
  });
  it('does not expose enablement without verified identity and admin permission', async () => {
    const original = fixture();
    const data = { ...original, connections: [{ ...original.connections[0], shoot_enabled: false }],
      orders: [{ ...original.orders[0], delivery_setup: { can_enable: false, client_name: 'David Wagner', client_access_required: false } }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText('Delivery setup required')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enable delivery' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeDisabled();
  });
  it('does not offer enablement while processing is paused', async () => {
    const original = fixture();
    const data = { ...original, connections: [{ ...original.connections[0], shoot_enabled: false, processing_enabled: false }],
      orders: [{ ...original.orders[0], delivery_setup: { can_enable: true, client_name: 'David Wagner', client_access_required: false } }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByRole('button', { name: 'Process & deliver' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Enable delivery' })).not.toBeInTheDocument();
  });
  it('shows a verified provider delivery without inventing a connector receipt or starting another job', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => providerFixture() });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={2505} />);
    const button = await screen.findByRole('button', { name: 'Delivered in Aryeo' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Reconcile any Dashboard changes/)).toBeVisible();
    expect(screen.getByText(/Provider status checked/)).toBeVisible();
    expect(screen.queryByText(/Fresh inventory required/)).not.toBeInTheDocument();
    const cells = within(screen.getByRole('row', { name: /^Photos/ })).getAllByRole('cell');
    expect(cells.map(cell => cell.textContent)).toEqual(['1', '1', '40', 'Unknown']);
    expect(within(screen.getByRole('row', { name: /^Floor plans/ })).getAllByRole('cell')[2]).toHaveTextContent('5');
    fireEvent.click(button);
    expect(fetch.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
  });
  it.each(['request', 'listing', 'requester', 'future', 'origin'])('does not present provider delivery for invalid %s evidence', async issue => {
    const data = providerFixture();
    const status = data.orders[0].inventory.provider_status;
    if (issue === 'request') status.request_id = 'another-order';
    if (issue === 'listing') status.listing_id = 'another-listing';
    if (issue === 'requester') status.requester_email = 'another@example.test';
    if (issue === 'future') status.checked_at = new Date(Date.now() + 120000).toISOString();
    if (issue === 'origin') status.origin = 'unverified';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByRole('button', { name: 'Process & deliver' })).toBeEnabled();
    expect(screen.queryByText('Delivered in Aryeo')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unknown')).toHaveLength(8);
  });
  it('retains the provider observation time and does not turn unknown delivered counts into zero', async () => {
    const data = providerFixture();
    data.orders[0].inventory.provider_status.checked_at = new Date(Date.now() - 600000).toISOString();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByText(/Showing last verified provider status/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delivered in Aryeo' })).toBeDisabled();
    expect(screen.getAllByText('Unknown')).toHaveLength(4);
  });
  it('keeps managed delivery follow-up available when provider status also confirms delivery', async () => {
    const original = providerFixture();
    const data = { ...original, orders: [{ ...original.orders[0], jobs: [{ id: 'job-1', status: 'followup_pending', media_version: 'v1',
      error: 'Archive unavailable', steps: { delivery: 'success', filing: 'failed' }, receipt: { verified_at: new Date().toISOString() } }] }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByText('Delivered · follow-up pending')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resume unfinished steps' })).toBeEnabled();
  });
  it('shows unknown inventory and never starts a delivery when opened', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => fixture() });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={4} unitId={7} />);
    await screen.findByText('Order order-42');
    expect(screen.getByText('Aryeo request received')).toBeVisible();
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
  it('shows a scheduled metadata-only request before approved media exists', async () => {
    const original = fixture();
    const data = { ...original,
      connections: [{ ...original.connections[0], shoot_enabled: false, discovery_only: true }],
      orders: [{ ...original.orders[0], discovery: { ...original.orders[0].discovery, address: '413 Mahan Ln',
        required: { photos: null, floorplans: 0, videos: 0, tours: null } },
      readiness: { ...original.orders[0].readiness, eligible: false, blockers: ['editing_not_approved'],
        available: { photos: 0, floorplans: 0, videos: 0, tours: 0 }, assets: [] } }],
    };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByText('Aryeo request received')).toBeVisible();
    expect(screen.getByText(/Request sync enabled/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeDisabled();
    expect(screen.queryByText(/not connected for this client/)).not.toBeInTheDocument();
    expect(fetch.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
  });
  it('shows an email-only review candidate and requires an explicit match without starting delivery', async () => {
    const original = fixture();
    const data = { ...original, orders: [], unmatched: [{ id: 7, source_id: 'gmail-new', address: '413 Mahan Ln',
      requester_email: null, requester_name: 'Trish May', unit_label: null }] };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByText('Aryeo request received. Confirm the client match below.')).toBeVisible();
    expect(screen.getByText(/Trish May — 413 Mahan Ln/)).toBeVisible();
    const match = screen.getByRole('button', { name: 'Match request' });
    expect(match).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Unmatched Aryeo request' }), { target: { value: '7' } });
    expect(match).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(match);
    await waitFor(() => expect(fetch.mock.calls.some(call => call[0].endsWith('/shoots/2505/aryeo/requests/7/match') && call[1].method === 'POST')).toBe(true));
    expect(fetch.mock.calls.some(call => call[0].endsWith('/process'))).toBe(false);
  });
  it('cannot queue delivery before the requester email is verified', async () => {
    const original = fixture();
    const data = { ...original, orders: [{ ...original.orders[0],
      discovery: { ...original.orders[0].discovery, requester_email: null, requester_name: 'Trish May' } }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={2505} />);
    expect(await screen.findByText('Requester email needs verification before delivery.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Process & deliver' })).toBeDisabled();
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
  it('shows verified supervised delivery without inventing an order or permitting a duplicate', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => supervisedFixture() });
    vi.stubGlobal('fetch', fetch);
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText('Listing listing-42')).toBeVisible();
    const button = screen.getByRole('button', { name: 'Delivered manually' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Original Aryeo request ID unavailable/)).toBeVisible();
    expect(screen.queryByText(/Order awaiting/)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(fetch.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
  });
  it.each(['listing', 'media version', 'missing asset', 'unmapped asset', 'undelivered asset', 'incomplete inventory', 'unknown inventory time', 'future verification'])('does not claim manual delivery for %s evidence', async issue => {
    const data = supervisedFixture();
    const order = data.orders[0];
    const receipt = order.inventory.manual_delivery_receipt;
    if (issue === 'listing') receipt.listing_id = 'other-listing';
    if (issue === 'media version') receipt.media_version = 'old-version';
    if (issue === 'missing asset') receipt.asset_ids = [];
    if (issue === 'unmapped asset') order.inventory.assets[0].dashboard_asset_id = 2;
    if (issue === 'undelivered asset') order.inventory.assets[0].delivered = false;
    if (issue === 'incomplete inventory') order.inventory.complete = false;
    if (issue === 'unknown inventory time') order.inventory_checked_at = '';
    if (issue === 'future verification') receipt.verified_at = new Date(Date.now() + 3600000).toISOString();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    render(<AryeoFlowPanel shootId={4} />);
    expect(await screen.findByText('Manual delivery needs verification')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delivered manually' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manual delivery' })).toBeDisabled();
  });
});
