import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { StudioNewEdit } from './StudioNewEdit';
import { listingStudioClient } from '@/services/listingStudioClientService';
import { readStudioPurchase } from '@/lib/listingStudioPurchase';
import type { StudioAccount, StudioCatalog, StudioOrder, StudioQuote } from '@/types/listingStudioClient';
import fixtures from './studioFixtures.test-data.json';

vi.mock('@/services/listingStudioClientService', () => ({ listingStudioClient: { upload: vi.fn(), quote: vi.fn(), createOrder: vi.fn() } }));
const catalog = fixtures.catalog as StudioCatalog; const account = fixtures.account as StudioAccount;
const order = fixtures.order as StudioOrder;
const quote: StudioQuote = { ...fixtures.quote, kind: 'ai_edit', service: 'grass', options: {}, source: { kind: 'upload', id: '00000000-0000-4000-8000-000000000003' }, pricing: { ...fixtures.quote.pricing, totalPriceCents: 700, creditCostCents: 700, basePriceCents: 700, discountCents: 0, discountPercent: 0 } } as StudioQuote;
const onCreated = vi.fn();
const newPhoto = () => new File(['test-image'], 'exterior.jpg', { type: 'image/jpeg' });
function view(extra: Partial<Parameters<typeof StudioNewEdit>[0]> = {}) { return render(<StudioNewEdit accountId="42" account={account} catalog={catalog} onCreated={onCreated} onCancelRevision={vi.fn()} {...extra} />); }
async function reviewPhoto() {
  const user = userEvent.setup(); await user.upload(screen.getByLabelText('Your photo'), newPhoto());
  await user.click(screen.getByRole('radio', { name: /Grass enhancement/ }));
  await user.click(screen.getByRole('button', { name: 'Review price' }));
  await screen.findByRole('button', { name: 'Confirm · use $7 credit' }); return user;
}
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-preview') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.mocked(listingStudioClient.upload).mockResolvedValue({ id: quote.source.id, originalPreviewAvailable: true, expiresAt: '2026-11-01T00:00:00Z' });
  vi.mocked(listingStudioClient.quote).mockResolvedValue(quote);
  vi.mocked(listingStudioClient.createOrder).mockResolvedValue({ order, created: true, nextAction: { type: 'await_processing' } });
});
afterEach(cleanup);

describe('paid photo confirmation and recovery', () => {
  it('shows a server quote before any purchase, and prevents duplicate confirmation', async () => {
    view(); const user = await reviewPhoto(); expect(listingStudioClient.createOrder).not.toHaveBeenCalled();
    await user.dblClick(screen.getByRole('button', { name: 'Confirm · use $7 credit' }));
    expect(listingStudioClient.createOrder).toHaveBeenCalledTimes(1);
    expect(listingStudioClient.createOrder).toHaveBeenCalledWith(quote.id, 'credits', expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(onCreated).toHaveBeenCalledWith(order); expect(readStudioPurchase('42')).toBeNull();
  });
  it('recovers an uncertain confirmation after remount using the exact original request', async () => {
    vi.mocked(listingStudioClient.createOrder).mockRejectedValueOnce(new Error('Connection interrupted'));
    const first = view(); const user = await reviewPhoto(); await user.click(screen.getByRole('button', { name: 'Confirm · use $7 credit' }));
    await screen.findByRole('button', { name: 'Check existing request' });
    const originalCall = vi.mocked(listingStudioClient.createOrder).mock.calls[0]; expect(readStudioPurchase('42')).not.toBeNull(); first.unmount();
    view(); expect(screen.queryByLabelText('Your photo')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check existing request' }));
    expect(vi.mocked(listingStudioClient.createOrder).mock.calls[1]).toEqual(originalCall);
    expect(listingStudioClient.upload).toHaveBeenCalledTimes(1); expect(listingStudioClient.quote).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1); expect(readStudioPurchase('42')).toBeNull();
  });
  it('never falls back to charging a card when concurrent spending exhausts credit', async () => {
    vi.mocked(listingStudioClient.createOrder).mockRejectedValueOnce({ response: { status: 409, data: { code: 'insufficient_credits', message: 'Your available editing credit changed.' } } });
    view(); const user = await reviewPhoto(); await user.click(screen.getByRole('button', { name: 'Confirm · use $7 credit' }));
    await screen.findByText('Your available editing credit changed.');
    expect(listingStudioClient.createOrder).toHaveBeenCalledTimes(1); expect(onCreated).not.toHaveBeenCalled(); expect(readStudioPurchase('42')).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue · pay/ })).not.toBeInTheDocument();
  });
  it('retries an unchanged upload with the same key after a lost response', async () => {
    vi.mocked(listingStudioClient.upload).mockRejectedValueOnce(new Error('Lost response'));
    view(); const user = userEvent.setup(); await user.upload(screen.getByLabelText('Your photo'), newPhoto());
    await user.click(screen.getByRole('button', { name: 'Review price' })); await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Review price' })); await waitFor(() => expect(listingStudioClient.quote).toHaveBeenCalledTimes(1));
    expect(vi.mocked(listingStudioClient.upload).mock.calls[1][1]).toBe(vi.mocked(listingStudioClient.upload).mock.calls[0][1]);
  });
  it('keeps the original purchase key when account access changes after an uncertain response', async () => {
    vi.mocked(listingStudioClient.createOrder).mockRejectedValueOnce({ response: { status: 403, data: { code: 'account_ineligible', message: 'Use your client account.' } } });
    view(); const user = await reviewPhoto(); await user.click(screen.getByRole('button', { name: 'Confirm · use $7 credit' }));
    await screen.findByRole('button', { name: 'Check existing request' });
    const originalCall = vi.mocked(listingStudioClient.createOrder).mock.calls[0];
    expect(readStudioPurchase('42')?.key).toBe(originalCall[2]);
    await user.click(screen.getByRole('button', { name: 'Check existing request' }));
    expect(vi.mocked(listingStudioClient.createOrder).mock.calls[1]).toEqual(originalCall);
  });
  it('requires a new quote after the edit choice changes', async () => {
    view(); const user = await reviewPhoto(); await user.click(screen.getByRole('radio', { name: /Virtual staging/ }));
    expect(screen.queryByRole('button', { name: 'Confirm · use $7 credit' })).not.toBeInTheDocument();
    expect(listingStudioClient.createOrder).not.toHaveBeenCalled();
  });
  it('uploads the selected photo again after a definitive source expiry without creating an order', async () => {
    vi.mocked(listingStudioClient.quote).mockRejectedValueOnce({ response: { status: 422, data: { code: 'source_unavailable', message: 'The source photo expired. Upload it again.' } } });
    view(); const user = userEvent.setup(); await user.upload(screen.getByLabelText('Your photo'), newPhoto());
    await user.click(screen.getByRole('button', { name: 'Review price' })); await screen.findByText('The source photo expired. Upload it again.');
    const oldKey = vi.mocked(listingStudioClient.upload).mock.calls[0][1];
    await user.click(screen.getByRole('button', { name: 'Review price' }));
    await screen.findByRole('button', { name: 'Confirm · use $7 credit' });
    expect(listingStudioClient.upload).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listingStudioClient.upload).mock.calls[1][1]).not.toBe(oldKey);
    expect(listingStudioClient.createOrder).not.toHaveBeenCalled();
  });
  it('does not upload or create orders while paid editing is disabled', async () => {
    view({ account: { ...account, capabilities: { ...account.capabilities, canCreateOrder: false } } });
    await userEvent.upload(screen.getByLabelText('Your photo'), newPhoto());
    expect(screen.getByRole('button', { name: 'Review price' })).toBeDisabled(); expect(listingStudioClient.upload).not.toHaveBeenCalled();
  });
  it('quotes a human revision from the owned result and uses its discounted server price', async () => {
    vi.mocked(listingStudioClient.quote).mockResolvedValue({ ...quote, kind: 'human_revision', pricing: { ...quote.pricing, basePriceCents: 1500, totalPriceCents: 1200, creditCostCents: 1200, discountPercent: 20, discountCents: 300 } });
    const source = { kind: 'claimed_trial' as const, id: '00000000-0000-4000-8000-000000000009' };
    view({ revision: { source, service: 'grass' } }); const user = userEvent.setup();
    await user.type(screen.getByLabelText('What would you like changed?'), 'Please refine the lawn edges.');
    await user.click(screen.getByRole('button', { name: 'Review price' }));
    await screen.findByRole('button', { name: 'Confirm · use $12 credit' });
    expect(listingStudioClient.upload).not.toHaveBeenCalled();
    expect(listingStudioClient.quote).toHaveBeenCalledWith({ kind: 'human_revision', service: 'grass', source, options: {}, instructions: 'Please refine the lawn edges.' });
    expect(screen.getByText('Plan discount (20%)')).toBeInTheDocument();
  });
});


describe('delegated purchase confirmation', () => {
  it('requires explicit named-client credit consent before calling the delegated adapter', async () => {
    const api = { upload: vi.fn().mockResolvedValue({ id: quote.source.id }), quote: vi.fn().mockResolvedValue(quote), createOrder: vi.fn().mockResolvedValue({ order, created: true, nextAction: { type: 'await_processing' } }) };
    view({ api, accountId: 'staff:9:client:42', forClient: { name: 'Jane Client' } }); const user = await reviewPhoto();
    const confirm = screen.getByRole('button', { name: 'Confirm · use $7 credit' }); expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /I confirm using/ })); await user.click(confirm);
    expect(api.createOrder).toHaveBeenCalledWith(quote.id, 'credits', expect.any(String)); expect(listingStudioClient.createOrder).not.toHaveBeenCalled(); expect(readStudioPurchase('42')).toBeNull();
  });
  it('labels delegated card orders as a client payment request without opening Stripe', async () => {
    const api = { upload: vi.fn().mockResolvedValue({ id: quote.source.id }), quote: vi.fn().mockResolvedValue(quote), createOrder: vi.fn().mockResolvedValue({ order: { ...order, funding: { ...order.funding, method: 'card', status: 'pending' } }, created: true, nextAction: { type: 'checkout' } }) };
    view({ api, accountId: 'staff:9:client:42', forClient: { name: 'Jane Client' } }); const user = await reviewPhoto();
    await user.click(screen.getByRole('radio', { name: /Pay.*by card/ })); await user.click(screen.getByRole('button', { name: 'Create client payment request' }));
    expect(api.createOrder).toHaveBeenCalledWith(quote.id, 'card', expect.any(String)); expect(listingStudioClient.createOrder).not.toHaveBeenCalled();
  });
});
