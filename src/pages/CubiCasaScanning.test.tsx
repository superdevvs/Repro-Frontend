import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CubiCasaScanning from './CubiCasaScanning';

const mocks = vi.hoisted(() => ({
  role: 'admin' as string,
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: mocks.role, isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/services/cubicasaTracking', () => ({
  getCubicasaTrackedShoots: mocks.list,
  createCubicasaOrder: mocks.create,
}));

const missing = {
  id: 10,
  address: '10 Missing Lane',
  scheduled_at: '2026-09-25T15:00:00.000Z',
  client_name: 'Lee Gedansky',
  photographer_name: 'Alex Morgan',
  services: ['2D Floor Plan'],
  cubicasa_order_id: null,
  cubicasa_external_id: null,
  cubicasa_status: null,
  cubicasa_sync_status: null,
  cubicasa_last_sync_error: null,
  cubicasa_tour_url: null,
  linked: false,
};

const linked = {
  id: 20,
  address: '20 Linked Lane',
  scheduled_at: '2026-09-26T15:00:00.000Z',
  client_name: 'Pat Client',
  photographer_name: 'Alex Morgan',
  services: ['Floor Plan'],
  cubicasa_order_id: 'order-20',
  cubicasa_external_id: null,
  cubicasa_status: 'Pending',
  cubicasa_sync_status: null,
  cubicasa_last_sync_error: null,
  cubicasa_tour_url: null,
  linked: true,
};

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <CubiCasaScanning />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('Property Scan tracker', () => {
  beforeEach(() => {
    mocks.role = 'admin';
    mocks.create.mockResolvedValue({ success: true });
    mocks.list.mockImplementation(async ({ status }: { status: string }) => ({
      data: status === 'linked' ? [linked] : [missing],
      counts: { missing: 1, linked: 1 },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('lists missing shoots and creates an order only for a shoot that needs one', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('10 Missing Lane')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Needs an order/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connected/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create order for 10 Missing Lane' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(10));

    await user.click(screen.getByRole('button', { name: /Connected/ }));
    expect(await screen.findByText('20 Linked Lane')).toBeInTheDocument();
    expect(screen.getByText('order-20')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create order/ })).not.toBeInTheDocument();
  });

  it('hides create from photographers', async () => {
    mocks.role = 'photographer';
    renderPage();

    expect(await screen.findByText('10 Missing Lane')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create order/ })).not.toBeInTheDocument();
  });
});
