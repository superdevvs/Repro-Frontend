import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import QuoteEditorPage from './QuoteEditorPage';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../api', async (importOriginal) => ({ ...await importOriginal<typeof import('../../api')>(), crmApi: api }));

const quote = {
  id: 42, number: 'Q-42', status: 'approved', contact: { id: 7, name: 'Jane' }, discount_percent: 15, property_address: '20 Main',
  sqft: 2350, items: [{ service_id: 4, name: 'Listing photos', quantity: 1, unit_price: 365 }], approved_by: { name: 'Reviewer' },
};
function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/crm/contacts/:contactId/quotes/new" element={<QuoteEditorPage />} />
    <Route path="/crm/quotes/:id" element={<QuoteEditorPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url: string) => {
    if (url === '/meta') return { can: { approve_quotes: false }, settings: { quote_discount_approval_percent: 10 } };
    if (url === '/contacts/7') return { contact: { id: 7, name: 'Jane', email: 'jane@example.test', can: { edit: true } } };
    if (url === '/quotes/42') return { quote };
    if (url === '/quotes/catalog') return { data: [{ id: 4, name: 'Listing photos', price: 200 }] };
    throw new Error(url);
  });
  api.post.mockResolvedValue({ quote });
});

it('sends a newly created quote using the saved ID', async () => {
  open('/crm/contacts/7/quotes/new');
  fireEvent.click(await screen.findByRole('button', { name: 'Custom line' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save and send' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes/42/send'));
  expect(api.post.mock.calls[0][0]).toBe('/contacts/7/quotes');
});

it('keeps an approved price on reload and sends without clearing its approval', async () => {
  open('/crm/quotes/42');
  await waitFor(() => expect(screen.getByLabelText('Square feet')).toHaveValue(2350));
  expect(screen.getAllByText('$365.00').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save and send' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes/42/send'));
  expect(api.patch).not.toHaveBeenCalled();
});

it('requires another review when an approved quote changes', async () => {
  open('/crm/quotes/42');
  await waitFor(() => expect(screen.getByLabelText('Square feet')).toHaveValue(2350));
  fireEvent.change(screen.getByLabelText('Discount %'), { target: { value: '20' } });
  expect(screen.queryByRole('button', { name: 'Save and send' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask for approval' })).toBeEnabled();
});
