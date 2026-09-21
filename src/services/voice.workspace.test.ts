import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { addVoiceCallNote, getVoiceInsights, wrapUpVoiceCall } from './voice';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('voice workspace APIs', () => {
  it('saves wrap-up without inventing a task model', async () => {
    const payload = {
      recap_title: 'Access issue identified.',
      recap_body: 'Gate code no longer works.',
      create_task: true,
      task_title: 'Confirm the new gate code',
      send_sms: false,
      sms_body: 'Draft only',
    };
    const call = { id: 12, metadata: { wrap_up: { sms_sent: false } } };
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: call } as never);

    await expect(wrapUpVoiceCall(12, payload)).resolves.toEqual(call);
    expect(patch).toHaveBeenCalledWith('/voice/calls/12/wrap-up', payload);
  });

  it('posts a private note and loads insights for a range', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 12 } } as never);
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { inbound_total: 3, answered_rate_delta: null } } as never);

    await addVoiceCallNote(12, 'Prefers text');
    await expect(getVoiceInsights('7d')).resolves.toEqual({ inbound_total: 3, answered_rate_delta: null });
    expect(post).toHaveBeenCalledWith('/voice/calls/12/note', { body: 'Prefers text' });
    expect(get).toHaveBeenCalledWith('/voice/calls/insights', { params: { range: '7d' } });
  });
});
