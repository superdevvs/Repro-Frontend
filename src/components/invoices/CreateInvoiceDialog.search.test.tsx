import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateInvoiceDialog } from './CreateInvoiceDialog';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: mocks }));
vi.mock('@/services/invoiceService', () => ({ mapInvoiceResponse: (invoice: object) => invoice }));
vi.mock('@/utils/invoiceDownloads', () => ({ downloadInvoicePdf: vi.fn() }));
vi.mock('./SendInvoiceDialog', () => ({ SendInvoiceDialog: () => null }));
vi.mock('@/components/layout/Logo', () => ({ Logo: () => <span>Company logo</span> }));

const oldClient = { id: 1, name: 'AG Marketing', email: 'ag@example.test' };
const latestClient = { id: 2, name: 'John Rumik', email: 'john@example.test' };
const oldShoot = {
  id: 10, address: '10 Cedar Lane', date: '2026-10-01', existing_invoice: null,
  lines: [{ description: 'Photography', quantity: 1, price: 100.01 }],
};
const latestShoot = {
  id: 20, address: '124 Maple Avenue', date: '2026-10-02', existing_invoice: null,
  lines: [{ description: 'Property video', quantity: 2, price: 250 }],
};
type Option = typeof oldClient | typeof oldShoot;
const response = (rows: Option[]) => ({ data: { data: rows } });

function delayedResponse() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ReturnType<typeof response>>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}
async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
}
async function deliver(request: ReturnType<typeof delayedResponse>, rows: Option[]) {
  await act(async () => { request.resolve(response(rows)); });
}
function renderComposer(isOpen = true) {
  const props = { isOpen, onClose: vi.fn(), onInvoiceCreate: vi.fn() };
  return { ...render(<CreateInvoiceDialog {...props} />), props };
}
function clientResults() {
  return within(screen.getByLabelText('Client search results'));
}
function shootResults() {
  return within(screen.getByLabelText('Shoot search results'));
}

describe('invoice composer search generations', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('removes old client options immediately while the new search is debouncing', async () => {
    const latest = delayedResponse();
    mocks.get.mockResolvedValueOnce(response([oldClient])).mockReturnValueOnce(latest.promise);
    renderComposer();
    await debounce();
    expect(clientResults().getByRole('button', { name: /AG Marketing/ })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Search clients'), { target: { value: 'John' } });
    expect(clientResults().queryByRole('button', { name: /AG Marketing/ })).not.toBeInTheDocument();
    expect(clientResults().getByRole('status')).toHaveTextContent('Searching');
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await debounce();
    expect(mocks.get.mock.calls[1][1].params).toEqual({ q: 'John' });
    await deliver(latest, [latestClient]);
    fireEvent.click(clientResults().getByRole('button', { name: /John Rumik/ }));
    expect(screen.getByRole('button', { name: 'Change client' })).toBeInTheDocument();
    expect(screen.getByText('john@example.test', { selector: '.composer-selected small' })).toBeInTheDocument();
  });

  it.each(['during debounce', 'during latest request'])('ignores a late old client response %s, including its loading completion', async (stage) => {
    const old = delayedResponse(), latest = delayedResponse();
    mocks.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    renderComposer();
    await debounce();
    fireEvent.change(screen.getByLabelText('Search clients'), { target: { value: 'John' } });
    if (stage === 'during latest request') await debounce();
    await deliver(old, [oldClient]);
    expect(clientResults().queryByRole('button', { name: /AG Marketing/ })).not.toBeInTheDocument();
    expect(clientResults().getByRole('status')).toHaveTextContent('Searching');
    if (stage === 'during debounce') await debounce();
    await deliver(latest, [latestClient]);
    expect(clientResults().queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(clientResults().getByRole('button', { name: /John Rumik/ }));
    expect(screen.getByRole('button', { name: 'Change client' })).toBeInTheDocument();
  });

  it('removes stale shoot options before debounce and keeps the selected property until a new shoot is chosen', async () => {
    const latest = delayedResponse();
    mocks.get.mockResolvedValueOnce(response([oldClient])).mockResolvedValueOnce(response([oldShoot])).mockReturnValueOnce(latest.promise);
    renderComposer();
    await debounce();
    fireEvent.click(clientResults().getByRole('button', { name: /AG Marketing/ }));
    await debounce();
    fireEvent.click(shootResults().getByRole('button', { name: /10 Cedar Lane/ }));

    fireEvent.change(screen.getByLabelText('Search shoots'), { target: { value: 'Maple' } });
    expect(shootResults().queryByRole('button', { name: /10 Cedar Lane/ })).not.toBeInTheDocument();
    expect(shootResults().getByRole('status')).toHaveTextContent('Searching');
    expect(screen.getByLabelText('Property address')).toHaveValue('10 Cedar Lane');
    expect(screen.getByLabelText('Unit price (USD)')).toHaveValue(100.01);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await debounce();
    expect(mocks.get.mock.calls[2][1].params).toEqual({ q: 'Maple', client_id: oldClient.id });
    await deliver(latest, [latestShoot]);
    fireEvent.click(shootResults().getByRole('button', { name: /124 Maple Avenue/ }));
    expect(screen.getByLabelText('Property address')).toHaveValue('124 Maple Avenue');
    expect(screen.getByLabelText('Service / description')).toHaveValue('Property video');
    expect(screen.getByLabelText('Qty')).toHaveValue(2);
    expect(screen.getByLabelText('Unit price (USD)')).toHaveValue(250);
  });

  it.each(['during debounce', 'during latest request'])('ignores a late old shoot response %s, including its loading completion', async (stage) => {
    const old = delayedResponse(), latest = delayedResponse();
    mocks.get.mockResolvedValueOnce(response([oldClient])).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    renderComposer();
    await debounce();
    fireEvent.click(clientResults().getByRole('button', { name: /AG Marketing/ }));
    await debounce();
    fireEvent.change(screen.getByLabelText('Search shoots'), { target: { value: 'Maple' } });
    if (stage === 'during latest request') await debounce();
    await deliver(old, [oldShoot]);
    expect(shootResults().queryByRole('button', { name: /10 Cedar Lane/ })).not.toBeInTheDocument();
    expect(shootResults().getByRole('status')).toHaveTextContent('Searching');
    if (stage === 'during debounce') await debounce();
    await deliver(latest, [latestShoot]);
    fireEvent.click(shootResults().getByRole('button', { name: /124 Maple Avenue/ }));
    expect(screen.getByLabelText('Property address')).toHaveValue(latestShoot.address);
  });

  it('ignores late shoot failures after the selected client changes', async () => {
    const oldShoots = delayedResponse(), clients = delayedResponse();
    mocks.get.mockResolvedValueOnce(response([oldClient])).mockReturnValueOnce(oldShoots.promise).mockReturnValueOnce(clients.promise);
    renderComposer();
    await debounce();
    fireEvent.click(clientResults().getByRole('button', { name: /AG Marketing/ }));
    await debounce();
    fireEvent.click(screen.getByRole('button', { name: 'Change client' }));
    await act(async () => { oldShoots.reject(new Error('Outdated search failed')); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(clientResults().getByRole('status')).toHaveTextContent('Searching');
    await debounce();
    await deliver(clients, [latestClient]);
    expect(clientResults().getByRole('button', { name: /John Rumik/ })).toBeEnabled();
  });

  it('rejects pending search responses after closing and reopening', async () => {
    const old = delayedResponse(), latest = delayedResponse();
    mocks.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const { rerender, props } = renderComposer();
    await debounce();
    rerender(<CreateInvoiceDialog {...props} isOpen={false} />);
    await deliver(old, [oldClient]);
    rerender(<CreateInvoiceDialog {...props} isOpen />);
    expect(clientResults().queryByRole('button', { name: /AG Marketing/ })).not.toBeInTheDocument();
    expect(clientResults().getByRole('status')).toHaveTextContent('Searching');
    await debounce();
    await deliver(latest, [latestClient]);
    expect(clientResults().getByRole('button', { name: /John Rumik/ })).toBeEnabled();
  });

  it('rejects the previous shoot search after saving a manual invoice and resetting to a new invoice', async () => {
    const oldShoots = delayedResponse(), latest = delayedResponse();
    mocks.get.mockResolvedValueOnce(response([oldClient])).mockReturnValueOnce(oldShoots.promise).mockReturnValueOnce(latest.promise);
    mocks.post.mockResolvedValue({ data: { data: {
      id: '99', number: 'M-99', client: oldClient.name, property: 'Manual property', date: '2026-10-09', dueDate: '2026-10-09',
      status: 'draft', amount: 100, total: 100, subtotal: 100, tax: 0, amountPaid: 0, balance: 100, services: ['Photography'], paymentMethod: 'N/A',
    } } });
    renderComposer();
    await debounce();
    fireEvent.click(clientResults().getByRole('button', { name: /AG Marketing/ }));
    await debounce();
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: 'Manual property' } });
    fireEvent.change(screen.getByLabelText('Unit price (USD)'), { target: { value: '100' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create invoice' })); });
    expect(mocks.post.mock.calls[0][1].shoot_id).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await deliver(oldShoots, [oldShoot]);
    expect(clientResults().getByRole('status')).toHaveTextContent('Searching');
    expect(screen.getByLabelText('Property address')).toHaveValue('');
    await debounce();
    await deliver(latest, [latestClient]);
    expect(clientResults().getByRole('button', { name: /John Rumik/ })).toBeEnabled();
  });
});
