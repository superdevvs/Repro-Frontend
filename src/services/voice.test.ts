import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api';
import { placeVoiceCall } from './voice';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('placeVoiceCall', () => {
  it('posts the outbound Telnyx call payload to the provider-neutral endpoint', async () => {
    const payload = {
      to: '+12025550123',
      from: '+18888041663',
      assistant_mode: 'robbie_ai',
      source: 'test_call_dialog',
      dynamic_variables: {
        reason: 'Canary verification',
        source: 'calls_dashboard_test_call',
      },
    };
    const call = { id: 42, provider: 'telnyx', status: 'queued' };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: call } as never);

    await expect(placeVoiceCall(payload)).resolves.toEqual(call);
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/voice/calls/outbound', payload);
  });
});
