import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceAutomationBuilder } from './VoiceAutomationBuilder';
import { VoiceAutomationEditor } from './VoiceAutomationEditor';
import type { VoiceAutomationRule } from '@/services/voiceAutomations';

const mocks = vi.hoisted(() => ({
  getVoiceAutomationRules: vi.fn(), getVoiceAutomationRuns: vi.fn(), saveVoiceAutomationRule: vi.fn(),
  toggleVoiceAutomationRule: vi.fn(), archiveVoiceAutomationRule: vi.fn(), previewVoiceAutomationRule: vi.fn(),
  updateVoiceAutomationTask: vi.fn(), can: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/services/voiceAutomations', () => ({ ...mocks, automationError: (error: Error) => error.message }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const rule: VoiceAutomationRule = {
  id: 1, name: 'Review missed call', trigger_type: 'missed_call_callback', enabled: true, conditions: [], delay_minutes: 60,
  quiet_hours: { enabled: true, start: '20:00', end: '08:00', timezone: 'UTC' }, max_attempts: 3, retry_delay_minutes: 60,
  action_type: 'internal_task', action_config: { task_title: 'Confirm the new gate code' }, created_at: '', updated_at: '',
};
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;

describe('Voice automation builder', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    mocks.can.mockReturnValue(true);
    mocks.getVoiceAutomationRules.mockResolvedValue({ rules: [rule], managed_triggers: ['missed_call_callback'], assignees: [] });
    mocks.getVoiceAutomationRuns.mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 });
    mocks.saveVoiceAutomationRule.mockResolvedValue(rule);
    mocks.toggleVoiceAutomationRule.mockResolvedValue(rule);
    mocks.updateVoiceAutomationTask.mockResolvedValue({ id: 4, status: 'completed' });
    mocks.previewVoiceAutomationRule.mockResolvedValue({ would_run: true, action_type: 'internal_task', scheduled_at: '2026-09-22T08:00:00Z', quiet_hours_adjusted: true, checks: [], notice: 'Nothing saved or sent.' });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it('runs a fictional preview without invoking save or toggle and clears it when edited', async () => {
    const user = userEvent.setup();
    render(<VoiceAutomationEditor rule={rule} assignees={[]} onClose={vi.fn()} onSaved={vi.fn()} />, { wrapper });
    await user.click(screen.getByText('Preview with a fictional example'));
    await user.click(screen.getByRole('button', { name: 'Run preview' }));
    expect(await screen.findByText('This example matches the rule')).toBeInTheDocument();
    expect(mocks.previewVoiceAutomationRule.mock.calls[0][0]).toMatchObject({ rule: { id: 1, action_type: 'internal_task' }, sample: { target_phone: '+12025550124' } });
    expect(mocks.saveVoiceAutomationRule).not.toHaveBeenCalled();
    expect(mocks.toggleVoiceAutomationRule).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Rule name'), ' updated');
    expect(screen.queryByText('This example matches the rule')).not.toBeInTheDocument();
  });

  it('creates a disabled task rule with timing and conditions in one explicit save', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(<VoiceAutomationEditor assignees={[{ id: 8, name: 'Jamie' }]} onClose={vi.fn()} onSaved={saved} />, { wrapper });
    await user.type(screen.getByLabelText('Rule name'), 'Review customer follow-up');
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(screen.getByRole('button', { name: 'Create an internal task' }));
    await user.type(screen.getByLabelText('Task title'), 'Confirm property access');
    await user.selectOptions(screen.getByLabelText('Assign to'), '8');
    await user.click(screen.getByRole('button', { name: 'Save disabled rule' }));
    await waitFor(() => expect(mocks.saveVoiceAutomationRule).toHaveBeenCalled());
    expect(mocks.saveVoiceAutomationRule.mock.calls[0][0]).toMatchObject({ draft: {
      enabled: false, conditions: [{ field: 'known_caller', operator: 'eq', value: true }], delay_minutes: 60,
      action_type: 'internal_task', action_config: { task_title: 'Confirm property access', assigned_to_user_id: 8 },
    } });
    expect(saved).toHaveBeenCalled();
  });

  it('keeps a save error in the editor and never reports success', async () => {
    const user = userEvent.setup();
    mocks.saveVoiceAutomationRule.mockRejectedValue(new Error('Choose a valid timezone.'));
    const saved = vi.fn();
    render(<VoiceAutomationEditor rule={rule} assignees={[]} onClose={vi.fn()} onSaved={saved} />, { wrapper });
    await user.click(screen.getByRole('button', { name: 'Save enabled rule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid timezone.');
    expect(saved).not.toHaveBeenCalled();
  });

  it('preserves the task draft on a repeated action click and when switching away and back', async () => {
    const user = userEvent.setup();
    render(<VoiceAutomationEditor rule={rule} assignees={[{ id: 8, name: 'Jamie' }]} onClose={vi.fn()} onSaved={vi.fn()} />, { wrapper });
    await user.selectOptions(screen.getByLabelText('Assign to'), '8');
    await user.click(screen.getByRole('button', { name: 'Create an internal task' }));
    expect(screen.getByLabelText('Task title')).toHaveValue('Confirm the new gate code');
    expect(screen.getByLabelText('Assign to')).toHaveValue('8');
    await user.click(screen.getByRole('button', { name: 'Queue an AI callback' }));
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create an internal task' }));
    expect(screen.getByLabelText('Task title')).toHaveValue('Confirm the new gate code');
    expect(screen.getByLabelText('Assign to')).toHaveValue('8');
  });

  it('reuses the same creation key when retrying a save with an unconfirmed response', async () => {
    const user = userEvent.setup();
    mocks.saveVoiceAutomationRule.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce(rule);
    const saved = vi.fn();
    render(<VoiceAutomationEditor assignees={[]} onClose={vi.fn()} onSaved={saved} />, { wrapper });
    await user.type(screen.getByLabelText('Rule name'), 'Call back once');
    await user.click(screen.getByRole('button', { name: 'Save disabled rule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Response lost');
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save disabled rule' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    const first = mocks.saveVoiceAutomationRule.mock.calls[0][0];
    const retry = mocks.saveVoiceAutomationRule.mock.calls[1][0];
    expect(first.creationKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(retry).toEqual(first);
  });

  it('allows an operator to complete a task but not manage workflows', async () => {
    const user = userEvent.setup();
    mocks.can.mockImplementation((_resource: string, action: string) => action !== 'manage');
    mocks.getVoiceAutomationRuns.mockResolvedValue({ data: [{
      id: 2, voice_automation_rule_id: 1, rule_snapshot: rule, effective_status: 'task_open', created_at: '2026-09-21T12:00:00Z',
      context: { voice_call_id: 12 }, task: { id: 4, title: 'Confirm the new gate code', status: 'open', due_at: '2026-09-22T08:00:00Z' },
    }], current_page: 1, last_page: 1, total: 1 });
    render(<VoiceAutomationBuilder />, { wrapper });
    expect(await screen.findByRole('button', { name: 'Complete task' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Build rule' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Enable Review missed call' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Complete task' }));
    await waitFor(() => expect(mocks.updateVoiceAutomationTask).toHaveBeenCalled());
    expect(mocks.updateVoiceAutomationTask.mock.calls[0][0]).toEqual({ id: 4, status: 'completed' });
  });
});
