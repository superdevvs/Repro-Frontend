import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ListingStudioDialog from './ListingStudioDialog';
import { listingStudioService, type ListingStudioRequest } from '@/services/listingStudioService';

const auth = vi.hoisted(() => ({ role: 'client', user: { id: '12', name: 'Jordan Client', email: 'jordan@example.test', phone: '+12025550100', secondary_roles: [] as string[] } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/listingStudioService', () => ({ listingStudioService: { catalog: vi.fn(), clients: vi.fn(), requests: vi.fn(), create: vi.fn(), review: vi.fn() }, listingStudioError: () => 'The request could not be saved.' }));
const catalog = { plans: [{ code: 'plan_100', name: 'Plan 100', reference_price_usd: 100 }, { code: 'custom', name: 'Custom plan', reference_price_usd: null }], services: [{ code: 'virtual_staging', name: 'Virtual staging' }] };
const contact = { id: 12, name: 'Jordan Client', email: 'jordan@example.test', phone: '+12025550100' };
const request: ListingStudioRequest = { id: 9, type: 'signup', status: 'pending', client_id: 12, client: contact, contact, plan_code: 'plan_100', services: ['virtual_staging'], details: 'Help with my listings', phone: null, preferred_time: null, review_note: null, reviewed_at: null, reviewed_by: null, created_at: '2026-09-27T12:00:00Z', submitted_by: { id: 12, name: 'Jordan Client' } };
const requestPage = (items: ListingStudioRequest[]) => ({ data: items, meta: { current_page: 1, last_page: 1, total: items.length, per_page: 20 } });
const mount = (initialTab?: 'requests') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ListingStudioDialog initialTab={initialTab} onClose={vi.fn()} /></QueryClientProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'client';
  auth.user.secondary_roles = [];
  vi.mocked(listingStudioService.catalog).mockResolvedValue(catalog);
  vi.mocked(listingStudioService.clients).mockResolvedValue([contact]);
  vi.mocked(listingStudioService.requests).mockResolvedValue(requestPage([request]));
  vi.mocked(listingStudioService.create).mockResolvedValue(request);
  vi.mocked(listingStudioService.review).mockResolvedValue({ ...request, status: 'approved' });
});
afterEach(cleanup);

describe('Listing Studio requests', () => {
  it('opens a notification directly in request history', async () => {
    mount('requests');
    expect(await screen.findByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Request history' })).toHaveAttribute('aria-selected', 'true');
  });

  it('uses assisted signup for a primary client with a secondary rep role', async () => {
    auth.user.secondary_roles = ['sales_rep'];
    mount();
    expect(await screen.findByLabelText('Who is this for?')).toBeInTheDocument();
    expect(listingStudioService.clients).toHaveBeenCalled();
  });

  it('shows review controls for a primary rep with a secondary admin role', async () => {
    auth.role = 'salesRep';
    auth.user.secondary_roles = ['admin'];
    mount();
    expect(await screen.findByRole('button', { name: 'Approve request' })).toBeInTheDocument();
  });

  it('submits a client signup for their own identity and shows the pending history', async () => {
    mount();
    fireEvent.click(await screen.findByRole('radio', { name: /\$100/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Virtual staging' }));
    expect(screen.queryByLabelText('Who is this for?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit signup request' }));
    await waitFor(() => expect(listingStudioService.create).toHaveBeenCalledOnce());
    expect(vi.mocked(listingStudioService.create).mock.calls[0][0]).toEqual({ type: 'signup', plan_code: 'plan_100', services: ['virtual_staging'], idempotency_key: expect.any(String) });
    expect(await screen.findByText('Request submitted.')).toBeInTheDocument();
    expect(await screen.findByText('Awaiting review')).toBeInTheDocument();
    expect(listingStudioService.clients).not.toHaveBeenCalled();
  });

  it('allows a sales rep to submit custom client contact details for review', async () => {
    auth.role = 'salesRep';
    mount();
    fireEvent.change(await screen.findByLabelText('Who is this for?'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: ' Taylor Agent ' } });
    fireEvent.change(screen.getByLabelText('Client email'), { target: { value: 'taylor@example.test' } });
    fireEvent.click(screen.getByRole('radio', { name: /Custom plan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit signup request' }));
    await waitFor(() => expect(listingStudioService.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', plan_code: 'custom', custom_client: { name: 'Taylor Agent', email: 'taylor@example.test', phone: '', company_name: '' } })));
  });

  it('prefills a selected client callback and submits the preferred time', async () => {
    auth.role = 'salesRep';
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Request a call' }));
    await screen.findByRole('option', { name: /Jordan Client/ });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: '12' } });
    expect(screen.getByLabelText('Callback phone')).toHaveValue('+12025550100');
    fireEvent.change(screen.getByLabelText(/Preferred time/), { target: { value: 'Weekdays 2 pm Eastern' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit call request' }));
    await waitFor(() => expect(listingStudioService.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'call', client_id: 12, phone: '+12025550100', preferred_time: 'Weekdays 2 pm Eastern' })));
  });

  it('keeps a failed request and reuses its key when the client retries', async () => {
    vi.mocked(listingStudioService.create).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(request);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Request a change' }));
    fireEvent.change(screen.getByLabelText('What would you like to change?'), { target: { value: 'Add rush delivery to my plan.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit change request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.getByLabelText('What would you like to change?')).toHaveValue('Add rush delivery to my plan.');
    fireEvent.click(screen.getByRole('button', { name: 'Submit change request' }));
    await waitFor(() => expect(listingStudioService.create).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(listingStudioService.create).mock.calls;
    expect(calls[0][0].idempotency_key).toBe(calls[1][0].idempotency_key);
    expect(calls[1][0]).toEqual({ type: 'change', details: 'Add rush delivery to my plan.', idempotency_key: expect.any(String) });
  });

  it.each(['admin', 'superadmin'])('lets %s approve with a response and refreshes the request', async role => {
    auth.role = role;
    vi.mocked(listingStudioService.requests).mockResolvedValueOnce(requestPage([request])).mockResolvedValue(requestPage([{ ...request, status: 'approved', review_note: 'We will confirm your terms.' }]));
    mount();
    fireEvent.change(await screen.findByLabelText(/Response to client/), { target: { value: 'We will confirm your terms.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(listingStudioService.review).toHaveBeenCalledWith(9, { status: 'approved', review_note: 'We will confirm your terms.' }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve request' })).not.toBeInTheDocument();
  });

  it('uses call completion instead of signup approval', async () => {
    auth.role = 'admin';
    vi.mocked(listingStudioService.requests).mockResolvedValue(requestPage([{ ...request, type: 'call', plan_code: null, phone: '+12025550100' }]));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark call completed' }));
    await waitFor(() => expect(listingStudioService.review).toHaveBeenCalledWith(9, { status: 'completed' }));
    expect(screen.queryByRole('button', { name: 'Approve request' })).not.toBeInTheDocument();
  });

  it.each(['client', 'salesRep'])('does not expose review actions to %s', async role => {
    auth.role = role;
    mount();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Request history' }), { button: 0, ctrlKey: false });
    await screen.findByText('Awaiting review');
    expect(screen.queryByRole('button', { name: 'Approve request' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline request' })).not.toBeInTheDocument();
  });

  it.each(['editor', 'photographer', 'editing_manager'])('does not open or fetch studio for %s', role => {
    auth.role = role;
    mount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listingStudioService.catalog).not.toHaveBeenCalled();
  });
});
