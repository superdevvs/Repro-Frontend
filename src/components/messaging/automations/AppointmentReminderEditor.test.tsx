import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { updateAutomation } from '@/services/messaging';
import type { AutomationRule } from '@/types/messaging';
import { createDefaultDraft } from './automationEditorModel';
import { buildSimpleWorkflowFromDraft } from './workflow-utils';
import { AutomationEditorDialog } from './AutomationEditorDialog';

vi.mock('@/services/messaging', () => ({
  getTemplates: vi.fn().mockResolvedValue([{ id: 4, name: 'Shoot reminder', channel: 'EMAIL', is_active: true }]),
  getEmailSettings: vi.fn().mockResolvedValue({ channels: [] }),
  getSmsSettings: vi.fn().mockResolvedValue({ numbers: [] }),
  createAutomation: vi.fn(), updateAutomation: vi.fn().mockResolvedValue({}),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('saves the client calendar times without replacing staff timing or recipients', async () => {
  const schedule = {
    offset: '-24h',
    client_email_schedule: {
      previous_day_time: '07:00', day_of_time: '07:00', morning_start: '07:00', morning_end: '12:00',
      morning_previous_evening_time: '19:00', morning_lead_minutes: 120,
    },
  };
  const workflow = buildSimpleWorkflowFromDraft({ ...createDefaultDraft(), name: 'Shoot reminder', trigger_type: 'SHOOT_REMINDER', template_id: '4', recipient_roles: ['client', 'photographer'], schedule_json: schedule });
  const rule = { id: 17, name: 'Shoot reminder', trigger_type: 'SHOOT_REMINDER', scope: 'SYSTEM', is_active: true, workflow_definition_json: workflow, template_id: 4, schedule_json: schedule } as AutomationRule;
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AutomationEditorDialog automation={rule} mode="edit" open onClose={vi.fn()} onSuccess={vi.fn()} />
  </QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText('Day before shoot'), { target: { value: '07:30' } });
  fireEvent.change(screen.getByLabelText('Morning appointments: minutes before'), { target: { value: '90' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and open workflow' }));
  await waitFor(() => expect(updateAutomation).toHaveBeenCalledOnce());
  const payload = vi.mocked(updateAutomation).mock.calls[0][1];
  expect(payload.schedule_json).toEqual({ ...schedule, client_email_schedule: { ...schedule.client_email_schedule, previous_day_time: '07:30', morning_lead_minutes: 90 } });
  expect(payload.recipients_json).toEqual(['client', 'photographer']);
  expect(payload.entry_trigger_json?.config?.schedule).toEqual(payload.schedule_json);
});
