import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));

vi.mock('./api', () => ({
  apiClient: { get: getMock, post: postMock },
}));

import { getNotificationRecipients, previewManualNotification } from './messaging';

describe('getNotificationRecipients', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('requests and preserves the assigned sales rep recipient type', async () => {
    getMock.mockResolvedValue({ data: { shoot_id: 149, recipients: [{ id: 9, name: 'Alex Sales', recipient_type: 'rep' }] } });
    const result = await getNotificationRecipients(149, 'rep');
    expect(getMock).toHaveBeenCalledWith('/messaging/notifications/recipients', { params: { shoot_id: 149, recipient_type: 'rep' } });
    expect(result.recipients).toEqual([expect.objectContaining({ id: 9, name: 'Alex Sales', recipient_type: 'rep' })]);
  });

  it('returns mapped recipients on success', async () => {
    getMock.mockResolvedValue({
      data: {
        shoot_id: 149,
        recipients: [
          { id: 1163, name: 'Lee', email: 'lee@example.test', recipient_type: 'photographer' },
        ],
      },
    });
    await expect(getNotificationRecipients(149)).resolves.toEqual({
      shoot_id: 149,
      recipients: [{
        id: 1163,
        name: 'Lee',
        email: 'lee@example.test',
        phone: null,
        role: null,
        recipient_type: 'photographer',
      }],
    });
  });

  it('soft-fails 403/401 to an empty roster (no throw for sales_rep)', async () => {
    getMock.mockRejectedValue({ response: { status: 403, data: { message: "I don't have permission." } } });
    await expect(getNotificationRecipients(149)).resolves.toEqual({
      shoot_id: 149,
      recipients: [],
    });

    getMock.mockRejectedValue({ publicError: { status: 401, message: 'Please sign in to continue.' } });
    await expect(getNotificationRecipients(149)).resolves.toEqual({
      shoot_id: 149,
      recipients: [],
    });
  });

  it('rethrows unexpected errors', async () => {
    getMock.mockRejectedValue({ response: { status: 500, data: { message: 'boom' } } });
    await expect(getNotificationRecipients(149)).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});


describe('manual notification preview recipients', () => {
  it('preserves the type-specific recipient roster returned by the preview', async () => {
    const recipients = [{ id: 22, name: 'Current assignee', phone: '2025550122', recipient_type: 'photographer' }];
    const preview = { subject: 'On hold', body_text: 'Hold details', body_html: null, missing_variables: [], recipients };
    postMock.mockResolvedValue({ data: preview });
    const payload = { shoot_id: 149, type: 'shoot_on_hold', recipient_type: 'photographer', channel: 'sms' } as const;
    expect(await previewManualNotification(payload)).toEqual(preview);
    expect(postMock).toHaveBeenCalledWith('/messaging/notifications/manual-preview', payload);
  });
});
