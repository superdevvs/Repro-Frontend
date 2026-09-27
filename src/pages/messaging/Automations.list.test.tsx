import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { AutomationRule, AutomationRun } from '@/types/messaging';
import Automations from './Automations';
import { buildSimpleWorkflowFromDraft } from '@/components/messaging/automations/workflow-utils';
import { createDefaultDraft } from '@/components/messaging/automations/automationEditorModel';

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

const failedRun: AutomationRun = {
  id: 857, automation_rule_id: 1, status: 'failed',
  created_at: '2026-09-15T13:00:04Z', started_at: '2026-09-15T13:00:04Z',
  completed_at: '2026-09-15T13:00:04Z', updated_at: '2026-09-15T13:00:04Z',
  error_message: 'Automation could not complete. Review its configuration and try again.',
};

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

    await user.click(screen.getByRole('button', { name: /Money moment/ }));
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
    expect(within(systemMenu).queryByText('Run now')).not.toBeInTheDocument();
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

  it('opens the full workflow when Change cannot preserve all conditions in the simple form', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), use_condition: true, condition_field: 'notify_client', condition_value: 'true' });
    workflow.nodes.find((node) => node.type === 'condition.if')!.config.rules = [
      { field: 'notify_client', operator: 'eq', value: true },
      { field: 'shoot.status', operator: 'eq', value: 'scheduled' },
    ];
    mocks.getAutomations.mockResolvedValue([{ ...booking, workflow_definition_json: workflow }]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messaging/email/automations/1');
    expect(screen.queryByText('Editor edit')).not.toBeInTheDocument();
  });

  it('shows dated historical failure without a current Fix label and keeps its details', async () => {
    mocks.getAutomations.mockResolvedValue([{ ...booking, updated_at: '2026-09-27T04:59:11Z', recent_runs: [failedRun] }]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Previous run failed/)).toBeInTheDocument();
    expect(screen.getByText('Updated since this failed run; awaiting next run.')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-09-15T13:00:04.000Z');
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fix' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Needs a fix')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Run needs attention')).not.toBeInTheDocument();
    await user.click(screen.getByText('View run history'));
    expect(screen.getByText(failedRun.error_message!)).toBeVisible();
  });

  it('keeps a current failure visible and flagged even without an error message', async () => {
    mocks.getAutomations.mockResolvedValue([{ ...booking, updated_at: '2026-09-15T12:00:00Z', recent_runs: [{ ...failedRun, error_message: null }] }]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Last run failed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Run needs attention')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Booking moment — run needs attention' })).toBeInTheDocument();
    expect(screen.queryByText(/awaiting next run/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    await user.click(screen.getByText('View run history'));
    expect(screen.getByText('This run failed without an error message.')).toBeVisible();
  });

  it('keeps current validation actionable even when errors are empty and the failure is old', async () => {
    mocks.getAutomations.mockResolvedValue([{ ...booking, updated_at: '2026-09-27T04:59:11Z', recent_runs: [failedRun], validation_state: { valid: false, errors: [] } }]);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Fix' })).toBeInTheDocument();
    expect(screen.getByText('This workflow needs a configuration fix.')).toBeInTheDocument();
    expect(screen.getByLabelText('Needs a fix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Booking moment — needs a fix' })).toBeInTheDocument();
    expect(screen.getByText(/Previous run failed/)).toBeInTheDocument();
  });

  it('shows the latest active failure first and preserves older failures in history', async () => {
    const resumedRun = { ...failedRun, id: 858, completed_at: '2026-09-28T05:00:00Z', updated_at: '2026-09-28T05:00:00Z' };
    mocks.getAutomations.mockResolvedValue([{ ...booking, updated_at: '2026-09-27T04:59:11Z', recent_runs: [failedRun, resumedRun] }]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Last run failed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Run needs attention')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-09-28T05:00:00.000Z');
    await user.click(screen.getByText('View run history'));
    expect(screen.getByText(/Run #858/)).toBeVisible();
    expect(screen.getByText(/Run #857/)).toBeVisible();
  });

  it('does not call an undated failure the last run beside a dated newer success', async () => {
    const success = { ...failedRun, id: 858, status: 'completed', completed_at: '2026-09-28T05:00:00Z', updated_at: '2026-09-28T05:00:00Z', error_message: null };
    mocks.getAutomations.mockResolvedValue([{ ...booking, updated_at: '2026-09-27T04:59:11Z', recent_runs: [success, { ...failedRun, completed_at: null }] }]);
    renderPage();
    expect(await screen.findByText(/Failed run; timing needs review/)).toBeInTheDocument();
    expect(screen.queryByText(/Last run failed/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Booking moment — run needs attention' })).toBeInTheDocument();
  });
});
