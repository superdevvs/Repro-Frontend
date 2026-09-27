import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { updateAutomation } from '@/services/messaging';
import type { AutomationRule } from '@/types/messaging';
import { createDefaultDraft } from './automationEditorModel';
import { buildSimpleWorkflowFromDraft } from './workflow-utils';
import { AutomationEditorDialog } from './AutomationEditorDialog';

vi.mock('@/services/messaging', () => ({
  getTemplates: vi.fn().mockResolvedValue([{ id: 4, name: 'Welcome email', channel: 'EMAIL', is_active: true }]),
  getEmailSettings: vi.fn().mockResolvedValue({ channels: [{ id: 1, display_name: 'Studio' }] }),
  getSmsSettings: vi.fn().mockResolvedValue({ numbers: [{ id: 3, phone_number: '+15555550123' }] }),
  createAutomation: vi.fn(),
  updateAutomation: vi.fn(),
}));

function renderDialog(automation: AutomationRule | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AutomationEditorDialog automation={automation} mode={automation ? "edit" : "create"} open onClose={vi.fn()} onSuccess={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('automation sentence form', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('saves edited timing and recipients for a built-in photographer reminder', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Photographer reminder', trigger_type: 'PHOTOGRAPHER_SHOOT_REMINDER', template_id: '4', recipient_roles: ['photographer'], schedule_json: { offset: '-2h' } });
    workflow.meta = { ...workflow.meta, system_default_key: 'photographer-reminder', repair_version: 1 };
    const rule = { id: 17, name: 'Photographer reminder', trigger_type: 'PHOTOGRAPHER_SHOOT_REMINDER', scope: 'SYSTEM', is_system_locked: true, is_active: true, workflow_definition_json: workflow, template_id: 4, schedule_json: { offset: '-2h' } } as AutomationRule;
    vi.mocked(updateAutomation).mockResolvedValue(rule);
    renderDialog(rule);
    expect(await screen.findByRole('button', { name: 'Edit message template' })).toBeInTheDocument();
    expect(screen.getByLabelText('When')).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('Send before shoot (minutes)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Admin team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
    const payload = vi.mocked(updateAutomation).mock.calls[0][1];
    expect(payload).toMatchObject({ scope: 'SYSTEM', is_system_locked: false, recipients_json: ['photographer', 'admin'], schedule_json: { offset: '-90m' } });
    expect(payload.workflow_definition_json?.nodes.some((node) => node.type.startsWith('wait.'))).toBe(false);
    expect(payload.entry_trigger_json?.config?.schedule).toEqual({ offset: '-90m' });
    expect(payload.workflow_definition_json?.meta).toMatchObject({ system_default_key: 'photographer-reminder', repair_version: 1 });
  });

  it('keeps the sentence controls that save a real automation', async () => {
    renderDialog();

    expect(await screen.findByRole('heading', { name: 'New automation' })).toBeInTheDocument();
    expect(screen.getByLabelText('When')).toBeInTheDocument();
    expect(screen.getByLabelText('Sends')).toBeInTheDocument();
    expect(screen.getByText('Who')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText('Only send if')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create and open workflow' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Message' })).toBeInTheDocument();
  });

  it('saves invoice cadence without resetting the selected recipients or template', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Overdue', trigger_type: 'INVOICE_OVERDUE', template_id: '4', schedule_json: { time: '09:30', overdue_days: [1, 3, 7], repeat_every_days: 30 } });
    const rule = { id: 22, name: 'Overdue', trigger_type: 'INVOICE_OVERDUE', scope: 'GLOBAL', is_active: true, workflow_definition_json: workflow } as AutomationRule;
    vi.mocked(updateAutomation).mockResolvedValue(rule);
    renderDialog(rule);
    fireEvent.change(await screen.findByLabelText('Days after due date'), { target: { value: '1, 7, 14' } });
    fireEvent.blur(screen.getByLabelText('Days after due date'));
    fireEvent.change(screen.getByLabelText('Then repeat every (days)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Send time'), { target: { value: '10:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
    expect(vi.mocked(updateAutomation).mock.calls[0][1]).toMatchObject({
      template_id: 4, recipients_json: ['client'],
      schedule_json: { time: '10:15', overdue_days: [1, 7, 14], repeat_every_days: 15 },
    });
  });

  it('preserves the new-account recipient when editing the built-in welcome email', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Account created', trigger_type: 'ACCOUNT_CREATED', template_id: '4', recipient_mode: 'automation_default', recipient_roles: ['account'] });
    const rule = { id: 23, name: 'Account created', trigger_type: 'ACCOUNT_CREATED', scope: 'SYSTEM', is_active: true, recipients_json: ['account'], workflow_definition_json: workflow } as AutomationRule;
    vi.mocked(updateAutomation).mockResolvedValue(rule);
    renderDialog(rule);
    expect(await screen.findByRole('button', { name: 'New account' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
    expect(vi.mocked(updateAutomation).mock.calls[0][1].recipients_json).toEqual(['account']);
  });

  it('lets a one-of status condition save multiple choices from the simple form', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Status update', template_id: '4', use_condition: true, condition_field: 'shoot.status', condition_operator: 'in', condition_value: 'scheduled' });
    const rule = { id: 24, name: 'Status update', trigger_type: 'SHOOT_BOOKED', scope: 'GLOBAL', is_active: true, workflow_definition_json: workflow } as AutomationRule;
    vi.mocked(updateAutomation).mockResolvedValue(rule);
    renderDialog(rule);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Value' }), { target: { value: 'scheduled, completed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
    expect(vi.mocked(updateAutomation).mock.calls[0][1].workflow_definition_json?.nodes.find((node) => node.type === 'condition.if')?.config.rules).toEqual([
      { field: 'shoot.status', operator: 'in', value: ['scheduled', 'completed'] },
    ]);
  });

  it('edits the weekly payout digest address and time without losing its accounting recipient', async () => {
    const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Accounting digest', trigger_mode: 'schedule', trigger_type: 'WEEKLY_PAYOUT_DIGEST', template_id: '4', recipient_roles: ['accounting'], schedule_day_of_week: '0', schedule_time: '05:00', schedule_json: { accounting_email: 'accounts@example.com' } });
    const rule = { id: 25, name: 'Accounting digest', trigger_type: 'WEEKLY_PAYOUT_DIGEST', scope: 'SYSTEM', is_active: true, workflow_definition_json: workflow } as AutomationRule;
    vi.mocked(updateAutomation).mockResolvedValue(rule);
    renderDialog(rule);
    fireEvent.change(await screen.findByLabelText('Accounting email'), { target: { value: 'finance@example.com' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '06:45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
    await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
    expect(vi.mocked(updateAutomation).mock.calls[0][1]).toMatchObject({ scope: 'SYSTEM', recipients_json: ['accounting'], schedule_json: { accounting_email: 'finance@example.com', day_of_week: 0, time: '06:45' } });
  });
});
