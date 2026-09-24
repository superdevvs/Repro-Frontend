import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { AutomationRule } from '@/types/messaging';
import Automations from './Automations';

const mocks = vi.hoisted(() => ({
  getAutomations: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/services/messaging', () => ({
  getAutomations: mocks.getAutomations,
  deleteAutomation: vi.fn(),
  runAutomation: vi.fn(),
  toggleAutomation: vi.fn(),
}));
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/messaging/email/EmailNavigation', () => ({ EmailNavigation: () => null }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/components/messaging/automations/AutomationEditorDialog', () => ({
  AutomationEditorDialog: ({ open, mode }: { open: boolean; mode: string }) => (open ? <div>Editor {mode}</div> : null),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

const booking = {
  id: 1,
  name: 'Booking confirmation',
  description: 'Confirm booking to client',
  trigger_type: 'SHOOT_BOOKED',
  is_active: true,
  scope: 'SYSTEM',
  is_system_locked: true,
  recipients_json: ['photographer'],
  template: { id: 9, name: 'Booking confirmation email', channel: 'EMAIL' },
  validation_state: { valid: true, errors: [], node_errors: {}, summary: { node_count: 3, edge_count: 2, reachable_action_count: 1 } },
} as AutomationRule;

const receipt = {
  id: 2,
  name: 'Payment receipt',
  description: 'Email a receipt',
  trigger_type: 'PAYMENT_COMPLETED',
  is_active: false,
  scope: 'GLOBAL',
  recipients_json: ['client'],
  schedule_json: { offset: '-2d' },
  validation_state: { valid: false, errors: ['Pick a template'], node_errors: {}, summary: { node_count: 2, edge_count: 1, reachable_action_count: 0 } },
} as AutomationRule;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Automations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('automations by the job', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('groups live automations and keeps system and custom actions', async () => {
    mocks.getAutomations.mockResolvedValue([booking, receipt]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Booking confirmation' })).toBeInTheDocument();
    expect(screen.getByText('Photographer')).toBeInTheDocument();
    expect(screen.getByText('Right away')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment receipt' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Money moment' }));
    expect(await screen.findByRole('heading', { name: 'Payment receipt' })).toBeInTheDocument();
    expect(screen.getByText('2 days before')).toBeInTheDocument();
    expect(screen.getByText('Pick a template')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions for Payment receipt' }));
    const customMenu = screen.getByRole('menu');
    expect(within(customMenu).getByText('Delete')).toBeInTheDocument();
    expect(within(customMenu).queryByText('Run now')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Booking moment' }));
    await user.click(screen.getByRole('button', { name: 'More actions for Booking confirmation' }));
    const systemMenu = screen.getByRole('menu');
    expect(within(systemMenu).getByText('Run now')).toBeInTheDocument();
    expect(within(systemMenu).queryByText('Delete')).not.toBeInTheDocument();
    await user.click(within(systemMenu).getByText('Open workflow'));
    expect(mocks.navigate).toHaveBeenCalledWith('/messaging/email/automations/1');
  });

  it('opens the form for a new automation and the editor for a blank workflow', async () => {
    mocks.getAutomations.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'New automation' }));
    expect(screen.getByText('Editor create')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advanced editor' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messaging/email/automations/new');
  });
});
