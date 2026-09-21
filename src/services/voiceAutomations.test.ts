import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveVoiceAutomationRule, type VoiceAutomationDraft } from './voiceAutomations';

const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock('./api', () => ({ apiClient: mocks }));
const draft: VoiceAutomationDraft = {
  name: 'Review missed calls', trigger_type: 'missed_call_callback', enabled: false, conditions: [], delay_minutes: 60,
  quiet_hours: { enabled: false, start: '20:00', end: '08:00', timezone: 'UTC' }, max_attempts: 3, retry_delay_minutes: 60,
  action_type: 'ai_callback', action_config: {},
};

describe('workflow save transport', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.post.mockResolvedValue({ data: { ...draft, id: 3 } }); mocks.patch.mockResolvedValue({ data: { ...draft, id: 3 } }); });
  it('sends the caller-owned creation key and refuses an unkeyed create', async () => {
    await expect(saveVoiceAutomationRule({ draft })).rejects.toThrow('creation key');
    expect(mocks.post).not.toHaveBeenCalled();
    await saveVoiceAutomationRule({ draft, creationKey: '11111111-1111-4111-8111-111111111111' });
    expect(mocks.post).toHaveBeenCalledWith('/voice/automation-rules', { ...draft, idempotency_key: '11111111-1111-4111-8111-111111111111' });
  });
  it('updates the known rule without creating another rule', async () => {
    await saveVoiceAutomationRule({ id: 3, draft, creationKey: 'unused' });
    expect(mocks.patch).toHaveBeenCalledWith('/voice/automation-rules/3', draft);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
